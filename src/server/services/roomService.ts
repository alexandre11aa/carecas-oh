// src/server/services/roomService.ts
import { randomInt, randomUUID } from "node:crypto";
import type { Room, RoomStore } from "../store/roomStore.js";

export const MAX_PLAYERS = 2;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;

export type RoomErrorCode = "ROOM_NOT_FOUND" | "ROOM_FULL" | "INVALID_TOKEN";

export type PublicRoom = {
  code: string;
  players: { nickname: string; connected: boolean }[];
};

export type RoomResult =
  | { ok: true; room: PublicRoom; token: string }
  | { ok: false; code: RoomErrorCode };

/** Sala afetada por uma saída; `room` é null quando a sala foi removida. */
export type RoomChange = { code: string; room: PublicRoom | null };

export type RoomService = {
  createRoom: (input: { nickname: string; connectionId: string }) => RoomResult;
  joinRoom: (input: { code: string; nickname: string; connectionId: string }) => RoomResult;
  rejoinRoom: (input: { token: string; connectionId: string }) => RoomResult;
  /** Marca o jogador da conexão como desconectado (mantém o lugar para reconexão). */
  disconnectPlayer: (input: { connectionId: string }) => RoomChange | null;
  /** Remove o jogador da sala; a sala some se ficar vazia. */
  leaveRoom: (input: { connectionId: string }) => RoomChange | null;
  /** Remove a sala se todos os jogadores estiverem desconectados. Retorna true se removeu. */
  removeAbandonedRoom: (input: { code: string }) => boolean;
};

export const toPublicRoom = (room: Room): PublicRoom => ({
  code: room.code,
  players: room.players.map((p) => ({ nickname: p.nickname, connected: p.connectionId !== null })),
});

export const createRoomService = (store: RoomStore): RoomService => {
  const generateCode = (): string => {
    for (;;) {
      let code = "";
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!store.getRoom(code)) return code;
    }
  };

  return {
    createRoom: ({ nickname, connectionId }) => {
      const token = randomUUID();
      const room: Room = { code: generateCode(), players: [{ token, nickname, connectionId }] };
      store.saveRoom(room);
      return { ok: true, room: toPublicRoom(room), token };
    },

    joinRoom: ({ code, nickname, connectionId }) => {
      const room = store.getRoom(code);
      if (!room) return { ok: false, code: "ROOM_NOT_FOUND" };
      if (room.players.length >= MAX_PLAYERS) return { ok: false, code: "ROOM_FULL" };
      const token = randomUUID();
      const updated: Room = { ...room, players: [...room.players, { token, nickname, connectionId }] };
      store.saveRoom(updated);
      return { ok: true, room: toPublicRoom(updated), token };
    },

    rejoinRoom: ({ token, connectionId }) => {
      const room = store.getRoomByToken(token);
      if (!room) return { ok: false, code: "INVALID_TOKEN" };
      const updated: Room = {
        ...room,
        players: room.players.map((p) => (p.token === token ? { ...p, connectionId } : p)),
      };
      store.saveRoom(updated);
      return { ok: true, room: toPublicRoom(updated), token };
    },

    disconnectPlayer: ({ connectionId }) => {
      const room = store.getRoomByConnection(connectionId);
      if (!room) return null;
      const updated: Room = {
        ...room,
        players: room.players.map((p) => (p.connectionId === connectionId ? { ...p, connectionId: null } : p)),
      };
      store.saveRoom(updated);
      return { code: room.code, room: toPublicRoom(updated) };
    },

    leaveRoom: ({ connectionId }) => {
      const room = store.getRoomByConnection(connectionId);
      if (!room) return null;
      const players = room.players.filter((p) => p.connectionId !== connectionId);
      if (players.length === 0) {
        store.removeRoom(room.code);
        return { code: room.code, room: null };
      }
      const updated: Room = { ...room, players };
      store.saveRoom(updated);
      return { code: room.code, room: toPublicRoom(updated) };
    },

    removeAbandonedRoom: ({ code }) => {
      const room = store.getRoom(code);
      if (!room || room.players.some((p) => p.connectionId !== null)) return false;
      store.removeRoom(code);
      return true;
    },
  };
};
