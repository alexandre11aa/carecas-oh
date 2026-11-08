// src/engine/rules/summon.test.ts
import { describe, expect, it } from "vitest";
import { applyAction } from "../applyAction.js";
import { createMatch } from "../createMatch.js";
import type { Action, MatchState, MonsterOnField, PlayerId } from "../types.js";

const field = (cardId: string, extra: Partial<MonsterOnField> = {}): MonsterOnField => ({
  cardId,
  position: "ATTACK",
  faceDown: false,
  summonedOnTurn: 0,
  hasAttacked: false,
  changedPositionOnTurn: null,
  ...extra,
});

type Setup = { hand?: string[]; monsters?: (MonsterOnField | null)[]; used?: boolean; phase?: MatchState["phase"] };

/** Estado na Principal 1 do turno 5 com mão e campo do jogador atual definidos. */
const setup = ({ hand = [], monsters, used = false, phase = "MAIN_1" }: Setup): { state: MatchState; p: PlayerId } => {
  const base = createMatch(42, { P1: "balanced", P2: "strategic" });
  const p = base.currentPlayer;
  const player = base.players[p];
  return {
    p,
    state: {
      ...base,
      turn: 5,
      phase,
      players: {
        ...base.players,
        [p]: {
          ...player,
          hand,
          monsters: monsters ?? player.monsters,
          normalSummonUsed: used,
        },
      },
    },
  };
};

const fullField = (ids: string[]): MonsterOnField[] => ids.map((id) => field(id));
const run = (state: MatchState, p: PlayerId, action: Action) => applyAction(state, p, action);
const summon = (cardId: string, zone = 0, tributeZones: number[] = []): Action => ({
  type: "SUMMON_CARD",
  cardId,
  tributeZones,
  zone,
});

describe("SUMMON_CARD", () => {
  it("invoca_monstro_nivel_baixo_em_ataque_virado_para_cima", () => {
    const { state, p } = setup({ hand: ["dune_scout", "tide_imp"] });
    const r = run(state, p, summon("dune_scout", 2));
    if (!r.ok) throw new Error("esperado ok");
    const player = r.state.players[p];
    expect(player.hand).toEqual(["tide_imp"]);
    expect(player.monsters[2]).toEqual(field("dune_scout", { summonedOnTurn: 5 }));
    expect(player.normalSummonUsed).toBe(true);
    expect(r.events).toEqual([
      { type: "MONSTER_SUMMONED", player: p, cardId: "dune_scout", zone: 2, position: "ATTACK", faceDown: false },
    ]);
  });

  it("nao_altera_o_estado_recebido", () => {
    const { state, p } = setup({ hand: ["dune_scout"] });
    const snapshot = structuredClone(state);
    run(state, p, summon("dune_scout"));
    expect(state).toEqual(snapshot);
  });

  it("funciona_na_principal_2", () => {
    const { state, p } = setup({ hand: ["dune_scout"], phase: "MAIN_2" });
    expect(run(state, p, summon("dune_scout")).ok).toBe(true);
  });

  it("nivel_5_exige_1_tributo_e_envia_ao_cemiterio", () => {
    const { state, p } = setup({
      hand: ["storm_hawk"],
      monsters: [field("tide_imp"), null, null, null, null],
    });
    const r = run(state, p, summon("storm_hawk", 0, [0]));
    if (!r.ok) throw new Error("esperado ok");
    const player = r.state.players[p];
    expect(player.graveyard).toEqual(["tide_imp"]);
    expect(player.monsters[0]?.cardId).toBe("storm_hawk");
    expect(r.events).toEqual([
      { type: "CARD_SENT_TO_GRAVEYARD", player: p, cardId: "tide_imp" },
      { type: "MONSTER_SUMMONED", player: p, cardId: "storm_hawk", zone: 0, position: "ATTACK", faceDown: false },
    ]);
  });

  it("nivel_6_exige_1_tributo", () => {
    const { state, p } = setup({ hand: ["iron_minotaur"] });
    expect(run(state, p, summon("iron_minotaur"))).toEqual({ ok: false, code: "NOT_ENOUGH_TRIBUTES" });
  });

  it("nivel_7_exige_2_tributos", () => {
    const { state, p } = setup({
      hand: ["ash_dragon"],
      monsters: [field("tide_imp"), field("ash_sprite"), null, null, null],
    });
    expect(run(state, p, summon("ash_dragon", 2, [0]))).toEqual({
      ok: false,
      code: "NOT_ENOUGH_TRIBUTES",
    });
    const r = run(state, p, summon("ash_dragon", 0, [0, 1]));
    if (!r.ok) throw new Error("esperado ok");
    expect(r.state.players[p].graveyard).toEqual(["tide_imp", "ash_sprite"]);
    expect(r.state.players[p].monsters.map((m) => m?.cardId ?? null)).toEqual(["ash_dragon", null, null, null, null]);
  });

  it("nivel_7_exige_2_tributos", () => {
    const { state, p } = setup({ hand: ["ash_dragon"], monsters: [field("tide_imp"), null, null, null, null] });
    expect(run(state, p, summon("ash_dragon", 1, [0]))).toEqual({ ok: false, code: "NOT_ENOUGH_TRIBUTES" });
  });

  it("rejeita_tributos_a_mais_repetidos_ou_fora_do_campo", () => {
    const monsters = [field("tide_imp"), field("ash_sprite"), null, null, null];
    const one = setup({ hand: ["storm_hawk"], monsters });
    expect(run(one.state, one.p, summon("storm_hawk", 2, [0, 1]))).toEqual({
      ok: false,
      code: "INVALID_TRIBUTES",
    });
    expect(run(one.state, one.p, summon("storm_hawk", 2, [3]))).toEqual({
      ok: false,
      code: "INVALID_TRIBUTES",
    });
    const two = setup({ hand: ["ash_dragon"], monsters });
    expect(run(two.state, two.p, summon("ash_dragon", 2, [0, 0]))).toEqual({
      ok: false,
      code: "INVALID_TRIBUTES",
    });
    expect(run(one.state, one.p, summon("dune_scout", 2, [0]))).toEqual({
      ok: false,
      code: "CARD_NOT_IN_HAND",
    });
  });

  it("nao_permite_tributar_monstro_do_oponente", () => {
    const { state, p } = setup({ hand: ["storm_hawk"] });
    const other: PlayerId = p === "P1" ? "P2" : "P1";
    const enemy = state.players[other];
    const withEnemy: MatchState = {
      ...state,
      players: { ...state.players, [other]: { ...enemy, monsters: [field("tide_imp"), null, null, null, null] } },
    };
    expect(run(withEnemy, p, summon("storm_hawk", 1, [0]))).toEqual({ ok: false, code: "INVALID_TRIBUTES" });
  });

  it("segunda_invocacao_no_turno_retorna_erro", () => {
    const { state, p } = setup({ hand: ["dune_scout", "tide_imp"] });
    const first = run(state, p, summon("dune_scout", 0));
    if (!first.ok) throw new Error("esperado ok");
    expect(run(first.state, p, summon("tide_imp", 1))).toEqual({ ok: false, code: "NORMAL_SUMMON_ALREADY_USED" });
  });

  it("nao_permite_invocar_fora_das_fases_principais", () => {
    for (const phase of ["DRAW", "BATTLE", "END"] as const) {
      const { state, p } = setup({ hand: ["dune_scout"], phase });
      expect(run(state, p, summon("dune_scout"))).toEqual({ ok: false, code: "INVALID_PHASE" });
    }
  });

  it("campo_cheio_retorna_erro", () => {
    const { state, p } = setup({
      hand: ["dune_scout"],
      monsters: fullField(["tide_imp", "ash_sprite", "moss_golem", "bone_knight", "crystal_bat"]),
    });
    expect(run(state, p, summon("dune_scout", 0))).toEqual({ ok: false, code: "FIELD_FULL" });
  });

  it("campo_cheio_permite_invocar_com_tributo_na_zona_liberada", () => {
    const { state, p } = setup({
      hand: ["storm_hawk"],
      monsters: fullField(["tide_imp", "ash_sprite", "moss_golem", "bone_knight", "crystal_bat"]),
    });
    expect(run(state, p, summon("storm_hawk", 0, [1]))).toEqual({ ok: false, code: "ZONE_OCCUPIED" });
    const r = run(state, p, summon("storm_hawk", 1, [1]));
    if (!r.ok) throw new Error("esperado ok");
    expect(r.state.players[p].monsters[1]?.cardId).toBe("storm_hawk");
  });

  it("zona_ocupada_ou_invalida_retorna_erro", () => {
    const { state, p } = setup({ hand: ["dune_scout"], monsters: [field("tide_imp"), null, null, null, null] });
    expect(run(state, p, summon("dune_scout", 0))).toEqual({ ok: false, code: "ZONE_OCCUPIED" });
    expect(run(state, p, summon("dune_scout", 5))).toEqual({ ok: false, code: "INVALID_ZONE" });
    expect(run(state, p, summon("dune_scout", -1))).toEqual({ ok: false, code: "INVALID_ZONE" });
    expect(run(state, p, summon("dune_scout", 1.5))).toEqual({ ok: false, code: "INVALID_ZONE" });
  });

  it("rejeita_carta_que_nao_e_monstro", () => {
    const { state, p } = setup({ hand: ["wind_gust"] });
    expect(run(state, p, summon("wind_gust"))).toEqual({ ok: false, code: "NOT_A_MONSTER" });
  });

  it("nao_permite_jogar_fora_do_turno", () => {
    const { state, p } = setup({ hand: ["dune_scout"] });
    const other: PlayerId = p === "P1" ? "P2" : "P1";
    expect(run(state, other, summon("dune_scout"))).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
  });
});

describe("SET_MONSTER", () => {
  it("baixa_em_defesa_virada_e_conta_como_invocacao_normal", () => {
    const { state, p } = setup({ hand: ["dune_scout", "tide_imp"] });
    const r = run(state, p, { type: "SET_MONSTER", cardId: "dune_scout", tributeZones: [], zone: 3 });
    if (!r.ok) throw new Error("esperado ok");
    expect(r.state.players[p].monsters[3]).toEqual(
      field("dune_scout", { position: "DEFENSE", faceDown: true, summonedOnTurn: 5 }),
    );
    expect(r.state.players[p].normalSummonUsed).toBe(true);
    expect(r.events).toEqual([
      { type: "MONSTER_SUMMONED", player: p, cardId: "dune_scout", zone: 3, position: "DEFENSE", faceDown: true },
    ]);
    expect(run(r.state, p, summon("tide_imp", 0))).toEqual({ ok: false, code: "NORMAL_SUMMON_ALREADY_USED" });
  });

  it("exige_tributo_para_monstro_nivel_alto", () => {
    const { state, p } = setup({ hand: ["storm_hawk"] });
    expect(run(state, p, { type: "SET_MONSTER", cardId: "storm_hawk", tributeZones: [], zone: 0 })).toEqual({
      ok: false,
      code: "NOT_ENOUGH_TRIBUTES",
    });
  });
});

describe("CHANGE_POSITION", () => {
  const change: Action = { type: "CHANGE_POSITION", zone: 0 };

  it("alterna_ataque_para_defesa", () => {
    const { state, p } = setup({ monsters: [field("dune_scout"), null, null, null, null] });
    const r = run(state, p, change);
    if (!r.ok) throw new Error("esperado ok");
    expect(r.state.players[p].monsters[0]).toEqual(
      field("dune_scout", { position: "DEFENSE", changedPositionOnTurn: 5 }),
    );
    expect(r.events).toEqual([
      { type: "POSITION_CHANGED", player: p, cardId: "dune_scout", position: "DEFENSE", faceDown: false },
    ]);
  });

  it("monstro_virado_vira_para_cima_ao_mudar_para_ataque", () => {
    const { state, p } = setup({
      monsters: [field("dune_scout", { position: "DEFENSE", faceDown: true }), null, null, null, null],
    });
    const r = run(state, p, change);
    if (!r.ok) throw new Error("esperado ok");
    expect(r.state.players[p].monsters[0]).toEqual(field("dune_scout", { changedPositionOnTurn: 5 }));
  });

  it("so_uma_vez_por_turno_por_monstro", () => {
    const { state, p } = setup({ monsters: [field("dune_scout"), field("tide_imp"), null, null, null] });
    const first = run(state, p, change);
    if (!first.ok) throw new Error("esperado ok");
    expect(run(first.state, p, change)).toEqual({ ok: false, code: "ALREADY_CHANGED_POSITION" });
    expect(run(first.state, p, { type: "CHANGE_POSITION", zone: 1 }).ok).toBe(true);
  });

  it("pode_mudar_novamente_no_turno_seguinte", () => {
    const { state, p } = setup({
      monsters: [field("dune_scout", { changedPositionOnTurn: 3 }), null, null, null, null],
    });
    expect(run(state, p, change).ok).toBe(true);
  });

  it("nao_permite_mudar_no_turno_em_que_foi_invocado", () => {
    const { state, p } = setup({ hand: ["dune_scout"] });
    const summoned = run(state, p, summon("dune_scout"));
    if (!summoned.ok) throw new Error("esperado ok");
    expect(run(summoned.state, p, change)).toEqual({ ok: false, code: "CANNOT_CHANGE_POSITION" });
  });

  it("nao_permite_mudar_depois_de_atacar", () => {
    const { state, p } = setup({ monsters: [field("dune_scout", { hasAttacked: true }), null, null, null, null] });
    expect(run(state, p, change)).toEqual({ ok: false, code: "CANNOT_CHANGE_POSITION" });
  });

  it("exige_fase_principal_e_monstro_no_campo", () => {
    const battle = setup({ monsters: [field("dune_scout"), null, null, null, null], phase: "BATTLE" });
    expect(run(battle.state, battle.p, change)).toEqual({ ok: false, code: "INVALID_PHASE" });
    const empty = setup({});
    expect(run(empty.state, empty.p, change)).toEqual({ ok: false, code: "MONSTER_NOT_ON_FIELD" });
  });
});

describe("FLIP_SUMMON", () => {
  const flip: Action = { type: "FLIP_SUMMON", zone: 0 };
  const faceDown = field("dune_scout", { position: "DEFENSE", faceDown: true });

  it("vira_monstro_baixado_em_ataque_virado_para_cima", () => {
    const { state, p } = setup({ monsters: [faceDown, null, null, null, null] });
    const r = run(state, p, flip);
    if (!r.ok) throw new Error("esperado ok");
    expect(r.state.players[p].monsters[0]).toEqual(field("dune_scout", { changedPositionOnTurn: 5 }));
    expect(r.events).toEqual([{ type: "MONSTER_FLIPPED", player: p, cardId: "dune_scout" }]);
  });

  it("nao_permite_virar_no_turno_em_que_foi_baixado", () => {
    const { state, p } = setup({ hand: ["dune_scout"] });
    const set = run(state, p, { type: "SET_MONSTER", cardId: "dune_scout", tributeZones: [], zone: 0 });
    if (!set.ok) throw new Error("esperado ok");
    expect(run(set.state, p, flip)).toEqual({ ok: false, code: "CANNOT_CHANGE_POSITION" });
  });

  it("nao_permite_virar_monstro_ja_virado_para_cima", () => {
    const { state, p } = setup({ monsters: [field("dune_scout"), null, null, null, null] });
    expect(run(state, p, flip)).toEqual({ ok: false, code: "NOT_FACE_DOWN" });
  });

  it("conta_como_a_mudanca_de_posicao_do_turno", () => {
    const { state, p } = setup({ monsters: [faceDown, null, null, null, null] });
    const r = run(state, p, flip);
    if (!r.ok) throw new Error("esperado ok");
    expect(run(r.state, p, { type: "CHANGE_POSITION", zone: 0 })).toEqual({
      ok: false,
      code: "ALREADY_CHANGED_POSITION",
    });
  });
});

describe("cartas iguais no campo", () => {
  it("tributar_uma_copia_mantem_as_outras_e_manda_so_uma_ao_cemiterio", () => {
    const { state, p } = setup({
      hand: ["storm_hawk"],
      monsters: [field("tide_imp"), field("tide_imp"), field("tide_imp"), null, null],
    });
    const r = run(state, p, summon("storm_hawk", 1, [1]));
    if (!r.ok) throw new Error("esperado ok");
    expect(r.state.players[p].monsters.map((m) => m?.cardId ?? null)).toEqual([
      "tide_imp",
      "storm_hawk",
      "tide_imp",
      null,
      null,
    ]);
    expect(r.state.players[p].graveyard).toEqual(["tide_imp"]);
  });

  it("dois_tributos_em_zonas_diferentes_de_copias_iguais_sao_aceitos_e_a_mesma_zona_duas_vezes_nao", () => {
    const { state, p } = setup({
      hand: ["ash_dragon"],
      monsters: [field("tide_imp"), field("tide_imp"), field("tide_imp"), null, null],
    });
    expect(run(state, p, summon("ash_dragon", 0, [2, 2]))).toEqual({ ok: false, code: "INVALID_TRIBUTES" });
    const r = run(state, p, summon("ash_dragon", 0, [0, 2]));
    if (!r.ok) throw new Error("esperado ok");
    expect(r.state.players[p].monsters.map((m) => m?.cardId ?? null)).toEqual([
      "ash_dragon",
      "tide_imp",
      null,
      null,
      null,
    ]);
    expect(r.state.players[p].graveyard).toEqual(["tide_imp", "tide_imp"]);
  });

  it("mudar_posicao_de_uma_copia_nao_afeta_a_outra", () => {
    const { state, p } = setup({ monsters: [field("dune_scout"), field("dune_scout"), null, null, null] });
    const r = run(state, p, { type: "CHANGE_POSITION", zone: 1 });
    if (!r.ok) throw new Error("esperado ok");
    expect(r.state.players[p].monsters[0]).toEqual(field("dune_scout"));
    expect(r.state.players[p].monsters[1]).toEqual(
      field("dune_scout", { position: "DEFENSE", changedPositionOnTurn: 5 }),
    );
    expect(run(r.state, p, { type: "CHANGE_POSITION", zone: 1 })).toEqual({ ok: false, code: "ALREADY_CHANGED_POSITION" });
    expect(run(r.state, p, { type: "CHANGE_POSITION", zone: 0 }).ok).toBe(true);
  });

  it("virar_uma_de_duas_copias_viradas_nao_vira_a_outra", () => {
    const down = field("dune_scout", { position: "DEFENSE", faceDown: true });
    const { state, p } = setup({ monsters: [down, down, null, null, null] });
    const r = run(state, p, { type: "FLIP_SUMMON", zone: 1 });
    if (!r.ok) throw new Error("esperado ok");
    expect(r.state.players[p].monsters[0]).toEqual(down);
    expect(r.state.players[p].monsters[1]).toEqual(field("dune_scout", { changedPositionOnTurn: 5 }));
  });

  it("zona_invalida_ou_vazia_nao_muda_posicao", () => {
    const { state, p } = setup({ monsters: [field("dune_scout"), null, null, null, null] });
    for (const zone of [1, -1, 5, 0.5]) {
      expect(run(state, p, { type: "CHANGE_POSITION", zone })).toEqual({ ok: false, code: "MONSTER_NOT_ON_FIELD" });
      expect(run(state, p, { type: "FLIP_SUMMON", zone })).toEqual({ ok: false, code: "MONSTER_NOT_ON_FIELD" });
    }
  });
});
