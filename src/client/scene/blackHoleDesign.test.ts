// src/client/scene/blackHoleDesign.test.ts
import { describe, expect, it } from "vitest";
import {
  DISC_STOPS,
  SPIRAL_STROKES,
  VORTEX_DISC_SIZE,
  VORTEX_LAYERS,
  VORTEX_POSITION,
  VORTEX_TILT,
  spiralAngle,
  vortexAngle,
} from "./blackHoleDesign.js";

describe("blackHoleDesign", () => {
  it("fica_parado_com_movimento_reduzido", () => {
    for (const layer of VORTEX_LAYERS) expect(vortexAngle(layer, 123, true)).toBe(0);
  });
  it("gira_proporcional_ao_tempo_e_no_sentido_da_camada", () => {
    const layer = { size: 1, speed: 0.5, opacity: 1, tint: 0 };
    expect(vortexAngle(layer, 2, false)).toBeCloseTo(1);
    expect(vortexAngle({ ...layer, speed: -0.5 }, 2, false)).toBeCloseTo(-1);
  });
  it("ignora_tempo_invalido", () => {
    expect(vortexAngle(VORTEX_LAYERS[0], Number.NaN, false)).toBe(0);
  });
  it("camadas_tem_tamanhos_decrescentes_e_sentidos_alternados", () => {
    for (let i = 1; i < VORTEX_LAYERS.length; i++) {
      expect(VORTEX_LAYERS[i].size).toBeLessThan(VORTEX_LAYERS[i - 1].size);
      expect(Math.sign(VORTEX_LAYERS[i].speed)).toBe(-Math.sign(VORTEX_LAYERS[i - 1].speed));
    }
  });
  it("espiral_distribui_bracos_igualmente", () => {
    expect(spiralAngle(1, 0, 4)).toBeCloseTo(Math.PI / 2);
    expect(spiralAngle(0, 1, 4)).toBeCloseTo(5);
  });
  it("fica_centrado_na_mesa_e_deitado_sob_ela", () => {
    expect(VORTEX_POSITION.x).toBe(0);
    expect(VORTEX_POSITION.z).toBe(0);
    expect(VORTEX_POSITION.y).toBeLessThan(0);
    expect(VORTEX_TILT).toBeCloseTo(-Math.PI / 2);
  });
  it("disco_base_cobre_todas_as_camadas_e_o_centro_e_preto_opaco", () => {
    for (const layer of VORTEX_LAYERS) expect(VORTEX_DISC_SIZE).toBeGreaterThan(layer.size);
    expect(DISC_STOPS[0]).toEqual({ offset: 0, color: "rgba(0,0,0,1)" });
  });
  it("faixas_do_disco_crescem_de_0_a_1_e_a_borda_esmaece", () => {
    for (let i = 1; i < DISC_STOPS.length; i++) expect(DISC_STOPS[i].offset).toBeGreaterThan(DISC_STOPS[i - 1].offset);
    expect(DISC_STOPS[DISC_STOPS.length - 1].offset).toBe(1);
  });
  it("camadas_sao_translucidas_para_nao_clarear_o_fundo", () => {
    for (const layer of VORTEX_LAYERS) expect(layer.opacity).toBeLessThanOrEqual(0.5);
  });
  it("passadas_da_espiral_ficam_mais_finas_e_mais_opacas", () => {
    for (let i = 1; i < SPIRAL_STROKES.length; i++) {
      expect(SPIRAL_STROKES[i].width).toBeLessThan(SPIRAL_STROKES[i - 1].width);
      expect(SPIRAL_STROKES[i].alpha).toBeGreaterThan(SPIRAL_STROKES[i - 1].alpha);
    }
  });
});
