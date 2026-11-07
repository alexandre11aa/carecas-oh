// src/client/scene/blackHoleDesign.ts
// Lógica pura (sem WebGL/DOM): medidas, camadas e rotação do buraco negro decorativo sob a mesa.

export type VortexLayer = {
  /** Diâmetro do plano no mundo. */
  size: number;
  /** Velocidade angular em rad/s (sinal = sentido). */
  speed: number;
  opacity: number;
  /** Cor de multiplicação do material (hex). */
  tint: number;
};

/** Centro do buraco negro: o mesmo centro da mesa, logo abaixo dela (a mesa cobre o miolo e o disco aparece ao redor). */
export const VORTEX_POSITION = { x: 0, y: -0.6, z: 0 } as const;
/** Rotação em X que deita o plano na horizontal, virado para cima. */
export const VORTEX_TILT = -Math.PI / 2;

/** Diâmetro do disco base (denso, centro preto, borda de acreção brilhante). */
export const VORTEX_DISC_SIZE = 56;

/** Camadas de espirais preenchidas (mesma textura) girando em sentidos opostos, do fundo para a frente. */
export const VORTEX_LAYERS: readonly VortexLayer[] = [
  { size: 50, speed: 0.06, opacity: 0.4, tint: 0x7a3cc8 },
  { size: 40, speed: -0.1, opacity: 0.32, tint: 0xc8702a },
  { size: 31, speed: 0.15, opacity: 0.3, tint: 0x9a6ad0 },
];

/** Ângulo da camada no instante `seconds`; parado quando o usuário prefere menos movimento. */
export const vortexAngle = (layer: VortexLayer, seconds: number, reducedMotion: boolean): number => {
  if (reducedMotion || !Number.isFinite(seconds)) return 0;
  return (layer.speed * seconds) % (Math.PI * 2);
};

export const SPIRAL_ARMS = 5;
export const SPIRAL_TEXTURE_SIZE = 512;

/** Ângulo de cada braço da espiral em função do raio normalizado (0..1). */
export const spiralAngle = (arm: number, radius: number, arms: number = SPIRAL_ARMS): number =>
  (arm / arms) * Math.PI * 2 + radius * 5;

/** Espessuras (em fração do raio da textura) e opacidades das passadas de cada braço, da mais larga e suave à fina e viva. */
export const SPIRAL_STROKES: readonly { width: number; alpha: number }[] = [
  { width: 0.16, alpha: 0.12 },
  { width: 0.09, alpha: 0.22 },
  { width: 0.04, alpha: 0.4 },
];

/** Faixas do disco (raio normalizado 0..1): centro preto opaco, anel de acreção brilhante e halo que esmaece. */
export const DISC_STOPS: readonly { offset: number; color: string }[] = [
  { offset: 0, color: "rgba(0,0,0,1)" },
  { offset: 0.3, color: "rgba(0,0,0,1)" },
  { offset: 0.38, color: "rgba(24,6,40,0.98)" },
  { offset: 0.43, color: "rgba(255,170,70,0.95)" },
  { offset: 0.46, color: "rgba(255,225,160,1)" },
  { offset: 0.5, color: "rgba(170,80,28,0.85)" },
  { offset: 0.6, color: "rgba(56,18,84,0.92)" },
  { offset: 0.8, color: "rgba(14,5,26,0.9)" },
  { offset: 1, color: "rgba(4,2,10,0.15)" },
];
