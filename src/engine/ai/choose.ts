// src/engine/ai/choose.ts
// Núcleo da IA: lê só o `playerView` do próprio lado, gera candidatos, valida cada um no motor e escolhe.
import { applyAction } from "../applyAction.js";
import { playerView } from "../playerView.js";
import type { Action, GameEvent, MatchState, PlayerId } from "../types.js";
import { generateCandidates } from "./candidates.js";
import { chooseEasy, type AiContext } from "./easy.js";
import { chooseMedium } from "./medium.js";
import { MAX_AI_ACTIONS_PER_TURN, type AiDecision, type AiInput, type AiLevel } from "./types.js";

type Strategy = (context: AiContext, seed: number) => AiDecision;

// Até a issue seguinte, o Difícil usa o comportamento do Fácil.
const STRATEGIES: Record<AiLevel, Strategy> = {
  easy: chooseEasy,
  medium: chooseMedium,
  hard: chooseEasy,
};

const accepted = (state: MatchState, side: PlayerId, action: Action): boolean =>
  applyAction(state, side, action).ok;

/** Ação segura quando a estratégia não escolhe nada: passa a resposta, avança a compra ou encerra o turno. */
const fallbackAction = (state: MatchState, side: PlayerId): Action | null => {
  const options: Action[] = state.pendingResponse
    ? [{ type: "PASS_RESPONSE" }]
    : state.phase === "DRAW"
      ? [{ type: "NEXT_PHASE" }]
      : [{ type: "END_TURN" }, { type: "NEXT_PHASE" }];
  return options.find((a) => accepted(state, side, a)) ?? null;
};

/** O lado precisa agir agora? Com janela aberta só o defensor age; senão, só o jogador do turno. */
export const mustAct = (state: MatchState, side: PlayerId): boolean => {
  if (state.winner) return false;
  return state.pendingResponse ? state.pendingResponse.responder === side : state.currentPlayer === side;
};

/**
 * Escolhe a próxima ação do lado `side`. Pura e determinística: só usa `seed` (nunca a semente do estado)
 * e lê o estado pela mesma visão que o jogador teria. A ação devolvida passa em `applyAction`.
 * `action` é nulo apenas quando o lado não precisa agir (fora do turno, sem janela para ele ou partida encerrada).
 */
export const chooseAiAction = ({ state, side, level, seed }: AiInput): AiDecision => {
  if (!mustAct(state, side)) return { action: null, seed };
  const view = playerView(state, side);
  const valid = generateCandidates(view).filter((action) => accepted(state, side, action));
  const decision = STRATEGIES[level]({ view, valid }, seed);
  if (decision.action && accepted(state, side, decision.action)) return decision;
  return { action: fallbackAction(state, side), seed: decision.seed };
};

export type AiTurnStatus = "TURN_ENDED" | "WAITING_RESPONSE" | "MATCH_ENDED" | "NOT_ACTING";

export type AiTurnResult = {
  state: MatchState;
  actions: Action[];
  events: GameEvent[];
  seed: number;
  status: AiTurnStatus;
};

/**
 * Joga as ações do lado `side` até o turno passar. Para antes se a ação abrir uma janela de resposta do
 * oponente (`WAITING_RESPONSE`) ou se a partida terminar. Nunca passa de `maxActions` ações: perto do
 * limite, encerra o turno à força.
 */
export const playAiTurn = ({
  state,
  side,
  level,
  seed,
  maxActions = MAX_AI_ACTIONS_PER_TURN,
}: AiInput & { maxActions?: number }): AiTurnResult => {
  // Reserva 2 ações para o fechamento forçado (NEXT_PHASE da compra e END_TURN).
  const limit = Math.max(2, Math.floor(maxActions));
  const free = limit - 2;
  let current = state;
  let rngSeed = seed;
  const actions: Action[] = [];
  const events: GameEvent[] = [];

  const play = (action: Action): boolean => {
    const result = applyAction(current, side, action);
    if (!result.ok) return false;
    current = result.state;
    actions.push(action);
    events.push(...result.events);
    return true;
  };

  if (!mustAct(current, side)) return { state, actions, events, seed, status: "NOT_ACTING" };

  while (mustAct(current, side) && actions.length < free) {
    const decision = chooseAiAction({ state: current, side, level, seed: rngSeed });
    rngSeed = decision.seed;
    if (!decision.action || !play(decision.action)) break;
  }

  // Limite atingido (ou decisão sem ação): fecha o turno à força, sem estourar o limite.
  while (mustAct(current, side) && actions.length < limit) {
    const action = fallbackAction(current, side);
    if (!action || !play(action)) break;
  }

  const status: AiTurnStatus = current.winner
    ? "MATCH_ENDED"
    : current.pendingResponse && current.pendingResponse.responder !== side
      ? "WAITING_RESPONSE"
      : "TURN_ENDED";
  return { state: current, actions, events, seed: rngSeed, status };
};
