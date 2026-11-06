// src/engine/decks.test.ts
import { describe, expect, it } from "vitest";
import { getCard } from "./cards";
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

  it("divide_por_categoria_de_forma_balanceada_com_varias_sementes", () => {
    const counts = (ids: string[]) => {
      const c = { low: 0, mid: 0, high: 0, spell: 0, trap: 0 };
      for (const id of ids) {
        const card = getCard(id)!;
        if (card.type === "SPELL") c.spell++;
        else if (card.type === "TRAP") c.trap++;
        else if (card.level <= 4) c.low++;
        else if (card.level <= 6) c.mid++;
        else c.high++;
      }
      return c;
    };
    for (let seed = 1; seed <= 200; seed++) {
      const { decks } = dealDecks(seed);
      const a = counts(decks.P1);
      const b = counts(decks.P2);
      expect(decks.P1).toHaveLength(10);
      expect(decks.P2).toHaveLength(10);
      expect(new Set([...decks.P1, ...decks.P2]).size).toBe(20);
      // P1 recebe a carta extra na primeira categoria ímpar (nível 5-6), P2 na seguinte (magia)
      expect(a).toEqual({ low: 3, mid: 2, high: 1, spell: 2, trap: 2 });
      expect(b).toEqual({ low: 3, mid: 1, high: 1, spell: 3, trap: 2 });
      const monstersA = a.low + a.mid + a.high;
      const monstersB = b.low + b.mid + b.high;
      expect(Math.abs(monstersA - monstersB)).toBeLessThanOrEqual(1);
      expect(a.mid + a.high).toBeGreaterThanOrEqual(1);
      expect(b.mid + b.high).toBeGreaterThanOrEqual(1);
    }
  });
});
