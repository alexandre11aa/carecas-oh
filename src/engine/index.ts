// src/engine/index.ts
export const ENGINE_READY = true;

export * from "./types";
export { CARDS, getCard } from "./cards";
export { nextRandom, shuffle } from "./rng";
export { DECK_SIZE, dealDecks } from "./decks";
export type { DealtDecks } from "./decks";
