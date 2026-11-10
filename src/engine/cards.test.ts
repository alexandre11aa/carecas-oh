// src/engine/cards.test.ts
import { describe, expect, it } from "vitest";
import { CARDS } from "./cards.js";

describe("cards", () => {
  // Só ids e nomes são únicos: a descrição pode repetir quando duas cartas têm o mesmo efeito
  // e a arte traz o mesmo texto (ex.: Pensamento Negativo e Revide Pessoal, "Causa 800 de dano direto ao oponente.").
  it("tem_ids_e_nomes_unicos", () => {
    expect(CARDS).toHaveLength(60);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(60);
    expect(new Set(CARDS.map((c) => c.name)).size).toBe(60);
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
    expect(byId("blazing_colossus")).toMatchObject({ level: 7, attack: 2700, defense: 1500 });
    expect(byId("granite_giant")).toMatchObject({ level: 7, attack: 2600, defense: 2600 });
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

  it("por_uns_trocados_usa_o_flavor_e_a_descricao_da_arte", () => {
    expect(CARDS.find((c) => c.id === "healing_spring")?.flavor).toBe(
      "Por alguns trocados, nenhum serviço pode ser dispensado pelo usuário, mesmo os mais degradantes.",
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
      image: "/cards/esquiva_da_gloria_divina.webp",
    });
    expect(CARDS.some((c) => c.id === "mirror_wall")).toBe(false);
  });

  it("abyss_titan_foi_removido_do_catalogo", () => {
    expect(CARDS.some((c) => c.id === "abyss_titan")).toBe(false);
  });

  it("cartas_dos_decks_controle_equilibrado_e_estrategico_tem_valores_definidos", () => {
    const byId = (id: string) => CARDS.find((c) => c.id === id);
    expect(byId("silent_rupture")).toMatchObject({ type: "SPELL", effect: { kind: "DESTROY_SPELL_TRAP" } });
    expect(byId("vital_exchange")).toMatchObject({ type: "SPELL", effect: { kind: "DRAIN", amount: 800 } });
    expect(byId("mist_wall")).toMatchObject({ type: "TRAP", trigger: "ATTACK_DECLARED", effect: { kind: "NEGATE_ATTACK" } });
    expect(byId("cunning_scout")).toMatchObject({ level: 2, attack: 800, defense: 500 });
    expect(byId("wall_archer")).toMatchObject({ level: 3, attack: 1300, defense: 1300 });
    expect(byId("tactical_captain")).toMatchObject({ level: 4, attack: 1600, defense: 1000 });
    expect(byId("strategist_knight")).toMatchObject({ level: 5, attack: 1900, defense: 1500 });
    expect(byId("siege_general")).toMatchObject({ level: 7, attack: 2600, defense: 2000 });
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

describe("descricoes_com_valor_do_efeito", () => {
  const valuesOf = (card: (typeof CARDS)[number]): number[] => {
    if (card.type === "MONSTER") return [];
    const e = card.effect;
    switch (e.kind) {
      case "BOOST_ATTACK":
      case "BOOST_ALL_ATTACK":
      case "HEAL":
      case "DAMAGE":
      case "DRAIN":
        return [e.amount];
      case "HEAL_PER_MONSTER":
        return [e.amountPerMonster, e.maxAmount];
      case "DRAW":
        return [e.count];
      case "REVIVE_MONSTER":
        return [e.maxLevel];
      case "DESTROY_MONSTER":
      case "DESTROY_ATTACKER":
        return e.maxAttack === undefined ? [] : [e.maxAttack];
      default:
        return [];
    }
  };

  it("toda_descricao_cita_os_numeros_do_effect", () => {
    for (const card of CARDS) {
      for (const value of valuesOf(card)) {
        expect(card.description, card.id).toMatch(new RegExp(String.raw`(^|\D)${value}(\D|$)`));
      }
    }
  });

  it("surto_de_poder_informa_700", () => {
    expect(CARDS.find((c) => c.id === "power_surge")?.description).toBe(
      "Aumenta o ataque de um monstro seu em ATK 700 até o fim do turno.",
    );
  });
});
