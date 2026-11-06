// src/engine/applyAction.ts
import { drawPhase, endTurn, nextPhaseOf } from "./rules/turn";
import type { Action, ActionResult, MatchState, PlayerId } from "./types";

/** Aplica uma ação do jogador ao estado, sem alterá-lo. Jogada inválida devolve um código estável. */
export const applyAction = (state: MatchState, player: PlayerId, action: Action): ActionResult => {
  if (state.winner) return { ok: false, code: "MATCH_ENDED" };
  if (state.currentPlayer !== player) return { ok: false, code: "NOT_YOUR_TURN" };

  switch (action.type) {
    case "NEXT_PHASE": {
      if (state.phase === "DRAW") {
        const draw = drawPhase(state);
        return { ok: true, ...draw };
      }
      const phase = nextPhaseOf(state.phase);
      if (phase === null) return { ok: false, code: "INVALID_PHASE" };
      return { ok: true, state: { ...state, phase }, events: [{ type: "PHASE_CHANGED", phase }] };
    }
    case "END_TURN": {
      if (state.phase === "DRAW") return { ok: false, code: "INVALID_PHASE" };
      return { ok: true, ...endTurn(state) };
    }
    default:
      return { ok: false, code: "ACTION_NOT_AVAILABLE" };
  }
};
