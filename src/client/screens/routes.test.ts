// src/client/screens/routes.test.ts
import { describe, expect, it } from "vitest";
import { resolveRoute, routePath } from "./routes.js";

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
