// src/engine/rules/spellsNewEffects.test.ts
// Efeitos BOOST_ALL_ATTACK, HEAL_PER_MONSTER e REVIVE_MONSTER, com magias de teste (ainda não há cartas que os usam).
import { describe, expect, it, vi } from "vitest";

vi.mock("../cards.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../cards.js")>();
  const fakes = [
    { id: "t_boost_all", name: "t", type: "SPELL", effect: { kind: "BOOST_ALL_ATTACK", amount: 400 }, image: "", description: "", flavor: "" },
    { id: "t_heal_each", name: "t", type: "SPELL", effect: { kind: "HEAL_PER_MONSTER", amountPerMonster: 500, maxAmount: 2000 }, image: "", description: "", flavor: "" },
    { id: "t_revive", name: "t", type: "SPELL", effect: { kind: "REVIVE_MONSTER", maxLevel: 4 }, image: "", description: "", flavor: "" },
  ];
  return { ...original, getCard: (id: string) => fakes.find((c) => c.id === id) ?? original.getCard(id) };
});

const { applyAction } = await import("../applyAction.js");
const { createMatch } = await import("../createMatch.js");
const { eventView } = await import("../eventView.js");
const { opponentOf } = await import("./turn.js");
import type { MatchState, MonsterOnField } from "../types.js";

const field = (cardId: string, extra: Partial<MonsterOnField> = {}): MonsterOnField => ({
  cardId,
  position: "ATTACK",
  faceDown: false,
  summonedOnTurn: 0,
  hasAttacked: false,
  changedPositionOnTurn: null,
  ...extra,
});

const pad = <T,>(list: (T | null)[]): (T | null)[] => [...list, ...Array<null>(5 - list.length).fill(null)];

const setup = (cardId: string, mine: (MonsterOnField | null)[], graveyard: string[] = [], life = 3000) => {
  const base = createMatch(42, { P1: "balanced", P2: "strategic" });
  const p = base.currentPlayer;
  const o = opponentOf(p);
  const state: MatchState = {
    ...base,
    turn: 5,
    phase: "MAIN_1",
    players: {
      ...base.players,
      [p]: { ...base.players[p], hand: [cardId], monsters: pad(mine), graveyard, lifePoints: life },
    },
  };
  return { state, p, o };
};

const activate = (cardId: string) => ({ type: "ACTIVATE_SPELL" as const, cardId });

describe("BOOST_ALL_ATTACK", () => {
  it("reforca_todos_os_monstros_proprios_inclusive_virados", () => {
    const { state, p, o } = setup("t_boost_all", [field("dune_scout"), null, field("moss_golem", { faceDown: true, attackBonus: 100 })]);
    const before = JSON.stringify(state);
    const r = applyAction(state, p, activate("t_boost_all"));
    if (!r.ok) throw new Error(r.code);
    expect(r.state.players[p].monsters.map((m) => m?.attackBonus)).toEqual([400, undefined, 500, undefined, undefined]);
    expect(r.state.players[p].graveyard).toEqual(["t_boost_all"]);
    expect(r.events).toEqual([
      { type: "SPELL_ACTIVATED", player: p, cardId: "t_boost_all", targetZone: null },
      { type: "ATTACK_BOOSTED", player: p, cardId: "dune_scout", zone: 0, amount: 400 },
      { type: "ATTACK_BOOSTED", player: p, cardId: "moss_golem", zone: 2, amount: 400 },
      { type: "CARD_SENT_TO_GRAVEYARD", player: p, cardId: "t_boost_all" },
    ]);
    expect(JSON.stringify(state)).toBe(before);
    // o oponente nao ve o id do monstro virado reforcado
    const seen = r.events.map((e) => eventView(e, o)).filter((e) => e.type === "ATTACK_BOOSTED");
    expect(seen.map((e) => ("cardId" in e ? e.cardId : undefined))).toEqual([null, null]);
  });
});

describe("HEAL_PER_MONSTER", () => {
  it("cura_por_monstro_proprio", () => {
    const { state, p } = setup("t_heal_each", [field("dune_scout"), field("moss_golem")]);
    const before = JSON.stringify(state);
    const r = applyAction(state, p, activate("t_heal_each"));
    if (!r.ok) throw new Error(r.code);
    expect(r.state.players[p].lifePoints).toBe(4000);
    expect(r.events).toContainEqual({ type: "LIFE_RESTORED", player: p, amount: 1000 });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("respeita_o_teto", () => {
    const { state, p } = setup("t_heal_each", [field("a"), field("b"), field("c"), field("d"), field("e")]);
    const r = applyAction(state, p, activate("t_heal_each"));
    if (!r.ok) throw new Error(r.code);
    expect(r.state.players[p].lifePoints).toBe(5000);
  });

  it("sem_monstros_nao_cura_e_nao_gera_evento_de_cura", () => {
    const { state, p } = setup("t_heal_each", []);
    const r = applyAction(state, p, activate("t_heal_each"));
    if (!r.ok) throw new Error(r.code);
    expect(r.state.players[p].lifePoints).toBe(3000);
    expect(r.events.some((e) => e.type === "LIFE_RESTORED")).toBe(false);
  });
});

describe("REVIVE_MONSTER", () => {
  it("revive_o_de_maior_atk_elegivel_em_ataque_na_primeira_zona_livre", () => {
    const { state, p, o } = setup("t_revive", [field("tide_imp")], ["ash_sprite", "storm_hawk", "dune_scout", "bone_knight"]);
    const before = JSON.stringify(state);
    const r = applyAction(state, p, activate("t_revive"));
    if (!r.ok) throw new Error(r.code);
    expect(r.state.players[p].monsters[1]).toEqual({
      cardId: "dune_scout",
      position: "ATTACK",
      faceDown: false,
      summonedOnTurn: 5,
      hasAttacked: false,
      changedPositionOnTurn: null,
    });
    expect(r.state.players[p].graveyard).toEqual(["ash_sprite", "storm_hawk", "bone_knight", "t_revive"]);
    const summoned = { type: "MONSTER_SUMMONED", player: p, cardId: "dune_scout", zone: 1, position: "ATTACK", faceDown: false };
    expect(r.events).toContainEqual(summoned);
    expect(eventView(summoned as never, o)).toEqual(summoned);
    expect(r.state.players[p].normalSummonUsed).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("desempata_pela_ordem_do_cemiterio", () => {
    const { state, p } = setup("t_revive", [], ["bone_knight", "bone_knight"]);
    const r = applyAction(state, p, activate("t_revive"));
    if (!r.ok) throw new Error(r.code);
    expect(r.state.players[p].graveyard).toEqual(["bone_knight", "t_revive"]);
  });

  it("falha_sem_monstro_elegivel_e_nao_altera_o_estado", () => {
    const { state, p } = setup("t_revive", [], ["storm_hawk", "healing_spring"]);
    const before = JSON.stringify(state);
    expect(applyAction(state, p, activate("t_revive"))).toEqual({ ok: false, code: "NO_ELIGIBLE_MONSTER" });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("falha_com_campo_cheio", () => {
    const { state, p } = setup("t_revive", [field("a"), field("b"), field("c"), field("d"), field("e")], ["dune_scout"]);
    expect(applyAction(state, p, activate("t_revive"))).toEqual({ ok: false, code: "FIELD_FULL" });
  });
});
