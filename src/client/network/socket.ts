// src/client/network/socket.ts
import { io } from "socket.io-client";
import type { EventView } from "../../engine/eventView.js";
import type { DeckId } from "../../engine/decks.js";
import type { AiLevel } from "../../engine/index.js";
import type { PlayerView } from "../../engine/playerView.js";
import type { Action } from "../../engine/types.js";
import { aiRoomPayload } from "../screens/aiDuel.js";
import { asDeckId } from "../screens/deckSelect.js";
import { rematchPayload } from "../screens/matchEnd.js";
import { showErrorCode, showErrorMessage } from "../screens/toasts.js";
import { createTurnClock, turnNotice } from "../screens/turnTimer.js";
import { clearToken, getState, loadToken, lobbyRoomsFromPayload, matchForRoom, saveToken, setState, type MatchEnded, type PublicRoom } from "../state.js";

type RoomReply = { room: PublicRoom; token: string; deckId?: unknown };

const socket = io({ autoConnect: false });

/** A home quer a lista de salas; usado para reassinar após reconexão. */
let lobbyWanted = false;

const applyReply = ({ room, token, deckId }: RoomReply): void => {
  saveToken(token);
  const match = matchForRoom(room, getState().match);
  setState({ room, match, ended: match ? getState().ended : null, busy: false, booting: false, deckId: deckId === undefined && room.vsAi ? getState().deckId : asDeckId(deckId) });
};

/** Liga os eventos do servidor ao estado e abre a conexão. Chamar uma única vez. */
export const connect = (): void => {
  socket.on("connect", () => {
    setState({ connection: "online" });
    // Reconexão por token: ao carregar a página ou ao voltar a conexão.
    const token = loadToken();
    if (token) socket.emit("room:rejoin", { token });
    else setState({ booting: false });
    // A assinatura do lobby se perde com a conexão; reassina se a home ainda a quer.
    if (lobbyWanted) socket.emit("lobby:subscribe");
  });

  socket.on("disconnect", () => {
    setState({ connection: "offline" });
    showErrorMessage("Conexão com o servidor perdida. Tentando reconectar...");
  });
  socket.on("connect_error", () => showErrorMessage("Não foi possível conectar ao servidor."));
  socket.io.on("reconnect_attempt", () => setState({ connection: "connecting" }));

  socket.on("lobby:rooms", (payload: unknown) => setState({ lobbyRooms: lobbyRoomsFromPayload(payload) }));

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
      setState({ match: view, turnClock, turnNotice: notice, matchEvents: { seq: (previous.matchEvents?.seq ?? 0) + 1, events: events ?? [] }, ended: view.winner ? previous.ended : null });
    },
  );
  socket.on("match:ended", (ended: MatchEnded) => setState({ ended }));

  socket.on("app:error", ({ event, code }: { event: string; code: string }) => {
    if (event === "room:rejoin" && code === "INVALID_TOKEN") {
      // Sala removida ou token antigo: volta ao estado sem sala, sem exibir erro.
      clearToken();
      setState({ room: null, match: null, turnClock: null, turnNotice: null, matchEvents: null, ended: null, booting: false, busy: false, deckId: null });
      return;
    }
    showErrorCode(code);
    setState({ busy: false, booting: false });
  });

  socket.connect();
};

/** Assina a lista de salas abertas (`lobby:subscribe`); reassinada sozinha após reconexão. */
export const subscribeLobby = (): void => {
  lobbyWanted = true;
  if (socket.connected) socket.emit("lobby:subscribe");
};

/** Cancela a assinatura da lista de salas (`lobby:unsubscribe`). */
export const unsubscribeLobby = (): void => {
  lobbyWanted = false;
  if (socket.connected) socket.emit("lobby:unsubscribe");
  setState({ lobbyRooms: [] });
};

export const createRoom = (nickname: string): void => {
  setState({ busy: true });
  socket.emit("room:create", { nickname });
};

/** Cria uma sala contra a IA (`room:createAi`); a partida abre com o `match:state` seguinte. Combinação inválida não envia. */
export const createAiRoom = (nickname: string, level: AiLevel, deckId: DeckId): void => {
  const payload = aiRoomPayload({ nickname, level, deckId });
  if (!payload) return;
  setState({ busy: true, deckId });
  socket.emit("room:createAi", payload);
};

export const joinRoom = (code: string, nickname: string): void => {
  setState({ busy: true });
  socket.emit("room:join", { code, nickname });
};

export const leaveRoom = (): void => {
  socket.emit("room:leave");
  clearToken();
  setState({ room: null, match: null, turnClock: null, turnNotice: null, matchEvents: null, ended: null, deckId: null });
};

/** Marca o jogador como pronto com o deck escolhido (`room:ready`). */
export const sendReady = (deckId: DeckId): void => {
  setState({ deckId });
  socket.emit("room:ready", { deckId });
};

/** Envia uma jogada (`match:action`); quem decide o resultado é o servidor. */
export const sendAction = (action: Action): void => {
  socket.emit("match:action", action);
};

/** Vota por revanche com o deck escolhido ou retira o voto (limpando a escolha). Sem deck, não envia voto. */
export const sendRematch = (accept: boolean, deckId: DeckId | null): void => {
  const payload = rematchPayload(accept, deckId);
  if (!payload) return;
  setState({ deckId: accept ? deckId : null });
  socket.emit("match:rematch", payload);
};
