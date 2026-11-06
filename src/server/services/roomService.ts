// src/server/services/roomService.ts
import { randomInt, randomUUID } from "node:crypto";
import {
  applyAction,
  createMatch,
  eventView,
  playerView,
  type Action,
  type ErrorCode,
  type EventView,
  type GameEvent,
  type PlayerId,
  type PlayerView,
} from "../../engine/index.js";
import type { Room, RoomMatch, RoomStore } from "../store/roomStore.js";

export const MAX_PLAYERS = 2;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const SEED_LIMIT = 2 ** 31 - 1;

export type RoomErrorCode = "ROOM_NOT_FOUND" | "ROOM_FULL" | "INVALID_TOKEN";
export type MatchErrorCode = "NOT_IN_ROOM" | "MATCH_NOT_STARTED" | "MATCH_ALREADY_STARTED" | ErrorCode;

export type PublicRoom = {
  code: string;
  players: { nickname: string; connected: boolean; ready: boolean }[];
};

/** Estado e eventos já filtrados para um jogador; `connectionId` indica para onde enviar. */
export type Delivery = { connectionId: string; view: PlayerView; events: EventView[] };

export type RoomResult =
  | {
      ok: true;
      room: PublicRoom;
      token: string;
      /** Presente ao reconectar no meio de uma partida. */
      view?: PlayerView;
    }
  | { ok: false; code: RoomErrorCode };

export type MatchResult =
  | { ok: true; room: PublicRoom; deliveries: Delivery[] }
  | { ok: false; code: MatchErrorCode };

/** Sala afetada por uma saída; `room` é null quando a sala foi removida. */
export type RoomChange = { code: string; room: PublicRoom | null };

export type RoomService = {
  createRoom: (input: { nickname: string; connectionId: string }) => RoomResult;
  joinRoom: (input: { code: string; nickname: string; connectionId: string }) => RoomResult;
  rejoinRoom: (input: { token: string; connectionId: string }) => RoomResult;
  /** Marca/desmarca "pronto"; com os dois prontos cria a partida e devolve o estado inicial de cada jogador. */
  setReady: (input: { connectionId: string; ready: boolean }) => MatchResult;
  /** Aplica a ação do jogador da conexão (identificado pelo servidor) e devolve o resultado a cada jogador. */
  submitAction: (input: { connectionId: string; action: Action }) => MatchResult;
  /** Marca o jogador da conexão como desconectado (mantém o lugar para reconexão). */
  disconnectPlayer: (input: { connectionId: string }) => RoomChange | null;
  /** Remove o jogador da sala; a sala some se ficar vazia. */
  leaveRoom: (input: { connectionId: string }) => RoomChange | null;
  /** Remove a sala se todos os jogadores estiverem desconectados. Retorna true se removeu. */
  removeAbandonedRoom: (input: { code: string }) => boolean;
};

export const toPublicRoom = (room: Room): PublicRoom => ({
  code: room.code,
  players: room.players.map((p) => ({ nickname: p.nickname, connected: p.connectionId !== null, ready: p.ready })),
});

/** Lado (P1/P2) controlado pelo token, ou null se o token não joga a partida. */
const sideOf = (match: RoomMatch, token: string): PlayerId | null =>
  match.tokens.P1 === token ? "P1" : match.tokens.P2 === token ? "P2" : null;

/** Estado e eventos filtrados para cada jogador conectado. Nada bruto sai daqui. */
const deliver = (room: Room, match: RoomMatch, events: GameEvent[]): Delivery[] =>
  room.players.flatMap((p) => {
    const side = sideOf(match, p.token);
    if (!side || p.connectionId === null) return [];
    return [
      {
        connectionId: p.connectionId,
        view: playerView(match.state, side),
        events: events.map((event) => eventView(event, side)),
      },
    ];
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
      const room: Room = {
        code: generateCode(),
        players: [{ token, nickname, connectionId, ready: false }],
        match: null,
      };
      store.saveRoom(room);
      return { ok: true, room: toPublicRoom(room), token };
    },

    joinRoom: ({ code, nickname, connectionId }) => {
      const room = store.getRoom(code);
      if (!room) return { ok: false, code: "ROOM_NOT_FOUND" };
      if (room.players.length >= MAX_PLAYERS) return { ok: false, code: "ROOM_FULL" };
      const token = randomUUID();
      const updated: Room = {
        ...room,
        players: [...room.players, { token, nickname, connectionId, ready: false }],
      };
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
      const side = updated.match ? sideOf(updated.match, token) : null;
      const view = updated.match && side ? playerView(updated.match.state, side) : undefined;
      return { ok: true, room: toPublicRoom(updated), token, ...(view ? { view } : {}) };
    },

    setReady: ({ connectionId, ready }) => {
      const room = store.getRoomByConnection(connectionId);
      if (!room) return { ok: false, code: "NOT_IN_ROOM" };
      if (room.match) return { ok: false, code: "MATCH_ALREADY_STARTED" };
      let updated: Room = {
        ...room,
        players: room.players.map((p) => (p.connectionId === connectionId ? { ...p, ready } : p)),
      };
      const [first, second] = updated.players;
      if (first && second && updated.players.every((p) => p.ready && p.connectionId !== null)) {
        // A semente nasce no servidor e nunca é enviada aos jogadores.
        const match: RoomMatch = {
          state: createMatch(randomInt(1, SEED_LIMIT)),
          tokens: { P1: first.token, P2: second.token },
        };
        updated = { ...updated, match };
        store.saveRoom(updated);
        return { ok: true, room: toPublicRoom(updated), deliveries: deliver(updated, match, []) };
      }
      store.saveRoom(updated);
      return { ok: true, room: toPublicRoom(updated), deliveries: [] };
    },

    submitAction: ({ connectionId, action }) => {
      const room = store.getRoomByConnection(connectionId);
      if (!room) return { ok: false, code: "NOT_IN_ROOM" };
      if (!room.match) return { ok: false, code: "MATCH_NOT_STARTED" };
      const player = room.players.find((p) => p.connectionId === connectionId);
      const side = player ? sideOf(room.match, player.token) : null;
      if (!side) return { ok: false, code: "NOT_IN_ROOM" };
      const result = applyAction(room.match.state, side, action);
      if (!result.ok) return { ok: false, code: result.code };
      const match: RoomMatch = { ...room.match, state: result.state };
      const updated: Room = { ...room, match };
      store.saveRoom(updated);
      return { ok: true, room: toPublicRoom(updated), deliveries: deliver(updated, match, result.events) };
    },

    disconnectPlayer: ({ connectionId }) => {
      const room = store.getRoomByConnection(connectionId);
      if (!room) return null;
      const updated: Room = {
        ...room,
        players: room.players.map((p) =>
          // Sem partida, "pronto" some junto com a conexão; com partida, o lugar é mantido para a reconexão.
          p.connectionId === connectionId ? { ...p, connectionId: null, ready: room.match ? p.ready : false } : p,
        ),
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
      // Quem sai encerra a partida em andamento (fim/revanche ficam para outra issue); todos voltam a "não pronto".
      const updated: Room = { ...room, players: players.map((p) => ({ ...p, ready: false })), match: null };
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
