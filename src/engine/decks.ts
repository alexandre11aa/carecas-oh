// src/engine/decks.ts
export const DECK_SIZE = 20;
/** Máximo de cópias de uma mesma carta no deck; a carta única (magia de efeito exclusivo) entra 1 vez. */
export const MAX_COPIES = 3;

export type DeckId = "aggressive" | "defensive" | "magic" | "control" | "balanced" | "strategic";

/** Uma carta do deck e quantas cópias dela entram (1 a `MAX_COPIES`). */
export type DeckEntry = { cardId: string; copies: number };

export type DeckDefinition = {
  id: DeckId;
  name: string;
  /** Cartas distintas do deck com suas cópias, em ordem fixa; a soma das cópias é `DECK_SIZE`. */
  entries: readonly DeckEntry[];
  /** `entries` expandido: exatamente `DECK_SIZE` ids (com repetição), antes de embaralhar. */
  cardIds: readonly string[];
};

const defineDeck = (id: DeckId, name: string, spec: readonly (readonly [string, number])[]): DeckDefinition => {
  const entries = spec.map(([cardId, copies]) => ({ cardId, copies }));
  return { id, name, entries, cardIds: entries.flatMap((entry) => Array<string>(entry.copies).fill(entry.cardId)) };
};

/**
 * Os 6 decks fixos de 20 cartas, só com as cartas de cada deck repetidas (monstros/magias/armadilhas):
 * 12/6/2, 10/4/6, 8/10/2, 8/6/6, 10/6/4 e 10/8/2. A magia de efeito exclusivo entra 1 vez; as demais, de 1 a 3.
 */
export const DECKS: readonly DeckDefinition[] = [
  defineDeck("aggressive", "Agressivo", [
    ["crimson_blade", 2], ["crimson_wolf", 2], ["crimson_warrior", 3], ["ember_boar", 2], ["war_executioner", 2], ["blazing_colossus", 1],
    ["war_cry", 1], ["flaming_lance", 3], ["blind_fury", 2],
    ["cutting_net", 2],
  ]),
  defineDeck("defensive", "Defensivo", [
    ["stone_sentinel", 3], ["iron_squire", 2], ["living_wall", 2], ["basalt_guardian", 2], ["granite_giant", 1],
    ["life_wall", 1], ["sanctuary_blessing", 3],
    ["mirror_shield", 2], ["spear_barrier", 2], ["silent_web", 2],
  ]),
  defineDeck("magic", "Mágico", [
    ["runic_raven", 3], ["eclipse_mage", 2], ["frost_witch", 2], ["sphinx_archmage", 1],
    ["call_beyond", 1], ["arcane_dart", 3], ["runic_pulse", 2], ["frost_blast", 2], ["arcane_draw", 2],
    ["runic_seal", 2],
  ]),
  defineDeck("control", "Controle", [
    ["moss_golem", 3], ["bone_knight", 2], ["storm_hawk", 2], ["iron_minotaur", 1],
    ["silent_rupture", 1], ["power_surge", 3], ["wind_gust", 2],
    ["divine_glory_evasion", 2], ["spike_pit", 2], ["dark_veil", 2],
  ]),
  defineDeck("balanced", "Equilibrado", [
    ["ash_sprite", 2], ["tide_imp", 2], ["crystal_bat", 2], ["dune_scout", 3], ["ash_dragon", 1],
    ["vital_exchange", 1], ["fire_bolt", 2], ["healing_spring", 3],
    ["mist_wall", 2], ["hidden_snare", 2],
  ]),
  defineDeck("strategic", "Estratégico", [
    ["cunning_scout", 3], ["wall_archer", 2], ["tactical_captain", 2], ["strategist_knight", 2], ["siege_general", 1],
    ["retreat_plan", 1], ["precise_strike", 3], ["tactical_reinforcement", 2], ["inside_information", 2],
    ["counter_offensive", 2],
  ]),
];

export const getDeck = (id: DeckId): DeckDefinition => {
  const deck = DECKS.find((candidate) => candidate.id === id);
  if (!deck) throw new Error(`Deck desconhecido: ${id}`);
  return deck;
};
