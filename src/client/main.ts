// src/client/main.ts
import { connect, joinRoom } from "./network/socket.js";
import { createHomeScreen } from "./screens/homeScreen.js";
import { createMatchScreen } from "./screens/matchScreen.js";
import { createLoadingScreen } from "./screens/loadingScreen.js";
import { createCardsPage, createGuidePage } from "./screens/tutorialScreen.js";
import { pathAfterRoomExit, resolveRoute, routePath } from "./screens/routes.js";
import { createWaitingRoomScreen } from "./screens/waitingRoomScreen.js";
import type { Screen } from "./screens/dom.js";
import { getState, loadNickname, subscribe } from "./state.js";

const root = document.getElementById("app") as HTMLElement;

/** Código da sala na URL `/sala/CODIGO`, ou null em qualquer outra rota. */
const codeFromUrl = (): string | null => {
  const route = resolveRoute(location.pathname);
  return route.page === "room" ? route.code : null;
};

let currentKey = "";
let current: Screen | null = null;
let autoJoinTried = false;
let hadRoom = false;

const render = () => {
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
    key = "loading";
    create = createLoadingScreen;
  } else if (state.room) {
    // O primeiro match:state (ou o de uma reconexão) abre a mesa; sem partida, sala de espera.
    key = state.match ? "match" : "waiting";
    create = state.match ? createMatchScreen : createWaitingRoomScreen;
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
    if (code && nickname && !autoJoinTried && state.connection === "online") {
      autoJoinTried = true;
      joinRoom(code, nickname);
    }
  }

  if (key !== currentKey) {
    currentKey = key;
    current?.destroy?.();
    current = create();
    root.replaceChildren(current.element);
  } else {
    current?.update();
  }
};

subscribe(render);
// Voltar/avançar do navegador (e os links internos) redesenham a página sem recarregar.
window.addEventListener("popstate", render);
render();
connect();
