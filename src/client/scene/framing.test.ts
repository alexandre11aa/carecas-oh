// src/client/scene/framing.test.ts
import { describe, expect, it } from "vitest";
import { CAMERA_FOV, CAMERA_TARGET, FRAMING_MARGIN, MAX_CAMERA_SCALE, cameraDistanceScale, cameraPosition } from "./framing.js";
import { allSlots } from "./layout.js";
import { zoneOuterSize } from "./tableDesign.js";

/** Fração da meia-largura visível usada por um ponto do plano da mesa, com a câmera recuada por k. */
const usedFraction = (x: number, z: number, aspect: number, k: number): number => {
  const c = cameraPosition(k);
  const t = CAMERA_TARGET;
  const len = Math.hypot(t.y - c.y, t.z - c.z);
  const d = ((0 - c.y) * (t.y - c.y) + (z - c.z) * (t.z - c.z)) / len;
  return x / (d * Math.tan((CAMERA_FOV * Math.PI) / 360) * aspect);
};

describe("cameraDistanceScale", () => {
  it("16_9_nao_recua", () => {
    expect(cameraDistanceScale(16 / 9)).toBe(1);
    expect(cameraDistanceScale(1366 / 768)).toBe(1);
  });
  it("4_3_recua_um_pouco", () => {
    const k = cameraDistanceScale(4 / 3);
    expect(k).toBeGreaterThan(1.05);
    expect(k).toBeLessThan(1.12);
  });
  it("cresce_quando_o_aspecto_diminui_e_nunca_e_menor_que_1", () => {
    const aspects = [3, 16 / 9, 16 / 10, 4 / 3, 5 / 4, 1];
    const ks = aspects.map(cameraDistanceScale);
    for (let i = 1; i < ks.length; i++) expect(ks[i]!).toBeGreaterThanOrEqual(ks[i - 1]!);
    for (const k of ks) expect(k).toBeGreaterThanOrEqual(1);
  });
  it("aspecto_invalido_devolve_1", () => {
    for (const a of [0, -1, NaN, Infinity]) expect(cameraDistanceScale(a)).toBe(1);
  });
  it("retrato_extremo_e_limitado_ao_recuo_maximo", () => {
    expect(cameraDistanceScale(360 / 640)).toBe(MAX_CAMERA_SCALE);
  });
  it("todos_os_cantos_externos_de_todos_os_slots_cabem_quando_nao_limitado", () => {
    const outer = zoneOuterSize();
    for (const aspect of [16 / 9, 16 / 10, 4 / 3, 5 / 4]) {
      const k = cameraDistanceScale(aspect);
      for (const s of allSlots()) {
        for (const z of [s.z - outer.height / 2, s.z + outer.height / 2]) {
          expect(usedFraction(Math.abs(s.x) + outer.width / 2, z, aspect, k)).toBeLessThanOrEqual(1 / FRAMING_MARGIN + 1e-9);
        }
      }
    }
  });
  it("em_16_9_a_posicao_da_camera_e_a_original", () => {
    expect(cameraPosition(1)).toEqual({ x: 0, y: 11, z: 9 });
  });
});
