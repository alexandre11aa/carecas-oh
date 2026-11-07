// src/server/services/roomService.ts
import { randomInt, randomUUID } from "node:crypto";
import {
  applyAction,
  createMatch,
  DECKS,
  eventView,
  playerView,
  type Action,
  type AiLevel,
  type DeckId,
  type ErrorCode,
  type EventView,
  type GameEvent,
  type MatchState,
  type PlayerId,
  type PlayerView,
} from "../../engine/index.js";
import type { EndReason, MatchOutcome, Room, RoomMatch, RoomStore } from "../store/roomStore.js";

export const MAX_PLAYERS = 2;
/** Tempo que o jogador do turno (ou o defensor, com resposta pendente) tem para agir. */
export const TURN_TIME_MS = 30_000;
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
  /** Presente (verdadeiro) só nas salas contra a IA; ausente nas demais. */
  vsAi?: true;
  /** Nível da IA; presente junto com `vsAi`. */
  aiLevel?: AiLevel;
};

/** Item da lista de salas abertas do lobby: nada além do código e do apelido do anfitrião. */
export type LobbyRoom = { code: string; hostNickname: string };

/** Fim de partida visto por um jogador: vencedor, motivo e votos de revanche (`you` = ele mesmo). */
export type MatchEnd = { winner: PlayerId; reason: EndReason; rematch: { you: boolean; opponent: boolean } };

/**
 * Estado e eventos já filtrados para um jogador; `connectionId` indica para onde enviar.
 * `view` é null quando só o `ended` mudou (voto de revanche); `ended` é null com a partida em andamento.
 */
export type Delivery = {
  connectionId: string;
  view: PlayerView | null;
  events: EventView[];
  ended: MatchEnd | null;
  /** Prazo (ms, relógio do servidor) da ação em curso; null com a partida encerrada. Público. */
  turnDeadline: number | null;
  /** Hora do servidor no envio (ms), para o cliente calcular o tempo restante sem depender do próprio relógio. */
  serverNow: number;
};

export type RoomResult =
  | {
      ok: true;
      room: PublicRoom;
      token: string;
      /** Presente ao reconectar no meio de uma partida. */
      view?: PlayerView;
      /** Presente ao reconectar com a partida já encerrada. */
      ended?: MatchEnd;
      /** Deck que o próprio jogador escolheu (só em `room:rejoined`; null sem escolha). Nunca o do oponente. */
      deckId?: DeckId | null;
      /** Prazo do turno e hora do servidor; presentes junto com `view`. */
      turnDeadline?: number | null;
      serverNow?: number;
    }
  | { ok: false; code: RoomErrorCode };

export type MatchResult =
  | { ok: true; room: PublicRoom; deliveries: Delivery[] }
  | { ok: false; code: MatchErrorCode };

/** Sala afetada por uma saída; `room` é null quando a sala foi removida. */
export type RoomChange = { code: string; room: PublicRoom | null; deliveries?: Delivery[] };

/** Relógio e agendador do servidor; injetáveis para testar sem esperar o tempo real. */
export type Clock = {
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

export type RoomServiceOptions = { clock?: Clock; turnTimeMs?: number };

/** Resultado de um turno que expirou: entregas já filtradas por jogador. */
export type TurnExpiry = { code: string; room: PublicRoom; deliveries: Delivery[] };

export type RoomService = {
  /** Registra quem recebe o resultado quando o prazo do turno expira (o servidor aplica a ação por conta própria). */
  onTurnExpired: (listener: (expiry: TurnExpiry) => void) => void;
  /** Salas abertas: 1 jogador conectado e sem partida. */
  listOpenRooms: () => LobbyRoom[];
  createRoom: (input: { nickname: string; connectionId: string }) => RoomResult;
  /** Cria uma sala contra a IA e já inicia a partida (deck da IA sorteado no servidor); devolve o estado inicial do humano. */
  createAiRoom: (input: { nickname: string; level: AiLevel; deckId: DeckId; connectionId: string }) => RoomResult;
  joinRoom: (input: { code: string; nickname: string; connectionId: string }) => RoomResult;
  rejoinRoom: (input: { token: string; connectionId: string }) => RoomResult;
  /** Marca (com o deck escolhido) ou desmarca "pronto"; com os dois prontos cria a partida e devolve o estado inicial de cada jogador. */
  setReady: (input: { connectionId: string; ready: false } | { connectionId: string; ready: true; deckId: DeckId }) => MatchResult;
  /** Vota (com o deck escolhido) ou retira o voto por revanche; com os dois votos cria nova partida com novo sorteio. */
  requestRematch: (
    input: { connectionId: string; accept: false } | { connectionId: string; accept: true; deckId: DeckId },
  ) => MatchResult;
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
  ...(room.ai ? { vsAi: true as const, aiLevel: room.ai.level } : {}),
});

/** Lado (P1/P2) controlado pelo token, ou null se o token não joga a partida. */
const sideOf = (match: RoomMatch, token: string): PlayerId | null =>
  match.tokens.P1 === token ? "P1" : match.tokens.P2 === token ? "P2" : null;

/** Verdadeiro quando quem deve agir agora (defensor com resposta pendente, ou o jogador do turno) é a IA da sala. */
const botMustAct = (room: Room, match: RoomMatch): boolean => {
  if (!room.ai) return false;
  const actor = match.state.pendingResponse?.responder ?? match.state.currentPlayer;
  return match.tokens[actor] === room.ai.botToken;
};

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
const deliver = (room: Room, match: RoomMatch, events: GameEvent[], withState: boolean, serverNow: number): Delivery[] =>
  room.players.flatMap((p) => {
    const side = sideOf(match, p.token);
    if (!side || p.connectionId === null) return [];
    return [
      {
        connectionId: p.connectionId,
        view: withState ? playerView(match.state, side) : null,
        events: events.map((event) => eventView(event, side)),
        ended: endFor(match, p.token),
        turnDeadline: match.outcome ? null : match.turnDeadline,
        serverNow,
      },
    ];
  });

/** Vencedor e motivo quando o estado terminou (vida zerada ou deck vazio na compra). */
const outcomeOf = (state: MatchState): MatchOutcome | null => {
  if (!state.winner) return null;
  const loser = state.winner === "P1" ? "P2" : "P1";
  return { winner: state.winner, reason: state.players[loser].lifePoints <= 0 ? "LIFE_ZERO" : "DECK_OUT" };
};

const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => {
    const handle = setTimeout(callback, ms);
    handle.unref();
    return handle;
  },
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export const createRoomService = (
  store: RoomStore,
  { clock = realClock, turnTimeMs = TURN_TIME_MS }: RoomServiceOptions = {},
): RoomService => {
  const turnTimers = new Map<string, unknown>();
  let expiryListener: (expiry: TurnExpiry) => void = () => {};

  const send = (room: Room, match: RoomMatch, events: GameEvent[], withState = true): Delivery[] =>
    deliver(room, match, events, withState, clock.now());

  const cancelTurnTimer = (code: string) => {
    if (turnTimers.has(code)) clock.clearTimeout(turnTimers.get(code));
    turnTimers.delete(code);
  };

  /** Ações que o servidor aplica quando o prazo acaba: passar a resposta pendente ou encerrar o turno. */
  const expiryPlan = (state: MatchState): { side: PlayerId; action: Action }[] => {
    if (state.pendingResponse) return [{ side: state.pendingResponse.responder, action: { type: "PASS_RESPONSE" } }];
    const side = state.currentPlayer;
    // Na compra, END_TURN não vale: avança a fase (que compra) antes.
    return state.phase === "DRAW"
      ? [{ side, action: { type: "NEXT_PHASE" } }, { side, action: { type: "END_TURN" } }]
      : [{ side, action: { type: "END_TURN" } }];
  };

  /** Cancela o prazo anterior e, com a partida em andamento, abre um novo de `turnTimeMs`. Devolve a partida com `turnDeadline` atualizado. */
  const armTurnTimer = (room: Room, match: RoomMatch): RoomMatch => {
    const { code } = room;
    cancelTurnTimer(code);
    if (match.outcome) return { ...match, turnDeadline: null };
    // Transitório (até a IA jogar, #210): o relógio do humano não corre nem expira pela vez da IA.
    if (botMustAct(room, match)) return { ...match, turnDeadline: null };
    const turnDeadline = clock.now() + turnTimeMs;
    turnTimers.set(code, clock.setTimeout(() => expireTurn(code, turnDeadline), turnTimeMs));
    return { ...match, turnDeadline };
  };

  const expireTurn = (code: string, deadline: number) => {
    turnTimers.delete(code);
    const room = store.getRoom(code);
    // Prazo antigo (a jogada já renovou ou encerrou): ignora.
    if (!room?.match || room.match.outcome || room.match.turnDeadline !== deadline) return;
    let state = room.match.state;
    const events: GameEvent[] = [];
    for (const { side, action } of expiryPlan(state)) {
      const result = applyAction(state, side, action);
      if (!result.ok) break;
      state = result.state;
      events.push(...result.events);
      if (state.winner) break;
    }
    const match = armTurnTimer(room, { ...room.match, state, outcome: outcomeOf(state), rematchVotes: [] });
    const updated: Room = { ...room, match };
    store.saveRoom(updated);
    expiryListener({ code, room: toPublicRoom(updated), deliveries: send(updated, match, events) });
  };

  const generateCode = (): string => {
    for (;;) {
      let code = "";
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!store.getRoom(code)) return code;
    }
  };

  /** A semente nasce no servidor e nunca é enviada aos jogadores; `decks` são as escolhas de cada lado. */
  const newMatch = (room: Room, tokens: RoomMatch["tokens"], decks: Record<PlayerId, DeckId>): RoomMatch =>
    armTurnTimer(room, {
      state: createMatch(randomInt(1, SEED_LIMIT), decks),
      tokens,
      outcome: null,
      rematchVotes: [],
      turnDeadline: null,
    });

  return {
    onTurnExpired: (listener) => {
      expiryListener = listener;
    },

    listOpenRooms: () =>
      store.listRooms().flatMap((room) => {
        const [host] = room.players;
        return !room.ai && room.players.length === 1 && host && host.connectionId !== null && room.match === null
          ? [{ code: room.code, hostNickname: host.nickname }]
          : [];
      }),

    createRoom: ({ nickname, connectionId }) => {
      const token = randomUUID();
      const room: Room = {
        code: generateCode(),
        players: [{ token, nickname, connectionId, ready: false, deckId: null }],
        match: null,
      };
      store.saveRoom(room);
      return { ok: true, room: toPublicRoom(room), token };
    },

    createAiRoom: ({ nickname, level, deckId, connectionId }) => {
      const token = randomUUID();
      const botToken = randomUUID();
      // O deck da IA é sorteado aqui, no servidor (a engine não tem aleatoriedade própria); o humano é o P1.
      const aiDeckId = DECKS[randomInt(DECKS.length)]!.id;
      const base: Room = {
        code: generateCode(),
        players: [{ token, nickname, connectionId, ready: false, deckId: null }],
        match: null,
        ai: { level, botToken },
      };
      const match = newMatch(base, { P1: token, P2: botToken }, { P1: deckId, P2: aiDeckId });
      const room: Room = { ...base, match };
      store.saveRoom(room);
      return {
        ok: true,
        room: toPublicRoom(room),
        token,
        view: playerView(match.state, "P1"),
        turnDeadline: match.turnDeadline,
        serverNow: clock.now(),
      };
    },

    joinRoom: ({ code, nickname, connectionId }) => {
      const room = store.getRoom(code);
      if (!room) return { ok: false, code: "ROOM_NOT_FOUND" };
      if (room.ai || room.players.length >= MAX_PLAYERS) return { ok: false, code: "ROOM_FULL" };
      const token = randomUUID();
      // Quem entra numa sala cuja partida já terminou (o outro saiu) começa do zero: sem partida e sem "pronto".
      const reset = Boolean(room.match?.outcome);
      if (reset) cancelTurnTimer(code);
      const updated: Room = {
        ...room,
        match: reset ? null : room.match,
        players: [
          ...room.players.map((p) => (reset ? { ...p, ready: false, deckId: null } : p)),
          { token, nickname, connectionId, ready: false, deckId: null },
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
      const timing =
        view && updated.match
          ? { turnDeadline: updated.match.outcome ? null : updated.match.turnDeadline, serverNow: clock.now() }
          : {};
      const own = updated.players.find((p) => p.token === token);
      return {
        ok: true,
        room: toPublicRoom(updated),
        token,
        deckId: own?.deckId ?? null,
        ...(view ? { view } : {}),
        ...(ended ? { ended } : {}),
        ...timing,
      };
    },

    setReady: (input) => {
      const { connectionId } = input;
      const room = store.getRoomByConnection(connectionId);
      if (!room) return { ok: false, code: "NOT_IN_ROOM" };
      if (room.match) return { ok: false, code: "MATCH_ALREADY_STARTED" };
      let updated: Room = {
        ...room,
        players: room.players.map((p) =>
          p.connectionId === connectionId ? { ...p, ready: input.ready, deckId: input.ready ? input.deckId : null } : p,
        ),
      };
      const [first, second] = updated.players;
      if (first?.deckId && second?.deckId && updated.players.every((p) => p.ready && p.connectionId !== null)) {
        const match = newMatch(room, { P1: first.token, P2: second.token }, { P1: first.deckId, P2: second.deckId });
        // A escolha vale só para esta partida: sai do store ao começar.
        updated = { ...updated, match, players: updated.players.map((p) => ({ ...p, deckId: null })) };
        store.saveRoom(updated);
        return { ok: true, room: toPublicRoom(updated), deliveries: send(updated, match, []) };
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
      // Ação válida: o prazo recomeça (ou some, se a partida terminou).
      const match = armTurnTimer(room, {
        ...room.match,
        state: result.state,
        outcome: outcomeOf(result.state),
        rematchVotes: [],
      });
      const updated: Room = { ...room, match };
      store.saveRoom(updated);
      return { ok: true, room: toPublicRoom(updated), deliveries: send(updated, match, result.events) };
    },

    requestRematch: (input) => {
      const { connectionId, accept } = input;
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
      // O deck do voto fica no jogador; retirar o voto descarta a escolha.
      const players = room.players.map((p) =>
        p.token === player.token ? { ...p, deckId: input.accept ? input.deckId : null } : p,
      );
      // Revanche: novo sorteio das cartas, vida em 8000 e lados trocados; cada deck acompanha o seu jogador.
      const tokens = { P1: room.match.tokens.P2, P2: room.match.tokens.P1 };
      const deckP1 = players.find((p) => p.token === tokens.P1)?.deckId;
      const deckP2 = players.find((p) => p.token === tokens.P2)?.deckId;
      if (deckP1 && deckP2 && players.every((p) => votes.includes(p.token) && p.connectionId !== null)) {
        const match = newMatch(room, tokens, { P1: deckP1, P2: deckP2 });
        const updated: Room = { ...room, match, players: players.map((p) => ({ ...p, deckId: null })) };
        store.saveRoom(updated);
        return { ok: true, room: toPublicRoom(updated), deliveries: send(updated, match, []) };
      }
      const match: RoomMatch = { ...room.match, rematchVotes: votes };
      const updated: Room = { ...room, match, players };
      store.saveRoom(updated);
      return { ok: true, room: toPublicRoom(updated), deliveries: send(updated, match, [], false) };
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
          p.connectionId === connectionId ? { ...p, connectionId: null, ready: room.match ? p.ready : false, deckId: null } : p,
        ),
      };
      store.saveRoom(updated);
      const deliveries = match?.outcome ? send(updated, match, [], false) : [];
      return { code: room.code, room: toPublicRoom(updated), deliveries };
    },

    leaveRoom: ({ connectionId }) => {
      const room = store.getRoomByConnection(connectionId);
      if (!room) return null;
      const players = room.players.filter((p) => p.connectionId !== connectionId);
      if (players.length === 0) {
        cancelTurnTimer(room.code);
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
      cancelTurnTimer(room.code);
      if (match) match = { ...match, turnDeadline: null };
      const updated: Room = { ...room, players: players.map((p) => ({ ...p, ready: false, deckId: null })), match };
      store.saveRoom(updated);
      const deliveries = match ? send(updated, match, events) : [];
      return { code: room.code, room: toPublicRoom(updated), deliveries };
    },

    removeAbandonedRoom: ({ code }) => {
      const room = store.getRoom(code);
      if (!room || room.players.some((p) => p.connectionId !== null)) return false;
      cancelTurnTimer(code);
      store.removeRoom(code);
      return true;
    },
  };
};
