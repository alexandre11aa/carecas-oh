// src/engine/cards.test.ts
import { describe, expect, it } from "vitest";
import { CARDS } from "./cards.js";

describe("cards", () => {
  it("tem_ids_nomes_e_descricoes_unicos", () => {
    expect(CARDS).toHaveLength(60);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(60);
    expect(new Set(CARDS.map((c) => c.name)).size).toBe(60);
    expect(new Set(CARDS.map((c) => c.description)).size).toBe(60);
  });

  it("ids_sao_snake_case", () => {
    for (const card of CARDS) expect(card.id).toMatch(/^[a-z]+(_[a-z]+)*$/);
  });

  it("cartas_novas_tem_efeitos_e_valores_definidos", () => {
    const byId = (id: string) => CARDS.find((c) => c.id === id);
    expect(byId("war_cry")).toMatchObject({ type: "SPELL", effect: { kind: "BOOST_ALL_ATTACK", amount: 400 } });
    expect(byId("life_wall")).toMatchObject({
      effect: { kind: "HEAL_PER_MONSTER", amountPerMonster: 500, maxAmount: 2000 },
    });
    expect(byId("call_beyond")).toMatchObject({ effect: { kind: "REVIVE_MONSTER", maxLevel: 4 } });
    expect(byId("runic_seal")).toMatchObject({ trigger: "SPELL_ACTIVATION", effect: { kind: "NEGATE_SPELL" } });
    expect(byId("blazing_colossus")).toMatchObject({ level: 7, attack: 3300, defense: 1600 });
    expect(byId("granite_giant")).toMatchObject({ level: 7, attack: 2200, defense: 2700 });
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

  it("abyss_titan_foi_removido_do_catalogo", () => {
    expect(CARDS.some((c) => c.id === "abyss_titan")).toBe(false);
  });

  it("cartas_dos_decks_controle_equilibrado_e_estrategico_tem_valores_definidos", () => {
    const byId = (id: string) => CARDS.find((c) => c.id === id);
    expect(byId("silent_rupture")).toMatchObject({ type: "SPELL", effect: { kind: "DESTROY_SPELL_TRAP" } });
    expect(byId("vital_exchange")).toMatchObject({ type: "SPELL", effect: { kind: "DRAIN", amount: 600 } });
    expect(byId("mist_wall")).toMatchObject({ type: "TRAP", trigger: "ATTACK_DECLARED", effect: { kind: "NEGATE_ATTACK" } });
    expect(byId("cunning_scout")).toMatchObject({ level: 2, attack: 800, defense: 500 });
    expect(byId("wall_archer")).toMatchObject({ level: 3, attack: 1300, defense: 1300 });
    expect(byId("tactical_captain")).toMatchObject({ level: 4, attack: 1700, defense: 1000 });
    expect(byId("strategist_knight")).toMatchObject({ level: 5, attack: 2000, defense: 1500 });
    expect(byId("siege_general")).toMatchObject({ level: 7, attack: 2900, defense: 2000 });
    expect(byId("retreat_plan")).toMatchObject({ type: "SPELL", effect: { kind: "BOUNCE_MONSTER" } });
    expect(byId("precise_strike")).toMatchObject({ effect: { kind: "DESTROY_MONSTER", maxAttack: 2000 } });
    expect(byId("tactical_reinforcement")).toMatchObject({ effect: { kind: "BOOST_ATTACK", amount: 700 } });
    expect(byId("inside_information")).toMatchObject({ effect: { kind: "DRAW", count: 1 } });
    expect(byId("counter_offensive")).toMatchObject({
      type: "TRAP",
      trigger: "ATTACK_DECLARED",
      effect: { kind: "DESTROY_ATTACKER", maxAttack: 2000 },
    });
  });

  it("e_serializavel_em_json", () => {
    expect(JSON.parse(JSON.stringify(CARDS))).toEqual(CARDS);
  });
});
