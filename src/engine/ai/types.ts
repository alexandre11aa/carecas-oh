// src/engine/ai/types.ts
// Tipos públicos da IA: níveis, entrada e saída da decisão. Serializáveis em JSON.
import type { Action, MatchState, PlayerId } from "../types.js";

export type AiLevel = "easy" | "medium" | "hard";

export const AI_LEVELS: readonly AiLevel[] = ["easy", "medium", "hard"];

/** Limite padrão de ações da IA por turno (inclui a compra e o fim do turno). */
export const MAX_AI_ACTIONS_PER_TURN = 40;

export type AiInput = {
  state: MatchState;
  side: PlayerId;
  level: AiLevel;
  /** Semente própria da IA; nunca a semente do estado da partida. */
  seed: number;
};

/** `action` é nulo só quando o lado não tem nada a fazer agora (fora do turno, sem janela para ele, ou partida encerrada). */
export type AiDecision = { action: Action | null; seed: number };
