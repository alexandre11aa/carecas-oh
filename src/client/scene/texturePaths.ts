// src/client/scene/texturePaths.ts
// Lógica pura (sem WebGL/DOM): caminhos das texturas e cálculo do tamanho alvo.
import type { PlayerView } from "../../engine/playerView.js";
import { faceImageUrl } from "./cardArt.js";

/** Verso das cartas (WebP 1030x1500; sem o arquivo, usa o desenho provisório em canvas). */
export const CARD_BACK_PATH = "/cards/verso.webp";
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

/**
 * Largura máxima (px) da textura da mesa: ocupa a tela inteira, então não pode ser reduzida a 512 px.
 * O PNG de 1920x1320 passa inteiro (a redução nunca amplia); 2048 é seguro para MAX_TEXTURE_SIZE >= 4096.
 */
export const TABLE_MAX_TEXTURE_WIDTH = 2048;

/** Opções de carga de uma textura pela URL: a mesa usa mais resolução e anisotropia; as demais, o padrão. */
export const textureOptionsFor = (url: string): { maxWidth?: number; anisotropy?: number } =>
  url === TABLE_PATH ? { maxWidth: TABLE_MAX_TEXTURE_WIDTH, anisotropy: 8 } : {};

/**
 * Texturas críticas do estado inicial da partida, sem repetição e em ordem estável: fundo, mesa, verso
 * e a frente das cartas do próprio jogador (mão e campo viradas para cima). Só estas seguram o loading;
 * cemitério, cartas do oponente e cartas futuras carregam depois, sem segurar. Cartas viradas usam o verso.
 */
export const criticalTextureUrls = (view: PlayerView | null): string[] => {
  const urls = [BACKGROUND_PATH, TABLE_PATH, CARD_BACK_PATH];
  if (view) {
    const ids = [
      ...view.you.hand,
      ...view.you.monsters.map((monster) => (monster && !monster.faceDown ? monster.cardId : null)),
      ...view.you.spellTraps.map((card) => (card && !card.faceDown ? card.cardId : null)),
    ];
    for (const id of ids) {
      const url = faceImageUrl(id);
      if (url) urls.push(url);
    }
  }
  return [...new Set(urls)];
};
