// src/engine/decks.ts
import { CARDS } from "./cards";
import { shuffle } from "./rng";

export const DECK_SIZE = 10;

export type DealtDecks = {
  decks: { P1: string[]; P2: string[] };
  seed: number;
};

/** Embaralha as 20 cartas com a semente e entrega 10 a cada jogador, sem repetição. */
export const dealDecks = (seed: number): DealtDecks => {
  const shuffled = shuffle(
    CARDS.map((card) => card.id),
    seed,
  );
  return {
    decks: {
      P1: shuffled.items.slice(0, DECK_SIZE),
      P2: shuffled.items.slice(DECK_SIZE, DECK_SIZE * 2),
    },
    seed: shuffled.seed,
  };
};
