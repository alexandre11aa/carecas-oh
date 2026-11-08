// src/engine/index.ts
export const ENGINE_READY = true;

export * from "./types.js";
export { CARDS, getCard } from "./cards.js";
export { nextRandom, shuffle } from "./rng.js";
export { DECK_SIZE, DECKS, getDeck } from "./decks.js";
export type { DeckDefinition, DeckId } from "./decks.js";
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
export { AI_LEVELS, MAX_AI_ACTIONS_PER_TURN, chooseAiAction, playAiTurn } from "./ai/index.js";
export type { AiDecision, AiInput, AiLevel, AiTurnResult, AiTurnStatus } from "./ai/index.js";
