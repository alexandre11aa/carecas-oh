// src/engine/index.ts
export const ENGINE_READY = true;

export * from "./types.js";
export { CARDS, getCard } from "./cards.js";
export { nextRandom, shuffle } from "./rng.js";
export { DECK_SIZE, dealDecks } from "./decks.js";
export type { DealtDecks } from "./decks.js";
export { createMatch, INITIAL_LIFE_POINTS, INITIAL_HAND_SIZE } from "./createMatch.js";
export { applyAction } from "./applyAction.js";
export { canAttack, opponentOf } from "./rules/turn.js";
export { requiredTributes } from "./rules/summon.js";
export { SPELL_TRAP_ZONES } from "./createMatch.js";
export { resolveTrapEffect } from "./rules/traps.js";
export { playerView } from "./playerView.js";
export type {
  HiddenMonsterView,
  HiddenSpellTrapView,
  OpponentPlayerView,
  OwnPlayerView,
  PendingResponseView,
  PlayerView,
} from "./playerView.js";
export { eventView } from "./eventView.js";
export type { EventView } from "./eventView.js";
