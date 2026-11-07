// src/client/screens/handReconcile.test.ts
import { describe, expect, it } from "vitest";
import { reusableHandSlots } from "./handReconcile.js";

describe("reusableHandSlots", () => {
  it("reaproveita_todos_quando_a_mao_nao_mudou", () => {
    expect(reusableHandSlots(["a", "b", "a"], ["a", "b", "a"])).toEqual([true, true, true]);
  });

  it("cria_botao_novo_para_carta_comprada_no_fim", () => {
    expect(reusableHandSlots(["a", "b"], ["a", "b", "c"])).toEqual([true, true, false]);
  });

  it("recria_a_partir_da_carta_removida_no_meio", () => {
    expect(reusableHandSlots(["a", "b", "c"], ["a", "c"])).toEqual([true, false]);
  });

  it("cartas_iguais_repetidas_sao_reaproveitadas_por_posicao", () => {
    expect(reusableHandSlots(["a", "a", "a"], ["a", "a"])).toEqual([true, true]);
  });

  it("mao_vazia_nao_reaproveita_nada", () => {
    expect(reusableHandSlots(["a"], [])).toEqual([]);
    expect(reusableHandSlots([], ["a"])).toEqual([false]);
  });
});
