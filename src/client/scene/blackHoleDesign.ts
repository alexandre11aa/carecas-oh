// src/client/scene/blackHoleDesign.ts
// Lógica pura (sem WebGL/DOM): medidas, camadas e rotação do vórtice decorativo atrás da mesa.

export type VortexLayer = {
  /** Diâmetro do plano no mundo. */
  size: number;
  /** Velocidade angular em rad/s (sinal = sentido). */
  speed: number;
  opacity: number;
  /** Cor de multiplicação do material (hex). */
  tint: number;
};

/** Posição e inclinação do vórtice: bem atrás da mesa, virado para a câmera. */
export const VORTEX_POSITION = { x: 0, y: 3, z: -13 } as const;
export const VORTEX_TILT = -0.35;

/** Camadas de espirais (mesma textura) girando em sentidos opostos, do fundo para a frente. */
export const VORTEX_LAYERS: readonly VortexLayer[] = [
  { size: 46, speed: 0.05, opacity: 0.55, tint: 0x8a4cff },
  { size: 36, speed: -0.08, opacity: 0.6, tint: 0xffc94d },
  { size: 26, speed: 0.12, opacity: 0.7, tint: 0xb06bff },
];

/** Diâmetro do núcleo escuro. */
export const VORTEX_CORE_SIZE = 9;

/** Ângulo da camada no instante `seconds`; parado quando o usuário prefere menos movimento. */
export const vortexAngle = (layer: VortexLayer, seconds: number, reducedMotion: boolean): number => {
  if (reducedMotion || !Number.isFinite(seconds)) return 0;
  return (layer.speed * seconds) % (Math.PI * 2);
};

export const SPIRAL_ARMS = 4;
export const SPIRAL_TEXTURE_SIZE = 256;

/** Ângulo de cada braço da espiral em função do raio normalizado (0..1). */
export const spiralAngle = (arm: number, radius: number, arms: number = SPIRAL_ARMS): number =>
  (arm / arms) * Math.PI * 2 + radius * 5;
