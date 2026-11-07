// src/server/store/roomStore.ts
import type { AiLevel, DeckId, MatchState, PlayerId } from "../../engine/index.js";

export type RoomPlayer = {
  token: string;
  nickname: string;
  /** Id da conexão Socket.IO atual; null quando desconectado. */
  connectionId: string | null;
  /** Marcou "pronto" na sala de espera. */
  ready: boolean;
  /**
   * Deck escolhido (secreto para o oponente) ao marcar "pronto" ou votar por revanche; null sem escolha.
   * Limpo ao iniciar partida/revanche, ao desmarcar/retirar o voto e ao sair.
   */
  deckId: DeckId | null;
};

export type EndReason = "LIFE_ZERO" | "DECK_OUT" | "OPPONENT_LEFT";

/** Resultado de uma partida encerrada. */
export type MatchOutcome = { winner: PlayerId; reason: EndReason };

/** Partida em andamento: o estado completo (com informação oculta) fica só aqui, no servidor. */
export type RoomMatch = {
  state: MatchState;
  /** Token do jogador que controla cada lado. */
  tokens: Record<PlayerId, string>;
  /** Preenchido quando a partida termina; a partida encerrada continua na sala até a revanche ou a saída. */
  outcome: MatchOutcome | null;
  /** Tokens dos jogadores que votaram por revanche (só faz sentido com `outcome`). */
  rematchVotes: string[];
  /** Prazo (ms, relógio do servidor) para agir; null com a partida encerrada. Fica fora da engine. */
  turnDeadline: number | null;
};

/** Adversário controlado pelo servidor. Não é um `RoomPlayer` (não tem conexão); só ocupa um lado em `match.tokens`. */
export type RoomAi = { level: AiLevel; botToken: string };

export type Room = {
  code: string;
  players: RoomPlayer[];
  match: RoomMatch | null;
  /** Presente nas salas contra a IA: a partida começa na hora, a sala não é pública e não aceita outro jogador. */
  ai?: RoomAi;
};

export type RoomStore = {
  getRoom: (code: string) => Room | undefined;
  getRoomByToken: (token: string) => Room | undefined;
  getRoomByConnection: (connectionId: string) => Room | undefined;
  listRooms: () => Room[];
  saveRoom: (room: Room) => void;
  removeRoom: (code: string) => void;
};

/** Armazena as salas na memória do servidor. */
export const createRoomStore = (): RoomStore => {
  const rooms = new Map<string, Room>();

  const find = (predicate: (room: Room) => boolean): Room | undefined => {
    for (const room of rooms.values()) {
      if (predicate(room)) return room;
    }
    return undefined;
  };

  return {
    getRoom: (code) => rooms.get(code),
    getRoomByToken: (token) => find((room) => room.players.some((p) => p.token === token)),
    getRoomByConnection: (connectionId) =>
      find((room) => room.players.some((p) => p.connectionId === connectionId)),
    listRooms: () => [...rooms.values()],
    saveRoom: (room) => {
      rooms.set(room.code, room);
    },
    removeRoom: (code) => {
      rooms.delete(code);
    },
  };
};
