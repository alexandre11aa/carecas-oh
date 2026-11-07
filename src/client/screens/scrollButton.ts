// src/client/screens/scrollButton.ts
// Lógica pura do botão fixo que alterna entre descer ao fim e subir ao topo da página.

export type ScrollTarget = "top" | "bottom";

export interface ScrollMetrics {
  scrollTop: number;
  viewportHeight: number;
  scrollHeight: number;
}

/** Diferença, em pixels, abaixo da qual a página é considerada sem rolagem. */
export const SCROLL_TOLERANCE = 4;

export const SCROLL_LABELS: Record<ScrollTarget, string> = {
  bottom: "Ir para o fim da página",
  top: "Voltar ao topo da página",
};

/**
 * Escolhe o destino do botão: `bottom` na primeira metade da página, `top` a partir do meio
 * (inclusive no fim) e `null` quando a página não rola (botão oculto).
 */
export function pickScrollTarget({ scrollTop, viewportHeight, scrollHeight }: ScrollMetrics): ScrollTarget | null {
  if (scrollHeight <= viewportHeight + SCROLL_TOLERANCE) return null;
  return scrollTop + viewportHeight / 2 >= scrollHeight / 2 ? "top" : "bottom";
}

export function scrollLabel(target: ScrollTarget): string {
  return SCROLL_LABELS[target];
}
