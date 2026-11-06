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

  it("toda_carta_tem_flavor_nao_vazio", () => {
    for (const card of CARDS) {
      expect(card.flavor.trim().length, card.id).toBeGreaterThan(0);
    }
  });

  it("fonte_curativa_usa_o_flavor_definido", () => {
    expect(CARDS.find((c) => c.id === "healing_spring")?.flavor).toBe(
      "Fonte abençoada que concede refrigério a quem disfruta da oportunidade de beber sua água.",
    );
  });

  it("esquiva_da_gloria_divina_tem_id_nome_efeito_e_imagem_definidos", () => {
    const card = CARDS.find((c) => c.id === "divine_glory_evasion");
    expect(card).toMatchObject({
      id: "divine_glory_evasion",
      name: "Esquiva da Glória Divina",
      type: "TRAP",
      trigger: "ATTACK_DECLARED",
      effect: { kind: "NEGATE_ATTACK" },
      image: "/cards/esquiva_da_gloria_divina.png",
    });
    expect(CARDS.some((c) => c.id === "mirror_wall")).toBe(false);
  });

  it("e_serializavel_em_json", () => {
    expect(JSON.parse(JSON.stringify(CARDS))).toEqual(CARDS);
  });
});
