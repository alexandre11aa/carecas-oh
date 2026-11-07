// src/client/screens/toasts.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_TOASTS,
  TOAST_DURATION_MS,
  dismissToast,
  dismissToastById,
  errorToast,
  expireToasts,
  expireVisibleToasts,
  getToasts,
  messageToast,
  nextExpiry,
  pushToast,
  resetToasts,
  showErrorCode,
  showToast,
  subscribeToasts,
} from "./toasts.js";

describe("toasts (lógica pura)", () => {
  it("empilha_toasts_diferentes_em_ordem", () => {
    let list = pushToast([], messageToast("A"), 0, 1);
    list = pushToast(list, messageToast("B"), 10, 2);
    expect(list.map((toast) => toast.message)).toEqual(["A", "B"]);
    expect(list[1].expiresAt).toBe(10 + TOAST_DURATION_MS);
  });

  it("nao_repete_o_mesmo_toast_enquanto_visivel", () => {
    const first = pushToast([], errorToast("ROOM_FULL"), 0, 1);
    const again = pushToast(first, errorToast("ROOM_FULL"), 100, 2);
    expect(again).toHaveLength(1);
    expect(again[0].id).toBe(1);
  });

  it("repete_o_toast_depois_que_o_anterior_expira", () => {
    const first = pushToast([], errorToast("ROOM_FULL"), 0, 1);
    const again = pushToast(first, errorToast("ROOM_FULL"), TOAST_DURATION_MS, 2);
    expect(again.map((toast) => toast.id)).toEqual([2]);
  });

  it("codigos_diferentes_com_mesma_mensagem_generica_nao_repetem", () => {
    const list = pushToast([], errorToast("X1"), 0, 1);
    expect(pushToast(list, errorToast("X2"), 1, 2)).toHaveLength(1);
  });

  it("limita_o_empilhamento_descartando_o_mais_antigo", () => {
    let list: ReturnType<typeof pushToast> = [];
    for (let i = 1; i <= MAX_TOASTS + 2; i += 1) list = pushToast(list, messageToast(`m${i}`), 0, i);
    expect(list.map((toast) => toast.message)).toEqual(["m3", "m4", "m5", "m6"]);
  });

  it("expira_apenas_os_toasts_vencidos", () => {
    let list = pushToast([], messageToast("A"), 0, 1);
    list = pushToast(list, messageToast("B"), 3000, 2);
    expect(expireToasts(list, TOAST_DURATION_MS).map((toast) => toast.message)).toEqual(["B"]);
    expect(expireToasts(list, 10)).toBe(list);
  });

  it("dispensa_por_id", () => {
    let list = pushToast([], messageToast("A"), 0, 1);
    list = pushToast(list, messageToast("B"), 0, 2);
    expect(dismissToast(list, 1).map((toast) => toast.id)).toEqual([2]);
    expect(dismissToast(list, 99)).toHaveLength(2);
  });

  it("calcula_a_proxima_expiracao", () => {
    expect(nextExpiry([])).toBeNull();
    let list = pushToast([], messageToast("A"), 100, 1);
    list = pushToast(list, messageToast("B"), 50, 2);
    expect(nextExpiry(list)).toBe(50 + TOAST_DURATION_MS);
  });

  it("usa_mensagem_em_portugues_e_generica_para_codigo_desconhecido", () => {
    expect(errorToast("ROOM_FULL").message).toBe("Esta sala já está cheia.");
    expect(errorToast("NAO_EXISTE").message).toBe("Algo deu errado. Tente novamente.");
  });
});

describe("toasts (armazém)", () => {
  beforeEach(resetToasts);

  it("notifica_assinantes_e_deduplica", () => {
    const seen: number[] = [];
    const unsubscribe = subscribeToasts((list) => seen.push(list.length));
    showToast(messageToast("A"), 0);
    showToast(messageToast("A"), 1);
    showToast(messageToast("B"), 2);
    expect(seen).toEqual([1, 2]);
    expect(getToasts().map((toast) => toast.id)).toEqual([1, 2]);
    unsubscribe();
  });

  it("dispensa_e_expira_pelo_armazem", () => {
    showToast(messageToast("A"), 0);
    showToast(messageToast("B"), 1000);
    expireVisibleToasts(TOAST_DURATION_MS);
    expect(getToasts().map((toast) => toast.message)).toEqual(["B"]);
    dismissToastById(2);
    expect(getToasts()).toEqual([]);
  });

  it("showErrorCode_mostra_a_mensagem_do_codigo", () => {
    showErrorCode("NOT_YOUR_TURN");
    expect(getToasts()[0].message).toBe("Não é o seu turno.");
  });
});
