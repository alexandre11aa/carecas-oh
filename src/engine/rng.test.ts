// src/engine/rng.test.ts
import { describe, expect, it } from "vitest";
import { nextRandom, shuffle } from "./rng.js";

describe("rng", () => {
  it("mesma_semente_gera_mesmo_valor_em_zero_a_um", () => {
    const a = nextRandom(42);
    expect(a).toEqual(nextRandom(42));
    expect(a.value).toBeGreaterThanOrEqual(0);
    expect(a.value).toBeLessThan(1);
  });

  it("embaralha_de_forma_deterministica_sem_alterar_a_entrada", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffle(input, 7);
    expect(a).toEqual(shuffle(input, 7));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...a.items].sort()).toEqual(input);
  });

  it("sementes_diferentes_geram_ordens_diferentes", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(input, 1).items).not.toEqual(shuffle(input, 2).items);
  });
});
