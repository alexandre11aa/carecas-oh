// src/client/network/socket.ts
import { io } from "socket.io-client";
import type { PlayerView } from "../../engine/playerView.js";
import { clearToken, getState, loadToken, matchForRoom, saveToken, setState, type PublicRoom } from "../state.js";

type RoomReply = { room: PublicRoom; token: string };

const socket = io({ autoConnect: false });

const applyReply = ({ room, token }: RoomReply): void => {
  saveToken(token);
  setState({ room, match: matchForRoom(room, getState().match), busy: false, booting: false, errorCode: null });
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
  socket.on("match:state", ({ view }: { view: PlayerView }) => setState({ match: view }));

  socket.on("app:error", ({ event, code }: { event: string; code: string }) => {
    if (event === "room:rejoin" && code === "INVALID_TOKEN") {
      // Sala removida ou token antigo: volta ao estado sem sala, sem exibir erro.
      clearToken();
      setState({ room: null, match: null, booting: false, busy: false });
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
  setState({ room: null, match: null, errorCode: null });
};

/** Marca o jogador como pronto (`room:ready`). */
export const sendReady = (): void => {
  socket.emit("room:ready");
};
