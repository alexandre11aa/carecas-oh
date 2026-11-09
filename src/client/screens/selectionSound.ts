// src/client/screens/selectionSound.ts
// Lógica pura: qual som tocar quando um clique em carta (mão ou campo) muda a seleção.
import type { AudioName } from "../animations/matchAudio.js";
import type { Selection } from "./matchActions.js";

/** Som de seleção: reaproveita o clique da interface. */
export const SELECTION_SOUND: AudioName = "click";

/**
 * Som do clique em carta. Toca só quando o clique deixa uma seleção nova ou diferente;
 * desseleção, clique sem efeito e clique que envia ação (o som vem do evento da jogada) ficam em silêncio.
 */
export const selectionSound = (before: Selection | null, after: Selection | null, sentAction: boolean): AudioName | null => {
  if (sentAction || !after) return null;
  if (before && JSON.stringify(before) === JSON.stringify(after)) return null;
  return SELECTION_SOUND;
};
