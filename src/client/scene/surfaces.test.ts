// src/client/scene/surfaces.test.ts
import { describe, expect, it } from "vitest";
import { backgroundCover, pickSurface, ZONE_OPACITY_ON_TEXTURE, zoneOpacity } from "./surfaces.js";

describe("pickSurface", () => {
  it("usa_a_textura_quando_ela_existe", () => {
    expect(pickSurface({})).toBe("texture");
  });
  it("mantem_a_cor_sem_arquivo_enquanto_carrega_ou_se_falhar", () => {
    expect(pickSurface(null)).toBe("color");
    expect(pickSurface(undefined)).toBe("color");
  });
});

describe("zoneOpacity", () => {
  it("zonas_sao_solidas_sem_textura_e_semitransparentes_com_textura", () => {
    expect(zoneOpacity("color")).toBe(1);
    expect(zoneOpacity("texture")).toBe(ZONE_OPACITY_ON_TEXTURE);
  });
});

describe("backgroundCover", () => {
  it("mesma_proporcao_nao_corta_nada", () => {
    expect(backgroundCover(16 / 9, 16 / 9)).toEqual({ repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 });
  });
  it("tela_mais_larga_corta_em_cima_e_embaixo", () => {
    expect(backgroundCover(1, 2)).toEqual({ repeatX: 1, repeatY: 0.5, offsetX: 0, offsetY: 0.25 });
  });
  it("tela_mais_estreita_corta_nas_laterais", () => {
    expect(backgroundCover(2, 1)).toEqual({ repeatX: 0.5, repeatY: 1, offsetX: 0.25, offsetY: 0 });
  });
  it("proporcao_invalida_nao_distorce", () => {
    expect(backgroundCover(0, 1)).toEqual({ repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 });
  });
});
