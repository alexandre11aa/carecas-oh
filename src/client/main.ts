// src/client/main.ts
import { connect, joinRoom } from "./network/socket.js";
import { createHomeScreen } from "./screens/homeScreen.js";
import { createMatchScreen } from "./screens/matchScreen.js";
import { createLoadingScreen } from "./screens/loadingScreen.js";
import { shouldShowLoading } from "./screens/loadingTracker.js";
import { pageLoading } from "./screens/pageLoading.js";
import { createCardsPage, createGuidePage } from "./screens/tutorialScreen.js";
import { pathAfterRoomExit, resolveRoute, routePath, shouldAutoJoin } from "./screens/routes.js";
import { mountToasts } from "./screens/toastView.js";
import { createWaitingRoomScreen } from "./screens/waitingRoomScreen.js";
import type { Screen } from "./screens/dom.js";
import { getAppAudio } from "./animations/matchAudio.js";
import { createSoundButton } from "./screens/soundButtonView.js";
import { musicTrackFor } from "./screens/musicTrack.js";
import { playsUiClicks, showsFloatingSoundButton, uiSoundFor } from "./screens/uiSounds.js";
import { getState, loadNickname, roomPage, subscribe } from "./state.js";

const root = document.getElementById("app") as HTMLElement;

/** Código da sala na URL `/sala/CODIGO`, ou null em qualquer outra rota. */
const codeFromUrl = (): string | null => {
  const route = resolveRoute(location.pathname);
  return route.page === "room" ? route.code : null;
};

// O loading cobre a tela inteira por cima da página: some quando o servidor responde e as imagens
// da primeira tela carregam (ou o timeout estoura). Depois disso, navegar não o reabre (exceto ao abrir a mesa).
const loadingScreen = createLoadingScreen();
const loadingOverlay = document.createElement("div");
loadingOverlay.className = "loading-overlay";
loadingOverlay.append(loadingScreen.element);
document.body.append(loadingOverlay);
let initialLoadDone = false;

/** Sala contra a IA entre `room:created` e o primeiro `match:state`: só um aviso, sem sala de espera. */
const createStartingScreen = (): Screen => {
  const element = document.createElement("main");
  element.className = "screen themed";
  const text = document.createElement("p");
  text.className = "hint";
  text.setAttribute("role", "status");
  text.textContent = "Iniciando o duelo...";
  element.append(text);
  return { element, update: () => {} };
};

let rendering = false;

const refreshLoading = () => {
  const booting = getState().booting;
  const show = shouldShowLoading({
    booting,
    pending: pageLoading.pending().length,
    timedOut: pageLoading.expired().length > 0,
    initialDone: initialLoadDone,
  });
  if (!show && !booting) initialLoadDone = true;
  loadingOverlay.hidden = !show;
  loadingScreen.update();
};

let currentKey = "";
// Botão de som fixo das páginas fora da partida (a mesa mostra o mesmo botão no HUD). Persiste entre telas.
const floatingSound = createSoundButton("sound-floating");
floatingSound.element.hidden = true;
document.body.append(floatingSound.element);
const refreshFloatingSound = () => {
  floatingSound.element.hidden = !showsFloatingSoundButton(currentKey);
  floatingSound.refresh();
};
// Música de fundo: faixa decidida por `musicTrackFor` a cada troca de página e ao ligar/desligar o som.
const syncMusic = () => {
  const { match, ended } = getState();
  getAppAudio().setMusic(musicTrackFor({
    key: currentKey,
    soundEnabled: getAppAudio().isEnabled(),
    matchOver: match?.winner != null || ended !== null,
  }));
};
getAppAudio().onEnabledChange(syncMusic);
// Som de clique global: um único ouvinte delegado, decidido por `uiSoundFor` conforme a página aberta.
document.addEventListener("click", (event) => {
  if (!playsUiClicks(currentKey) || !(event.target instanceof Element)) return;
  const node = event.target.closest("button, a, select, summary, input, [role=button]");
  if (!node) return;
  const sound = uiSoundFor({
    tag: node.tagName.toLowerCase(),
    classes: [...node.classList],
    disabled: node.matches(":disabled") || node.getAttribute("aria-disabled") === "true",
    role: node.getAttribute("role"),
    inputType: node instanceof HTMLInputElement ? node.type : null,
  });
  getAppAudio().play(sound);
}, { capture: true });
let current: Screen | null = null;
let autoJoinTried = false;
let hadRoom = false;

const render = () => {
  rendering = true;
  try {
    renderPage();
  } finally {
    rendering = false;
  }
  refreshFloatingSound();
  syncMusic();
  refreshLoading();
};

const renderPage = () => {
  const state = getState();
  // Sair da sala devolve a URL a `/`, para a home aparecer normal (não como convite).
  const exitPath = pathAfterRoomExit(hadRoom, !!state.room, location.pathname);
  if (exitPath) history.replaceState(null, "", exitPath);
  if (!state.booting) hadRoom = !!state.room;
  const route = resolveRoute(location.pathname);
  const urlCode = codeFromUrl();

  let key: string;
  let create: () => Screen;
  if (state.booting) {
    // Sem tela por baixo enquanto o servidor não responde: só o loading.
    current?.destroy?.();
    current = null;
    currentKey = "";
    root.replaceChildren();
    return;
  } else if (state.room) {
    // O primeiro match:state (ou o de uma reconexão) abre a mesa; sem partida, sala de espera.
    const page = roomPage(state.room, state.match);
    key = page;
    create = page === "match" ? createMatchScreen : page === "starting" ? createStartingScreen : createWaitingRoomScreen;
    if (urlCode !== state.room.code) history.replaceState(null, "", `/sala/${state.room.code}`);
  } else {
    // Rota desconhecida (ou fora da forma canônica) volta ao caminho canônico.
    if (location.pathname !== routePath(route)) history.replaceState(null, "", routePath(route));
    const code = urlCode;
    if (route.page === "guide") {
      key = "guide";
      create = createGuidePage;
    } else if (route.page === "cards") {
      key = "cards";
      create = createCardsPage;
    } else {
      key = `home:${code ?? ""}`;
      create = () => createHomeScreen(code);
    }
    // Link de convite com apelido já salvo: entra direto na sala.
    const nickname = loadNickname();
    if (code && shouldAutoJoin({ code, nickname, tried: autoJoinTried, online: state.connection === "online", busy: state.busy })) {
      autoJoinTried = true;
      joinRoom(code, nickname);
    }
  }

  if (key !== currentKey) {
    currentKey = key;
    current?.destroy?.();
    // Ciclo novo de recursos: o timeout da tela anterior não vale para esta (chaves são únicas por imagem).
    pageLoading.reset();
    // A mesa reabre o loading em tela cheia até as texturas críticas carregarem (também ao reconectar).
    if (key === "match") initialLoadDone = false;
    current = create();
    root.replaceChildren(current.element);
  } else {
    current?.update();
  }
};

mountToasts(document.body);
subscribe(render);
// Imagens que terminam (ou o timeout) reavaliam o loading; durante o próprio render ele é reavaliado no fim.
pageLoading.subscribe(() => {
  if (!rendering) refreshLoading();
});
// Voltar/avançar do navegador (e os links internos) redesenham a página sem recarregar.
window.addEventListener("popstate", render);
render();
connect();
