// src/engine/rules/turn.ts
// Ciclo de turnos: compra automática, fases e fim de turno. Funções puras.
import type { GameEvent, MatchState, Phase, PlayerId } from "../types";

export const opponentOf = (player: PlayerId): PlayerId => (player === "P1" ? "P2" : "P1");

/** Quem inicia o primeiro turno (turno 1) não pode atacar. */
export const canAttack = (state: MatchState): boolean => state.turn > 1;

const PHASE_ORDER: Phase[] = ["DRAW", "MAIN_1", "BATTLE", "MAIN_2", "END"];

export const nextPhaseOf = (phase: Phase): Phase | null => {
  const index = PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER[index + 1] ?? null;
};

export type TurnStep = { state: MatchState; events: GameEvent[] };

/**
 * Executa a compra do jogador do turno e avança para a Principal 1.
 * Sem carta para comprar, o jogador perde e o oponente é registrado como vencedor.
 */
export const drawPhase = (state: MatchState): TurnStep => {
  const player = state.currentPlayer;
  const current = state.players[player];
  const [cardId, ...restDeck] = current.deck;
  if (cardId === undefined) {
    const winner = opponentOf(player);
    return {
      state: { ...state, winner },
      events: [{ type: "MATCH_ENDED", winner }],
    };
  }
  return {
    state: {
      ...state,
      phase: "MAIN_1",
      players: {
        ...state.players,
        [player]: { ...current, deck: restDeck, hand: [...current.hand, cardId] },
      },
    },
    events: [
      { type: "CARD_DRAWN", player, cardId },
      { type: "PHASE_CHANGED", phase: "MAIN_1" },
    ],
  };
};

/** Passa o turno ao oponente, reinicia os limites do turno e executa a compra. */
export const endTurn = (state: MatchState): TurnStep => {
  const ending = state.currentPlayer;
  const player = opponentOf(ending);
  const next: MatchState = {
    ...state,
    turn: state.turn + 1,
    currentPlayer: player,
    phase: "DRAW",
    players: {
      ...state.players,
      // Bônus de ATK de magias vale até o fim do turno em que foi dado.
      [ending]: {
        ...state.players[ending],
        monsters: state.players[ending].monsters.map((m) => (m?.attackBonus ? { ...m, attackBonus: 0 } : m)),
      },
      [player]: {
        ...state.players[player],
        normalSummonUsed: false,
        monsters: state.players[player].monsters.map((m) => (m ? { ...m, hasAttacked: false } : m)),
      },
    },
  };
  const draw = drawPhase(next);
  return {
    state: draw.state,
    events: [{ type: "TURN_STARTED", player, turn: next.turn }, ...draw.events],
  };
};
