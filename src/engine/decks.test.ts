// src/engine/decks.test.ts
import { describe, expect, it } from "vitest";
import { getCard } from "./cards.js";
import { DECKS, DECK_SIZE, MAX_COPIES, getDeck } from "./decks.js";
import type { DeckId } from "./decks.js";

const composition = (cardIds: readonly string[]) => {
  const c = { monsters: 0, spells: 0, traps: 0 };
  for (const id of cardIds) {
    const card = getCard(id)!;
    if (card.type === "MONSTER") c.monsters++;
    else if (card.type === "SPELL") c.spells++;
    else c.traps++;
  }
  return [c.monsters, c.spells, c.traps];
};

describe("decks", () => {
  it("define_6_decks_com_20_cartas_existentes", () => {
    expect(DECK_SIZE).toBe(20);
    expect(DECKS.map((deck) => deck.id)).toEqual(["aggressive", "defensive", "magic", "control", "balanced", "strategic"]);
    for (const deck of DECKS) {
      expect(deck.cardIds).toHaveLength(DECK_SIZE);
      expect(deck.entries.reduce((sum, entry) => sum + entry.copies, 0)).toBe(DECK_SIZE);
      expect(new Set(deck.cardIds).size).toBe(deck.entries.length);
      for (const id of deck.cardIds) expect(getCard(id), id).toBeDefined();
    }
  });

  it("respeita_a_composicao_de_monstros_magias_armadilhas_de_cada_deck", () => {
    const expected: Record<DeckId, number[]> = {
      aggressive: [12, 6, 2],
      defensive: [10, 4, 6],
      magic: [8, 10, 2],
      control: [8, 6, 6],
      balanced: [10, 6, 4],
      strategic: [10, 8, 2],
    };
    for (const deck of DECKS) expect(composition(deck.cardIds), deck.id).toEqual(expected[deck.id]);
  });

  it("cada_carta_aparece_em_no_maximo_um_deck", () => {
    const all = DECKS.flatMap((deck) => deck.entries.map((entry) => entry.cardId));
    expect(new Set(all).size).toBe(all.length);
  });

  it("cada_carta_tem_de_1_a_3_copias_e_a_carta_exclusiva_apenas_1", () => {
    const signatures: Record<DeckId, string> = {
      aggressive: "war_cry",
      defensive: "life_wall",
      magic: "call_beyond",
      control: "silent_rupture",
      balanced: "vital_exchange",
      strategic: "retreat_plan",
    };
    for (const deck of DECKS) {
      for (const entry of deck.entries) {
        expect(entry.copies, `${deck.id}/${entry.cardId}`).toBeGreaterThanOrEqual(1);
        expect(entry.copies, `${deck.id}/${entry.cardId}`).toBeLessThanOrEqual(MAX_COPIES);
      }
      const unique = deck.cardIds.filter((id) => id === signatures[deck.id]);
      expect(unique, deck.id).toHaveLength(1);
      const others = deck.entries.filter((entry) => entry.cardId !== signatures[deck.id]);
      expect(others.every((entry) => deck.cardIds.filter((id) => id === entry.cardId).length === entry.copies)).toBe(true);
    }
  });

  it("cada_deck_tem_uma_magia_de_efeito_exclusivo", () => {
    const kindsOf = (cardIds: readonly string[]) =>
      cardIds.flatMap((id) => {
        const card = getCard(id)!;
        return card.type === "SPELL" ? [card.effect.kind] : [];
      });
    for (const deck of DECKS) {
      const others = new Set(DECKS.filter((d) => d.id !== deck.id).flatMap((d) => kindsOf(d.cardIds)));
      expect(kindsOf(deck.cardIds).some((kind) => !others.has(kind)), deck.id).toBe(true);
    }
  });

  it("controle_contem_as_cartas_pedidas", () => {
    expect(getDeck("control").cardIds).toEqual(
      expect.arrayContaining(["divine_glory_evasion", "spike_pit", "dark_veil", "power_surge"]),
    );
  });
});
