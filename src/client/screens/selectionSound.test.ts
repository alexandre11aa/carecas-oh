// src/client/screens/selectionSound.test.ts
import { describe, expect, it } from "vitest";
import type { Selection } from "./matchActions.js";
import { selectionSound } from "./selectionSound.js";

const hand: Selection = { kind: "hand", cardId: "ash_dragon", handIndex: 0 };
const monster: Selection = { kind: "monster", zone: 2 };
const field: Selection = { kind: "field", cardId: "trap" };

describe("selectionSound", () => {
  it("toca_ao_selecionar_carta_da_mao", () => {
    expect(selectionSound(null, hand, false)).toBe("click");
  });
  it("toca_ao_selecionar_monstro_ou_carta_do_campo", () => {
    expect(selectionSound(null, monster, false)).toBe("click");
    expect(selectionSound(hand, field, false)).toBe("click");
  });
  it("toca_ao_trocar_de_selecao", () => {
    expect(selectionSound(hand, { ...hand, handIndex: 1 }, false)).toBe("click");
  });
  it("fica_mudo_ao_desselecionar", () => {
    expect(selectionSound(hand, null, false)).toBeNull();
  });
  it("fica_mudo_em_clique_sem_efeito", () => {
    expect(selectionSound(null, null, false)).toBeNull();
    expect(selectionSound(monster, { ...monster }, false)).toBeNull();
  });
  it("fica_mudo_quando_o_clique_envia_acao", () => {
    expect(selectionSound(hand, null, true)).toBeNull();
    expect(selectionSound(hand, hand, true)).toBeNull();
  });
});
