// src/engine/decks.test.ts
import { describe, expect, it } from "vitest";
import { getCard } from "./cards.js";
import { DECKS, DECK_SIZE, getDeck } from "./decks.js";
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
  it("define_6_decks_com_10_cartas_existentes", () => {
    expect(DECKS.map((deck) => deck.id)).toEqual(["aggressive", "defensive", "magic", "control", "balanced", "strategic"]);
    for (const deck of DECKS) {
      expect(deck.cardIds).toHaveLength(DECK_SIZE);
      expect(new Set(deck.cardIds).size).toBe(DECK_SIZE);
      for (const id of deck.cardIds) expect(getCard(id), id).toBeDefined();
    }
  });

  it("respeita_a_composicao_de_monstros_magias_armadilhas_de_cada_deck", () => {
    const expected: Record<DeckId, number[]> = {
      aggressive: [6, 3, 1],
      defensive: [5, 2, 3],
      magic: [4, 5, 1],
      control: [4, 3, 3],
      balanced: [5, 3, 2],
      strategic: [5, 4, 1],
    };
    for (const deck of DECKS) expect(composition(deck.cardIds), deck.id).toEqual(expected[deck.id]);
  });

  it("cada_carta_aparece_em_no_maximo_um_deck", () => {
    const all = DECKS.flatMap((deck) => [...deck.cardIds]);
    expect(new Set(all).size).toBe(all.length);
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
