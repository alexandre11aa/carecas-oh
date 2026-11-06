// src/client/screens/waitingRoomScreen.ts
import { leaveRoom, sendReady } from "../network/socket.js";
import { getState } from "../state.js";
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
  const readyButton = el("button", "primary", "Pronto");
  const leaveButton = el("button", undefined, "Sair da sala");
  const error = el("p", "error");
  error.setAttribute("role", "alert");
  element.append(el("h1", undefined, "Sala de espera"), code, link, copyRow, players, status, readyButton, leaveButton, error);

  let sent = false;

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
    sent = true;
    sendReady();
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
    readyButton.textContent = sent ? "Pronto! Aguardando o oponente..." : "Pronto";
    readyButton.disabled = !full || connection !== "online" || sent;
    error.textContent = errorCode ? errorMessage(errorCode) : "";
  };
  update();
  return { element, update };
};
