// src/server/services/aiPlay.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiLevel, MatchState, PlayerState } from "../../engine/index.js";
import { createRoomStore, type Room } from "../store/roomStore.js";
import { AI_DELAY_MS, createRoomService, TURN_TIME_MS, type AiMove, type Clock, type TurnExpiry } from "./roomService.js";

const START = 1_000_000;

/** Relógio falso manual: só avança quando o teste manda, sem timers reais. */
const createFakeClock = () => {
  let now = START;
  let nextId = 1;
  const pending = new Map<number, { at: number; callback: () => void }>();
  const clock: Clock = {
    now: () => now,
    setTimeout: (callback, ms) => {
      const id = nextId++;
      pending.set(id, { at: now + ms, callback });
      return id;
    },
    clearTimeout: (handle) => {
      pending.delete(handle as number);
    },
  };
  const advance = (ms: number) => {
    const target = now + ms;
    for (;;) {
      const due = [...pending.entries()]
        .filter(([, t]) => t.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      pending.delete(due[0]);
      now = Math.max(now, due[1].at);
      due[1].callback();
    }
    now = target;
  };
  return { clock, advance, pendingCount: () => pending.size };
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const setup = (level: AiLevel = "medium") => {
  const fake = createFakeClock();
  const store = createRoomStore();
  const service = createRoomService(store, { clock: fake.clock });
  const moves: AiMove[] = [];
  const expiries: TurnExpiry[] = [];
  service.onAiMove((move) => moves.push(move));
  service.onTurnExpired((expiry) => expiries.push(expiry));
  const create = () => {
    const result = service.createAiRoom({ nickname: "Ana", level, deckId: "balanced", connectionId: "a" });
    if (!result.ok) throw new Error("falha ao criar sala");
    return result;
  };
  const room = (code: string): Room => store.getRoom(code)!;
  const forceState = (code: string, patch: (state: MatchState) => MatchState) => {
    const r = room(code);
    store.saveRoom({ ...r, match: { ...r.match!, state: patch(r.match!.state) } });
  };
  return { fake, store, service, moves, expiries, create, room, forceState };
};

/** Cria salas até o lado inicial ser o pedido. */
const createStartedBy = (ctx: ReturnType<typeof setup>, who: "human" | "bot") => {
  for (let i = 0; i < 100; i++) {
    const result = ctx.create();
    const starter = ctx.room(result.room.code).match!.state.currentPlayer === "P1" ? "human" : "bot";
    if (starter === who) return result;
    ctx.service.leaveRoom({ connectionId: "a" });
  }
  throw new Error("sorteio não variou");
};

const patchPlayer = (state: MatchState, side: "P1" | "P2", patch: Partial<PlayerState>): MatchState => ({
  ...state,
  players: { ...state.players, [side]: { ...state.players[side], ...patch } },
});

const pad = <T>(items: T[], size = 5): (T | null)[] => [...items, ...Array<null>(size - items.length).fill(null)];

const monster = (cardId: string) => ({
  cardId,
  position: "ATTACK" as const,
  faceDown: false,
  summonedOnTurn: 1,
  hasAttacked: false,
  changedPositionOnTurn: null,
});

describe("IA joga no servidor", () => {
  it("nao_joga_antes_do_atraso_e_joga_uma_acao_por_vez_a_cada_700ms", () => {
    const ctx = setup();
    const created = createStartedBy(ctx, "bot");
    const code = created.room.code;
    expect(AI_DELAY_MS).toBe(700);
    ctx.fake.advance(699);
    expect(ctx.moves).toHaveLength(0);
    ctx.fake.advance(1);
    expect(ctx.moves).toHaveLength(1);
    expect(ctx.room(code).match!.state.phase).not.toBe("DRAW");
    ctx.fake.advance(700);
    expect(ctx.moves).toHaveLength(2);
    for (const move of ctx.moves) {
      expect(move.code).toBe(code);
      expect(move.deliveries).toHaveLength(1);
      expect(move.deliveries[0]!.connectionId).toBe("a");
    }
  });

  it("joga_o_turno_inteiro_e_devolve_a_vez_ao_humano_com_prazo_de_30s_nos_3_niveis", () => {
    for (const level of ["easy", "medium", "hard"] as const) {
      const ctx = setup(level);
      const created = createStartedBy(ctx, "bot");
      const code = created.room.code;
      expect(created.turnDeadline).toBeNull();
      let steps = 0;
      while (ctx.room(code).match!.state.currentPlayer === "P2" && steps < 60) {
        ctx.fake.advance(AI_DELAY_MS);
        steps += 1;
      }
      const match = ctx.room(code).match!;
      expect(match.state.currentPlayer).toBe("P1");
      expect(match.state.turn).toBe(2);
      expect(steps).toBeLessThan(60);
      // Cada ação da IA gerou um match:state; na vez dela o prazo é nulo e no fim volta ao humano.
      expect(ctx.moves).toHaveLength(steps);
      for (const move of ctx.moves.slice(0, -1)) expect(move.deliveries[0]!.turnDeadline).toBeNull();
      const last = ctx.moves.at(-1)!.deliveries[0]!;
      expect(last.view?.currentPlayer).toBe("P1");
      expect(last.turnDeadline).toBe(last.serverNow + TURN_TIME_MS);
      expect(match.turnDeadline).toBe(last.serverNow + TURN_TIME_MS);
      expect(last.events.some((e) => e.type === "TURN_STARTED")).toBe(true);
      // Sem agendamento da IA na vez do humano; só o prazo de 30 s.
      expect(ctx.fake.pendingCount()).toBe(1);
    }
  });

  it("o_prazo_de_30s_nao_expira_na_vez_da_IA_e_expira_na_do_humano", () => {
    const ctx = setup();
    const created = createStartedBy(ctx, "bot");
    const code = created.room.code;
    // Toda a vez da IA dura bem menos que 30 s: nenhuma expiração enquanto ela joga.
    for (let i = 0; i < 60 && ctx.room(code).match!.state.currentPlayer === "P2"; i++) {
      expect(ctx.room(code).match!.turnDeadline).toBeNull();
      ctx.fake.advance(AI_DELAY_MS);
    }
    expect(ctx.expiries).toEqual([]);
    expect(ctx.room(code).match!.state.currentPlayer).toBe("P1");
    // O turno voltou ao humano: o prazo recomeçou e, ao expirar, o servidor encerra o turno dele.
    expect(ctx.room(code).match!.turnDeadline).not.toBeNull();
    ctx.fake.advance(TURN_TIME_MS);
    expect(ctx.expiries).toHaveLength(1);
  });

  it("humano_que_termina_o_turno_entrega_a_vez_e_a_IA_passa_a_jogar", () => {
    const ctx = setup();
    const created = createStartedBy(ctx, "human");
    const code = created.room.code;
    expect(ctx.room(code).match!.turnDeadline).toBe(START + TURN_TIME_MS);
    for (const action of [{ type: "NEXT_PHASE" }, { type: "END_TURN" }] as const) {
      expect(ctx.service.submitAction({ connectionId: "a", action }).ok).toBe(true);
    }
    expect(ctx.room(code).match!.state.currentPlayer).toBe("P2");
    expect(ctx.room(code).match!.turnDeadline).toBeNull();
    ctx.fake.advance(AI_DELAY_MS);
    expect(ctx.moves).toHaveLength(1);
  });

  it("responde_a_janela_de_resposta_aberta_pelo_humano_e_devolve_o_prazo", () => {
    const ctx = setup("hard");
    const created = createStartedBy(ctx, "human");
    const code = created.room.code;
    ctx.forceState(code, (s) => {
      let next: MatchState = { ...s, turn: 5, phase: "MAIN_1", currentPlayer: "P1" };
      next = patchPlayer(next, "P1", { hand: ["dune_scout"], monsters: pad([]), normalSummonUsed: false });
      return patchPlayer(next, "P2", { spellTraps: pad([{ cardId: "hidden_snare", faceDown: true, setOnTurn: 1 }]) });
    });
    const summon = ctx.service.submitAction({
      connectionId: "a",
      action: { type: "SUMMON_CARD", cardId: "dune_scout", tributeCardIds: [], zone: 0 },
    });
    expect(summon.ok).toBe(true);
    const open = ctx.room(code).match!;
    expect(open.state.pendingResponse?.responder).toBe("P2");
    // A janela é da IA: sem prazo para o humano e nenhum cliente decide por ela.
    expect(open.turnDeadline).toBeNull();
    ctx.fake.advance(AI_DELAY_MS);
    expect(ctx.moves).toHaveLength(1);
    const events = ctx.moves[0]!.deliveries[0]!.events;
    expect(events.some((e) => e.type === "TRAP_ACTIVATED" || e.type === "RESPONSE_PASSED")).toBe(true);
    const after = ctx.room(code).match!;
    expect(after.state.pendingResponse).toBeNull();
    expect(after.state.currentPlayer).toBe("P1");
    expect(after.turnDeadline).toBe(START + AI_DELAY_MS + TURN_TIME_MS);
    expect(ctx.expiries).toEqual([]);
  });

  it("a_IA_ativa_a_armadilha_ao_defender_um_ataque_forte_do_humano", () => {
    const ctx = setup("hard");
    const created = createStartedBy(ctx, "human");
    const code = created.room.code;
    ctx.forceState(code, (s) => {
      let next: MatchState = { ...s, turn: 5, phase: "BATTLE", currentPlayer: "P1" };
      next = patchPlayer(next, "P1", { monsters: pad([monster("dune_scout")]) });
      return patchPlayer(next, "P2", {
        monsters: pad([]),
        spellTraps: pad([{ cardId: "mirror_shield", faceDown: true, setOnTurn: 1 }]),
      });
    });
    const attack = ctx.service.submitAction({
      connectionId: "a",
      action: { type: "ATTACK", attackerCardId: "dune_scout", targetZone: null },
    });
    expect(attack.ok).toBe(true);
    expect(ctx.room(code).match!.state.pendingResponse?.responder).toBe("P2");
    ctx.fake.advance(AI_DELAY_MS);
    expect(ctx.moves).toHaveLength(1);
    expect(ctx.moves[0]!.deliveries[0]!.events.some((e) => e.type === "TRAP_ACTIVATED")).toBe(true);
    expect(ctx.room(code).match!.state.pendingResponse).toBeNull();
    expect(ctx.room(code).match!.state.players.P2.lifePoints).toBe(8000);
  });
});

describe("fim de partida contra a IA", () => {
  it("vitoria_da_IA_gera_outcome_e_ended_para_o_humano_e_para_de_agendar", () => {
    const ctx = setup("hard");
    const created = createStartedBy(ctx, "bot");
    const code = created.room.code;
    ctx.forceState(code, (s) => {
      let next: MatchState = { ...s, turn: 6, phase: "BATTLE", currentPlayer: "P2" };
      next = patchPlayer(next, "P1", { lifePoints: 100, monsters: pad([]), spellTraps: pad([]) });
      return patchPlayer(next, "P2", { monsters: pad([monster("dune_scout")]) });
    });
    for (let i = 0; i < 10 && !ctx.room(code).match!.outcome; i++) ctx.fake.advance(AI_DELAY_MS);
    const match = ctx.room(code).match!;
    expect(match.outcome).toEqual({ winner: "P2", reason: "LIFE_ZERO" });
    expect(match.turnDeadline).toBeNull();
    const last = ctx.moves.at(-1)!.deliveries[0]!;
    expect(last.ended).toMatchObject({ winner: "P2", reason: "LIFE_ZERO" });
    expect(last.turnDeadline).toBeNull();
    expect(ctx.fake.pendingCount()).toBe(0);
    const count = ctx.moves.length;
    ctx.fake.advance(TURN_TIME_MS * 3);
    expect(ctx.moves).toHaveLength(count);
  });

  it("vitoria_do_humano_gera_outcome_e_a_IA_nao_agenda_mais", () => {
    const ctx = setup("hard");
    const created = createStartedBy(ctx, "human");
    const code = created.room.code;
    ctx.forceState(code, (s) => {
      let next: MatchState = { ...s, turn: 5, phase: "BATTLE", currentPlayer: "P1" };
      next = patchPlayer(next, "P1", { monsters: pad([monster("dune_scout")]) });
      return patchPlayer(next, "P2", { lifePoints: 100, monsters: pad([]), spellTraps: pad([]) });
    });
    const result = ctx.service.submitAction({
      connectionId: "a",
      action: { type: "ATTACK", attackerCardId: "dune_scout", targetZone: null },
    });
    expect(result.ok).toBe(true);
    expect(ctx.room(code).match!.outcome).toEqual({ winner: "P1", reason: "LIFE_ZERO" });
    expect(ctx.fake.pendingCount()).toBe(0);
    ctx.fake.advance(TURN_TIME_MS * 3);
    expect(ctx.moves).toEqual([]);
  });
});

describe("cancelamento da IA", () => {
  it("leaveRoom_cancela_o_agendamento_e_remove_a_sala", () => {
    const ctx = setup();
    const created = createStartedBy(ctx, "bot");
    expect(ctx.fake.pendingCount()).toBe(1);
    ctx.service.leaveRoom({ connectionId: "a" });
    expect(ctx.fake.pendingCount()).toBe(0);
    ctx.fake.advance(TURN_TIME_MS * 3);
    expect(ctx.moves).toEqual([]);
    expect(ctx.store.getRoom(created.room.code)).toBeUndefined();
  });

  it("removeAbandonedRoom_cancela_o_agendamento", () => {
    const ctx = setup();
    const created = createStartedBy(ctx, "bot");
    ctx.service.disconnectPlayer({ connectionId: "a" });
    expect(ctx.service.removeAbandonedRoom({ code: created.room.code })).toBe(true);
    expect(ctx.fake.pendingCount()).toBe(0);
    ctx.fake.advance(TURN_TIME_MS * 3);
    expect(ctx.moves).toEqual([]);
  });

  it("sala_removida_do_store_antes_do_disparo_nao_joga_nem_agenda_de_novo", () => {
    const ctx = setup();
    const created = createStartedBy(ctx, "bot");
    ctx.store.removeRoom(created.room.code);
    ctx.fake.advance(AI_DELAY_MS * 5);
    expect(ctx.moves).toEqual([]);
    expect(ctx.fake.pendingCount()).toBe(0);
  });
});

describe("sigilo da IA", () => {
  it("nenhuma_entrega_vaza_semente_token_ou_mao_da_IA", () => {
    const ctx = setup("hard");
    const created = createStartedBy(ctx, "bot");
    const botToken = ctx.room(created.room.code).ai!.botToken;
    for (let i = 0; i < 12; i++) ctx.fake.advance(AI_DELAY_MS);
    expect(ctx.moves.length).toBeGreaterThan(0);
    for (const move of ctx.moves) {
      const dump = JSON.stringify(move);
      expect(dump).not.toContain(botToken);
      expect(dump).not.toMatch(/seed/i);
      for (const d of move.deliveries) {
        expect(d.view?.opponent).not.toHaveProperty("hand");
        expect(d.view?.opponent).not.toHaveProperty("deck");
      }
    }
  });
});
