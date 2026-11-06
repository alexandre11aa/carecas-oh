// src/client/screens/cardDetail.test.ts
import { describe, expect, it } from "vitest";
import { createMatch } from "../../engine/createMatch.js";
import { playerView } from "../../engine/playerView.js";
import { getCard } from "../../engine/cards.js";
import { allSlots } from "../scene/layout.js";
import { buildCardDetail, slotCardId } from "./cardDetail.js";

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
