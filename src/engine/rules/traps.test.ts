// src/engine/rules/traps.test.ts
import { describe, expect, it } from "vitest";
import { applyAction } from "../applyAction.js";
import { createMatch } from "../createMatch.js";
import { resolveTrapEffect } from "./traps.js";
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

const trap = (cardId: string, setOnTurn = 4): SpellTrapOnField => ({ cardId, faceDown: true, setOnTurn });

const pad = <T,>(list: (T | null)[]): (T | null)[] => [...list, ...Array<null>(5 - list.length).fill(null)];

type Setup = {
  hand?: string[];
  mine?: (MonsterOnField | null)[];
  mineSpellTraps?: (SpellTrapOnField | null)[];
  theirs?: (MonsterOnField | null)[];
  theirTraps?: (SpellTrapOnField | null)[];
  phase?: MatchState["phase"];
};

/** Turno 5; `p` é o jogador do turno (atacante) e `o` o defensor, dono das armadilhas. */
const setup = ({ hand = [], mine = [], mineSpellTraps = [], theirs = [], theirTraps = [], phase = "BATTLE" }: Setup) => {
  const base = createMatch(42, { P1: "balanced", P2: "strategic" });
  const p = base.currentPlayer;
  const o = opponentOf(p);
  const state: MatchState = {
    ...base,
    turn: 5,
    phase,
    players: {
      ...base.players,
      [p]: { ...base.players[p], hand, monsters: pad(mine), spellTraps: pad(mineSpellTraps) },
      [o]: { ...base.players[o], monsters: pad(theirs), spellTraps: pad(theirTraps) },
    },
  };
  return { state, p, o };
};

const ok = (state: MatchState, p: PlayerId, action: Action) => {
  const r = applyAction(state, p, action);
  if (!r.ok) throw new Error(`esperado ok, veio ${r.code}`);
  return r;
};

const attackWith = (attackerCardId: string, targetZone: number | null): Action => ({
  type: "ATTACK",
  attackerCardId,
  targetZone,
});
const activate = (cardId: string): Action => ({ type: "ACTIVATE_TRAP", cardId });
const pass: Action = { type: "PASS_RESPONSE" };

const battle = (theirTraps: string[]) =>
  setup({
    mine: [field("dune_scout")],
    theirs: [field("bone_knight")],
    theirTraps: theirTraps.map((id) => trap(id)),
  });

describe("armadilha: gatilho de declaracao de ataque", () => {
  it("abre_janela_para_o_defensor_sem_aplicar_o_ataque", () => {
    const { state, p, o } = battle(["divine_glory_evasion"]);
    const r = ok(state, p, attackWith("dune_scout", 0));
    expect(r.events).toEqual([{ type: "RESPONSE_WINDOW_OPENED", responder: o, trigger: "ATTACK_DECLARED" }]);
    expect(r.state.pendingResponse).toEqual({
      trigger: "ATTACK_DECLARED",
      responder: o,
      action: attackWith("dune_scout", 0),
    });
    expect(r.state.players[o].lifePoints).toBe(8000);
    expect(r.state.players[p].monsters[0]?.hasAttacked).toBe(false);
  });

  it("sem_armadilha_elegivel_o_ataque_resolve_direto", () => {
    const { state, p, o } = battle([]);
    const r = ok(state, p, attackWith("dune_scout", 0));
    expect(r.state.pendingResponse).toBeNull();
    expect(r.state.players[o].lifePoints).toBe(7800);
  });

  it("armadilha_de_outro_gatilho_nao_abre_janela_no_ataque", () => {
    const { state, p } = battle(["hidden_snare"]);
    expect(ok(state, p, attackWith("dune_scout", 0)).state.pendingResponse).toBeNull();
  });

  it("armadilha_baixada_no_turno_atual_nao_abre_janela", () => {
    const { state, p } = setup({
      mine: [field("dune_scout")],
      theirs: [field("bone_knight")],
      theirTraps: [trap("divine_glory_evasion", 5)],
    });
    expect(ok(state, p, attackWith("dune_scout", 0)).state.pendingResponse).toBeNull();
  });

  it("ataque_invalido_nao_abre_janela", () => {
    const { state, p } = battle(["divine_glory_evasion"]);
    expect(applyAction(state, p, attackWith("dune_scout", 3))).toEqual({ ok: false, code: "INVALID_TARGET" });
  });

  it("negar_ataque_cancela_o_dano_e_gasta_o_ataque", () => {
    const { state, p, o } = battle(["divine_glory_evasion"]);
    const open = ok(state, p, attackWith("dune_scout", 0)).state;
    const r = ok(open, o, activate("divine_glory_evasion"));
    expect(r.events).toEqual([
      { type: "TRAP_ACTIVATED", player: o, cardId: "divine_glory_evasion", trigger: "ATTACK_DECLARED" },
      { type: "CARD_SENT_TO_GRAVEYARD", player: o, cardId: "divine_glory_evasion" },
      { type: "ATTACK_NEGATED", player: p, attackerCardId: "dune_scout" },
    ]);
    expect(r.state.pendingResponse).toBeNull();
    expect(r.state.players[o].lifePoints).toBe(8000);
    expect(r.state.players[p].lifePoints).toBe(8000);
    expect(r.state.players[o].monsters[0]?.cardId).toBe("bone_knight");
    expect(r.state.players[p].monsters[0]).toMatchObject({ cardId: "dune_scout", hasAttacked: true });
    expect(r.state.players[o].spellTraps.every((s) => s === null)).toBe(true);
    expect(r.state.players[o].graveyard).toEqual(["divine_glory_evasion"]);
  });

  it("destruir_atacante_envia_o_monstro_ao_cemiterio_sem_dano", () => {
    const { state, p, o } = battle(["spike_pit"]);
    const open = ok(state, p, attackWith("dune_scout", 0)).state;
    const r = ok(open, o, activate("spike_pit"));
    expect(r.events).toEqual([
      { type: "TRAP_ACTIVATED", player: o, cardId: "spike_pit", trigger: "ATTACK_DECLARED" },
      { type: "CARD_SENT_TO_GRAVEYARD", player: o, cardId: "spike_pit" },
      { type: "CARD_SENT_TO_GRAVEYARD", player: p, cardId: "dune_scout" },
    ]);
    expect(r.state.players[p].monsters[0]).toBeNull();
    expect(r.state.players[p].graveyard).toEqual(["dune_scout"]);
    expect(r.state.players[o].lifePoints).toBe(8000);
    expect(r.state.players[o].monsters[0]?.cardId).toBe("bone_knight");
  });

  it("passar_a_resposta_retoma_o_ataque", () => {
    const { state, p, o } = battle(["divine_glory_evasion"]);
    const open = ok(state, p, attackWith("dune_scout", 0)).state;
    const r = ok(open, o, pass);
    expect(r.events[0]).toEqual({ type: "RESPONSE_PASSED", player: o });
    expect(r.events[1]).toEqual({ type: "ATTACK_DECLARED", player: p, attackerCardId: "dune_scout", targetZone: 0 });
    expect(r.state.pendingResponse).toBeNull();
    expect(r.state.players[o].lifePoints).toBe(7800);
    expect(r.state.players[o].monsters[0]).toBeNull();
    expect(r.state.players[o].spellTraps[0]?.cardId).toBe("divine_glory_evasion");
  });

  it("nao_altera_o_estado_recebido", () => {
    const { state, p, o } = battle(["divine_glory_evasion"]);
    const open = ok(state, p, attackWith("dune_scout", 0)).state;
    const snapshot = JSON.stringify(open);
    ok(open, o, activate("divine_glory_evasion"));
    expect(JSON.stringify(open)).toBe(snapshot);
  });
});

describe("armadilha: maxAttack do spike_pit", () => {
  it("destroi_atacante_com_ataque_ate_o_limite", () => {
    const { state, p, o } = battle(["spike_pit"]);
    const opened = ok(state, p, attackWith("dune_scout", 0));
    const r = ok(opened.state, o, activate("spike_pit"));
    expect(r.state.players[p].monsters[0]).toBeNull();
    expect(r.state.players[p].graveyard).toEqual(["dune_scout"]);
    expect(r.state.players[o].lifePoints).toBe(8000);
  });

  it("nao_destroi_atacante_com_ataque_acima_do_limite_e_o_ataque_segue", () => {
    const { state, p, o } = setup({
      mine: [field("storm_hawk")],
      theirs: [field("bone_knight")],
      theirTraps: [trap("spike_pit")],
    });
    const opened = ok(state, p, attackWith("storm_hawk", 0));
    const r = ok(opened.state, o, activate("spike_pit"));
    expect(r.state.players[p].monsters[0]?.cardId).toBe("storm_hawk");
    expect(r.state.players[o].graveyard).toEqual(["spike_pit", "bone_knight"]);
    expect(r.state.players[o].lifePoints).toBe(7400);
  });

  it("maxAttack_considera_o_bonus_do_atacante", () => {
    const { state, p, o } = setup({
      mine: [field("dune_scout", { attackBonus: 400 })],
      theirs: [field("bone_knight")],
      theirTraps: [trap("spike_pit")],
    });
    const opened = ok(state, p, attackWith("dune_scout", 0));
    const r = ok(opened.state, o, activate("spike_pit"));
    expect(r.state.players[p].monsters[0]?.cardId).toBe("dune_scout");
    expect(r.state.players[p].graveyard).toEqual([]);
  });

  it("divine_glory_evasion_anula_atacante_forte", () => {
    const { state, p, o } = setup({
      mine: [field("ash_dragon")],
      theirs: [field("bone_knight")],
      theirTraps: [trap("divine_glory_evasion")],
    });
    const opened = ok(state, p, attackWith("ash_dragon", 0));
    const r = ok(opened.state, o, activate("divine_glory_evasion"));
    expect(r.events).toContainEqual({ type: "ATTACK_NEGATED", player: p, attackerCardId: "ash_dragon" });
    expect(r.state.players[o].monsters[0]?.cardId).toBe("bone_knight");
  });
});

describe("armadilha: gatilho de invocacao", () => {
  const summonSetup = () =>
    setup({ hand: ["dune_scout"], phase: "MAIN_1", theirTraps: [trap("hidden_snare")] });
  const summon: Action = { type: "SUMMON_CARD", cardId: "dune_scout", tributeCardIds: [], zone: 0 };

  it("abre_janela_ao_invocar_sem_aplicar_a_invocacao", () => {
    const { state, p, o } = summonSetup();
    const r = ok(state, p, summon);
    expect(r.events).toEqual([{ type: "RESPONSE_WINDOW_OPENED", responder: o, trigger: "SUMMON" }]);
    expect(r.state.players[p].hand).toEqual(["dune_scout"]);
    expect(r.state.players[p].monsters[0]).toBeNull();
  });

  it("baixar_monstro_em_defesa_nao_abre_janela", () => {
    const { state, p } = summonSetup();
    const r = ok(state, p, { type: "SET_MONSTER", cardId: "dune_scout", tributeCardIds: [], zone: 0 });
    expect(r.state.pendingResponse).toBeNull();
    expect(r.state.players[p].monsters[0]?.faceDown).toBe(true);
  });

  it("negar_invocacao_envia_o_monstro_ao_cemiterio_e_gasta_a_invocacao", () => {
    const { state, p, o } = summonSetup();
    const open = ok(state, p, summon).state;
    const r = ok(open, o, activate("hidden_snare"));
    expect(r.events).toEqual([
      { type: "TRAP_ACTIVATED", player: o, cardId: "hidden_snare", trigger: "SUMMON" },
      { type: "CARD_SENT_TO_GRAVEYARD", player: o, cardId: "hidden_snare" },
      { type: "SUMMON_NEGATED", player: p, cardId: "dune_scout" },
      { type: "CARD_SENT_TO_GRAVEYARD", player: p, cardId: "dune_scout" },
    ]);
    expect(r.state.players[p].hand).toEqual([]);
    expect(r.state.players[p].monsters.every((m) => m === null)).toBe(true);
    expect(r.state.players[p].graveyard).toEqual(["dune_scout"]);
    expect(r.state.players[p].normalSummonUsed).toBe(true);
  });

  it("passar_a_resposta_conclui_a_invocacao", () => {
    const { state, p, o } = summonSetup();
    const open = ok(state, p, summon).state;
    const r = ok(open, o, pass);
    expect(r.events.map((e) => e.type)).toEqual(["RESPONSE_PASSED", "MONSTER_SUMMONED"]);
    expect(r.state.players[p].monsters[0]).toMatchObject({ cardId: "dune_scout", position: "ATTACK" });
    expect(r.state.players[p].hand).toEqual([]);
    expect(r.state.pendingResponse).toBeNull();
  });
});

describe("armadilha: gatilho de ativacao de magia", () => {
  const spellSetup = () =>
    setup({ hand: ["fire_bolt"], phase: "MAIN_1", theirTraps: [trap("dark_veil")] });
  const cast: Action = { type: "ACTIVATE_SPELL", cardId: "fire_bolt" };

  it("negar_a_magia_a_envia_ao_cemiterio_sem_efeito", () => {
    const { state, p, o } = spellSetup();
    const open = ok(state, p, cast).state;
    expect(open.pendingResponse?.trigger).toBe("SPELL_ACTIVATION");
    const r = ok(open, o, activate("dark_veil"));
    expect(r.events.map((e) => e.type)).toEqual([
      "TRAP_ACTIVATED",
      "CARD_SENT_TO_GRAVEYARD",
      "SPELL_NEGATED",
      "CARD_SENT_TO_GRAVEYARD",
    ]);
    expect(r.state.players[o].lifePoints).toBe(8000);
    expect(r.state.players[p].hand).toEqual([]);
    expect(r.state.players[p].graveyard).toEqual(["fire_bolt"]);
  });

  it("passar_a_resposta_resolve_a_magia", () => {
    const { state, p, o } = spellSetup();
    const open = ok(state, p, cast).state;
    const r = ok(open, o, pass);
    expect(r.state.players[o].lifePoints).toBe(7200);
    expect(r.state.players[p].graveyard).toEqual(["fire_bolt"]);
  });
});

describe("armadilha: efeito de dano", () => {
  const attackPending = attackWith("dune_scout", 0);

  it("causa_dano_ao_dono_da_acao_e_retoma_a_acao", () => {
    const { state, p } = battle([]);
    const out = resolveTrapEffect({ kind: "DAMAGE", amount: 500 }, state, p, attackPending);
    expect(out.resume).toBe(true);
    expect(out.events).toEqual([{ type: "DAMAGE_DEALT", player: p, amount: 500 }]);
    expect(out.state.players[p].lifePoints).toBe(7500);
  });

  it("dano_letal_encerra_a_partida_e_nao_retoma_a_acao", () => {
    const { state, p, o } = battle([]);
    const low: MatchState = {
      ...state,
      players: { ...state.players, [p]: { ...state.players[p], lifePoints: 300 } },
    };
    const out = resolveTrapEffect({ kind: "DAMAGE", amount: 500 }, low, p, attackPending);
    expect(out.resume).toBe(false);
    expect(out.state.winner).toBe(o);
    expect(out.state.players[p].lifePoints).toBe(0);
    expect(out.events).toContainEqual({ type: "MATCH_ENDED", winner: o });
  });
});

describe("armadilha: erros e bloqueio durante a janela", () => {
  const opened = (traps: string[] = ["divine_glory_evasion"]) => {
    const { state, p, o } = battle(traps);
    return { state: ok(state, p, attackWith("dune_scout", 0)).state, p, o };
  };

  it("jogador_do_turno_nao_age_durante_a_janela", () => {
    const { state, p } = opened();
    expect(applyAction(state, p, { type: "END_TURN" })).toEqual({ ok: false, code: "RESPONSE_PENDING" });
    expect(applyAction(state, p, pass)).toEqual({ ok: false, code: "RESPONSE_PENDING" });
  });

  it("defensor_nao_faz_outra_acao_durante_a_janela", () => {
    const { state, o } = opened();
    expect(applyAction(state, o, { type: "NEXT_PHASE" })).toEqual({ ok: false, code: "RESPONSE_PENDING" });
  });

  it("responder_sem_janela_retorna_no_response_window", () => {
    const { state, o } = battle(["divine_glory_evasion"]);
    expect(applyAction(state, o, pass)).toEqual({ ok: false, code: "NO_RESPONSE_WINDOW" });
    expect(applyAction(state, o, activate("divine_glory_evasion"))).toEqual({ ok: false, code: "NO_RESPONSE_WINDOW" });
  });

  it("armadilha_inexistente_retorna_trap_not_available", () => {
    const { state, o } = opened();
    expect(applyAction(state, o, activate("spike_pit"))).toEqual({ ok: false, code: "TRAP_NOT_AVAILABLE" });
  });

  it("carta_que_nao_e_armadilha_retorna_not_a_trap", () => {
    const { state, p, o } = setup({
      mine: [field("dune_scout")],
      theirs: [field("bone_knight")],
      theirTraps: [trap("divine_glory_evasion"), trap("fire_bolt")],
    });
    const open = ok(state, p, attackWith("dune_scout", 0)).state;
    expect(applyAction(open, o, activate("fire_bolt"))).toEqual({ ok: false, code: "NOT_A_TRAP" });
  });

  it("gatilho_diferente_retorna_trap_trigger_mismatch", () => {
    const { state, p, o } = setup({
      mine: [field("dune_scout")],
      theirs: [field("bone_knight")],
      theirTraps: [trap("divine_glory_evasion"), trap("hidden_snare")],
    });
    const open = ok(state, p, attackWith("dune_scout", 0)).state;
    expect(applyAction(open, o, activate("hidden_snare"))).toEqual({ ok: false, code: "TRAP_TRIGGER_MISMATCH" });
  });

  it("armadilha_baixada_no_turno_atual_retorna_trap_not_active_yet", () => {
    const { state, p, o } = setup({
      mine: [field("dune_scout")],
      theirs: [field("bone_knight")],
      theirTraps: [trap("divine_glory_evasion"), trap("spike_pit", 5)],
    });
    const open = ok(state, p, attackWith("dune_scout", 0)).state;
    expect(applyAction(open, o, activate("spike_pit"))).toEqual({ ok: false, code: "TRAP_NOT_ACTIVE_YET" });
  });

  it("erro_na_resposta_mantem_a_janela_aberta", () => {
    const { state, o } = opened();
    const r = applyAction(state, o, activate("spike_pit"));
    expect(r.ok).toBe(false);
    expect(applyAction(state, o, pass).ok).toBe(true);
  });

  it("armadilha_baixada_so_vale_a_partir_do_turno_seguinte", () => {
    // O defensor baixa a armadilha no próprio turno 4; o atacante ataca no turno 5.
    const { state, p, o } = setup({ mine: [field("dune_scout")], theirs: [field("bone_knight")], phase: "MAIN_1" });
    const setupState: MatchState = {
      ...state,
      turn: 4,
      currentPlayer: o,
      players: { ...state.players, [o]: { ...state.players[o], hand: ["divine_glory_evasion"] } },
    };
    const afterSet = ok(setupState, o, { type: "SET_SPELL_TRAP", cardId: "divine_glory_evasion" }).state;
    expect(afterSet.players[o].spellTraps[0]).toMatchObject({ cardId: "divine_glory_evasion", setOnTurn: 4 });
    const turn5: MatchState = { ...afterSet, turn: 5, currentPlayer: p, phase: "BATTLE" };
    expect(ok(turn5, p, attackWith("dune_scout", 0)).state.pendingResponse).not.toBeNull();
  });
});
