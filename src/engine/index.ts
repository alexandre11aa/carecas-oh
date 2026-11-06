// src/engine/index.ts
export const ENGINE_READY = true;

export * from "./types";
export { CARDS, getCard } from "./cards";
export { nextRandom, shuffle } from "./rng";
export { DECK_SIZE, dealDecks } from "./decks";
export type { DealtDecks } from "./decks";
export { createMatch, INITIAL_LIFE_POINTS, INITIAL_HAND_SIZE } from "./createMatch";
export { applyAction } from "./applyAction";
export { canAttack, opponentOf } from "./rules/turn";
export { requiredTributes } from "./rules/summon";
export { SPELL_TRAP_ZONES } from "./createMatch";
