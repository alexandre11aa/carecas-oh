// src/client/state.ts
import type { EventView } from "../engine/eventView.js";
import type { PlayerView } from "../engine/playerView.js";
import type { PlayerId } from "../engine/types.js";
import type { TurnClock } from "./screens/turnTimer.js";

export type PublicPlayer = { nickname: string; connected: boolean; ready?: boolean };
export type PublicRoom = { code: string; hasMatch: boolean; players: PublicPlayer[] };

/** Sala aberta listada no lobby (`lobby:rooms`). */
export type LobbyRoom = { code: string; hostNickname: string };

/** Fim de partida recebido em `match:ended`: vencedor, motivo e votos de revanche. */
export type MatchEnded = {
  winner: PlayerId;
  reason: "LIFE_ZERO" | "DECK_OUT" | "OPPONENT_LEFT";
  rematch: { you: boolean; opponent: boolean };
};

/** Último estado recebido do servidor. Estado visual (campos digitados etc.) fica nas telas. */
export type ClientState = {
  connection: "connecting" | "online" | "offline";
  /** Verdadeiro até o servidor responder à primeira conexão (inclui o rejoin automático). */
  booting: boolean;
  room: PublicRoom | null;
  /** Última visão da partida recebida em `match:state`; null fora de partida. */
  match: PlayerView | null;
  /** Prazo do turno do último `match:state` (recalculado a cada estado); null sem partida ou com partida encerrada. */
  turnClock: TurnClock | null;
  /** Aviso temporário de turno (`seq` muda a cada aviso novo); null se não há. */
  turnNotice: { seq: number; text: string } | null;
  /** Eventos filtrados do último `match:state` (`seq` muda a cada estado; `events` vazio na reconexão); null sem partida. */
  matchEvents: { seq: number; events: EventView[] } | null;
  /** Resultado da partida encerrada (`match:ended`); null enquanto a partida está em andamento. */
  ended: MatchEnded | null;
  /** Salas abertas recebidas em `lobby:rooms`; vazia sem assinatura ou sem salas. */
  lobbyRooms: LobbyRoom[];
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
  turnClock: null,
  turnNotice: null,
  matchEvents: null,
  ended: null,
  lobbyRooms: [],
  errorCode: null,
  busy: false,
};

/** Extrai a lista de salas de um payload `lobby:rooms`, descartando itens malformados. */
export const lobbyRoomsFromPayload = (payload: unknown): LobbyRoom[] => {
  const rooms = (payload as { rooms?: unknown } | null)?.rooms;
  if (!Array.isArray(rooms)) return [];
  return rooms.flatMap((item): LobbyRoom[] => {
    const { code, hostNickname } = (item ?? {}) as Partial<LobbyRoom>;
    return typeof code === "string" && typeof hostNickname === "string" ? [{ code, hostNickname }] : [];
  });
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
