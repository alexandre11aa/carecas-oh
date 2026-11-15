// src/client/screens/cardModal.test.ts
import { describe, expect, it } from "vitest";
import { CLOSED_MODAL, closeCardModal, isActivationKey, modalKeyAction, nextFocusIndex, openCardModal } from "./cardModal.js";

describe("cardModal", () => {
  it("abre_com_a_carta_clicada", () => {
    expect(openCardModal(CLOSED_MODAL, "ash_dragon")).toEqual({ open: true, cardId: "ash_dragon" });
  });

  it("troca_a_carta_ao_abrir_de_novo", () => {
    const aberto = openCardModal(CLOSED_MODAL, "a");
    expect(openCardModal(aberto, "b")).toEqual({ open: true, cardId: "b" });
  });

  it("fecha_e_mantem_fechado", () => {
    expect(closeCardModal({ open: true, cardId: "a" })).toEqual({ open: false });
    expect(closeCardModal(CLOSED_MODAL)).toBe(CLOSED_MODAL);
  });

  it("esc_fecha_so_com_o_modal_aberto", () => {
    expect(modalKeyAction({ open: true, cardId: "a" }, "Escape")).toBe("close");
    expect(modalKeyAction(CLOSED_MODAL, "Escape")).toBeNull();
  });

  it("tab_circula_o_foco_e_outras_teclas_sao_ignoradas", () => {
    const aberto = { open: true, cardId: "a" } as const;
    expect(modalKeyAction(aberto, "Tab")).toBe("focusNext");
    expect(modalKeyAction(aberto, "Tab", true)).toBe("focusPrev");
    expect(modalKeyAction(aberto, "x")).toBeNull();
  });

  it("foco_e_circular", () => {
    expect(nextFocusIndex(0, 2, "focusNext")).toBe(1);
    expect(nextFocusIndex(1, 2, "focusNext")).toBe(0);
    expect(nextFocusIndex(-1, 2, "focusNext")).toBe(0);
    expect(nextFocusIndex(0, 2, "focusPrev")).toBe(1);
    expect(nextFocusIndex(1, 2, "focusPrev")).toBe(0);
    expect(nextFocusIndex(-1, 2, "focusPrev")).toBe(1);
    expect(nextFocusIndex(0, 0, "focusNext")).toBe(-1);
  });

  it("enter_e_espaco_ativam_a_carta", () => {
    expect(isActivationKey("Enter")).toBe(true);
    expect(isActivationKey(" ")).toBe(true);
    expect(isActivationKey("a")).toBe(false);
  });
});
