// src/client/scene/surfaces.ts
// Lógica pura (sem WebGL/DOM): decisão textura x cor do fundo e da mesa, e enquadramento do fundo.

/** Aparência de uma superfície: a textura carregada ou a cor padrão (sem arquivo, carregando ou falha). */
export type Surface = "texture" | "color";

/** Usa a textura só quando ela existe; `null` (ausente, carregando ou falha) mantém a cor atual. */
export const pickSurface = (texture: unknown | null | undefined): Surface => (texture ? "texture" : "color");

/** Opacidade das zonas: sem textura mantêm-se sólidas; sobre a textura da mesa ficam semi-transparentes. */
export const ZONE_OPACITY_ON_TEXTURE = 0.7;
export const zoneOpacity = (surface: Surface): number => (surface === "texture" ? ZONE_OPACITY_ON_TEXTURE : 1);

/**
 * Enquadramento "cover" do fundo (preenche a tela sem esticar, cortando o excesso):
 * devolve `repeat` e `offset` da textura para a proporção da imagem e da tela (largura/altura).
 */
export const backgroundCover = (
  imageAspect: number,
  viewAspect: number,
): { repeatX: number; repeatY: number; offsetX: number; offsetY: number } => {
  if (!(imageAspect > 0) || !(viewAspect > 0)) return { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 };
  if (viewAspect > imageAspect) {
    // Tela mais larga que a imagem: usa a largura toda e corta em cima/embaixo.
    const repeatY = imageAspect / viewAspect;
    return { repeatX: 1, repeatY, offsetX: 0, offsetY: (1 - repeatY) / 2 };
  }
  const repeatX = viewAspect / imageAspect;
  return { repeatX, repeatY: 1, offsetX: (1 - repeatX) / 2, offsetY: 0 };
};

/** Proporção (largura/profundidade) do plano da mesa: 16x11. */
export const TABLE_ASPECT = 16 / 11;

/**
 * Enquadramento "cover" da textura no plano da mesa (16:11): imagem 16:11 usa mapeamento direto
 * (repeat 1x1, offset 0); mais larga corta nas laterais, mais alta corta em cima e embaixo, sem distorcer.
 * Entrada inválida devolve a identidade.
 */
export const tableCover = (imageAspect: number): { repeatX: number; repeatY: number; offsetX: number; offsetY: number } =>
  Math.abs(imageAspect - TABLE_ASPECT) < 1e-6
    ? { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 }
    : backgroundCover(imageAspect, TABLE_ASPECT);
