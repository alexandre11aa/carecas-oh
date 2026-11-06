// src/server/store/roomStore.ts
import type { MatchState, PlayerId } from "../../engine/index.js";

export type RoomPlayer = {
  token: string;
  nickname: string;
  /** Id da conexão Socket.IO atual; null quando desconectado. */
  connectionId: string | null;
  /** Marcou "pronto" na sala de espera. */
  ready: boolean;
};

/** Partida em andamento: o estado completo (com informação oculta) fica só aqui, no servidor. */
export type RoomMatch = {
  state: MatchState;
  /** Token do jogador que controla cada lado. */
  tokens: Record<PlayerId, string>;
};

export type Room = {
  code: string;
  players: RoomPlayer[];
  match: RoomMatch | null;
};

export type RoomStore = {
  getRoom: (code: string) => Room | undefined;
  getRoomByToken: (token: string) => Room | undefined;
  getRoomByConnection: (connectionId: string) => Room | undefined;
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
    saveRoom: (room) => {
      rooms.set(room.code, room);
    },
    removeRoom: (code) => {
      rooms.delete(code);
    },
  };
};
