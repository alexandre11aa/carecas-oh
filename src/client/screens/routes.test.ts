// src/client/screens/routes.test.ts
import { describe, expect, it } from "vitest";
import { FOOTER_LINKS, isCurrentFooterLink, pathAfterRoomExit, resolveRoute, routePath, shouldAutoJoin } from "./routes.js";

describe("resolveRoute", () => {
  it("resolve_a_raiz_para_a_home", () => {
    expect(resolveRoute("/")).toEqual({ page: "home" });
  });
  it("resolve_guia_e_cartas", () => {
    expect(resolveRoute("/guia")).toEqual({ page: "guide" });
    expect(resolveRoute("/cartas")).toEqual({ page: "cards" });
  });
  it("aceita_barra_final", () => {
    expect(resolveRoute("/guia/")).toEqual({ page: "guide" });
    expect(resolveRoute("/sala/ab12/")).toEqual({ page: "room", code: "AB12" });
  });
  it("resolve_sala_com_codigo_em_maiusculas", () => {
    expect(resolveRoute("/sala/ABCD")).toEqual({ page: "room", code: "ABCD" });
    expect(resolveRoute("/sala/abcd")).toEqual({ page: "room", code: "ABCD" });
  });
  it("rota_desconhecida_ou_codigo_invalido_vira_home", () => {
    expect(resolveRoute("/outra")).toEqual({ page: "home" });
    expect(resolveRoute("/sala/ABC")).toEqual({ page: "home" });
    expect(resolveRoute("/sala/ABCDE")).toEqual({ page: "home" });
    expect(resolveRoute("/guia/extra")).toEqual({ page: "home" });
  });
});

describe("routePath", () => {
  it("devolve_o_caminho_canonico", () => {
    expect(routePath({ page: "home" })).toBe("/");
    expect(routePath({ page: "guide" })).toBe("/guia");
    expect(routePath({ page: "cards" })).toBe("/cartas");
    expect(routePath({ page: "room", code: "ABCD" })).toBe("/sala/ABCD");
  });
});

describe("pathAfterRoomExit", () => {
  it("volta_para_a_raiz_ao_sair_da_sala", () => {
    expect(pathAfterRoomExit(true, false, "/sala/ABCD")).toBe("/");
  });
  it("mantem_o_convite_de_quem_abriu_a_url_direto", () => {
    expect(pathAfterRoomExit(false, false, "/sala/ABCD")).toBeNull();
  });
  it("nao_muda_enquanto_ha_sala_ou_fora_de_rota_de_sala", () => {
    expect(pathAfterRoomExit(true, true, "/sala/ABCD")).toBeNull();
    expect(pathAfterRoomExit(true, false, "/guia")).toBeNull();
  });
});

describe("FOOTER_LINKS", () => {
  it("lista_menu_guia_e_cartas_com_os_caminhos_canonicos", () => {
    expect(FOOTER_LINKS.map((l) => [l.label, l.path])).toEqual([
      ["Menu", "/"],
      ["Guia", "/guia"],
      ["Cartas", "/cartas"],
    ]);
  });
  it("marca_apenas_a_pagina_atual", () => {
    const current = (path: string) => FOOTER_LINKS.filter((l) => isCurrentFooterLink(l, resolveRoute(path))).map((l) => l.label);
    expect(current("/")).toEqual(["Menu"]);
    expect(current("/guia")).toEqual(["Guia"]);
    expect(current("/cartas")).toEqual(["Cartas"]);
    expect(current("/sala/ABCD")).toEqual([]);
  });
});

describe("shouldAutoJoin", () => {
  const base = { code: "AB12", nickname: "Ana", tried: false, online: true, busy: false };

  it("entra_sozinho_com_convite_apelido_salvo_e_conexao_online", () => {
    expect(shouldAutoJoin(base)).toBe(true);
  });

  it("nao_entra_de_novo_enquanto_uma_entrada_esta_em_andamento", () => {
    expect(shouldAutoJoin({ ...base, busy: true })).toBe(false);
  });

  it("nao_entra_sem_codigo_sem_apelido_offline_ou_se_ja_tentou", () => {
    expect(shouldAutoJoin({ ...base, code: null })).toBe(false);
    expect(shouldAutoJoin({ ...base, nickname: "  " })).toBe(false);
    expect(shouldAutoJoin({ ...base, online: false })).toBe(false);
    expect(shouldAutoJoin({ ...base, tried: true })).toBe(false);
  });
});
