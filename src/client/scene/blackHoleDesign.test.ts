// src/client/scene/blackHoleDesign.test.ts
import { describe, expect, it } from "vitest";
import { VORTEX_LAYERS, spiralAngle, vortexAngle } from "./blackHoleDesign.js";

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
});
