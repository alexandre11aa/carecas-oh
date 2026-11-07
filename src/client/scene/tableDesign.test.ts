// src/client/scene/tableDesign.test.ts
import { describe, expect, it } from "vitest";
import { ROW_Z, ZONE_COUNT, ZONE_SPACING, allSlots, CARD_HEIGHT, CARD_WIDTH } from "./layout.js";
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
  it("largura_externa_cabe_no_espacamento_horizontal", () => {
    expect(zoneOuterSize().width).toBeLessThanOrEqual(ZONE_SPACING);
  });
  it("altura_externa_cabe_no_espacamento_entre_fileiras", () => {
    const h = zoneOuterSize().height;
    expect(h).toBeLessThanOrEqual(ROW_Z.spellTrap - ROW_Z.monster);
    expect(h).toBeLessThanOrEqual(2 * ROW_Z.monster);
  });
  it("nenhum_par_de_slots_tem_retangulos_externos_com_area_em_comum", () => {
    const { width, height } = zoneOuterSize();
    const slots = allSlots();
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i]!;
        const b = slots[j]!;
        const overlapX = width - Math.abs(a.x - b.x);
        const overlapZ = height - Math.abs(a.z - b.z);
        const area = Math.max(0, overlapX - 1e-9) * Math.max(0, overlapZ - 1e-9);
        expect(area, `${a.key} x ${b.key}`).toBe(0);
      }
    }
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
