// src/client/scene/surfaces.test.ts
import { describe, expect, it } from "vitest";
import { backgroundCover, pickSurface, tableCover, TABLE_ASPECT, ZONE_OPACITY_ON_TEXTURE, zoneOpacity } from "./surfaces.js";

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

describe("tableCover", () => {
  it("imagem_16_por_11_usa_mapeamento_direto", () => {
    expect(tableCover(16 / 11)).toEqual({ repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 });
    expect(tableCover(1920 / 1320)).toEqual({ repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 });
  });
  it("imagem_quadrada_corta_em_cima_e_embaixo", () => {
    const c = tableCover(1);
    expect(c.repeatX).toBe(1);
    expect(c.repeatY).toBeCloseTo(1 / TABLE_ASPECT, 10);
    expect(c.offsetY).toBeCloseTo((1 - c.repeatY) / 2, 10);
    expect(c.offsetX).toBe(0);
  });
  it("imagem_mais_larga_corta_nas_laterais", () => {
    const c = tableCover(2);
    expect(c.repeatX).toBeCloseTo(TABLE_ASPECT / 2, 10);
    expect(c.repeatY).toBe(1);
    expect(c.offsetX).toBeCloseTo((1 - c.repeatX) / 2, 10);
    expect(c.offsetY).toBe(0);
  });
  it("imagem_mais_alta_corta_em_cima_e_embaixo", () => {
    const c = tableCover(1.2);
    expect(c.repeatX).toBe(1);
    expect(c.repeatY).toBeCloseTo(1.2 / TABLE_ASPECT, 10);
    expect(c.offsetY).toBeCloseTo((1 - c.repeatY) / 2, 10);
  });
  it("entrada_invalida_devolve_identidade", () => {
    for (const bad of [0, -1, NaN]) expect(tableCover(bad)).toEqual({ repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 });
  });
});
