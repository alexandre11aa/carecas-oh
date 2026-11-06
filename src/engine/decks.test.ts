// src/engine/decks.test.ts
import { describe, expect, it } from "vitest";
import { dealDecks } from "./decks";

describe("decks", () => {
  it("mesma_semente_gera_mesma_divisao", () => {
    expect(dealDecks(123)).toEqual(dealDecks(123));
  });

  it("entrega_10_cartas_a_cada_jogador_sem_repeticao_entre_decks", () => {
    const { decks } = dealDecks(99);
    expect(decks.P1).toHaveLength(10);
    expect(decks.P2).toHaveLength(10);
    const all = [...decks.P1, ...decks.P2];
    expect(new Set(all).size).toBe(20);
  });

  it("sementes_diferentes_geram_divisoes_diferentes", () => {
    expect(dealDecks(1).decks).not.toEqual(dealDecks(2).decks);
  });
});
