// src/engine/rules/spells.test.ts
import { describe, expect, it } from "vitest";
import { applyAction } from "../applyAction.js";
import { createMatch } from "../createMatch.js";
import { opponentOf } from "./turn.js";
import type { Action, MatchState, MonsterOnField, PlayerId, SpellTrapOnField } from "../types.js";

const field = (cardId: string, extra: Partial<MonsterOnField> = {}): MonsterOnField => ({
  cardId,
  position: "ATTACK",
  faceDown: false,
  summonedOnTurn: 0,
  hasAttacked: false,
  changedPositionOnTurn: null,
  ...extra,
});

type Setup = {
  hand?: string[];
  deck?: string[];
  mine?: (MonsterOnField | null)[];
  theirs?: (MonsterOnField | null)[];
  spellTraps?: (SpellTrapOnField | null)[];
  phase?: MatchState["phase"];
  myLife?: number;
  theirLife?: number;
};

const pad = <T,>(list: (T | null)[]): (T | null)[] => [...list, ...Array<null>(5 - list.length).fill(null)];

const setup = ({
  hand = [],
  deck,
  mine = [],
  theirs = [],
  spellTraps = [],
  phase = "MAIN_1",
  myLife = 8000,
  theirLife = 8000,
}: Setup) => {
  const base = createMatch(42);
  const p = base.currentPlayer;
  const o = opponentOf(p);
  const state: MatchState = {
    ...base,
    turn: 5,
    phase,
    players: {
      ...base.players,
      [p]: {
        ...base.players[p],
        hand,
        deck: deck ?? base.players[p].deck,
        monsters: pad(mine),
        spellTraps: pad(spellTraps),
        lifePoints: myLife,
      },
      [o]: { ...base.players[o], monsters: pad(theirs), lifePoints: theirLife },
    },
  };
  return { state, p, o };
};

const activate = (cardId: string, targetZone?: number | null): Action => ({
  type: "ACTIVATE_SPELL",
  cardId,
  targetZone,
});
const set = (cardId: string): Action => ({ type: "SET_SPELL_TRAP", cardId });

const ok = (state: MatchState, p: PlayerId, action: Action) => {
  const r = applyAction(state, p, action);
  if (!r.ok) throw new Error(`esperado ok, veio ${r.code}`);
  return r;
};

describe("baixar magia ou armadilha", () => {
  it("baixa_magia_virada_na_primeira_zona_livre", () => {
    const { state, p } = setup({ hand: ["healing_spring"] });
    const r = ok(state, p, set("healing_spring"));
    expect(r.state.players[p].hand).toEqual([]);
    expect(r.state.players[p].spellTraps).toEqual([
      { cardId: "healing_spring", faceDown: true, setOnTurn: 5 },
      null,
      null,
      null,
      null,
    ]);
    expect(r.events).toEqual([{ type: "SPELL_TRAP_SET", player: p, cardId: "healing_spring", zone: 0 }]);
  });

  it("baixa_armadilha_e_nao_altera_o_estado_original", () => {
    const { state, p } = setup({ hand: ["spike_pit"] });
    const before = JSON.stringify(state);
    const r = ok(state, p, set("spike_pit"));
    expect(r.state.players[p].spellTraps[0]?.cardId).toBe("spike_pit");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("recusa_quando_as_5_zonas_estao_ocupadas", () => {
    const full = Array.from({ length: 5 }, () => ({ cardId: "dark_veil", faceDown: true, setOnTurn: 1 }));
    const { state, p } = setup({ hand: ["healing_spring"], spellTraps: full });
    expect(applyAction(state, p, set("healing_spring"))).toEqual({ ok: false, code: "SPELL_TRAP_ZONES_FULL" });
  });

  it("recusa_monstro_carta_fora_da_mao_e_fase_invalida", () => {
    const a = setup({ hand: ["dune_scout"] });
    expect(applyAction(a.state, a.p, set("dune_scout"))).toEqual({ ok: false, code: "NOT_A_SPELL_OR_TRAP" });
    expect(applyAction(a.state, a.p, set("wind_gust"))).toEqual({ ok: false, code: "CARD_NOT_IN_HAND" });
    const b = setup({ hand: ["wind_gust"], phase: "BATTLE" });
    expect(applyAction(b.state, b.p, set("wind_gust"))).toEqual({ ok: false, code: "INVALID_PHASE" });
  });
});

describe("efeitos de magia", () => {
  it("cura_pontos_de_vida_e_envia_ao_cemiterio", () => {
    const { state, p } = setup({ hand: ["healing_spring"], myLife: 5000 });
    const r = ok(state, p, activate("healing_spring"));
    expect(r.state.players[p].lifePoints).toBe(6000);
    expect(r.state.players[p].hand).toEqual([]);
    expect(r.state.players[p].graveyard).toEqual(["healing_spring"]);
    expect(r.events).toEqual([
      { type: "SPELL_ACTIVATED", player: p, cardId: "healing_spring", targetZone: null },
      { type: "LIFE_RESTORED", player: p, amount: 1000 },
      { type: "CARD_SENT_TO_GRAVEYARD", player: p, cardId: "healing_spring" },
    ]);
  });

  it("causa_dano_direto_ao_oponente", () => {
    const { state, p, o } = setup({ hand: ["fire_bolt"] });
    const r = ok(state, p, activate("fire_bolt"));
    expect(r.state.players[o].lifePoints).toBe(7200);
    expect(r.state.players[p].lifePoints).toBe(8000);
    expect(r.state.players[p].graveyard).toEqual(["fire_bolt"]);
    expect(r.events).toContainEqual({ type: "DAMAGE_DEALT", player: o, amount: 800 });
  });

  it("dano_direto_que_zera_a_vida_encerra_a_partida", () => {
    const { state, p } = setup({ hand: ["fire_bolt"], theirLife: 500 });
    const r = ok(state, p, activate("fire_bolt"));
    expect(r.state.players[opponentOf(p)].lifePoints).toBe(0);
    expect(r.state.winner).toBe(p);
    expect(r.events).toContainEqual({ type: "MATCH_ENDED", winner: p });
  });

  it("destroi_monstro_do_oponente", () => {
    const { state, p, o } = setup({ hand: ["wind_gust"], theirs: [field("dune_scout"), field("tide_imp")] });
    const r = ok(state, p, activate("wind_gust", 0));
    expect(r.state.players[o].monsters.map((m) => m?.cardId ?? null)).toEqual([null, "tide_imp", null, null, null]);
    expect(r.state.players[o].graveyard).toEqual(["dune_scout"]);
    expect(r.state.players[p].graveyard).toEqual(["wind_gust"]);
    expect(r.events).toContainEqual({ type: "CARD_SENT_TO_GRAVEYARD", player: o, cardId: "dune_scout" });
  });

  it("destroi_monstro_com_ataque_no_limite_do_maxAttack", () => {
    const { state, p, o } = setup({ hand: ["wind_gust"], theirs: [field("storm_hawk", {}), field("dune_scout")] });
    // storm_hawk tem 2100 (acima do limite de 2000)
    expect(applyAction(state, p, activate("wind_gust", 0))).toEqual({ ok: false, code: "INVALID_TARGET" });
    const r = ok(state, p, activate("wind_gust", 1));
    expect(r.state.players[o].graveyard).toEqual(["dune_scout"]);
  });

  it("maxAttack_considera_o_bonus_de_ataque_do_alvo", () => {
    const { state, p } = setup({ hand: ["wind_gust"], theirs: [field("dune_scout", { attackBonus: 400 })] });
    expect(applyAction(state, p, activate("wind_gust", 0))).toEqual({ ok: false, code: "INVALID_TARGET" });
  });

  it("wind_gust_nao_destroi_o_titan_do_abismo", () => {
    const { state, p } = setup({ hand: ["wind_gust"], theirs: [field("abyss_titan")] });
    expect(applyAction(state, p, activate("wind_gust", 0))).toEqual({ ok: false, code: "INVALID_TARGET" });
  });

  it("destruir_exige_alvo_do_oponente", () => {
    const { state, p } = setup({ hand: ["wind_gust"], mine: [field("tide_imp")], theirs: [field("dune_scout")] });
    expect(applyAction(state, p, activate("wind_gust"))).toEqual({ ok: false, code: "INVALID_TARGET" });
    // zona do oponente vazia, ou fora do intervalo (o campo próprio não conta para este efeito)
    expect(applyAction(state, p, activate("wind_gust", 1))).toEqual({ ok: false, code: "INVALID_TARGET" });
    expect(applyAction(state, p, activate("wind_gust", 5))).toEqual({ ok: false, code: "INVALID_TARGET" });
    expect(applyAction(state, p, activate("wind_gust", -1))).toEqual({ ok: false, code: "INVALID_TARGET" });
  });

  it("destroi_monstro_virado_do_oponente_pela_zona", () => {
    const { state, p, o } = setup({
      hand: ["wind_gust"],
      theirs: [null, null, field("tide_imp", { position: "DEFENSE", faceDown: true })],
    });
    const r = ok(state, p, activate("wind_gust", 2));
    expect(r.state.players[o].monsters[2]).toBeNull();
    expect(r.state.players[o].graveyard).toEqual(["tide_imp"]);
    expect(r.events).toContainEqual({ type: "SPELL_ACTIVATED", player: p, cardId: "wind_gust", targetZone: 2 });
  });

  it("compra_uma_carta", () => {
    const { state, p } = setup({ hand: ["arcane_draw"], deck: ["ash_sprite", "moss_golem"] });
    const r = ok(state, p, activate("arcane_draw"));
    expect(r.state.players[p].hand).toEqual(["ash_sprite"]);
    expect(r.state.players[p].deck).toEqual(["moss_golem"]);
    expect(r.events).toContainEqual({ type: "CARD_DRAWN", player: p, cardId: "ash_sprite" });
  });

  it("comprar_com_deck_vazio_faz_o_jogador_perder", () => {
    const { state, p, o } = setup({ hand: ["arcane_draw"], deck: [] });
    const r = ok(state, p, activate("arcane_draw"));
    expect(r.state.winner).toBe(o);
    expect(r.events).toContainEqual({ type: "MATCH_ENDED", winner: o });
  });

  it("aumenta_ataque_ate_o_fim_do_turno", () => {
    const { state, p, o } = setup({ hand: ["power_surge"], mine: [field("tide_imp")], theirs: [field("ash_sprite")] });
    const boosted = ok(state, p, activate("power_surge", 0));
    expect(boosted.state.players[p].monsters[0]?.attackBonus).toBe(700);
    expect(boosted.events).toContainEqual({ type: "ATTACK_BOOSTED", player: p, cardId: "tide_imp", zone: 0, amount: 700 });

    // tide_imp 600 + 700 = 1300 contra ash_sprite 700 em ataque: destrói e causa 600 de dano
    const battle = ok(boosted.state, p, { type: "NEXT_PHASE" });
    const hit = ok(battle.state, p, { type: "ATTACK", attackerCardId: "tide_imp", targetZone: 0 });
    expect(hit.state.players[o].lifePoints).toBe(7400);
    expect(hit.state.players[o].graveyard).toEqual(["ash_sprite"]);

    // o bônus acaba ao fim do turno
    const end = ok(hit.state, p, { type: "END_TURN" });
    expect(end.state.players[p].monsters[0]?.attackBonus ?? 0).toBe(0);
  });

  it("aumentar_ataque_exige_monstro_proprio", () => {
    const { state, p } = setup({ hand: ["power_surge"], theirs: [field("dune_scout")] });
    expect(applyAction(state, p, activate("power_surge"))).toEqual({ ok: false, code: "INVALID_TARGET" });
    expect(applyAction(state, p, activate("power_surge", 0))).toEqual({ ok: false, code: "INVALID_TARGET" });
    expect(applyAction(state, p, activate("power_surge", 5))).toEqual({ ok: false, code: "INVALID_TARGET" });
  });

  it("aumenta_ataque_de_monstro_proprio_virado_pela_zona", () => {
    const { state, p } = setup({
      hand: ["power_surge"],
      mine: [null, field("tide_imp", { position: "DEFENSE", faceDown: true })],
    });
    const r = ok(state, p, activate("power_surge", 1));
    expect(r.state.players[p].monsters[1]?.attackBonus).toBe(700);
    expect(r.events).toContainEqual({ type: "ATTACK_BOOSTED", player: p, cardId: "tide_imp", zone: 1, amount: 700 });
  });

  it("ativa_magia_baixada_no_campo_e_libera_a_zona", () => {
    const set1 = { cardId: "healing_spring", faceDown: true, setOnTurn: 5 };
    const { state, p } = setup({ spellTraps: [set1], myLife: 1000 });
    const r = ok(state, p, activate("healing_spring"));
    expect(r.state.players[p].lifePoints).toBe(2000);
    expect(r.state.players[p].spellTraps).toEqual([null, null, null, null, null]);
    expect(r.state.players[p].graveyard).toEqual(["healing_spring"]);
  });

  it("permite_ativar_na_principal_2", () => {
    const { state, p } = setup({ hand: ["healing_spring"], phase: "MAIN_2" });
    expect(applyAction(state, p, activate("healing_spring")).ok).toBe(true);
  });
});

describe("erros ao ativar magia", () => {
  it("recusa_fora_da_principal", () => {
    for (const phase of ["DRAW", "BATTLE", "END"] as const) {
      const { state, p } = setup({ hand: ["healing_spring"], phase });
      expect(applyAction(state, p, activate("healing_spring"))).toEqual({ ok: false, code: "INVALID_PHASE" });
    }
  });

  it("recusa_carta_que_nao_esta_na_mao_nem_no_campo", () => {
    const { state, p } = setup({ hand: [] });
    expect(applyAction(state, p, activate("healing_spring"))).toEqual({ ok: false, code: "SPELL_NOT_AVAILABLE" });
  });

  it("recusa_carta_que_nao_e_magia", () => {
    const { state, p } = setup({ hand: ["dune_scout", "spike_pit"] });
    expect(applyAction(state, p, activate("dune_scout"))).toEqual({ ok: false, code: "NOT_A_SPELL" });
    expect(applyAction(state, p, activate("spike_pit"))).toEqual({ ok: false, code: "NOT_A_SPELL" });
  });

  it("recusa_fora_do_turno", () => {
    const { state, o } = setup({ hand: ["healing_spring"] });
    expect(applyAction(state, o, activate("healing_spring"))).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
  });

  it("falha_nao_altera_o_estado", () => {
    const { state, p } = setup({ hand: ["wind_gust"] });
    const before = JSON.stringify(state);
    applyAction(state, p, activate("wind_gust", 0));
    expect(JSON.stringify(state)).toBe(before);
  });
});
