// src/engine/rules/spellsControlEffects.test.ts
// Efeitos DESTROY_SPELL_TRAP, DRAIN e BOUNCE_MONSTER, com magias de teste (ainda não há cartas que os usam).
import { describe, expect, it, vi } from "vitest";

vi.mock("../cards.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../cards.js")>();
  const fakes = [
    { id: "t_break", name: "t", type: "SPELL", effect: { kind: "DESTROY_SPELL_TRAP" }, image: "", description: "", flavor: "" },
    { id: "t_drain", name: "t", type: "SPELL", effect: { kind: "DRAIN", amount: 600 }, image: "", description: "", flavor: "" },
    { id: "t_bounce", name: "t", type: "SPELL", effect: { kind: "BOUNCE_MONSTER" }, image: "", description: "", flavor: "" },
  ];
  return { ...original, getCard: (id: string) => fakes.find((c) => c.id === id) ?? original.getCard(id) };
});

const { applyAction } = await import("../applyAction.js");
const { createMatch } = await import("../createMatch.js");
const { eventView } = await import("../eventView.js");
const { opponentOf } = await import("./turn.js");
import type { MatchState, MonsterOnField, SpellTrapOnField } from "../types.js";

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

const setup = (
  cardId: string,
  theirs: { monsters?: (MonsterOnField | null)[]; spellTraps?: (SpellTrapOnField | null)[]; life?: number } = {},
) => {
  const base = createMatch(42);
  const p = base.currentPlayer;
  const o = opponentOf(p);
  const state: MatchState = {
    ...base,
    turn: 5,
    phase: "MAIN_1",
    players: {
      ...base.players,
      [p]: { ...base.players[p], hand: [cardId], lifePoints: 3000 },
      [o]: {
        ...base.players[o],
        hand: ["dune_scout"],
        monsters: pad(theirs.monsters ?? []),
        spellTraps: pad(theirs.spellTraps ?? []),
        lifePoints: theirs.life ?? 3000,
      },
    },
  };
  return { state, p, o };
};
const activate = (cardId: string, targetZone?: number) => ({ type: "ACTIVATE_SPELL" as const, cardId, targetZone });
const trap = (cardId: string): SpellTrapOnField => ({ cardId, faceDown: true, setOnTurn: 1 });

describe("DESTROY_SPELL_TRAP", () => {
  it("destroi_armadilha_virada_e_ela_vai_ao_cemiterio_do_dono", () => {
    const { state, p, o } = setup("t_break", { spellTraps: [null, trap("mirror_wall")] });
    const before = JSON.stringify(state);
    const r = applyAction(state, p, activate("t_break", 1));
    if (!r.ok) throw new Error(r.code);
    expect(r.state.players[o].spellTraps).toEqual([null, null, null, null, null]);
    expect(r.state.players[o].graveyard).toEqual([...state.players[o].graveyard, "mirror_wall"]);
    expect(r.state.players[p].graveyard).toEqual([...state.players[p].graveyard, "t_break"]);
    expect(r.events).toEqual([
      { type: "SPELL_ACTIVATED", player: p, cardId: "t_break", targetZone: 1 },
      { type: "CARD_SENT_TO_GRAVEYARD", player: o, cardId: "mirror_wall" },
      { type: "CARD_SENT_TO_GRAVEYARD", player: p, cardId: "t_break" },
    ]);
    // o id aparece apenas pelo cemitério, que é público
    expect(eventView(r.events[1]!, p)).toEqual(r.events[1]);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("falha_em_zona_vazia_ou_sem_alvo_e_nao_altera_o_estado", () => {
    const { state, p } = setup("t_break", { spellTraps: [trap("mirror_wall")] });
    const before = JSON.stringify(state);
    expect(applyAction(state, p, activate("t_break", 3))).toEqual({ ok: false, code: "INVALID_TARGET" });
    expect(applyAction(state, p, activate("t_break"))).toEqual({ ok: false, code: "INVALID_TARGET" });
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("DRAIN", () => {
  it("causa_dano_ao_oponente_e_cura_o_conjurador", () => {
    const { state, p, o } = setup("t_drain");
    const before = JSON.stringify(state);
    const r = applyAction(state, p, activate("t_drain"));
    if (!r.ok) throw new Error(r.code);
    expect(r.state.players[o].lifePoints).toBe(2400);
    expect(r.state.players[p].lifePoints).toBe(3600);
    expect(r.events).toEqual([
      { type: "SPELL_ACTIVATED", player: p, cardId: "t_drain", targetZone: null },
      { type: "DAMAGE_DEALT", player: o, amount: 600 },
      { type: "LIFE_RESTORED", player: p, amount: 600 },
      { type: "CARD_SENT_TO_GRAVEYARD", player: p, cardId: "t_drain" },
    ]);
    expect(r.state.winner).toBeNull();
    expect(JSON.stringify(state)).toBe(before);
  });

  it("zera_a_vida_do_oponente_e_encerra_a_partida", () => {
    const { state, p, o } = setup("t_drain", { life: 400 });
    const r = applyAction(state, p, activate("t_drain"));
    if (!r.ok) throw new Error(r.code);
    expect(r.state.players[o].lifePoints).toBe(0);
    expect(r.state.winner).toBe(p);
    expect(r.events).toContainEqual({ type: "MATCH_ENDED", winner: p });
  });
});

describe("BOUNCE_MONSTER", () => {
  it("devolve_o_monstro_a_mao_do_dono_e_o_bonus_some", () => {
    const { state, p, o } = setup("t_bounce", { monsters: [null, field("bone_knight", { attackBonus: 700 })] });
    const before = JSON.stringify(state);
    const r = applyAction(state, p, activate("t_bounce", 1));
    if (!r.ok) throw new Error(r.code);
    expect(r.state.players[o].monsters[1]).toBeNull();
    expect(r.state.players[o].hand).toEqual(["dune_scout", "bone_knight"]);
    expect(r.state.players[o].graveyard).toEqual(state.players[o].graveyard);
    expect(r.events).toContainEqual({ type: "CARD_RETURNED_TO_HAND", player: o, cardId: "bone_knight", zone: 1, faceDown: false });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("monstro_virado_devolvido_tem_id_oculto_para_o_conjurador", () => {
    const { state, p, o } = setup("t_bounce", { monsters: [field("moss_golem", { faceDown: true, position: "DEFENSE" })] });
    const r = applyAction(state, p, activate("t_bounce", 0));
    if (!r.ok) throw new Error(r.code);
    const event = r.events.find((e) => e.type === "CARD_RETURNED_TO_HAND")!;
    expect(eventView(event, p)).toEqual({ ...event, cardId: null });
    expect(eventView(event, o)).toEqual(event);
  });

  it("monstro_aberto_devolvido_e_publico", () => {
    const { state, p } = setup("t_bounce", { monsters: [field("moss_golem")] });
    const r = applyAction(state, p, activate("t_bounce", 0));
    if (!r.ok) throw new Error(r.code);
    const event = r.events.find((e) => e.type === "CARD_RETURNED_TO_HAND")!;
    expect(eventView(event, p)).toEqual(event);
  });

  it("falha_em_zona_vazia_ou_sem_alvo_e_nao_altera_o_estado", () => {
    const { state, p } = setup("t_bounce", { monsters: [field("moss_golem")] });
    const before = JSON.stringify(state);
    expect(applyAction(state, p, activate("t_bounce", 2))).toEqual({ ok: false, code: "INVALID_TARGET" });
    expect(applyAction(state, p, activate("t_bounce"))).toEqual({ ok: false, code: "INVALID_TARGET" });
    expect(JSON.stringify(state)).toBe(before);
  });
});
