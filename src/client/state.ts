// src/client/state.ts
import type { PlayerView } from "../engine/playerView.js";

export type PublicPlayer = { nickname: string; connected: boolean; ready?: boolean };
export type PublicRoom = { code: string; hasMatch: boolean; players: PublicPlayer[] };

/** Último estado recebido do servidor. Estado visual (campos digitados etc.) fica nas telas. */
export type ClientState = {
  connection: "connecting" | "online" | "offline";
  /** Verdadeiro até o servidor responder à primeira conexão (inclui o rejoin automático). */
  booting: boolean;
  room: PublicRoom | null;
  /** Última visão da partida recebida em `match:state`; null fora de partida. */
  match: PlayerView | null;
  /** Código do último erro recebido (a tela escolhe a mensagem). */
  errorCode: string | null;
  /** Há uma requisição de sala (criar/entrar) aguardando resposta. */
  busy: boolean;
};

let state: ClientState = {
  connection: "connecting",
  booting: true,
  room: null,
  match: null,
  errorCode: null,
  busy: false,
};

/** Partida a manter depois de uma atualização da sala: descartada só quando o servidor diz que não há partida. */
export const matchForRoom = (room: PublicRoom, match: PlayerView | null): PlayerView | null =>
  room.hasMatch ? match : null;

const listeners = new Set<(state: ClientState) => void>();

export const getState = (): ClientState => state;

export const setState = (patch: Partial<ClientState>): void => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
};

export const subscribe = (listener: (state: ClientState) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const TOKEN_KEY = "carecas-oh:token";
const NICKNAME_KEY = "carecas-oh:nickname";

export const loadToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const saveToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

export const loadNickname = (): string => localStorage.getItem(NICKNAME_KEY) ?? "";
export const saveNickname = (nickname: string): void => localStorage.setItem(NICKNAME_KEY, nickname);
