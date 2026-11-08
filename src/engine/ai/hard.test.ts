// src/engine/ai/hard.test.ts
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
  oppLife?: number;
  deckSize?: number;
};

type Scenario = { state: MatchState; side: PlayerId };

/** O jogador do turno (`side`) tem mão e campo definidos; o oponente tem campo e vida. */
const setup = ({
  hand = [],
  mine = [],
  mineTraps = [],
  theirs = [],
  theirTraps = [],
  phase = "MAIN_1",
  turn = 5,
  life = 8000,
  oppLife = 8000,
  deckSize,
}: Setup): Scenario => {
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
          deck: deckSize === undefined ? base.players[side].deck : base.players[side].deck.slice(0, deckSize),
          lifePoints: life,
          monsters: pad(mine),
          spellTraps: pad(mineTraps),
          normalSummonUsed: false,
        },
        [other]: { ...base.players[other], lifePoints: oppLife, monsters: pad(theirs), spellTraps: pad(theirTraps) },
      },
    },
  };
};

const decide = (s: Scenario, seed = 5): Action | null =>
  chooseAiAction({ state: s.state, side: s.side, level: "hard", seed }).action;

/**
 * Janela de resposta aberta: o jogador do turno (`s.side`, com `mine`) declara `action`;
 * o defensor (dono de `theirs` e `theirTraps`) decide pelo ponto de vista dele.
 */
const respond = (
  s: Scenario,
  action: Action,
  trigger: "ATTACK_DECLARED" | "SUMMON" | "SPELL_ACTIVATION",
): Action | null => {
  const defender = opponentOf(s.side);
  const state: MatchState = { ...s.state, pendingResponse: { responder: defender, trigger, action } };
  return chooseAiAction({ state, side: defender, level: "hard", seed: 5 }).action;
};

/** Cenário para o defensor: ele tem `mine` e `traps`; o atacante tem `attackers`. */
const defending = (
  mine: MonsterOnField[],
  traps: string[],
  attackers: MonsterOnField[],
  life = 8000,
  hand: string[] = [],
  phase: MatchState["phase"] = "BATTLE",
): Scenario => {
  const s = setup({ hand, mine: attackers, theirs: mine, theirTraps: traps.map((id) => trap(id)), phase });
  const defender = opponentOf(s.side);
  return {
    side: s.side,
    state: { ...s.state, players: { ...s.state.players, [defender]: { ...s.state.players[defender], lifePoints: life } } },
  };
};

const attackAction = (attackerZone: number, targetZone: number | null): Action => ({
  type: "ATTACK",
  attackerZone,
  targetZone,
});

describe("IA nivel dificil: letal e dano direto", () => {
  it("ia_dificil_ataca_direto_quando_o_oponente_nao_tem_monstros", () => {
    const s = setup({ phase: "BATTLE", mine: [field("dune_scout")] });
    expect(decide(s)).toEqual({ type: "ATTACK", attackerZone: 0, targetZone: null });
  });

  it("ia_dificil_fecha_o_letal_somando_os_ataques_diretos", () => {
    const s = setup({ phase: "BATTLE", mine: [field("tide_imp"), field("dune_scout"), field("bone_knight")], oppLife: 3200 });
    expect(decide(s)).toMatchObject({ type: "ATTACK", targetZone: null });
    const result = playAiTurn({ state: s.state, side: s.side, level: "hard", seed: 5 });
    expect(result.state.winner).toBe(s.side);
    expect(result.status).toBe("MATCH_ENDED");
  });

  it("ia_dificil_usa_o_dano_da_magia_quando_e_letal", () => {
    const s = setup({ hand: ["fire_bolt"], oppLife: 800, theirs: [field("bone_knight")], mine: [field("tide_imp")] });
    expect(decide(s)).toEqual({ type: "ACTIVATE_SPELL", cardId: "fire_bolt" });
  });

  it("ia_dificil_combina_dano_de_magia_e_ataques_para_o_letal", () => {
    const s = setup({ hand: ["fire_bolt"], mine: [field("dune_scout")], oppLife: 2400 });
    expect(decide(s)).toEqual({ type: "ACTIVATE_SPELL", cardId: "fire_bolt" });
  });

  it("ia_dificil_guarda_o_dano_da_magia_sem_letal_ate_a_principal_2", () => {
    const s = setup({ hand: ["fire_bolt"], mine: [field("tide_imp")], theirs: [defense("living_wall")] });
    expect(decide(s)).toEqual({ type: "NEXT_PHASE" });
    expect(decide({ ...s, state: { ...s.state, phase: "MAIN_2" } })).toEqual({ type: "ACTIVATE_SPELL", cardId: "fire_bolt" });
  });
});

describe("IA nivel dificil: combate", () => {
  it("ia_dificil_evita_troca_ruim", () => {
    const s = setup({ phase: "BATTLE", mine: [field("bone_knight")], theirs: [field("storm_hawk")] });
    expect(decide(s)).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_dificil_evita_troca_de_valor_igual", () => {
    const s = setup({ phase: "BATTLE", mine: [field("bone_knight")], theirs: [field("bone_knight")] });
    expect(decide(s)).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_dificil_aceita_troca_favoravel_e_prefere_o_alvo_mais_valioso", () => {
    const s = setup({ phase: "BATTLE", mine: [field("dune_scout")], theirs: [field("tide_imp"), field("wall_archer")] });
    expect(decide(s)).toEqual({ type: "ATTACK", attackerZone: 0, targetZone: 1 });
  });

  it("ia_dificil_ordena_os_ataques_usando_o_atacante_mais_fraco_que_vence", () => {
    const s = setup({
      phase: "BATTLE",
      mine: [field("storm_hawk"), field("crystal_bat")],
      theirs: [defense("moss_golem"), defense("ash_sprite")],
    });
    // O Falcão (2100) vence o Golem (DEF 1500); o Morcego (1300) só vence a Fagulha (DEF 500).
    const first = decide(s) as Action;
    expect(first).toEqual({ type: "ATTACK", attackerZone: 0, targetZone: 0 });
    const next = applyAction(s.state, s.side, first);
    expect(next.ok).toBe(true);
    if (next.ok) {
      expect(decide({ state: next.state, side: s.side })).toEqual({ type: "ATTACK", attackerZone: 1, targetZone: 1 });
    }
  });

  it("ia_dificil_nao_ataca_se_o_dano_sofrido_seria_letal", () => {
    const s = setup({ phase: "BATTLE", mine: [field("tide_imp")], theirs: [defense("iron_squire")], life: 500 });
    expect(decide(s)).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_dificil_nao_troca_monstros_quando_o_contra_ataque_seria_letal", () => {
    // A troca de Morcego por Arqueiro é favorável (+valor), mas o Batedor adversário mataria com 1000 de vida.
    const exposed = setup({
      phase: "BATTLE",
      mine: [field("crystal_bat")],
      theirs: [field("wall_archer"), field("dune_scout")],
      life: 1000,
    });
    expect(decide(exposed)).toEqual({ type: "NEXT_PHASE" });
    // Com vida folgada a mesma troca é feita.
    const safe = setup({
      phase: "BATTLE",
      mine: [field("crystal_bat")],
      theirs: [field("wall_archer"), field("dune_scout")],
      life: 8000,
    });
    expect(decide(safe)).toEqual({ type: "ATTACK", attackerZone: 0, targetZone: 0 });
  });

  it("ia_dificil_prefere_o_ataque_que_desfaz_o_letal_iminente", () => {
    // 3 atacantes contra 2 bloqueadores: o Crystal Bat sobra e causa 1300 (letal com 1200 de vida).
    // Destruir a Bruxa em defesa (maior valor) não muda isso; destruir um atacante sim.
    const s = setup({
      phase: "BATTLE",
      mine: [field("storm_hawk"), field("bone_knight")],
      theirs: [defense("frost_witch"), field("dune_scout"), field("bone_knight"), field("crystal_bat")],
      life: 1200,
    });
    const action = decide(s);
    expect(action).toMatchObject({ type: "ATTACK" });
    expect(action).not.toMatchObject({ targetZone: 0 });
    // Sem o letal iminente, o alvo de maior valor (a Bruxa) é o escolhido.
    const calm = setup({
      phase: "BATTLE",
      mine: [field("storm_hawk"), field("bone_knight")],
      theirs: [defense("frost_witch"), field("dune_scout"), field("bone_knight"), field("crystal_bat")],
      life: 8000,
    });
    expect(decide(calm)).toEqual({ type: "ATTACK", attackerZone: 0, targetZone: 0 });
  });

  it("ia_dificil_nao_ataca_monstro_virado_com_atk_baixo", () => {
    const s = setup({
      phase: "BATTLE",
      mine: [field("bone_knight")],
      theirs: [field("tide_imp", { faceDown: true, position: "DEFENSE" })],
    });
    expect(decide(s)).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_dificil_nao_ataca_no_primeiro_turno", () => {
    const s = setup({ phase: "BATTLE", turn: 1, mine: [field("dune_scout")] });
    expect(decide(s)).toEqual({ type: "NEXT_PHASE" });
  });
});

describe("IA nivel dificil: magias", () => {
  it("ia_dificil_remove_o_maior_defensor_antes_do_ataque", () => {
    const s = setup({
      hand: ["wind_gust"],
      mine: [field("dune_scout")],
      theirs: [defense("moss_golem"), defense("frost_witch")],
    });
    expect(decide(s)).toEqual({ type: "ACTIVATE_SPELL", cardId: "wind_gust", targetZone: 1 });
  });

  it("ia_dificil_remove_antes_de_invocar", () => {
    const s = setup({ hand: ["wind_gust", "tide_imp"], mine: [field("dune_scout")], theirs: [defense("frost_witch")] });
    expect(decide(s)).toEqual({ type: "ACTIVATE_SPELL", cardId: "wind_gust", targetZone: 0 });
  });

  it("ia_dificil_nao_gasta_remocao_em_monstro_fraco", () => {
    const s = setup({ hand: ["wind_gust"], mine: [field("dune_scout")], theirs: [defense("ash_sprite")] });
    expect(decide(s)).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_dificil_cura_so_com_vida_baixa", () => {
    const hand = ["healing_spring"];
    expect(decide(setup({ hand, life: 7000 }))).toEqual({ type: "NEXT_PHASE" });
    expect(decide(setup({ hand, life: 3000 }))).toEqual({ type: "ACTIVATE_SPELL", cardId: "healing_spring" });
  });

  it("ia_dificil_cura_para_evitar_a_derrota", () => {
    const s = setup({ hand: ["healing_spring"], life: 5000, theirs: [field("ash_dragon"), field("siege_general")] });
    expect(decide(s)).toEqual({ type: "ACTIVATE_SPELL", cardId: "healing_spring" });
  });

  it("ia_dificil_usa_draw_com_deck_confortavel_e_nao_com_deck_quase_vazio", () => {
    const hand = ["arcane_draw"];
    expect(decide(setup({ hand, deckSize: 5 }))).toEqual({ type: "ACTIVATE_SPELL", cardId: "arcane_draw" });
    for (const deckSize of [1, 2, 3, 4]) {
      expect(decide(setup({ hand, deckSize }))).toEqual({ type: "NEXT_PHASE" });
    }
  });

  it("ia_dificil_reforca_so_quando_o_reforco_vira_o_combate", () => {
    const winning = setup({ hand: ["power_surge"], mine: [field("bone_knight")], theirs: [field("dune_scout")] });
    expect(decide(winning)).toEqual({ type: "ACTIVATE_SPELL", cardId: "power_surge", targetZone: 0 });
    const useless = setup({ hand: ["power_surge"], mine: [field("storm_hawk")], theirs: [field("tide_imp")] });
    expect(decide(useless)).toEqual({ type: "NEXT_PHASE" });
  });
});

describe("IA nivel dificil: invocacao e tributo", () => {
  it("ia_dificil_tributa_o_monstro_de_menor_valor", () => {
    const s = setup({ hand: ["storm_hawk"], mine: [field("moss_golem"), field("tide_imp"), field("bone_knight")] });
    expect(decide(s)).toMatchObject({ type: "SUMMON_CARD", cardId: "storm_hawk", tributeZones: [1] });
  });

  it("ia_dificil_mantem_o_defensor_quando_a_vida_esta_baixa", () => {
    const mine = [defense("stone_sentinel"), field("crystal_bat")];
    expect(decide(setup({ hand: ["storm_hawk"], mine, life: 8000 }))).toMatchObject({
      cardId: "storm_hawk",
      tributeZones: [0],
    });
    expect(decide(setup({ hand: ["storm_hawk"], mine, life: 2500 }))).toMatchObject({
      cardId: "storm_hawk",
      tributeZones: [1],
    });
  });

  it("ia_dificil_nao_tributa_monstro_melhor_por_um_pior", () => {
    const s = setup({ hand: ["basalt_guardian"], mine: [field("ash_dragon")] });
    expect(decide(s)).toEqual({ type: "NEXT_PHASE" });
  });

  it("ia_dificil_escolhe_a_melhor_jogada_por_valor_e_nao_a_primeira_da_lista", () => {
    const s = setup({ hand: ["tide_imp", "dune_scout"] });
    expect(decide(s)).toEqual({ type: "SUMMON_CARD", cardId: "dune_scout", tributeZones: [], zone: 0 });
  });

  it("ia_dificil_baixa_em_defesa_quando_o_oponente_e_mais_forte_e_a_vida_esta_baixa", () => {
    const s = setup({ hand: ["moss_golem"], theirs: [field("ash_dragon")], life: 2000 });
    expect(decide(s)).toEqual({ type: "SET_MONSTER", cardId: "moss_golem", tributeZones: [], zone: 0 });
  });
});

describe("IA nivel dificil: armadilhas", () => {
  it("ia_dificil_ativa_armadilha_contra_ataque_ao_monstro_mais_valioso", () => {
    const s = defending([field("storm_hawk")], ["spike_pit"], [field("dune_scout")]);
    // Ataque de 1700 contra o Falcão (2100) seria só uma troca ruim para o atacante: não gasta.
    expect(respond(s, attackAction(0, 0), "ATTACK_DECLARED")).toEqual({ type: "PASS_RESPONSE" });
    const valuable = defending([field("bone_knight")], ["spike_pit"], [field("dune_scout")]);
    expect(respond(valuable, attackAction(0, 0), "ATTACK_DECLARED")).toEqual({
      type: "ACTIVATE_TRAP",
      zone: 0,
    });
  });

  it("ia_dificil_nao_gasta_armadilha_em_ataque_inofensivo", () => {
    const s = defending([defense("living_wall")], ["mirror_shield"], [field("tide_imp")]);
    expect(respond(s, attackAction(0, 0), "ATTACK_DECLARED")).toEqual({ type: "PASS_RESPONSE" });
  });

  it("ia_dificil_ativa_armadilha_contra_dano_letal", () => {
    const s = defending([], ["mirror_shield"], [field("storm_hawk")], 1500);
    expect(respond(s, attackAction(0, null), "ATTACK_DECLARED")).toEqual({
      type: "ACTIVATE_TRAP",
      zone: 0,
    });
  });

  it("ia_dificil_ativa_armadilha_contra_dano_direto_grande", () => {
    const s = defending([], ["mirror_shield"], [field("dune_scout")], 8000);
    expect(respond(s, attackAction(0, null), "ATTACK_DECLARED")).toEqual({
      type: "ACTIVATE_TRAP",
      zone: 0,
    });
  });

  it("ia_dificil_nao_usa_destruicao_de_atacante_acima_do_limite_de_atk", () => {
    const s = defending([defense("tide_imp")], ["spike_pit"], [field("ash_dragon")]);
    expect(respond(s, attackAction(0, 0), "ATTACK_DECLARED")).toEqual({ type: "PASS_RESPONSE" });
  });

  it("ia_dificil_anula_invocacao_forte_e_ignora_a_fraca", () => {
    const s = defending([], ["hidden_snare"], [], 8000, ["storm_hawk", "tide_imp"], "MAIN_1");
    const strong: Action = { type: "SUMMON_CARD", cardId: "storm_hawk", tributeZones: [], zone: 0 };
    const weak: Action = { type: "SUMMON_CARD", cardId: "tide_imp", tributeZones: [], zone: 0 };
    expect(respond(s, strong, "SUMMON")).toEqual({ type: "ACTIVATE_TRAP", zone: 0 });
    expect(respond(s, weak, "SUMMON")).toEqual({ type: "PASS_RESPONSE" });
  });

  it("ia_dificil_anula_magia_de_dano_letal", () => {
    const s = defending([], ["dark_veil"], [], 600, ["fire_bolt"], "MAIN_1");
    const bolt: Action = { type: "ACTIVATE_SPELL", cardId: "fire_bolt" };
    expect(respond(s, bolt, "SPELL_ACTIVATION")).toEqual({ type: "ACTIVATE_TRAP", zone: 0 });
    const healthy = defending([], ["dark_veil"], [], 8000, ["fire_bolt"], "MAIN_1");
    expect(respond(healthy, bolt, "SPELL_ACTIVATION")).toEqual({ type: "PASS_RESPONSE" });
  });
});

describe("IA nivel dificil: informacao oculta e determinismo", () => {
  const SEEDS = [1, 7, 42, 99, 12345];

  it("ia_dificil_nao_le_a_mao_nem_o_deck_do_oponente", () => {
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
        players: { ...original.players, [other]: { ...opp, hand: [...opp.hand].reverse(), deck: [...opp.deck].reverse() } },
      };
      expect(decide({ state: reshuffled, side: base.side })).toEqual(decide({ state: original, side: base.side }));
    }
  });

  it("ia_dificil_nao_usa_a_identidade_nem_o_bonus_de_monstro_virado_do_oponente", () => {
    const make = (hidden: string): Scenario =>
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

  it("ia_dificil_nao_usa_armadilha_virada_nem_a_semente_do_estado", () => {
    const make = (trapId: string, stateSeed: number): Scenario => {
      const s = setup({ phase: "BATTLE", mine: [field("dune_scout")], theirs: [field("bone_knight")], theirTraps: [trap(trapId)] });
      return { state: { ...s.state, seed: stateSeed }, side: s.side };
    };
    expect(decide(make("spike_pit", 1))).toEqual(decide(make("dark_veil", 99999)));
  });

  it("ia_dificil_e_deterministico_e_devolve_a_mesma_semente", () => {
    const s = setup({ hand: ["storm_hawk", "fire_bolt"], mine: [field("tide_imp")] });
    const a = chooseAiAction({ state: s.state, side: s.side, level: "hard", seed: 77 });
    expect(chooseAiAction({ state: s.state, side: s.side, level: "hard", seed: 77 })).toEqual(a);
    expect(a.seed).toBe(77);
  });
});

describe("IA nivel dificil em partidas simuladas", () => {
  const deckIds: DeckId[] = DECKS.map((d) => d.id);
  const MAX_TURNS = 60;

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

  const duel = (opponent: AiLevel, base: number): { hard: number; other: number } => {
    let hard = 0;
    let other = 0;
    for (let i = 0; i < 20; i++) {
      const hardSide: PlayerId = i % 2 === 0 ? "P1" : "P2";
      const winner = simulate(base + i, { [hardSide]: "hard", [opponentOf(hardSide)]: opponent } as Record<PlayerId, AiLevel>);
      if (winner === hardSide) hard++;
      else if (winner) other++;
    }
    return { hard, other };
  };

  it("ia_dificil_sempre_joga_acao_valida_e_termina_os_turnos_dentro_do_limite", () => {
    for (let i = 0; i < 8; i++) {
      let state = createMatch(600 + i, { P1: deckIds[i % 6]!, P2: deckIds[(i + 3) % 6]! });
      let seed = 70 + i;
      let guard = 0;
      while (!state.winner && state.turn <= MAX_TURNS && guard++ < 1000) {
        const side = state.pendingResponse ? state.pendingResponse.responder : state.currentPlayer;
        const result = playAiTurn({ state, side, level: "hard", seed });
        seed = result.seed;
        expect(result.actions.length).toBeLessThanOrEqual(MAX_AI_ACTIONS_PER_TURN);
        state = result.state;
      }
      expect(state.turn).toBeGreaterThan(1);
    }
  });

  it("ia_dificil_vence_o_medio_na_maioria_das_partidas_simuladas", () => {
    let hard = 0;
    let other = 0;
    for (const base of [3000, 5000, 7000]) {
      const result = duel("medium", base);
      hard += result.hard;
      other += result.other;
    }
    expect(hard).toBeGreaterThan(other);
    expect(hard / (hard + other)).toBeGreaterThanOrEqual(0.6);
  });

  it("ia_dificil_vence_o_facil_na_maioria_das_partidas_simuladas", () => {
    const { hard, other } = duel("easy", 4000);
    expect(hard).toBeGreaterThan(other);
    expect(hard).toBeGreaterThanOrEqual(14);
  });
});
