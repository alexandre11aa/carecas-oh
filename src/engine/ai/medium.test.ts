// src/engine/ai/medium.test.ts
import { describe, expect, it } from "vitest";
import { applyAction } from "../applyAction.js";
import { createMatch } from "../createMatch.js";
import { DECKS, type DeckId } from "../decks.js";
import { opponentOf } from "../rules/turn.js";
import type { Action, MatchState, MonsterOnField, PlayerId, SpellTrapOnField } from "../types.js";
import { chooseAiAction, playAiTurn } from "./choose.js";
import { MAX_AI_ACTIONS_PER_TURN, type AiLevel } from "./types.js";

const field = (cardId: string, extra: Partial<MonsterOnField> = {}): MonsterOnField => ({
  cardId,
  position: "ATTACK",
  faceDown: false,
  summonedOnTurn: 0,
  hasAttacked: false,
  changedPositionOnTurn: null,
  ...extra,
});

const defense = (cardId: string): MonsterOnField => field(cardId, { position: "DEFENSE" });
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
  life?: number;
  normalSummonUsed?: boolean;
};

const setup = ({
  hand = [],
  mine = [],
  mineTraps = [],
  theirs = [],
  theirTraps = [],
  phase = "MAIN_1",
  turn = 5,
  life = 8000,
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
          lifePoints: life,
          monsters: pad(mine),
          spellTraps: pad(mineTraps),
          normalSummonUsed,
        },
        [other]: { ...base.players[other], monsters: pad(theirs), spellTraps: pad(theirTraps) },
      },
    },
  };
};

const decide = (s: { state: MatchState; side: PlayerId }, seed = 5): Action | null =>
  chooseAiAction({ state: s.state, side: s.side, level: "medium", seed }).action;

describe("IA nivel medio: invocacao", () => {
  it("ia_medio_invoca_o_monstro_de_maior_atk", () => {
    const s = setup({ hand: ["ash_sprite", "dune_scout", "bone_knight"] });
    expect(decide(s)).toEqual({ type: "SUMMON_CARD", cardId: "dune_scout", tributeZones: [], zone: 0 });
  });

  it("ia_medio_tributa_o_monstro_mais_fraco_no_nivel_5_a_6", () => {
    const s = setup({ hand: ["storm_hawk"], mine: [field("moss_golem"), field("tide_imp"), field("bone_knight")] });
    const action = decide(s);
    expect(action).toMatchObject({ type: "SUMMON_CARD", cardId: "storm_hawk", tributeZones: [1] });
  });

  it("ia_medio_tributa_os_dois_mais_fracos_no_nivel_7", () => {
    const s = setup({
      hand: ["ash_dragon"],
      mine: [field("bone_knight"), field("tide_imp"), field("moss_golem"), field("dune_scout")],
    });
    const action = decide(s);
    expect(action?.type).toBe("SUMMON_CARD");
    if (action?.type !== "SUMMON_CARD") return;
    expect(new Set(action.tributeZones)).toEqual(new Set([1, 2]));
  });

  it("ia_medio_nao_tributa_monstros_mais_fortes_que_o_invocado", () => {
    const s = setup({ hand: ["storm_hawk"], mine: [field("ash_dragon")] });
    expect(decide(s)).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_medio_baixa_em_defesa_virada_sem_vantagem_para_atacar", () => {
    const s = setup({ hand: ["dune_scout", "moss_golem"], theirs: [field("ash_dragon")] });
    expect(decide(s)).toEqual({ type: "SET_MONSTER", cardId: "moss_golem", tributeZones: [], zone: 0 });
  });

  it("ia_medio_ignora_ameaca_de_monstro_do_oponente_em_defesa", () => {
    const s = setup({ hand: ["dune_scout"], theirs: [defense("ash_dragon")] });
    expect(decide(s)).toEqual({ type: "SUMMON_CARD", cardId: "dune_scout", tributeZones: [], zone: 0 });
  });
});

describe("IA nivel medio: ataque", () => {
  it("ia_medio_ataca_quando_o_atk_vence_o_atk_do_alvo", () => {
    const s = setup({ phase: "BATTLE", mine: [field("dune_scout")], theirs: [field("bone_knight")] });
    expect(decide(s)).toEqual({ type: "ATTACK", attackerZone: 0, targetZone: 0 });
  });

  it("ia_medio_ataca_quando_o_atk_vence_a_def_do_alvo", () => {
    const s = setup({ phase: "BATTLE", mine: [field("dune_scout")], theirs: [defense("moss_golem")] });
    expect(decide(s)).toEqual({ type: "ATTACK", attackerZone: 0, targetZone: 0 });
  });

  it("ia_medio_nao_ataca_em_empate_nem_em_desvantagem", () => {
    const empate = setup({ phase: "BATTLE", mine: [field("dune_scout")], theirs: [field("dune_scout")] });
    expect(decide(empate)).toEqual({ type: "NEXT_PHASE" });
    const perde = setup({ phase: "BATTLE", mine: [field("moss_golem")], theirs: [defense("moss_golem")] });
    expect(decide(perde)).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_medio_considera_o_bonus_de_atk_no_ataque", () => {
    const sem = setup({ phase: "BATTLE", mine: [field("dune_scout")], theirs: [field("storm_hawk")] });
    expect(decide(sem)).toEqual({ type: "NEXT_PHASE" });
    const com = setup({
      phase: "BATTLE",
      mine: [field("dune_scout", { attackBonus: 700 })],
      theirs: [field("storm_hawk")],
    });
    expect(decide(com)).toEqual({ type: "ATTACK", attackerZone: 0, targetZone: 0 });
  });

  it("ia_medio_ataca_o_alvo_mais_forte_que_consegue_vencer", () => {
    const s = setup({
      phase: "BATTLE",
      mine: [field("storm_hawk")],
      theirs: [field("tide_imp"), field("bone_knight")],
    });
    expect(decide(s)).toEqual({ type: "ATTACK", attackerZone: 0, targetZone: 1 });
  });

  it("ia_medio_ataca_direto_quando_o_oponente_nao_tem_monstros", () => {
    const s = setup({ phase: "BATTLE", mine: [field("tide_imp")] });
    expect(decide(s)).toEqual({ type: "ATTACK", attackerZone: 0, targetZone: null });
  });

  it("ia_medio_nunca_ataca_no_primeiro_turno", () => {
    const s = setup({ phase: "BATTLE", turn: 1, mine: [field("dune_scout")] });
    expect(decide(s)).toEqual({ type: "NEXT_PHASE" });
    const played = playAiTurn({ state: s.state, side: s.side, level: "medium", seed: 3 });
    expect(played.actions.some((a) => a.type === "ATTACK")).toBe(false);
  });

  it("ia_medio_so_ataca_monstro_virado_com_atk_alto", () => {
    const hidden = field("ash_sprite", { faceDown: true, position: "DEFENSE" });
    const fraco = setup({ phase: "BATTLE", mine: [field("dune_scout")], theirs: [hidden] });
    expect(decide(fraco)).toEqual({ type: "NEXT_PHASE" });
    const forte = setup({ phase: "BATTLE", mine: [field("storm_hawk")], theirs: [hidden] });
    expect(decide(forte)).toEqual({ type: "ATTACK", attackerZone: 0, targetZone: 0 });
  });
});

describe("IA nivel medio: posicao", () => {
  it("ia_medio_vai_para_defesa_com_atk_baixo_diante_de_monstro_mais_forte", () => {
    const s = setup({ mine: [field("tide_imp")], theirs: [field("dune_scout")] });
    expect(decide(s)).toEqual({ type: "CHANGE_POSITION", zone: 0 });
  });

  it("ia_medio_fica_em_defesa_enquanto_ha_monstro_mais_forte", () => {
    const s = setup({ mine: [defense("tide_imp")], theirs: [field("dune_scout")] });
    expect(decide(s)).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_medio_troca_para_ataque_quando_passa_a_ser_o_mais_forte", () => {
    const s = setup({ mine: [defense("ash_dragon")], theirs: [field("dune_scout")] });
    expect(decide(s)).toEqual({ type: "CHANGE_POSITION", zone: 0 });
  });

  it("ia_medio_vira_monstro_baixado_quando_e_o_mais_forte", () => {
    const set = field("ash_dragon", { faceDown: true, position: "DEFENSE" });
    const s = setup({ mine: [set], theirs: [field("dune_scout")] });
    expect(decide(s)).toEqual({ type: "FLIP_SUMMON", zone: 0 });
  });
});

describe("IA nivel medio: magias", () => {
  it("ia_medio_cura_so_com_vida_abaixo_de_50_por_cento", () => {
    const baixa = setup({ hand: ["healing_spring"], life: 1999 });
    expect(decide(baixa)).toEqual({ type: "ACTIVATE_SPELL", cardId: "healing_spring" });
    const meio = setup({ hand: ["healing_spring"], life: 2000 });
    expect(decide(meio)).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_medio_reforca_o_ataque_antes_de_atacar_quando_isso_vence", () => {
    const s = setup({ hand: ["power_surge"], mine: [field("dune_scout")], theirs: [field("storm_hawk")] });
    expect(decide(s)).toEqual({ type: "ACTIVATE_SPELL", cardId: "power_surge", targetZone: 0 });
    const emDefesa = setup({ hand: ["power_surge"], mine: [field("dune_scout")], theirs: [defense("frost_witch")] });
    expect(decide(emDefesa)).toEqual({ type: "ACTIVATE_SPELL", cardId: "power_surge", targetZone: 0 });
  });

  it("ia_medio_nao_reforca_quando_o_reforco_nao_basta_ou_nao_e_preciso", () => {
    const naoBasta = setup({ hand: ["power_surge"], mine: [field("dune_scout")], theirs: [defense("granite_giant")] });
    expect(decide(naoBasta)).toEqual({ type: "NEXT_PHASE" });
    const jaVence = setup({ hand: ["power_surge"], mine: [field("dune_scout")], theirs: [field("bone_knight")] });
    expect(decide(jaVence)).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_medio_destroi_o_monstro_mais_forte_que_a_magia_alcanca", () => {
    const s = setup({
      hand: ["wind_gust"],
      theirs: [field("bone_knight"), field("storm_hawk"), field("dune_scout")],
    });
    // storm_hawk (2100) passa do limite de 2000: o alvo é o dune_scout (zona 2).
    expect(decide(s)).toEqual({ type: "ACTIVATE_SPELL", cardId: "wind_gust", targetZone: 2 });
  });

  it("ia_medio_compra_antes_de_invocar", () => {
    const s = setup({ hand: ["dune_scout", "arcane_draw"] });
    expect(decide(s)).toEqual({ type: "ACTIVATE_SPELL", cardId: "arcane_draw" });
  });

  it("ia_medio_nao_compra_com_deck_quase_vazio", () => {
    const s = setup({ hand: ["arcane_draw"] });
    const short: MatchState = {
      ...s.state,
      players: { ...s.state.players, [s.side]: { ...s.state.players[s.side], deck: [] } },
    };
    expect(decide({ state: short, side: s.side })).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_medio_usa_magia_de_dano", () => {
    const s = setup({ hand: ["fire_bolt"] });
    expect(decide(s)).toEqual({ type: "ACTIVATE_SPELL", cardId: "fire_bolt" });
  });

  it("ia_medio_baixa_armadilha_da_mao", () => {
    const s = setup({ hand: ["spike_pit"] });
    expect(decide(s)).toEqual({ type: "SET_SPELL_TRAP", cardId: "spike_pit" });
  });
});

describe("IA nivel medio: armadilhas", () => {
  /** O lado da IA é o defensor; o oponente declara o ataque e abre a janela. */
  const respond = (
    attacker: string,
    defenderMonsters: (MonsterOnField | null)[],
    traps: string[],
    targetZone: number | null = 0,
  ): Action | null => {
    const s = setup({
      phase: "BATTLE",
      mine: [field(attacker)],
      theirs: defenderMonsters,
      theirTraps: traps.map((id) => trap(id, 1)),
    });
    const opened = applyAction(s.state, s.side, { type: "ATTACK", attackerZone: 0, targetZone });
    if (!opened.ok) throw new Error("o ataque deveria abrir a janela");
    return chooseAiAction({ state: opened.state, side: opponentOf(s.side), level: "medium", seed: 1 }).action;
  };

  it("ia_medio_ativa_armadilha_quando_o_atacante_e_mais_forte_que_o_melhor_defensor", () => {
    expect(respond("dune_scout", [field("moss_golem")], ["spike_pit"])).toEqual({
      type: "ACTIVATE_TRAP",
      zone: 0,
    });
  });

  it("ia_medio_passa_quando_o_atacante_e_fraco_e_o_dano_e_pequeno", () => {
    expect(respond("tide_imp", [field("dune_scout")], ["spike_pit"])).toEqual({ type: "PASS_RESPONSE" });
  });

  it("ia_medio_ativa_quando_o_dano_seria_grande", () => {
    // Defensor em ataque com ATK maior que o atacante nao existe; ataque direto causa dano total.
    expect(respond("dune_scout", [], ["mirror_shield"], null)).toEqual({ type: "ACTIVATE_TRAP", zone: 0 });
  });

  it("ia_medio_prefere_destruir_o_atacante_e_anula_quando_ele_e_forte_demais", () => {
    expect(respond("dune_scout", [field("moss_golem")], ["mirror_shield", "spike_pit"])).toEqual({
      type: "ACTIVATE_TRAP",
      zone: 1,
    });
    expect(respond("storm_hawk", [field("moss_golem")], ["mirror_shield", "spike_pit"])).toEqual({
      type: "ACTIVATE_TRAP",
      zone: 0,
    });
  });

  it("ia_medio_passa_se_a_unica_armadilha_nao_destroi_o_atacante_forte", () => {
    expect(respond("storm_hawk", [field("moss_golem")], ["spike_pit"])).toEqual({ type: "PASS_RESPONSE" });
  });
});

describe("IA nivel medio: informacao oculta e determinismo", () => {
  const SEEDS = [1, 7, 42, 99, 12345];

  it("ia_medio_nao_le_a_mao_nem_o_deck_do_oponente", () => {
    const base = setup({
      hand: ["dune_scout", "fire_bolt", "wind_gust", "power_surge"],
      mine: [field("tide_imp"), field("moss_golem")],
      theirs: [field("iron_minotaur"), field("ash_sprite", { faceDown: true, position: "DEFENSE" })],
      theirTraps: [trap("dark_veil"), trap("spike_pit")],
    });
    const other = opponentOf(base.side);
    for (const phase of ["MAIN_1", "BATTLE", "MAIN_2"] as MatchState["phase"][]) {
      const original: MatchState = { ...base.state, phase };
      const opp = original.players[other];
      const reshuffled: MatchState = {
        ...original,
        players: {
          ...original.players,
          [other]: { ...opp, hand: [...opp.hand].reverse(), deck: [...opp.deck].reverse() },
        },
      };
      expect(decide({ state: reshuffled, side: base.side })).toEqual(decide({ state: original, side: base.side }));
    }
  });

  it("ia_medio_nao_usa_a_identidade_nem_o_bonus_de_monstro_virado_do_oponente", () => {
    const make = (hidden: string): { state: MatchState; side: PlayerId } =>
      setup({
        phase: "BATTLE",
        mine: [field("storm_hawk")],
        hand: ["wind_gust"],
        theirs: [field(hidden, { faceDown: true, position: "DEFENSE", attackBonus: hidden === "ash_dragon" ? 900 : 0 })],
      });
    for (const phase of ["MAIN_1", "BATTLE"] as MatchState["phase"][]) {
      for (const seed of SEEDS) {
        const a = make("ash_dragon");
        const b = make("tide_imp");
        expect(decide({ state: { ...a.state, phase }, side: a.side }, seed)).toEqual(
          decide({ state: { ...b.state, phase }, side: b.side }, seed),
        );
      }
    }
  });

  it("ia_medio_nao_usa_armadilha_virada_nem_a_semente_do_estado", () => {
    const make = (trapId: string, stateSeed: number) => {
      const s = setup({ phase: "BATTLE", mine: [field("dune_scout")], theirs: [field("bone_knight")], theirTraps: [trap(trapId)] });
      return { state: { ...s.state, seed: stateSeed }, side: s.side };
    };
    expect(decide(make("spike_pit", 1))).toEqual(decide(make("dark_veil", 99999)));
  });

  it("ia_medio_e_deterministico_e_devolve_a_mesma_semente", () => {
    const s = setup({ hand: ["storm_hawk", "fire_bolt"], mine: [field("tide_imp")] });
    const a = chooseAiAction({ state: s.state, side: s.side, level: "medium", seed: 77 });
    expect(chooseAiAction({ state: s.state, side: s.side, level: "medium", seed: 77 })).toEqual(a);
    expect(a.seed).toBe(77);
  });
});

describe("IA nivel medio em partidas simuladas", () => {
  const deckIds: DeckId[] = DECKS.map((d) => d.id);
  const MAX_TURNS = 60;

  /** Joga uma partida; cada lado usa o seu nível e toda ação precisa passar em `applyAction`. */
  const simulate = (gameSeed: number, levels: Record<PlayerId, AiLevel>): PlayerId | null => {
    let state = createMatch(gameSeed, {
      P1: deckIds[gameSeed % deckIds.length]!,
      P2: deckIds[(gameSeed * 5 + 1) % deckIds.length]!,
    });
    const seeds: Record<PlayerId, number> = { P1: gameSeed * 2 + 1, P2: gameSeed * 2 + 2 };
    let guard = 0;
    while (!state.winner && state.turn <= MAX_TURNS && guard++ < 4000) {
      const side = state.pendingResponse ? state.pendingResponse.responder : state.currentPlayer;
      const decision = chooseAiAction({ state, side, level: levels[side], seed: seeds[side] });
      seeds[side] = decision.seed;
      expect(decision.action).not.toBeNull();
      const result = applyAction(state, side, decision.action as Action);
      expect(result.ok).toBe(true);
      if (!result.ok) break;
      state = result.state;
    }
    return state.winner;
  };

  it("ia_medio_sempre_joga_acao_valida_e_termina_os_turnos_dentro_do_limite", () => {
    for (let i = 0; i < 8; i++) {
      let state = createMatch(400 + i, { P1: deckIds[i % 6]!, P2: deckIds[(i + 3) % 6]! });
      let seed = 50 + i;
      let guard = 0;
      while (!state.winner && state.turn <= MAX_TURNS && guard++ < 1000) {
        const side = state.pendingResponse ? state.pendingResponse.responder : state.currentPlayer;
        const result = playAiTurn({ state, side, level: "medium", seed });
        seed = result.seed;
        expect(result.actions.length).toBeLessThanOrEqual(MAX_AI_ACTIONS_PER_TURN);
        state = result.state;
      }
      expect(state.turn).toBeGreaterThan(1);
    }
  });

  it("ia_medio_vence_o_facil_na_maioria_das_partidas_simuladas", () => {
    let mediumWins = 0;
    let easyWins = 0;
    for (let i = 0; i < 20; i++) {
      const mediumSide: PlayerId = i % 2 === 0 ? "P1" : "P2";
      const winner = simulate(2000 + i, { [mediumSide]: "medium", [opponentOf(mediumSide)]: "easy" } as Record<PlayerId, AiLevel>);
      if (winner === mediumSide) mediumWins++;
      else if (winner) easyWins++;
    }
    expect(mediumWins).toBeGreaterThan(easyWins);
    expect(mediumWins).toBeGreaterThanOrEqual(12);
  });
});
