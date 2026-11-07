// src/client/screens/cardDetail.test.ts
import { describe, expect, it } from "vitest";
import { createMatch } from "../../engine/createMatch.js";
import { playerView } from "../../engine/playerView.js";
import { getCard } from "../../engine/cards.js";
import { allSlots } from "../scene/layout.js";
import { buildCardDetail, describeSpellEffect, slotCardId } from "./cardDetail.js";

describe("buildCardDetail", () => {
  it("monta_textos_de_monstro_com_efeito_e_mecanica", () => {
    const card = getCard("ash_dragon")!;
    expect(buildCardDetail("ash_dragon")).toEqual({
      id: "ash_dragon",
      kind: "monster",
      name: "Dragão de Cinzas",
      typeLabel: "Monstro · Nível 7",
      stats: "ATK 2800 / DEF 2100",
      effect: card.description,
      mechanic: card.flavor,
    });
  });

  it("monta_textos_de_magia_e_armadilha_sem_atk_def", () => {
    expect(buildCardDetail("healing_spring")).toMatchObject({ kind: "spell", typeLabel: "Magia", stats: null });
    expect(buildCardDetail("spike_pit")).toMatchObject({ kind: "trap", typeLabel: "Armadilha", stats: null });
  });

  it("carta_oculta_ou_desconhecida_nao_mostra_detalhes", () => {
    expect(buildCardDetail(null)).toBeNull();
    expect(buildCardDetail(undefined)).toBeNull();
    expect(buildCardDetail("nao_existe")).toBeNull();
  });
});

describe("slotCardId", () => {
  it("devolve_o_topo_do_cemiterio_e_oculta_monstro_virado_do_oponente", () => {
    const view = playerView(createMatch(7), "P1");
    const slot = (side: "you" | "opponent", kind: "monster" | "graveyard") => allSlots().find((s) => s.side === side && s.kind === kind && s.zone === 0)!;
    const withCards = {
      ...view,
      you: { ...view.you, graveyard: ["healing_spring", "ash_dragon"] },
      opponent: { ...view.opponent, monsters: [{ cardId: null, faceDown: true }, null, null, null, null] },
    } as unknown as typeof view;
    expect(slotCardId(withCards, slot("you", "graveyard"))).toBe("ash_dragon");
    expect(slotCardId(withCards, slot("opponent", "monster"))).toBeNull();
    expect(slotCardId(withCards, slot("you", "monster"))).toBeNull();
  });
});

describe("describeSpellEffect", () => {
  it("descreve_os_efeitos_novos", () => {
    expect(describeSpellEffect({ kind: "BOOST_ALL_ATTACK", amount: 400 })).toEqual({
      effect: "Todos os seus monstros no campo ganham 400 de ATK até o fim do turno.",
      mechanic: "Sem alvo. Vale também para monstros virados.",
    });
    expect(describeSpellEffect({ kind: "HEAL_PER_MONSTER", amountPerMonster: 500, maxAmount: 2000 })).toEqual({
      effect: "Você recupera 500 pontos de vida por monstro seu no campo, até 2000.",
      mechanic: "Sem alvo. Sem monstros no campo, não cura nada.",
    });
    expect(describeSpellEffect({ kind: "REVIVE_MONSTER", maxLevel: 4 })).toEqual({
      effect: "Traz ao campo, em ataque, o monstro de maior ATK do seu cemitério com nível 4 ou menos.",
      mechanic: "Sem alvo. Em empate de ATK, vale o mais antigo no cemitério. Exige uma zona de monstro livre.",
    });
  });

  it("descreve_os_efeitos_existentes", () => {
    expect(describeSpellEffect({ kind: "DRAW", count: 1 }).effect).toBe("Você compra 1 carta.");
    expect(describeSpellEffect({ kind: "DESTROY_MONSTER", maxAttack: 1500 }).effect).toBe(
      "Destrói um monstro do oponente com ATK até 1500.",
    );
  });
});
