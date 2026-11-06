// src/engine/rng.ts
// Gerador pseudoaleatório determinístico (mulberry32), puro: o estado é a própria semente.

export type RngResult = { value: number; seed: number };

/** Devolve um número em [0, 1) e a próxima semente. */
export const nextRandom = (seed: number): RngResult => {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: next };
};

/** Embaralha (Fisher-Yates) sem alterar a lista recebida. */
export const shuffle = <T>(items: readonly T[], seed: number): { items: T[]; seed: number } => {
  const result = [...items];
  let current = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    const rng = nextRandom(current);
    current = rng.seed;
    const j = Math.floor(rng.value * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return { items: result, seed: current };
};
