// src/client/network/socket.ts
import { io } from "socket.io-client";
import type { PlayerView } from "../../engine/playerView.js";
import type { Action } from "../../engine/types.js";
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
  socket.on("match:state", ({ view }: { view: PlayerView }) =>
    // Partida em andamento (inclusive a revanche) não tem resultado; o erro anterior perde o sentido.
    setState({ match: view, ended: view.winner ? getState().ended : null, errorCode: null }),
  );
  socket.on("match:ended", (ended: MatchEnded) => setState({ ended }));

  socket.on("app:error", ({ event, code }: { event: string; code: string }) => {
    if (event === "room:rejoin" && code === "INVALID_TOKEN") {
      // Sala removida ou token antigo: volta ao estado sem sala, sem exibir erro.
      clearToken();
      setState({ room: null, match: null, ended: null, booting: false, busy: false });
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
  setState({ room: null, match: null, ended: null, errorCode: null });
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
