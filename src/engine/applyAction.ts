// src/engine/applyAction.ts
import { attack } from "./rules/combat.js";
import { activateSpell, setSpellTrap } from "./rules/spells.js";
import { changePosition, flipSummon, summonMonster } from "./rules/summon.js";
import { openResponseWindow, respond } from "./rules/traps.js";
import { drawPhase, endTurn, nextPhaseOf } from "./rules/turn.js";
import type { Action, ActionResult, MatchState, PlayerId } from "./types.js";

/** Aplica uma ação do jogador ao estado, sem alterá-lo. Jogada inválida devolve um código estável. */
export const applyAction = (state: MatchState, player: PlayerId, action: Action): ActionResult => {
  if (state.winner) return { ok: false, code: "MATCH_ENDED" };

  // Com janela aberta, só o defensor age, e apenas para ativar uma armadilha ou passar.
  if (state.pendingResponse) {
    const isResponse = action.type === "ACTIVATE_TRAP" || action.type === "PASS_RESPONSE";
    if (player !== state.pendingResponse.responder || !isResponse) return { ok: false, code: "RESPONSE_PENDING" };
    return respond(state, player, action, executeAction);
  }
  if (action.type === "ACTIVATE_TRAP" || action.type === "PASS_RESPONSE") {
    return { ok: false, code: "NO_RESPONSE_WINDOW" };
  }
  if (state.currentPlayer !== player) return { ok: false, code: "NOT_YOUR_TURN" };

  const result = executeAction(state, player, action);
  if (!result.ok) return result;
  // Ação válida que o defensor pode responder: abre a janela e adia o efeito até a resposta.
  return openResponseWindow(state, player, action) ?? result;
};

/** Executa a ação do jogador do turno, sem considerar janelas de resposta. */
const executeAction = (state: MatchState, player: PlayerId, action: Action): ActionResult => {
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
    case "SUMMON_CARD":
    case "SET_MONSTER":
      return summonMonster(state, player, action);
    case "CHANGE_POSITION":
      return changePosition(state, player, action);
    case "FLIP_SUMMON":
      return flipSummon(state, player, action);
    case "SET_SPELL_TRAP":
      return setSpellTrap(state, player, action);
    case "ACTIVATE_SPELL":
      return activateSpell(state, player, action);
    case "ATTACK":
      return attack(state, player, action);
    default:
      return { ok: false, code: "ACTION_NOT_AVAILABLE" };
  }
};
