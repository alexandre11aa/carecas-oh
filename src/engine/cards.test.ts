// src/engine/cards.test.ts
import { describe, expect, it } from "vitest";
import { CARDS } from "./cards.js";

describe("cards", () => {
  it("tem_20_cartas_com_ids_unicos", () => {
    expect(CARDS).toHaveLength(20);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(20);
  });

  it("cobre_faixas_de_nivel_e_ao_menos_3_magias_e_3_armadilhas", () => {
    const levels = CARDS.flatMap((c) => (c.type === "MONSTER" ? [c.level] : []));
    expect(levels.some((l) => l >= 1 && l <= 4)).toBe(true);
    expect(levels.some((l) => l >= 5 && l <= 6)).toBe(true);
    expect(levels.some((l) => l >= 7)).toBe(true);
    expect(CARDS.filter((c) => c.type === "SPELL").length).toBeGreaterThanOrEqual(3);
    expect(CARDS.filter((c) => c.type === "TRAP").length).toBeGreaterThanOrEqual(3);
  });

  it("e_serializavel_em_json", () => {
    expect(JSON.parse(JSON.stringify(CARDS))).toEqual(CARDS);
  });
});
