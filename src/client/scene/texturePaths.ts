// src/client/scene/texturePaths.ts
// Lógica pura (sem WebGL/DOM): caminhos das texturas e cálculo do tamanho alvo.

/** Verso das cartas (opcional: sem o arquivo, usa o desenho provisório). */
export const CARD_BACK_PATH = "/cards/back.png";
/** Fundo da página/cena, recomendado 16:9 (opcional). */
export const BACKGROUND_PATH = "/textures/background.png";
/** Textura da mesa, recomendada 16:11, igual à proporção da mesa (opcional). */
export const TABLE_PATH = "/textures/table.png";

/** Dimensões originais das artes de carta. */
export const CARD_ART_WIDTH = 1030;
export const CARD_ART_HEIGHT = 1500;

/**
 * Largura máxima (px) das texturas enviadas à GPU. Os PNGs originais (1030x1500, 3 a 4 MB)
 * são reduzidos na carga para 512 px de largura (512x746), o suficiente para cartas na mesa.
 */
export const MAX_TEXTURE_WIDTH = 512;

/**
 * Tamanho alvo mantendo a proporção: só reduz (nunca amplia) quando a largura excede `maxWidth`.
 * Devolve inteiros >= 1.
 */
export const fitTextureSize = (
  width: number,
  height: number,
  maxWidth: number = MAX_TEXTURE_WIDTH,
): { width: number; height: number } => {
  if (!(width > 0) || !(height > 0) || !(maxWidth > 0)) return { width: 1, height: 1 };
  if (width <= maxWidth) return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  const scale = maxWidth / width;
  return { width: Math.max(1, Math.round(maxWidth)), height: Math.max(1, Math.round(height * scale)) };
};
