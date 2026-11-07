// src/engine/ai/ai.test.ts
import { describe, expect, it } from "vitest";
import { applyAction } from "../applyAction.js";
import { createMatch } from "../createMatch.js";
import { DECKS, type DeckId } from "../decks.js";
import { opponentOf } from "../rules/turn.js";
import type { Action, MatchState, MonsterOnField, PlayerId, SpellTrapOnField } from "../types.js";
import { generateCandidates } from "./candidates.js";
import { chooseAiAction, mustAct, playAiTurn } from "./choose.js";
import { AI_LEVELS, MAX_AI_ACTIONS_PER_TURN, type AiLevel } from "./types.js";
import { playerView } from "../playerView.js";

const field = (cardId: string, extra: Partial<MonsterOnField> = {}): MonsterOnField => ({
  cardId,
  position: "ATTACK",
  faceDown: false,
  summonedOnTurn: 0,
  hasAttacked: false,
  changedPositionOnTurn: null,
  ...extra,
});

const trap = (cardId: string, setOnTurn = 1): SpellTrapOnField => ({ cardId, faceDown: true, setOnTurn });

const pad = <T,>(list: (T | null)[], size = 5): (T | null)[] => [...list, ...Array<null>(size - list.length).fill(null)];

type Setup = {
  hand?: string[];
  mine?: (MonsterOnField | null)[];
  mineTraps?: (SpellTrapOnField | null)[];
  theirs?: (MonsterOnField | null)[];
  theirTraps?: (SpellTrapOnField | null)[];
  phase?: MatchState["phase"];
  turn?: number;
  normalSummonUsed?: boolean;
};

/** Estado montado à mão: o jogador do turno (`side`) tem mão e campo definidos. */
const setup = ({
  hand = [],
  mine = [],
  mineTraps = [],
  theirs = [],
  theirTraps = [],
  phase = "MAIN_1",
  turn = 5,
  normalSummonUsed = false,
}: Setup): { state: MatchState; side: PlayerId } => {
  const base = createMatch(42, { P1: "balanced", P2: "strategic" });
  const side = base.currentPlayer;
  const other = opponentOf(side);
  return {
    side,
    state: {
      ...base,
      turn,
      phase,
      players: {
        ...base.players,
        [side]: {
          ...base.players[side],
          hand,
          monsters: pad(mine),
          spellTraps: pad(mineTraps),
          normalSummonUsed,
        },
        [other]: { ...base.players[other], monsters: pad(theirs), spellTraps: pad(theirTraps) },
      },
    },
  };
};

const SEEDS = [1, 7, 42, 99, 12345, 2024, 777, 31337];

describe("candidatos da IA", () => {
  it("ia_candidatos_de_invocacao_respeitam_o_tributo", () => {
    const { state, side } = setup({
      hand: ["ash_dragon", "storm_hawk", "ash_sprite"],
      mine: [field("moss_golem"), field("tide_imp"), field("dune_scout")],
    });
    const actions = generateCandidates(playerView(state, side)).filter((a) => a.type === "SUMMON_CARD");
    const sizes = (id: string) =>
      new Set(actions.flatMap((a) => (a.type === "SUMMON_CARD" && a.cardId === id ? [a.tributeCardIds.length] : [])));
    expect(sizes("ash_sprite")).toEqual(new Set([0]));
    expect(sizes("storm_hawk")).toEqual(new Set([1]));
    expect(sizes("ash_dragon")).toEqual(new Set([2]));
  });

  it("ia_sem_tributos_suficientes_nao_gera_invocacao_do_monstro_alto", () => {
    const { state, side } = setup({ hand: ["ash_dragon"], mine: [field("moss_golem")] });
    const summons = generateCandidates(playerView(state, side)).filter((a) => a.type === "SUMMON_CARD");
    expect(summons).toEqual([]);
  });

  it("ia_nao_gera_ataque_no_primeiro_turno", () => {
    const { state, side } = setup({ phase: "BATTLE", turn: 1, mine: [field("dune_scout")] });
    const attacks = generateCandidates(playerView(state, side)).filter((a) => a.type === "ATTACK");
    expect(attacks).toEqual([]);
  });

  it("ia_gera_ataque_direto_so_sem_monstros_do_oponente", () => {
    const sem = setup({ phase: "BATTLE", mine: [field("dune_scout")] });
    expect(generateCandidates(playerView(sem.state, sem.side)).filter((a) => a.type === "ATTACK")).toEqual([
      { type: "ATTACK", attackerCardId: "dune_scout", targetZone: null },
    ]);
    const com = setup({ phase: "BATTLE", mine: [field("dune_scout")], theirs: [null, field("moss_golem")] });
    expect(generateCandidates(playerView(com.state, com.side)).filter((a) => a.type === "ATTACK")).toEqual([
      { type: "ATTACK", attackerCardId: "dune_scout", targetZone: 1 },
    ]);
  });

  it("ia_nao_gera_compra_extra_com_deck_curto_demais", () => {
    const { state, side } = setup({ hand: ["arcane_draw"] });
    const empty: MatchState = {
      ...state,
      players: { ...state.players, [side]: { ...state.players[side], deck: [] } },
    };
    const spells = generateCandidates(playerView(empty, side)).filter((a) => a.type === "ACTIVATE_SPELL");
    expect(spells).toEqual([]);
  });
});

describe("IA nivel facil: decisoes", () => {
  it("ia_facil_invoca_o_primeiro_monstro_que_consegue", () => {
    const { state, side } = setup({ hand: ["ash_dragon", "dune_scout", "ash_sprite"] });
    const { action } = chooseAiAction({ state, side, level: "easy", seed: 5 });
    expect(action).toEqual({ type: "SUMMON_CARD", cardId: "dune_scout", tributeCardIds: [], zone: 0 });
  });

  it("ia_facil_tributa_monstros_do_proprio_campo", () => {
    const { state, side } = setup({ hand: ["storm_hawk"], mine: [field("tide_imp"), field("moss_golem")] });
    const { action } = chooseAiAction({ state, side, level: "easy", seed: 5 });
    expect(action?.type).toBe("SUMMON_CARD");
    if (action?.type !== "SUMMON_CARD") return;
    expect(action.cardId).toBe("storm_hawk");
    expect(action.tributeCardIds).toHaveLength(1);
    expect(["tide_imp", "moss_golem"]).toContain(action.tributeCardIds[0]);
  });

  it("ia_facil_na_compra_avanca_a_fase", () => {
    const { state, side } = setup({ phase: "DRAW" });
    expect(chooseAiAction({ state, side, level: "easy", seed: 3 }).action).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_facil_na_fase_final_encerra_o_turno", () => {
    const { state, side } = setup({ phase: "END" });
    expect(chooseAiAction({ state, side, level: "easy", seed: 3 }).action).toEqual({ type: "END_TURN" });
  });

  it("ia_facil_sem_nada_a_fazer_na_principal_avanca_a_fase", () => {
    const { state, side } = setup({ hand: [] });
    expect(chooseAiAction({ state, side, level: "easy", seed: 3 }).action).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_facil_ataca_ao_acaso_inclusive_trocas_ruins", () => {
    const { state, side } = setup({
      phase: "BATTLE",
      mine: [field("tide_imp")],
      theirs: [field("ash_dragon")],
    });
    const chosen = new Set<string>();
    for (const seed of SEEDS.concat([3, 4, 5, 6, 8, 9, 10, 11])) {
      chosen.add(JSON.stringify(chooseAiAction({ state, side, level: "easy", seed }).action));
    }
    expect(chosen.has(JSON.stringify({ type: "ATTACK", attackerCardId: "tide_imp", targetZone: 0 }))).toBe(true);
    expect(chosen.has(JSON.stringify({ type: "NEXT_PHASE" }))).toBe(true);
  });

  it("ia_facil_ativa_armadilha_so_as_vezes", () => {
    // Estado com janela de resposta aberta para o lado da IA (defensor).
    const attackerSide = setup({
      phase: "BATTLE",
      mine: [field("dune_scout")],
      theirs: [field("moss_golem")],
      theirTraps: [trap("spike_pit", 1)],
    });
    const defender = opponentOf(attackerSide.side);
    const opened = applyAction(attackerSide.state, attackerSide.side, {
      type: "ATTACK",
      attackerCardId: "dune_scout",
      targetZone: 0,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.state.pendingResponse?.responder).toBe(defender);

    const actions = Array.from({ length: 200 }, (_, i) =>
      chooseAiAction({ state: opened.state, side: defender, level: "easy", seed: i + 1 }).action,
    );
    const activated = actions.filter((a) => a?.type === "ACTIVATE_TRAP").length;
    const passed = actions.filter((a) => a?.type === "PASS_RESPONSE").length;
    expect(activated + passed).toBe(200);
    expect(activated).toBeGreaterThan(30);
    expect(activated).toBeLessThan(100);
  });

  it("ia_nao_age_fora_do_turno_nem_com_partida_encerrada", () => {
    const { state, side } = setup({});
    const other = opponentOf(side);
    expect(chooseAiAction({ state, side: other, level: "easy", seed: 1 })).toEqual({ action: null, seed: 1 });
    const ended: MatchState = { ...state, winner: other };
    expect(chooseAiAction({ state: ended, side, level: "easy", seed: 1 })).toEqual({ action: null, seed: 1 });
    expect(mustAct(state, side)).toBe(true);
  });
});

describe("IA: determinismo e informacao oculta", () => {
  it("ia_mesma_entrada_e_semente_produzem_a_mesma_acao", () => {
    const { state, side } = setup({ hand: ["storm_hawk", "fire_bolt", "spike_pit"], mine: [field("tide_imp")] });
    for (const level of AI_LEVELS) {
      const a = chooseAiAction({ state, side, level, seed: 77 });
      const b = chooseAiAction({ state, side, level, seed: 77 });
      expect(b).toEqual(a);
    }
  });

  it("ia_nao_usa_a_semente_do_estado", () => {
    const { state, side } = setup({ hand: ["fire_bolt", "spike_pit", "power_surge"], mine: [field("tide_imp")] });
    const other: MatchState = { ...state, seed: state.seed + 12345 };
    for (const seed of SEEDS) {
      expect(chooseAiAction({ state: other, side, level: "easy", seed })).toEqual(
        chooseAiAction({ state, side, level: "easy", seed }),
      );
    }
  });

  it("ia_nao_le_a_mao_nem_o_deck_do_oponente", () => {
    const base = setup({
      hand: ["dune_scout", "fire_bolt", "wind_gust"],
      mine: [field("tide_imp"), field("moss_golem")],
      theirs: [field("iron_minotaur"), field("ash_sprite", { faceDown: true, position: "DEFENSE" })],
      theirTraps: [trap("dark_veil")],
    });
    const { side } = base;
    const other = opponentOf(side);
    const reshuffled = (phase: MatchState["phase"]): MatchState => {
      const opp = base.state.players[other];
      return {
        ...base.state,
        phase,
        players: {
          ...base.state.players,
          [other]: { ...opp, hand: [...opp.hand].reverse(), deck: [...opp.deck].reverse() },
        },
      };
    };
    for (const phase of ["MAIN_1", "BATTLE", "MAIN_2"] as MatchState["phase"][]) {
      const original = { ...base.state, phase };
      for (const seed of SEEDS) {
        for (const level of AI_LEVELS) {
          expect(chooseAiAction({ state: reshuffled(phase), side, level, seed })).toEqual(
            chooseAiAction({ state: original, side, level, seed }),
          );
        }
      }
    }
  });

  it("ia_nao_usa_a_identidade_de_monstro_virado_do_oponente", () => {
    const make = (hidden: string): MatchState => {
      const { state } = setup({
        phase: "MAIN_1",
        hand: ["wind_gust"],
        theirs: [field(hidden, { faceDown: true, position: "DEFENSE" })],
      });
      return state;
    };
    const { side } = setup({});
    for (const seed of SEEDS) {
      expect(chooseAiAction({ state: make("ash_dragon"), side, level: "easy", seed })).toEqual(
        chooseAiAction({ state: make("tide_imp"), side, level: "easy", seed }),
      );
    }
  });
});

describe("playAiTurn", () => {
  const expectEndsTurn = (state: MatchState, side: PlayerId, level: AiLevel = "easy"): void => {
    const result = playAiTurn({ state, side, level, seed: 11 });
    expect(result.actions.length).toBeLessThanOrEqual(MAX_AI_ACTIONS_PER_TURN);
    expect(result.status).toBe("TURN_ENDED");
    expect(result.state.currentPlayer).toBe(opponentOf(side));
    expect(result.actions.at(-1)).toEqual({ type: "END_TURN" });
  };

  it("ia_termina_o_turno_dentro_do_limite_com_mao_vazia", () => {
    const { state, side } = setup({ hand: [], phase: "DRAW" });
    expectEndsTurn(state, side);
  });

  it("ia_termina_o_turno_com_campo_cheio", () => {
    const { state, side } = setup({
      hand: ["dune_scout", "storm_hawk", "fire_bolt"],
      mine: ["a", "b", "c", "d", "e"].map(() => field("tide_imp")),
      phase: "MAIN_1",
    });
    expectEndsTurn(state, side);
  });

  it("ia_termina_o_turno_sem_tributos_possiveis", () => {
    const { state, side } = setup({ hand: ["ash_dragon", "blazing_colossus"], phase: "MAIN_1" });
    const result = playAiTurn({ state, side, level: "easy", seed: 4 });
    expect(result.actions.some((a) => a.type === "SUMMON_CARD")).toBe(false);
    expectEndsTurn(state, side);
  });

  it("ia_responde_a_janela_pendente_e_encerra", () => {
    const attackerSide = setup({
      phase: "BATTLE",
      mine: [field("dune_scout")],
      theirs: [field("moss_golem")],
      theirTraps: [trap("spike_pit", 1)],
    });
    const defender = opponentOf(attackerSide.side);
    const opened = applyAction(attackerSide.state, attackerSide.side, {
      type: "ATTACK",
      attackerCardId: "dune_scout",
      targetZone: 0,
    });
    if (!opened.ok) throw new Error("ataque deveria abrir a janela");
    const result = playAiTurn({ state: opened.state, side: defender, level: "easy", seed: 2 });
    expect(result.actions).toHaveLength(1);
    expect(["ACTIVATE_TRAP", "PASS_RESPONSE"]).toContain(result.actions[0]?.type);
    expect(result.state.pendingResponse).toBeNull();
    expect(result.status).toBe("TURN_ENDED");
  });

  it("ia_para_e_espera_quando_a_acao_abre_janela_do_oponente", () => {
    const { state, side } = setup({
      hand: ["dune_scout"],
      theirTraps: [trap("hidden_snare", 1)],
    });
    const result = playAiTurn({ state, side, level: "easy", seed: 2 });
    expect(result.status).toBe("WAITING_RESPONSE");
    expect(result.state.pendingResponse?.responder).toBe(opponentOf(side));
    expect(result.actions.at(-1)?.type).toBe("SUMMON_CARD");
  });

  it("ia_com_limite_pequeno_encerra_o_turno_a_forca", () => {
    const { state, side } = setup({ hand: ["dune_scout", "fire_bolt", "ash_sprite"], phase: "DRAW" });
    for (const maxActions of [2, 3, 4, 5]) {
      const result = playAiTurn({ state, side, level: "easy", seed: 8, maxActions });
      expect(result.actions.length).toBeLessThanOrEqual(maxActions);
      expect(result.status).toBe("TURN_ENDED");
      expect(result.actions.at(-1)).toEqual({ type: "END_TURN" });
    }
  });

  it("ia_fora_do_turno_nao_faz_nada", () => {
    const { state, side } = setup({});
    const result = playAiTurn({ state, side: opponentOf(side), level: "easy", seed: 5 });
    expect(result).toMatchObject({ actions: [], status: "NOT_ACTING", seed: 5 });
    expect(result.state).toBe(state);
  });
});

describe("IA em partidas simuladas", () => {
  const deckIds = DECKS.map((d) => d.id);
  const MAX_TURNS = 80;

  /** Joga uma partida IA x IA com chooseAiAction, afirmando que toda ação passa em applyAction. */
  const simulate = (gameSeed: number, p1: DeckId, p2: DeckId, level: AiLevel): { turns: number; winner: PlayerId | null } => {
    let state = createMatch(gameSeed, { P1: p1, P2: p2 });
    const seeds: Record<PlayerId, number> = { P1: gameSeed * 2 + 1, P2: gameSeed * 2 + 2 };
    let steps = 0;
    while (!state.winner && state.turn <= MAX_TURNS && steps < MAX_TURNS * MAX_AI_ACTIONS_PER_TURN) {
      steps++;
      const side = state.pendingResponse ? state.pendingResponse.responder : state.currentPlayer;
      const decision = chooseAiAction({ state, side, level, seed: seeds[side] });
      seeds[side] = decision.seed;
      expect(decision.action).not.toBeNull();
      const result = applyAction(state, side, decision.action as Action);
      expect(result.ok).toBe(true);
      if (!result.ok) break;
      state = result.state;
    }
    return { turns: state.turn, winner: state.winner };
  };

  it("ia_facil_sempre_joga_acao_valida", () => {
    let finished = 0;
    for (let i = 0; i < 24; i++) {
      const p1 = deckIds[i % deckIds.length]!;
      const p2 = deckIds[(i * 5 + 1) % deckIds.length]!;
      const result = simulate(1000 + i, p1, p2, "easy");
      expect(result.turns).toBeLessThanOrEqual(MAX_TURNS + 1);
      if (result.winner) finished++;
    }
    expect(finished).toBeGreaterThan(0);
  });

  it("ia_medio_e_dificil_tambem_jogam_acoes_validas", () => {
    for (const level of ["medium", "hard"] as AiLevel[]) {
      for (let i = 0; i < 6; i++) {
        simulate(5000 + i, deckIds[i % 6]!, deckIds[(i + 2) % 6]!, level);
      }
    }
  });

  it("ia_playAiTurn_sempre_termina_cada_turno_em_partidas_simuladas", () => {
    for (let i = 0; i < 12; i++) {
      let state = createMatch(300 + i, { P1: deckIds[i % 6]!, P2: deckIds[(i + 3) % 6]! });
      let seed = 900 + i;
      let guard = 0;
      while (!state.winner && state.turn <= MAX_TURNS && guard++ < 1000) {
        const side = state.pendingResponse ? state.pendingResponse.responder : state.currentPlayer;
        const result = playAiTurn({ state, side, level: "easy", seed });
        seed = result.seed;
        expect(result.actions.length).toBeLessThanOrEqual(MAX_AI_ACTIONS_PER_TURN);
        expect(result.actions.length).toBeGreaterThan(0);
        state = result.state;
      }
      expect(state.turn).toBeGreaterThan(1);
    }
  });
});
