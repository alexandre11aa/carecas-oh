// src/engine/createMatch.ts
import { getDeck, type DeckId } from "./decks.js";
import { nextRandom, shuffle } from "./rng.js";
import type { MatchState, PlayerId, PlayerState } from "./types.js";

export const INITIAL_LIFE_POINTS = 4000;
export const INITIAL_HAND_SIZE = 4;
export const MONSTER_ZONES = 5;
export const SPELL_TRAP_ZONES = 5;

const createPlayer = (id: PlayerId, deckId: DeckId, cards: string[]): PlayerState => ({
  id,
  deckId,
  lifePoints: INITIAL_LIFE_POINTS,
  hand: cards.slice(0, INITIAL_HAND_SIZE),
  deck: cards.slice(INITIAL_HAND_SIZE),
  monsters: Array.from({ length: MONSTER_ZONES }, () => null),
  spellTraps: Array.from({ length: SPELL_TRAP_ZONES }, () => null),
  graveyard: [],
  normalSummonUsed: false,
});

/**
 * Cria o estado inicial: 4000 LP, deck fixo de 20 cartas de cada jogador embaralhado com a semente, 4 cartas na mão e
 * 16 no deck. Os dois jogadores podem escolher o mesmo deck. O jogador inicial sai da semente.
 * O estado começa na fase de compra do turno 1; a compra é executada ao avançar a fase (NEXT_PHASE).
 */
export const createMatch = (seed: number, decks: Record<PlayerId, DeckId>): MatchState => {
  const p1 = shuffle(getDeck(decks.P1).cardIds, seed);
  const p2 = shuffle(getDeck(decks.P2).cardIds, p1.seed);
  const rng = nextRandom(p2.seed);
  return {
    seed: rng.seed,
    turn: 1,
    currentPlayer: rng.value < 0.5 ? "P1" : "P2",
    phase: "DRAW",
    players: {
      P1: createPlayer("P1", decks.P1, p1.items),
      P2: createPlayer("P2", decks.P2, p2.items),
    },
    winner: null,
    pendingResponse: null,
  };
};
