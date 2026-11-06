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
  type MatchState,
  type PlayerId,
  type PlayerView,
} from "../../engine/index.js";
import type { EndReason, MatchOutcome, Room, RoomMatch, RoomStore } from "../store/roomStore.js";

export const MAX_PLAYERS = 2;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const SEED_LIMIT = 2 ** 31 - 1;

export type RoomErrorCode = "ROOM_NOT_FOUND" | "ROOM_FULL" | "INVALID_TOKEN";
export type MatchErrorCode = "NOT_IN_ROOM" | "MATCH_NOT_STARTED" | "MATCH_ALREADY_STARTED" | "MATCH_NOT_ENDED" | "REMATCH_UNAVAILABLE" | ErrorCode;

export type PublicRoom = {
  code: string;
  /** Verdadeiro enquanto a sala guarda uma partida (em andamento ou encerrada); o cliente só descarta a sua quando é falso. */
  hasMatch: boolean;
  players: { nickname: string; connected: boolean; ready: boolean }[];
};

/** Fim de partida visto por um jogador: vencedor, motivo e votos de revanche (`you` = ele mesmo). */
export type MatchEnd = { winner: PlayerId; reason: EndReason; rematch: { you: boolean; opponent: boolean } };

/**
 * Estado e eventos já filtrados para um jogador; `connectionId` indica para onde enviar.
 * `view` é null quando só o `ended` mudou (voto de revanche); `ended` é null com a partida em andamento.
 */
export type Delivery = { connectionId: string; view: PlayerView | null; events: EventView[]; ended: MatchEnd | null };

export type RoomResult =
  | {
      ok: true;
      room: PublicRoom;
      token: string;
      /** Presente ao reconectar no meio de uma partida. */
      view?: PlayerView;
      /** Presente ao reconectar com a partida já encerrada. */
      ended?: MatchEnd;
    }
  | { ok: false; code: RoomErrorCode };

export type MatchResult =
  | { ok: true; room: PublicRoom; deliveries: Delivery[] }
  | { ok: false; code: MatchErrorCode };

/** Sala afetada por uma saída; `room` é null quando a sala foi removida. */
export type RoomChange = { code: string; room: PublicRoom | null; deliveries?: Delivery[] };

export type RoomService = {
  createRoom: (input: { nickname: string; connectionId: string }) => RoomResult;
  joinRoom: (input: { code: string; nickname: string; connectionId: string }) => RoomResult;
  rejoinRoom: (input: { token: string; connectionId: string }) => RoomResult;
  /** Marca/desmarca "pronto"; com os dois prontos cria a partida e devolve o estado inicial de cada jogador. */
  setReady: (input: { connectionId: string; ready: boolean }) => MatchResult;
  /** Vota (ou retira o voto) por revanche; com os dois votos cria nova partida com novo sorteio. */
  requestRematch: (input: { connectionId: string; accept: boolean }) => MatchResult;
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
  hasMatch: room.match !== null,
  players: room.players.map((p) => ({ nickname: p.nickname, connected: p.connectionId !== null, ready: p.ready })),
});

/** Lado (P1/P2) controlado pelo token, ou null se o token não joga a partida. */
const sideOf = (match: RoomMatch, token: string): PlayerId | null =>
  match.tokens.P1 === token ? "P1" : match.tokens.P2 === token ? "P2" : null;

/** Fim de partida do ponto de vista do jogador do token, ou null se a partida não terminou. */
const endFor = (match: RoomMatch, token: string): MatchEnd | null => {
  const side = sideOf(match, token);
  if (!match.outcome || !side) return null;
  const opponentToken = match.tokens[side === "P1" ? "P2" : "P1"];
  return {
    ...match.outcome,
    rematch: { you: match.rematchVotes.includes(token), opponent: match.rematchVotes.includes(opponentToken) },
  };
};

/** Estado e eventos filtrados para cada jogador conectado. Nada bruto sai daqui. */
const deliver = (room: Room, match: RoomMatch, events: GameEvent[], withState = true): Delivery[] =>
  room.players.flatMap((p) => {
    const side = sideOf(match, p.token);
    if (!side || p.connectionId === null) return [];
    return [
      {
        connectionId: p.connectionId,
        view: withState ? playerView(match.state, side) : null,
        events: events.map((event) => eventView(event, side)),
        ended: endFor(match, p.token),
      },
    ];
  });

/** Vencedor e motivo quando o estado terminou (vida zerada ou deck vazio na compra). */
const outcomeOf = (state: MatchState): MatchOutcome | null => {
  if (!state.winner) return null;
  const loser = state.winner === "P1" ? "P2" : "P1";
  return { winner: state.winner, reason: state.players[loser].lifePoints <= 0 ? "LIFE_ZERO" : "DECK_OUT" };
};

export const createRoomService = (store: RoomStore): RoomService => {
  const generateCode = (): string => {
    for (;;) {
      let code = "";
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!store.getRoom(code)) return code;
    }
  };

  /** A semente nasce no servidor e nunca é enviada aos jogadores. */
  const newMatch = (tokens: RoomMatch["tokens"]): RoomMatch => ({
    state: createMatch(randomInt(1, SEED_LIMIT)),
    tokens,
    outcome: null,
    rematchVotes: [],
  });

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
      // Quem entra numa sala cuja partida já terminou (o outro saiu) começa do zero: sem partida e sem "pronto".
      const reset = Boolean(room.match?.outcome);
      const updated: Room = {
        ...room,
        match: reset ? null : room.match,
        players: [
          ...room.players.map((p) => (reset ? { ...p, ready: false } : p)),
          { token, nickname, connectionId, ready: false },
        ],
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
      const ended = updated.match ? endFor(updated.match, token) : null;
      return { ok: true, room: toPublicRoom(updated), token, ...(view ? { view } : {}), ...(ended ? { ended } : {}) };
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
        const match = newMatch({ P1: first.token, P2: second.token });
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
      const match: RoomMatch = { ...room.match, state: result.state, outcome: outcomeOf(result.state), rematchVotes: [] };
      const updated: Room = { ...room, match };
      store.saveRoom(updated);
      return { ok: true, room: toPublicRoom(updated), deliveries: deliver(updated, match, result.events) };
    },

    requestRematch: ({ connectionId, accept }) => {
      const room = store.getRoomByConnection(connectionId);
      if (!room) return { ok: false, code: "NOT_IN_ROOM" };
      if (!room.match) return { ok: false, code: "MATCH_NOT_STARTED" };
      if (!room.match.outcome) return { ok: false, code: "MATCH_NOT_ENDED" };
      const player = room.players.find((p) => p.connectionId === connectionId);
      if (!player || !sideOf(room.match, player.token)) return { ok: false, code: "NOT_IN_ROOM" };
      // Sem o oponente na sala não há revanche possível.
      if (room.players.length < MAX_PLAYERS) return { ok: false, code: "REMATCH_UNAVAILABLE" };
      const others = room.match.rematchVotes.filter((t) => t !== player.token);
      const votes = accept ? [...others, player.token] : others;
      if (room.players.every((p) => votes.includes(p.token) && p.connectionId !== null)) {
        // Revanche: novo sorteio das cartas, vida em 8000 e lados trocados.
        const match = newMatch({ P1: room.match.tokens.P2, P2: room.match.tokens.P1 });
        const updated: Room = { ...room, match };
        store.saveRoom(updated);
        return { ok: true, room: toPublicRoom(updated), deliveries: deliver(updated, match, []) };
      }
      const match: RoomMatch = { ...room.match, rematchVotes: votes };
      const updated: Room = { ...room, match };
      store.saveRoom(updated);
      return { ok: true, room: toPublicRoom(updated), deliveries: deliver(updated, match, [], false) };
    },

    disconnectPlayer: ({ connectionId }) => {
      const room = store.getRoomByConnection(connectionId);
      if (!room) return null;
      const gone = room.players.find((p) => p.connectionId === connectionId);
      // Na partida encerrada, o voto de revanche some junto com a conexão.
      const match =
        room.match?.outcome && gone
          ? { ...room.match, rematchVotes: room.match.rematchVotes.filter((t) => t !== gone.token) }
          : room.match;
      const updated: Room = {
        ...room,
        match,
        players: room.players.map((p) =>
          // Sem partida, "pronto" some junto com a conexão; com partida, o lugar é mantido para a reconexão.
          p.connectionId === connectionId ? { ...p, connectionId: null, ready: room.match ? p.ready : false } : p,
        ),
      };
      store.saveRoom(updated);
      const deliveries = match?.outcome ? deliver(updated, match, [], false) : [];
      return { code: room.code, room: toPublicRoom(updated), deliveries };
    },

    leaveRoom: ({ connectionId }) => {
      const room = store.getRoomByConnection(connectionId);
      if (!room) return null;
      const players = room.players.filter((p) => p.connectionId !== connectionId);
      if (players.length === 0) {
        store.removeRoom(room.code);
        return { code: room.code, room: null };
      }
      const [remaining] = players;
      let match: RoomMatch | null = room.match;
      let events: GameEvent[] = [];
      if (match && !match.outcome) {
        // Sair no meio da partida é desistência: quem ficou vence e vê o fim; sem revanche, só pode voltar ao lobby.
        const winner = remaining ? sideOf(match, remaining.token) : null;
        if (winner) {
          match = { ...match, state: { ...match.state, winner }, outcome: { winner, reason: "OPPONENT_LEFT" }, rematchVotes: [] };
          events = [{ type: "MATCH_ENDED", winner }];
        } else {
          match = null;
        }
      } else if (match) {
        // Partida já encerrada: o resultado fica para quem ficou, sem votos de revanche.
        match = { ...match, rematchVotes: [] };
      }
      const updated: Room = { ...room, players: players.map((p) => ({ ...p, ready: false })), match };
      store.saveRoom(updated);
      const deliveries = match ? deliver(updated, match, events) : [];
      return { code: room.code, room: toPublicRoom(updated), deliveries };
    },

    removeAbandonedRoom: ({ code }) => {
      const room = store.getRoom(code);
      if (!room || room.players.some((p) => p.connectionId !== null)) return false;
      store.removeRoom(code);
      return true;
    },
  };
};
