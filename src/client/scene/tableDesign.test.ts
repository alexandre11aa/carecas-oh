// src/client/scene/tableDesign.test.ts
import { describe, expect, it } from "vitest";
import { ZONE_COUNT, ZONE_SPACING, allSlots, CARD_HEIGHT, CARD_WIDTH } from "./layout.js";
import {
  BACKGROUND_GRADIENT,
  FRAME_BORDER,
  TABLE_DEPTH,
  TABLE_WIDTH,
  frameSize,
  isValidGradient,
  trimSize,
  zoneInnerSize,
  zoneOuterSize,
  zoneOutlineThickness,
  zoneStyle,
} from "./tableDesign.js";

describe("zonas", () => {
  it("mantem_o_interior_na_proporcao_da_carta_1030_por_1500", () => {
    const { width, height } = zoneInnerSize();
    expect(width / height).toBeCloseTo(1030 / 1500, 10);
    expect(width / height).toBeCloseTo(CARD_WIDTH / CARD_HEIGHT, 10);
  });
  it("contorno_externo_soma_a_espessura_nos_dois_lados", () => {
    const inner = zoneInnerSize();
    const outer = zoneOuterSize();
    const t = zoneOutlineThickness();
    expect(outer.width).toBeCloseTo(inner.width + 2 * t, 10);
    expect(outer.height).toBeCloseTo(inner.height + 2 * t, 10);
  });
  it("zonas_cobrem_a_carta_e_nao_se_sobrepoem_na_mesma_linha", () => {
    const outer = zoneOuterSize();
    expect(outer.width).toBeGreaterThan(CARD_WIDTH);
    expect(outer.height).toBeGreaterThan(CARD_HEIGHT);
    expect(outer.width).toBeLessThan(ZONE_SPACING);
    expect(ZONE_COUNT).toBe(5);
  });
  it("todas_as_zonas_ficam_dentro_da_mesa", () => {
    const outer = zoneOuterSize();
    for (const s of allSlots()) {
      expect(Math.abs(s.x) + outer.width / 2).toBeLessThanOrEqual(TABLE_WIDTH / 2);
      expect(Math.abs(s.z) + outer.height / 2).toBeLessThanOrEqual(TABLE_DEPTH / 2);
    }
  });
  it("cada_tipo_tem_cores_proprias", () => {
    const kinds = ["monster", "spellTrap", "deck", "graveyard"] as const;
    const outlines = new Set(kinds.map((k) => zoneStyle(k).outline));
    const fills = new Set(kinds.map((k) => zoneStyle(k).fill));
    expect(outlines.size).toBe(4);
    expect(fills.size).toBe(4);
  });
});

describe("moldura", () => {
  it("envolve_a_mesa_com_a_borda_e_o_filete_fica_entre_os_dois", () => {
    const frame = frameSize();
    const trim = trimSize();
    expect(frame).toEqual({ width: TABLE_WIDTH + 2 * FRAME_BORDER, height: TABLE_DEPTH + 2 * FRAME_BORDER });
    expect(trim.width).toBeGreaterThan(TABLE_WIDTH);
    expect(trim.width).toBeLessThan(frame.width);
    expect(trim.height).toBeLessThan(frame.height);
  });
});

describe("degradê do fundo", () => {
  it("o_padrao_e_valido", () => {
    expect(isValidGradient(BACKGROUND_GRADIENT)).toBe(true);
  });
  it("rejeita_poucas_paradas_fora_de_faixa_ou_fora_de_ordem", () => {
    expect(isValidGradient([{ offset: 0, color: "#000" }])).toBe(false);
    expect(isValidGradient([{ offset: 0, color: "#000" }, { offset: 1.2, color: "#fff" }])).toBe(false);
    expect(isValidGradient([{ offset: 0.6, color: "#000" }, { offset: 0.3, color: "#fff" }])).toBe(false);
  });
});
