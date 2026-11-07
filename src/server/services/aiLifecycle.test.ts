// src/server/services/aiLifecycle.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DECKS } from "../../engine/index.js";
import { createRoomStore, type Room } from "../store/roomStore.js";
import { AI_DELAY_MS, createRoomService, type AiMove, type RoomResult } from "./roomService.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

type Ok = Extract<RoomResult, { ok: true }>;

const setup = () => {
  const store = createRoomStore();
  const service = createRoomService(store);
  const moves: AiMove[] = [];
  service.onAiMove((move) => moves.push(move));
  const create = (level: "easy" | "medium" | "hard" = "hard", deckId: "aggressive" | "magic" = "aggressive"): Ok => {
    const result = service.createAiRoom({ nickname: "Ana", level, deckId, connectionId: "a" });
    if (!result.ok) throw new Error("falha ao criar sala contra a IA");
    return result;
  };
  const roomOf = (result: Ok): Room => store.getRoom(result.room.code)!;
  /** Cria salas até uma em que a vez inicial seja do lado pedido (sorteio pela semente do servidor). */
  const createStartedBy = (who: "human" | "bot"): Ok => {
    for (let i = 0; i < 100; i++) {
      const result = create();
      const match = roomOf(result).match!;
      if ((match.tokens[match.state.currentPlayer] === result.token) === (who === "human")) return result;
      service.leaveRoom({ connectionId: "a" });
    }
    throw new Error("sorteio não variou");
  };
  /** Encerra a partida com vitória do humano por vida zerada. */
  const endMatch = (code: string) => {
    const room = store.getRoom(code)!;
    const winner = room.match!.tokens.P1 === room.players[0]!.token ? "P1" : "P2";
    store.saveRoom({
      ...room,
      match: { ...room.match!, state: { ...room.match!.state, winner }, outcome: { winner, reason: "LIFE_ZERO" }, turnDeadline: null },
    });
  };
  return { store, service, moves, create, createStartedBy, roomOf, endMatch };
};

describe("revanche contra a IA", () => {
  it("com_accept_true_inicia_na_hora_mantem_o_nivel_e_troca_os_lados", () => {
    const ctx = setup();
    const created = ctx.create("medium", "aggressive");
    const code = created.room.code;
    const before = ctx.roomOf(created);
    ctx.endMatch(code);
    const result = ctx.service.requestRematch({ connectionId: "a", accept: true, deckId: "magic" });
    if (!result.ok) throw new Error("falhou");
    const after = ctx.store.getRoom(code)!;
    expect(after.ai).toEqual(before.ai);
    expect(result.room).toMatchObject({ vsAi: true, aiLevel: "medium", hasMatch: true });
    expect(after.match!.tokens).toEqual({ P1: before.ai!.botToken, P2: created.token });
    expect(after.match!.outcome).toBeNull();
    expect(after.match!.rematchVotes).toEqual([]);
    expect(after.match!.state.players.P2.deckId).toBe("magic");
    expect(after.match!.state.players.P1.lifePoints).toBe(8000);
    expect(after.match!.state.players.P2.lifePoints).toBe(8000);
    expect(after.players[0]!.deckId).toBeNull();
    expect(result.deliveries).toHaveLength(1);
    expect(result.deliveries[0]).toMatchObject({ connectionId: "a", ended: null });
    expect(result.deliveries[0]!.view?.viewer).toBe("P2");
    expect(JSON.stringify(result)).not.toMatch(/seed/i);
    expect(JSON.stringify(result)).not.toContain(before.ai!.botToken);
  });

  it("sorteia_novo_deck_da_IA_a_cada_revanche_e_o_deck_do_humano_vem_da_escolha", () => {
    const ctx = setup();
    const created = ctx.create("easy");
    const seen = new Set<string>();
    const seeds = new Set<number>();
    for (let i = 0; i < 40; i++) {
      ctx.endMatch(created.room.code);
      const deckId = i % 2 === 0 ? "magic" : "control";
      expect(ctx.service.requestRematch({ connectionId: "a", accept: true, deckId }).ok).toBe(true);
      const match = ctx.roomOf(created).match!;
      const humanSide = match.tokens.P1 === created.token ? "P1" : "P2";
      const botSide = humanSide === "P1" ? "P2" : "P1";
      expect(match.state.players[humanSide].deckId).toBe(deckId);
      seen.add(match.state.players[botSide].deckId);
      seeds.add(match.state.seed);
    }
    expect(seen.size).toBeGreaterThan(1);
    for (const id of seen) expect(DECKS.map((d) => d.id)).toContain(id);
    expect(seeds.size).toBeGreaterThan(1);
  });

  it("os_lados_alternam_a_cada_revanche", () => {
    const ctx = setup();
    const created = ctx.create();
    const sides: string[] = [];
    for (let i = 0; i < 4; i++) {
      ctx.endMatch(created.room.code);
      ctx.service.requestRematch({ connectionId: "a", accept: true, deckId: "magic" });
      sides.push(ctx.roomOf(created).match!.tokens.P1 === created.token ? "P1" : "P2");
    }
    expect(sides).toEqual(["P2", "P1", "P2", "P1"]);
  });

  it("quando_a_IA_comeca_a_revanche_ela_joga_apos_o_atraso", () => {
    const ctx = setup();
    const created = ctx.create();
    let botStarts = false;
    for (let i = 0; i < 60 && !botStarts; i++) {
      ctx.endMatch(created.room.code);
      ctx.service.requestRematch({ connectionId: "a", accept: true, deckId: "magic" });
      const match = ctx.roomOf(created).match!;
      botStarts = match.tokens[match.state.currentPlayer] !== created.token;
    }
    expect(botStarts).toBe(true);
    ctx.moves.length = 0;
    vi.advanceTimersByTime(AI_DELAY_MS);
    expect(ctx.moves).toHaveLength(1);
    expect(ctx.service.aiRunCount()).toBe(1);
  });

  it("accept_false_apenas_limpa_o_deck_e_mantem_a_tela_de_fim_com_oponente_aceitando", () => {
    const ctx = setup();
    const created = ctx.create();
    ctx.endMatch(created.room.code);
    const tokensBefore = ctx.roomOf(created).match!.tokens;
    const result = ctx.service.requestRematch({ connectionId: "a", accept: false });
    if (!result.ok) throw new Error("falhou");
    expect(result.deliveries).toHaveLength(1);
    expect(result.deliveries[0]!.view).toBeNull();
    expect(result.deliveries[0]!.ended).toEqual({ winner: expect.any(String), reason: "LIFE_ZERO", rematch: { you: false, opponent: true } });
    const room = ctx.roomOf(created);
    expect(room.players[0]!.deckId).toBeNull();
    expect(room.match!.rematchVotes).toEqual([]);
    expect(room.match!.outcome).not.toBeNull();
    expect(room.match!.tokens).toEqual(tokensBefore);
  });

  it("nao_devolve_REMATCH_UNAVAILABLE_e_recusa_com_a_partida_em_andamento_ou_fora_da_sala", () => {
    const ctx = setup();
    const created = ctx.create();
    expect(ctx.service.requestRematch({ connectionId: "a", accept: true, deckId: "magic" })).toEqual({ ok: false, code: "MATCH_NOT_ENDED" });
    ctx.endMatch(created.room.code);
    expect(ctx.service.requestRematch({ connectionId: "zz", accept: true, deckId: "magic" })).toEqual({ ok: false, code: "NOT_IN_ROOM" });
    expect(ctx.service.requestRematch({ connectionId: "a", accept: true, deckId: "magic" }).ok).toBe(true);
  });

  it("match_ended_informa_rematch_opponent_true_na_reconexao_com_a_partida_encerrada", () => {
    const ctx = setup();
    const created = ctx.create();
    ctx.endMatch(created.room.code);
    const disconnection = ctx.service.disconnectPlayer({ connectionId: "a" });
    expect(disconnection!.deliveries).toEqual([]);
    const rejoined = ctx.service.rejoinRoom({ token: created.token, connectionId: "a2" });
    if (!rejoined.ok) throw new Error("falhou");
    expect(rejoined.ended).toEqual({ winner: expect.any(String), reason: "LIFE_ZERO", rematch: { you: false, opponent: true } });
    expect(rejoined.view).toBeDefined();
    expect(rejoined.turnDeadline).toBeNull();
    expect(ctx.service.requestRematch({ connectionId: "a2", accept: true, deckId: "magic" }).ok).toBe(true);
  });
});

describe("saida e reconexao na sala contra a IA", () => {
  it("room_leave_no_meio_da_partida_remove_a_sala_e_cancela_a_IA", () => {
    const ctx = setup();
    const created = ctx.createStartedBy("bot");
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    expect(ctx.service.leaveRoom({ connectionId: "a" })).toEqual({ code: created.room.code, room: null });
    expect(ctx.store.getRoom(created.room.code)).toBeUndefined();
    expect(ctx.service.aiRunCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10 * AI_DELAY_MS);
    expect(ctx.moves).toEqual([]);
  });

  it("room_leave_com_a_partida_encerrada_remove_a_sala_sem_timers", () => {
    const ctx = setup();
    const created = ctx.create();
    ctx.endMatch(created.room.code);
    expect(ctx.service.leaveRoom({ connectionId: "a" })).toEqual({ code: created.room.code, room: null });
    expect(ctx.store.getRoom(created.room.code)).toBeUndefined();
    expect(ctx.service.aiRunCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("perder_a_conexao_nao_e_desistencia_e_a_IA_continua_jogando_no_turno_dela", () => {
    const ctx = setup();
    const created = ctx.createStartedBy("bot");
    const change = ctx.service.disconnectPlayer({ connectionId: "a" });
    expect(change).toMatchObject({ code: created.room.code, deliveries: [] });
    expect(change!.room!.players[0]).toMatchObject({ connected: false });
    expect(ctx.roomOf(created).match!.outcome).toBeNull();
    vi.advanceTimersByTime(AI_DELAY_MS);
    expect(ctx.moves).toHaveLength(1);
    expect(ctx.moves[0]!.deliveries).toEqual([]);
    const rejoined = ctx.service.rejoinRoom({ token: created.token, connectionId: "a2" });
    if (!rejoined.ok) throw new Error("falhou");
    expect(rejoined.view?.viewer).toBe("P1");
    expect(rejoined.room).toMatchObject({ vsAi: true, hasMatch: true });
    expect(rejoined.ended).toBeUndefined();
  });

  it("removeAbandonedRoom_remove_a_sala_de_IA_desconectada_e_nao_deixa_timers", () => {
    const ctx = setup();
    const created = ctx.createStartedBy("bot");
    ctx.service.disconnectPlayer({ connectionId: "a" });
    expect(ctx.service.removeAbandonedRoom({ code: created.room.code })).toBe(true);
    expect(ctx.store.getRoom(created.room.code)).toBeUndefined();
    expect(ctx.service.aiRunCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removeAbandonedRoom_nao_remove_com_o_humano_conectado", () => {
    const ctx = setup();
    const created = ctx.create();
    expect(ctx.service.removeAbandonedRoom({ code: created.room.code })).toBe(false);
    expect(ctx.store.getRoom(created.room.code)).toBeDefined();
  });

  it("nenhuma_segunda_pessoa_entra_antes_do_fim_depois_do_fim_nem_apos_a_revanche", () => {
    const ctx = setup();
    const created = ctx.create();
    const join = () => ctx.service.joinRoom({ code: created.room.code, nickname: "Bia", connectionId: "b" });
    expect(join()).toEqual({ ok: false, code: "ROOM_FULL" });
    ctx.endMatch(created.room.code);
    expect(join()).toEqual({ ok: false, code: "ROOM_FULL" });
    ctx.service.requestRematch({ connectionId: "a", accept: true, deckId: "magic" });
    expect(join()).toEqual({ ok: false, code: "ROOM_FULL" });
    expect(ctx.roomOf(created).players).toHaveLength(1);
    expect(ctx.service.listOpenRooms()).toEqual([]);
  });

  it("sem_vazamento_apos_varias_revanches_e_saida", () => {
    const ctx = setup();
    const created = ctx.create();
    for (let i = 0; i < 5; i++) {
      ctx.endMatch(created.room.code);
      ctx.service.requestRematch({ connectionId: "a", accept: true, deckId: "magic" });
      expect(ctx.service.aiRunCount()).toBeLessThanOrEqual(1);
    }
    ctx.service.leaveRoom({ connectionId: "a" });
    expect(ctx.service.aiRunCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
