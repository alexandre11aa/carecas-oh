// src/client/network/socket.ts
import { io } from "socket.io-client";
import type { EventView } from "../../engine/eventView.js";
import type { PlayerView } from "../../engine/playerView.js";
import type { Action } from "../../engine/types.js";
import { createTurnClock, turnNotice } from "../screens/turnTimer.js";
import { clearToken, getState, loadToken, matchForRoom, saveToken, setState, type MatchEnded, type PublicRoom } from "../state.js";

type RoomReply = { room: PublicRoom; token: string };

const socket = io({ autoConnect: false });

const applyReply = ({ room, token }: RoomReply): void => {
  saveToken(token);
  const match = matchForRoom(room, getState().match);
  setState({ room, match, ended: match ? getState().ended : null, busy: false, booting: false, errorCode: null });
};

/** Liga os eventos do servidor ao estado e abre a conexão. Chamar uma única vez. */
export const connect = (): void => {
  socket.on("connect", () => {
    setState({ connection: "online" });
    // Reconexão por token: ao carregar a página ou ao voltar a conexão.
    const token = loadToken();
    if (token) socket.emit("room:rejoin", { token });
    else setState({ booting: false });
  });

  socket.on("disconnect", () => setState({ connection: "offline" }));
  socket.io.on("reconnect_attempt", () => setState({ connection: "connecting" }));

  socket.on("room:created", applyReply);
  socket.on("room:joined", applyReply);
  socket.on("room:rejoined", applyReply);
  socket.on("room:updated", ({ room }: { room: PublicRoom }) =>
    setState({ room, match: matchForRoom(room, getState().match) }),
  );

  // A visão substitui diretamente o estado anterior (inclusive na reconexão, sem animações).
  socket.on(
    "match:state",
    ({ view, events, turnDeadline, serverNow }: { view: PlayerView; events?: EventView[]; turnDeadline?: number | null; serverNow?: number }) => {
      const previous = getState();
      // Prazo recalculado a cada estado (renova a cada ação válida); usa o desvio com serverNow, não o relógio local absoluto.
      const turnClock = view.winner ? null : createTurnClock(turnDeadline, serverNow, Date.now());
      const text = turnNotice(events ?? [], view.viewer, previous.turnClock, serverNow);
      const notice = text ? { seq: (previous.turnNotice?.seq ?? 0) + 1, text } : previous.turnNotice;
      // Partida em andamento (inclusive a revanche) não tem resultado; o erro anterior perde o sentido.
      setState({ match: view, turnClock, turnNotice: notice, matchEvents: { seq: (previous.matchEvents?.seq ?? 0) + 1, events: events ?? [] }, ended: view.winner ? previous.ended : null, errorCode: null });
    },
  );
  socket.on("match:ended", (ended: MatchEnded) => setState({ ended }));

  socket.on("app:error", ({ event, code }: { event: string; code: string }) => {
    if (event === "room:rejoin" && code === "INVALID_TOKEN") {
      // Sala removida ou token antigo: volta ao estado sem sala, sem exibir erro.
      clearToken();
      setState({ room: null, match: null, turnClock: null, turnNotice: null, matchEvents: null, ended: null, booting: false, busy: false });
      return;
    }
    setState({ errorCode: code, busy: false, booting: false });
  });

  socket.connect();
};

export const createRoom = (nickname: string): void => {
  setState({ busy: true, errorCode: null });
  socket.emit("room:create", { nickname });
};

export const joinRoom = (code: string, nickname: string): void => {
  setState({ busy: true, errorCode: null });
  socket.emit("room:join", { code, nickname });
};

export const leaveRoom = (): void => {
  socket.emit("room:leave");
  clearToken();
  setState({ room: null, match: null, turnClock: null, turnNotice: null, matchEvents: null, ended: null, errorCode: null });
};

/** Marca o jogador como pronto (`room:ready`). */
export const sendReady = (): void => {
  socket.emit("room:ready");
};

/** Envia uma jogada (`match:action`); quem decide o resultado é o servidor. */
export const sendAction = (action: Action): void => {
  setState({ errorCode: null });
  socket.emit("match:action", action);
};

/** Vota por revanche (`accept: true`) ou retira o voto (`accept: false`). */
export const sendRematch = (accept: boolean): void => {
  socket.emit("match:rematch", { accept });
};
