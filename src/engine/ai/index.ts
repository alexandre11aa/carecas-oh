// src/engine/ai/index.ts
export { chooseAiAction, playAiTurn, mustAct } from "./choose.js";
export type { AiTurnResult, AiTurnStatus } from "./choose.js";
export { generateCandidates } from "./candidates.js";
export { AI_LEVELS, MAX_AI_ACTIONS_PER_TURN } from "./types.js";
export type { AiDecision, AiInput, AiLevel } from "./types.js";
