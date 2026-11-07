// src/client/scene/tableDesign.ts
// Lógica pura (sem WebGL/DOM): medidas e cores do visual padrão da mesa e do fundo (paleta escura com dourado, como o HUD).
import { CARD_HEIGHT, CARD_WIDTH, type SlotKind } from "./layout.js";

export const TABLE_WIDTH = 16;
export const TABLE_DEPTH = 11;
/** Largura da moldura em volta da mesa. */
export const FRAME_BORDER = 0.4;
/** Folga entre a carta e o interior da zona, em fração do tamanho da carta (mantém 1030:1500). */
export const ZONE_MARGIN_RATIO = 0.04;
/** Espessura do contorno da zona, em fração da altura da carta. */
export const ZONE_OUTLINE_RATIO = 0.025;

export const TABLE_COLOR = 0x1a2a24;
export const FRAME_COLOR = 0x3a2a12;
export const FRAME_TRIM_COLOR = 0xc8a23a;

export type ZoneStyle = { fill: number; outline: number };
export type ZoneGroup = "monster" | "spellTrap" | "deck" | "graveyard";

/** Cores por tipo de zona. Os contornos são mais claros que os tokens do HUD (--c-spell, --c-trap) para manterem contraste >= 3:1 sobre a textura da mesa. */
export const ZONE_STYLES: Record<ZoneGroup, ZoneStyle> = {
  monster: { fill: 0x3a2c1c, outline: 0xb5803a },
  spellTrap: { fill: 0x16322e, outline: 0x3fb59e },
  deck: { fill: 0x2a2440, outline: 0xc8a23a },
  graveyard: { fill: 0x2c1c30, outline: 0xc2639a },
};

export const zoneStyle = (kind: SlotKind): ZoneStyle => ZONE_STYLES[kind];

export type Size = { width: number; height: number };

/** Interior da zona: a carta mais a folga, sempre na proporção da carta. */
export const zoneInnerSize = (): Size => ({
  width: CARD_WIDTH * (1 + ZONE_MARGIN_RATIO),
  height: CARD_HEIGHT * (1 + ZONE_MARGIN_RATIO),
});

/** Tamanho externo da zona (interior + contorno); é a área que o clique deve considerar. */
export const zoneOuterSize = (): Size => {
  const inner = zoneInnerSize();
  const t = CARD_HEIGHT * ZONE_OUTLINE_RATIO;
  return { width: inner.width + 2 * t, height: inner.height + 2 * t };
};

export const zoneOutlineThickness = (): number => CARD_HEIGHT * ZONE_OUTLINE_RATIO;

/** Tamanho da moldura (mesa mais a borda nos quatro lados). */
export const frameSize = (): Size => ({ width: TABLE_WIDTH + 2 * FRAME_BORDER, height: TABLE_DEPTH + 2 * FRAME_BORDER });

/** Filete dourado fino entre a mesa e a moldura. */
export const trimSize = (): Size => ({ width: TABLE_WIDTH + 0.12, height: TABLE_DEPTH + 0.12 });

export type GradientStop = { offset: number; color: string };

/** Degradê vertical do fundo padrão (do topo à base), na paleta escura do HUD. */
export const BACKGROUND_GRADIENT: readonly GradientStop[] = [
  { offset: 0, color: "#0b0b14" },
  { offset: 0.55, color: "#1b1b2a" },
  { offset: 1, color: "#2a2236" },
];

/** Posições (0..1) válidas e em ordem crescente: o degradê só é desenhado se passar nesta checagem. */
export const isValidGradient = (stops: readonly GradientStop[]): boolean =>
  stops.length >= 2 && stops.every((s, i) => s.offset >= 0 && s.offset <= 1 && (i === 0 || s.offset > stops[i - 1]!.offset));
