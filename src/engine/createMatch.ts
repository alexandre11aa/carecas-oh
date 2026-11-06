// src/engine/createMatch.ts
import { dealDecks } from "./decks";
import { nextRandom } from "./rng";
import type { MatchState, PlayerId, PlayerState } from "./types";

export const INITIAL_LIFE_POINTS = 8000;
export const INITIAL_HAND_SIZE = 5;
export const MONSTER_ZONES = 5;
export const SPELL_TRAP_ZONES = 5;

const createPlayer = (id: PlayerId, cards: string[]): PlayerState => ({
  id,
  lifePoints: INITIAL_LIFE_POINTS,
  hand: cards.slice(0, INITIAL_HAND_SIZE),
  deck: cards.slice(INITIAL_HAND_SIZE),
  monsters: Array.from({ length: MONSTER_ZONES }, () => null),
  spellTraps: Array.from({ length: SPELL_TRAP_ZONES }, () => null),
  graveyard: [],
  normalSummonUsed: false,
});

/**
 * Cria o estado inicial: 8000 LP, 5 cartas na mão e 5 no deck. O jogador inicial sai da semente.
 * O estado começa na fase de compra do turno 1; a compra é executada ao avançar a fase (NEXT_PHASE).
 */
export const createMatch = (seed: number): MatchState => {
  const dealt = dealDecks(seed);
  const rng = nextRandom(dealt.seed);
  return {
    seed: rng.seed,
    turn: 1,
    currentPlayer: rng.value < 0.5 ? "P1" : "P2",
    phase: "DRAW",
    players: {
      P1: createPlayer("P1", dealt.decks.P1),
      P2: createPlayer("P2", dealt.decks.P2),
    },
    winner: null,
    pendingResponse: null,
  };
};
