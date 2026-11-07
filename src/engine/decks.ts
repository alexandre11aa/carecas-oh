// src/engine/decks.ts
export const DECK_SIZE = 10;

export type DeckId = "aggressive" | "defensive" | "magic" | "control" | "balanced" | "strategic";

export type DeckDefinition = {
  id: DeckId;
  name: string;
  /** Exatamente `DECK_SIZE` cartas; cada carta aparece em no máximo um deck. */
  cardIds: readonly string[];
};

/** Os 6 decks fixos (monstros/magias/armadilhas): 6/3/1, 5/2/3, 4/5/1, 4/3/3, 5/3/2 e 5/4/1. */
export const DECKS: readonly DeckDefinition[] = [
  {
    id: "aggressive",
    name: "Agressivo",
    cardIds: [
      "crimson_blade", "crimson_wolf", "crimson_warrior", "ember_boar", "war_executioner", "blazing_colossus",
      "war_cry", "flaming_lance", "blind_fury",
      "cutting_net",
    ],
  },
  {
    id: "defensive",
    name: "Defensivo",
    cardIds: [
      "stone_sentinel", "iron_squire", "living_wall", "basalt_guardian", "granite_giant",
      "life_wall", "sanctuary_blessing",
      "mirror_shield", "spear_barrier", "silent_web",
    ],
  },
  {
    id: "magic",
    name: "Mágico",
    cardIds: [
      "runic_raven", "eclipse_mage", "frost_witch", "sphinx_archmage",
      "call_beyond", "arcane_dart", "runic_pulse", "frost_blast", "arcane_draw",
      "runic_seal",
    ],
  },
  {
    id: "control",
    name: "Controle",
    cardIds: [
      "moss_golem", "bone_knight", "storm_hawk", "iron_minotaur",
      "silent_rupture", "power_surge", "wind_gust",
      "divine_glory_evasion", "spike_pit", "dark_veil",
    ],
  },
  {
    id: "balanced",
    name: "Equilibrado",
    cardIds: [
      "ash_sprite", "tide_imp", "crystal_bat", "dune_scout", "ash_dragon",
      "vital_exchange", "fire_bolt", "healing_spring",
      "mist_wall", "hidden_snare",
    ],
  },
  {
    id: "strategic",
    name: "Estratégico",
    cardIds: [
      "cunning_scout", "wall_archer", "tactical_captain", "strategist_knight", "siege_general",
      "retreat_plan", "precise_strike", "tactical_reinforcement", "inside_information",
      "counter_offensive",
    ],
  },
];

export const getDeck = (id: DeckId): DeckDefinition => {
  const deck = DECKS.find((candidate) => candidate.id === id);
  if (!deck) throw new Error(`Deck desconhecido: ${id}`);
  return deck;
};
