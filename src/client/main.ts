// src/client/main.ts
import { connect, joinRoom } from "./network/socket.js";
import { createHomeScreen } from "./screens/homeScreen.js";
import { createMatchScreen } from "./screens/matchScreen.js";
import { createLoadingScreen } from "./screens/loadingScreen.js";
import { createWaitingRoomScreen } from "./screens/waitingRoomScreen.js";
import type { Screen } from "./screens/dom.js";
import { getState, loadNickname, subscribe } from "./state.js";

const root = document.getElementById("app") as HTMLElement;

/** Código da sala na URL `/sala/CODIGO`, ou null em qualquer outra rota. */
const codeFromUrl = (): string | null => {
  const match = /^\/sala\/([A-Za-z0-9]{4})\/?$/.exec(location.pathname);
  return match ? match[1].toUpperCase() : null;
};

let currentKey = "";
let current: Screen | null = null;
let autoJoinTried = false;

const render = () => {
  const state = getState();
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
    if (location.pathname !== "/" && !urlCode) history.replaceState(null, "", "/");
    const code = codeFromUrl();
    key = `home:${code ?? ""}`;
    create = () => createHomeScreen(code);
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
render();
connect();
