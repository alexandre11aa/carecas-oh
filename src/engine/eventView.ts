// src/engine/eventView.ts
// Sanitizador de eventos: único caminho de eventos aos jogadores (ver playerView).
import type { GameEvent, PlayerId } from "./types";

type HiddenCardEvent =
  | Extract<GameEvent, { type: "CARD_DRAWN" }>
  | Extract<GameEvent, { type: "MONSTER_SUMMONED" }>
  | Extract<GameEvent, { type: "POSITION_CHANGED" }>
  | Extract<GameEvent, { type: "SPELL_TRAP_SET" }>
  | Extract<GameEvent, { type: "ATTACK_BOOSTED" }>;

/** Evento como um jogador pode vê-lo: ids de cartas ocultas do oponente viram `null`. */
export type EventView =
  | Exclude<GameEvent, HiddenCardEvent>
  | (Omit<Extract<GameEvent, { type: "CARD_DRAWN" }>, "cardId"> & { cardId: string | null })
  | (Omit<Extract<GameEvent, { type: "MONSTER_SUMMONED" }>, "cardId"> & { cardId: string | null })
  | (Omit<Extract<GameEvent, { type: "POSITION_CHANGED" }>, "cardId"> & { cardId: string | null })
  | (Omit<Extract<GameEvent, { type: "SPELL_TRAP_SET" }>, "cardId"> & { cardId: string | null })
  | (Omit<Extract<GameEvent, { type: "ATTACK_BOOSTED" }>, "cardId"> & { cardId: string | null });

/**
 * Evento visível a `viewer`. Eventos do próprio jogador passam intactos. Do oponente, removem-se:
 * carta comprada, monstro baixado/mudado de posição ainda virado, magia/armadilha baixada
 * e reforço de ataque (o alvo pode ser um monstro virado). Alvos de ataque e de magia vão por zona, públicos. Cartas reveladas (virada para cima, cemitério,
 * armadilha ativada, magia ativada) continuam públicas.
 */
export const eventView = (event: GameEvent, viewer: PlayerId): EventView => {
  switch (event.type) {
    case "CARD_DRAWN":
    case "SPELL_TRAP_SET":
      return event.player === viewer ? event : { ...event, cardId: null };
    case "MONSTER_SUMMONED":
    case "POSITION_CHANGED":
      return event.player === viewer || !event.faceDown ? event : { ...event, cardId: null };
    case "ATTACK_BOOSTED":
      return event.player === viewer ? event : { ...event, cardId: null };
    default:
      return event;
  }
};
