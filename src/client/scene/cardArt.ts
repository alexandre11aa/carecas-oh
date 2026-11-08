// src/client/scene/cardArt.ts
// Lógica pura (sem WebGL/DOM): decide se a frente de uma carta usa o WebP/PNG ou o visual provisório.
import { getCard } from "../../engine/cards.js";

/**
 * URL do WebP/PNG de frente de uma carta. Devolve null para carta oculta (`null`/vazio) ou desconhecida:
 * nunca se resolve a imagem da frente de uma carta virada, para não revelar nada.
 */
export const faceImageUrl = (cardId: string | null | undefined): string | null => {
  if (!cardId) return null;
  return getCard(cardId)?.image || null;
};

export type FaceKind = "image" | "fallback";

/** WebP/PNG só é usado depois de carregado com sucesso; antes disso (ou em 404) vale o fallback. */
export const chooseFace = (url: string | null, loaded: boolean): FaceKind => (url && loaded ? "image" : "fallback");
