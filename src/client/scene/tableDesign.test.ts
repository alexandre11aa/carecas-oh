// src/client/scene/tableDesign.test.ts
import { describe, expect, it } from "vitest";
import { ROW_Z, ZONE_COUNT, ZONE_SPACING, allSlots, slotPosition, CARD_HEIGHT, CARD_WIDTH } from "./layout.js";
import {
  ZONE_STYLES,
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
  it("carta_em_defesa_girada_cabe_no_espacamento_e_nao_toca_a_vizinha", () => {
    // Girada 90 graus, a largura no eixo x passa a ser CARD_HEIGHT.
    expect(CARD_HEIGHT).toBeLessThanOrEqual(ZONE_SPACING);
    expect(ZONE_SPACING - CARD_HEIGHT).toBeGreaterThanOrEqual(0.05);
    for (const side of ["you", "opponent"] as const) {
      for (const kind of ["monster", "spellTrap"] as const) {
        for (let zone = 0; zone + 1 < ZONE_COUNT; zone++) {
          const a = slotPosition(side, kind, zone);
          const b = slotPosition(side, kind, zone + 1);
          expect(Math.abs(a.x - b.x) - CARD_HEIGHT).toBeGreaterThanOrEqual(0.05);
        }
      }
    }
  });
  it("carta_em_defesa_girada_nao_alcanca_a_pilha_e_cabe_na_altura_da_zona", () => {
    const outer = zoneOuterSize();
    const lastZone = slotPosition("you", "monster", ZONE_COUNT - 1);
    const pile = slotPosition("you", "graveyard");
    expect(lastZone.x + CARD_HEIGHT / 2).toBeLessThan(pile.x - outer.width / 2);
    expect(CARD_WIDTH).toBeLessThanOrEqual(outer.height);
  });
  it("extremos_simetricos_e_pilhas_dentro_da_mesa_e_da_moldura", () => {
    const outer = zoneOuterSize();
    const frame = frameSize();
    const xs = allSlots().map((s) => s.x);
    expect(Math.max(...xs)).toBeCloseTo(-Math.min(...xs), 10);
    expect(Math.max(...xs) + outer.width / 2).toBeLessThanOrEqual(TABLE_WIDTH / 2);
    expect(Math.max(...xs) + outer.width / 2).toBeLessThan(frame.width / 2);
    for (const kind of ["monster", "spellTrap", "deck", "graveyard"] as const) {
      const y = slotPosition("you", kind, 0);
      const o = slotPosition("opponent", kind, 0);
      expect(o).toEqual({ x: -y.x, z: -y.z });
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

describe("contraste_dos_contornos_sobre_a_textura", () => {
  // Cor representativa dos tijolos roxos da textura da mesa (estimada da imagem; o reviewer mediu ~3,5 a 6:1).
  const BRICK = 0x3a2a45;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (c: number) => 0.2126 * channel((c >> 16) & 255) + 0.7152 * channel((c >> 8) & 255) + 0.0722 * channel(c & 255);
  const ratio = (a: number, b: number) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  it("todos_os_contornos_tem_contraste_minimo_3_para_1", () => {
    for (const group of Object.keys(ZONE_STYLES) as (keyof typeof ZONE_STYLES)[]) {
      expect(ratio(ZONE_STYLES[group].outline, BRICK), String(group)).toBeGreaterThanOrEqual(3);
    }
  });
});
