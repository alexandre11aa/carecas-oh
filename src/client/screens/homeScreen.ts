// src/client/screens/homeScreen.ts
import { CARD_BACK_PATH } from "../scene/texturePaths.js";
import { createRoom, joinRoom, subscribeLobby, unsubscribeLobby } from "../network/socket.js";
import { getState, loadNickname, saveNickname } from "../state.js";
import { el, type Screen } from "./dom.js";
import { errorMessage } from "./errorMessages.js";
import { NICKNAME_HINT, canSubmitNickname } from "./nickname.js";
import { createTutorialLinks } from "./tutorialScreen.js";

const DECO_FRONT_PATH = "/cards/esquiva_da_gloria_divina.png";

/** Carta decorativa inclinada. O fundo em CSS é o fallback: a imagem carrega sem bloquear e some se falhar. */
const createDecoCard = (className: string, src: string): HTMLElement => {
  const card = el("div", `deco-card ${className}`);
  card.setAttribute("aria-hidden", "true");
  const image = el("img");
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.loading = "lazy";
  image.decoding = "async";
  image.draggable = false;
  image.addEventListener("error", () => image.remove());
  image.src = src;
  card.append(image);
  return card;
};

/** Painel temático com título opcional. */
const createPanel = (title: string | null, ...children: HTMLElement[]): HTMLElement => {
  const panel = el("section", "panel");
  if (title) panel.append(el("h2", "panel-title", title));
  panel.append(...children);
  return panel;
};

/** Tela inicial. Com `presetCode` (rota /sala/CODIGO) mostra só a entrada na sala indicada. */
export const createHomeScreen = (presetCode: string | null): Screen => {
  const home = el("div", presetCode ? "home home--invite" : "home home--lobby");
  const element = el("main", "screen");
  home.append(element);
  const hero = el("header", "hero");
  hero.append(
    createDecoCard("deco-left", CARD_BACK_PATH),
    createDecoCard("deco-right", DECO_FRONT_PATH),
    el("h1", "game-title", "Carecas Oh"),
    ...(presetCode ? [el("p", "hero-subtitle", `Você foi convidado para a sala ${presetCode}.`)] : []),
  );
  element.append(hero);

  const nicknameInput = el("input");
  nicknameInput.placeholder = "Seu apelido";
  nicknameInput.maxLength = 20;
  nicknameInput.value = loadNickname();
  nicknameInput.setAttribute("aria-label", "Apelido");

  const codeInput = el("input");
  codeInput.placeholder = "Código da sala";
  codeInput.maxLength = 4;
  codeInput.setAttribute("aria-label", "Código da sala");

  const nicknameHint = el("p", "hint", NICKNAME_HINT);

  const createButton = el("button", "primary", "Criar duelo");
  const joinButton = el("button", presetCode ? "primary" : undefined, presetCode ? `Entrar na sala ${presetCode}` : "Entrar");
  const error = el("p", "error");
  error.setAttribute("role", "alert");

  const readNickname = (): string | null => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      error.textContent = "Informe um apelido.";
      nicknameInput.focus();
      return null;
    }
    saveNickname(nickname);
    return nickname;
  };

  const submitCreate = () => {
    const nickname = readNickname();
    if (nickname) createRoom(nickname);
  };

  const submitJoin = () => {
    const nickname = readNickname();
    if (!nickname) return;
    const code = (presetCode ?? codeInput.value).trim().toUpperCase();
    if (!code) {
      error.textContent = "Informe o código da sala.";
      codeInput.focus();
      return;
    }
    joinRoom(code, nickname);
  };

  createButton.addEventListener("click", submitCreate);
  joinButton.addEventListener("click", submitJoin);
  nicknameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") (presetCode ? submitJoin : submitCreate)();
  });
  codeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitJoin();
  });

  element.append(createPanel("Duelista", nicknameInput, nicknameHint));
  // Lista de salas abertas: só na home geral, não no convite /sala/CODIGO.
  const lobbyList = el("ul", "lobby-list");
  const lobbyEmpty = el("p", "hint", "Nenhuma sala aberta no momento");
  if (presetCode) {
    element.append(createPanel(null, joinButton, error));
  } else {
    const joinRow = el("div", "join-row");
    joinRow.append(codeInput, joinButton);
    const newDuel = createPanel("Novo duelo", createButton, el("p", "hint divider", "ou entre com um código"), joinRow, error);
    newDuel.classList.add("lobby-new");
    const openRooms = createPanel("Salas abertas", lobbyEmpty, lobbyList);
    openRooms.classList.add("lobby-open");
    const block = el("div", "lobby-block");
    block.append(newDuel, openRooms);
    element.append(block);
  }

  let renderedRooms: unknown = null;
  const renderLobby = () => {
    const { lobbyRooms, busy } = getState();
    const nicknameOk = canSubmitNickname(nicknameInput.value);
    if (lobbyRooms !== renderedRooms) {
      renderedRooms = lobbyRooms;
      lobbyEmpty.hidden = lobbyRooms.length > 0;
      lobbyList.replaceChildren(
        ...lobbyRooms.map((room) => {
          const item = el("li", "lobby-item");
          const join = el("button", undefined, "Entrar");
          join.setAttribute("aria-label", `Entrar na sala ${room.code} de ${room.hostNickname}`);
          join.addEventListener("click", () => {
            const nickname = readNickname();
            if (nickname) joinRoom(room.code, nickname);
          });
          item.append(el("span", "lobby-code", room.code), el("span", "lobby-host", room.hostNickname), join);
          return item;
        }),
      );
    }
    lobbyList.querySelectorAll("button").forEach((button) => (button.disabled = busy || !nicknameOk));
  };

  const update = () => {
    const { busy, errorCode } = getState();
    const nicknameOk = canSubmitNickname(nicknameInput.value);
    createButton.disabled = busy || !nicknameOk;
    joinButton.disabled = busy || !nicknameOk;
    nicknameHint.hidden = nicknameOk;
    if (errorCode) error.textContent = errorMessage(errorCode);
    else if (busy) error.textContent = "";
    if (!presetCode) renderLobby();
  };
  nicknameInput.addEventListener("input", update);
  update();
  if (presetCode) return { element: home, update };
  subscribeLobby();
  // Menu para guia e cartas: abaixo do bloco, só na home geral.
  element.append(createTutorialLinks());
  return {
    element: home,
    update,
    destroy: unsubscribeLobby,
  };
};
