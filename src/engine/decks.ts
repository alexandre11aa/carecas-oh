// src/engine/decks.ts
import { CARDS } from "./cards.js";
import { shuffle } from "./rng.js";

export const DECK_SIZE = 10;

export type DealtDecks = {
  decks: { P1: string[]; P2: string[] };
  seed: number;
};

/**
 * Pool legado: as 20 cartas originais. Enquanto não houver decks fixos, `dealDecks` sorteia só sobre ele.
 * Remover quando a issue de decks fixos entrar.
 */
const LEGACY_POOL = new Set([
  "ash_sprite", "moss_golem", "dune_scout", "tide_imp", "bone_knight", "crystal_bat",
  "storm_hawk", "iron_minotaur", "frost_witch", "ash_dragon", "abyss_titan",
  "healing_spring", "power_surge", "wind_gust", "fire_bolt", "arcane_draw",
  "spike_pit", "divine_glory_evasion", "hidden_snare", "dark_veil",
]);

const CATEGORIES = ["LOW_MONSTER", "MID_MONSTER", "HIGH_MONSTER", "SPELL", "TRAP"] as const;
type Category = (typeof CATEGORIES)[number];

const categoryOf = (card: (typeof CARDS)[number]): Category => {
  if (card.type === "SPELL") return "SPELL";
  if (card.type === "TRAP") return "TRAP";
  if (card.level <= 4) return "LOW_MONSTER";
  return card.level <= 6 ? "MID_MONSTER" : "HIGH_MONSTER";
};

/**
 * Divide as 20 cartas por categoria (monstro nível 1-4, 5-6, 7+, magia, armadilha): cada categoria é
 * embaralhada com a semente e distribuída alternadamente. Nas categorias de tamanho ímpar, quem recebe
 * a carta extra alterna (P1 na primeira, P2 na seguinte, e assim por diante).
 */
export const dealDecks = (seed: number): DealtDecks => {
  const decks: { P1: string[]; P2: string[] } = { P1: [], P2: [] };
  let current = seed;
  let extraTo: "P1" | "P2" = "P1";
  for (const category of CATEGORIES) {
    const shuffled = shuffle(
      CARDS.filter((card) => LEGACY_POOL.has(card.id) && categoryOf(card) === category).map((card) => card.id),
      current,
    );
    current = shuffled.seed;
    const half = Math.floor(shuffled.items.length / 2);
    const other: "P1" | "P2" = extraTo === "P1" ? "P2" : "P1";
    const odd = shuffled.items.length % 2 === 1;
    const firstCount = odd ? half + 1 : half;
    decks[extraTo].push(...shuffled.items.slice(0, firstCount));
    decks[other].push(...shuffled.items.slice(firstCount));
    if (odd) extraTo = other;
  }
  // Embaralha a ordem final de cada deck para não revelar a categoria pela posição de compra.
  const p1 = shuffle(decks.P1, current);
  const p2 = shuffle(decks.P2, p1.seed);
  return { decks: { P1: p1.items, P2: p2.items }, seed: p2.seed };
};
