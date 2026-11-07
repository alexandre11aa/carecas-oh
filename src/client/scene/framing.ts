// src/client/scene/framing.ts
// Lógica pura (sem WebGL): enquadramento da câmera. Calcula quanto recuar a câmera (a partir do alvo)
// para que os cantos externos de todos os slots caibam na largura visível, conforme o aspecto da tela.
import { allSlots } from "./layout.js";
import { zoneOuterSize } from "./tableDesign.js";

export const CAMERA_FOV = 45;
export const CAMERA_POSITION = { x: 0, y: 11, z: 9 } as const;
export const CAMERA_TARGET = { x: 0, y: 0, z: 0.8 } as const;
/** Folga relativa na meia-largura visível (2%). */
export const FRAMING_MARGIN = 1.02;
/** Recuo máximo: em retrato extremo a mesa continua cortada (limitação anterior à #100). */
export const MAX_CAMERA_SCALE = 1.6;

/**
 * Fator k >= 1 pelo qual a distância câmera-alvo é multiplicada para a mesa caber na largura.
 * Projeção real: para um ponto P no plano da mesa, a profundidade na direção do olhar é
 * d = (P - alvo)·f + k·L (f = direção unitária câmera->alvo, L = distância atual), e o ponto
 * cabe se |x|·margem <= d·tan(fov/2)·aspecto. Resolve-se k para o pior canto externo.
 */
export const cameraDistanceScale = (aspect: number): number => {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  const dy = CAMERA_TARGET.y - CAMERA_POSITION.y;
  const dz = CAMERA_TARGET.z - CAMERA_POSITION.z;
  const length = Math.hypot(dy, dz);
  const fy = dy / length;
  const fz = dz / length;
  const tanHalf = Math.tan((CAMERA_FOV * Math.PI) / 360);
  const outer = zoneOuterSize();
  let k = 1;
  for (const slot of allSlots()) {
    const x = Math.abs(slot.x) + outer.width / 2;
    for (const z of [slot.z - outer.height / 2, slot.z + outer.height / 2]) {
      const along = (0 - CAMERA_TARGET.y) * fy + (z - CAMERA_TARGET.z) * fz;
      k = Math.max(k, ((x * FRAMING_MARGIN) / (tanHalf * aspect) - along) / length);
    }
  }
  return Math.min(k, MAX_CAMERA_SCALE);
};

/** Posição da câmera: o alvo mais o vetor padrão câmera-alvo multiplicado por k. */
export const cameraPosition = (k: number): { x: number; y: number; z: number } => ({
  x: CAMERA_TARGET.x + (CAMERA_POSITION.x - CAMERA_TARGET.x) * k,
  y: CAMERA_TARGET.y + (CAMERA_POSITION.y - CAMERA_TARGET.y) * k,
  z: CAMERA_TARGET.z + (CAMERA_POSITION.z - CAMERA_TARGET.z) * k,
});
