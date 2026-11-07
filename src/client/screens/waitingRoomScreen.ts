// src/client/screens/waitingRoomScreen.ts
import { leaveRoom, sendReady } from "../network/socket.js";
import { getState } from "../state.js";
import type { DeckId } from "../../engine/decks.js";
import { asDeckId, canMarkReady, deckOptions, selectDeck } from "./deckSelect.js";
import { el, type Screen } from "./dom.js";
import { errorMessage } from "./errorMessages.js";

export const roomLink = (code: string): string => `${location.origin}/sala/${code}`;

/** Sala de espera: código, link, jogadores presentes e botão "Pronto". */
export const createWaitingRoomScreen = (): Screen => {
  const element = el("main", "screen themed");
  const code = el("p", "room-code");
  const link = el("p", "hint");
  const copyCode = el("button", undefined, "Copiar código");
  const copyLink = el("button", undefined, "Copiar link");
  const copyRow = el("div", "row");
  copyRow.append(copyCode, copyLink);
  const players = el("ul", "players");
  const status = el("p", "hint");
  const deckTitle = el("h2", "deck-title", "Escolha seu deck");
  const deckGroup = el("div", "deck-select");
  deckGroup.setAttribute("role", "group");
  deckGroup.setAttribute("aria-label", "Escolha seu deck");
  const deckButtons = new Map<DeckId, HTMLButtonElement>();
  const readyButton = el("button", "primary", "Pronto");
  const leaveButton = el("button", undefined, "Sair da sala");
  const error = el("p", "error");
  error.setAttribute("role", "alert");
  element.append(el("h1", undefined, "Sala de espera"), code, link, copyRow, players, deckTitle, deckGroup, status, readyButton, leaveButton, error);

  let sent = false;
  let selected: DeckId | null = asDeckId(getState().deckId);

  for (const option of deckOptions()) {
    const button = el("button", "deck-option");
    button.type = "button";
    button.setAttribute("aria-label", option.label);
    const image = el("img", "deck-image");
    image.alt = "";
    image.src = option.image;
    // Sem a imagem, o nome em texto continua identificando o deck.
    image.addEventListener("error", () => image.remove());
    button.append(image, el("span", "deck-name", option.name));
    button.addEventListener("click", () => {
      selected = selectDeck(selected, option.id, sent);
      update();
    });
    deckButtons.set(option.id, button);
    deckGroup.append(button);
  }

  const copy = async (button: HTMLButtonElement, label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copiado!";
    } catch {
      button.textContent = "Não foi possível copiar";
    }
    setTimeout(() => (button.textContent = label), 1500);
  };
  copyCode.addEventListener("click", () => {
    const room = getState().room;
    if (room) void copy(copyCode, "Copiar código", room.code);
  });
  copyLink.addEventListener("click", () => {
    const room = getState().room;
    if (room) void copy(copyLink, "Copiar link", roomLink(room.code));
  });
  readyButton.addEventListener("click", () => {
    if (!selected) return;
    sent = true;
    sendReady(selected);
    update();
  });
  leaveButton.addEventListener("click", leaveRoom);

  const update = () => {
    const { room, errorCode, connection } = getState();
    if (!room) return;
    code.textContent = room.code;
    link.textContent = roomLink(room.code);
    players.replaceChildren(
      ...room.players.map((player) => {
        const suffix = !player.connected ? " (desconectado)" : player.ready ? " (pronto)" : "";
        return el("li", player.connected ? "" : "offline", `${player.nickname}${suffix}`);
      }),
    );
    const full = room.players.length >= 2;
    status.textContent =
      connection !== "online"
        ? "Reconectando ao servidor..."
        : full
          ? 'Os dois jogadores estão na sala. Marque "Pronto" para começar.'
          : "Aguardando o segundo jogador. Compartilhe o código ou o link.";
    // Escolha restaurada pelo servidor após reconexão, se o jogador ainda não escolheu nada.
    selected ??= asDeckId(getState().deckId);
    for (const [id, button] of deckButtons) {
      const active = id === selected;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("selected", active);
      button.disabled = sent;
    }
    readyButton.textContent = sent ? "Pronto! Aguardando o oponente..." : "Pronto";
    readyButton.disabled = !canMarkReady({ full, online: connection === "online", deckId: selected, ready: sent });
    error.textContent = errorCode ? errorMessage(errorCode) : "";
  };
  update();
  return { element, update };
};
