// src/engine/cards.ts
// 20 cartas provisórias; valores gerados aleatoriamente uma vez e fixados aqui.
import type { Card } from "./types";

const image = (id: string): string => `/cards/${id}.webp`;

export const CARDS: readonly Card[] = [
  // Monstros nível 1-4 (sem tributo)
  { id: "ash_sprite", name: "Fagulha de Cinzas", type: "MONSTER", level: 2, attack: 700, defense: 500, image: image("ash_sprite"), description: "Uma pequena chama que brilha no escuro." },
  { id: "moss_golem", name: "Golem de Musgo", type: "MONSTER", level: 3, attack: 1100, defense: 1500, image: image("moss_golem"), description: "Um guardião lento coberto de musgo." },
  { id: "dune_scout", name: "Batedor das Dunas", type: "MONSTER", level: 4, attack: 1700, defense: 900, image: image("dune_scout"), description: "Rápido como o vento do deserto." },
  { id: "tide_imp", name: "Diabrete da Maré", type: "MONSTER", level: 1, attack: 400, defense: 800, image: image("tide_imp"), description: "Adora molhar os distraídos." },
  { id: "bone_knight", name: "Cavaleiro de Ossos", type: "MONSTER", level: 4, attack: 1500, defense: 1300, image: image("bone_knight"), description: "Serve a um rei esquecido." },
  { id: "crystal_bat", name: "Morcego de Cristal", type: "MONSTER", level: 3, attack: 1300, defense: 600, image: image("crystal_bat"), description: "Suas asas refletem a luz da lua." },
  // Monstros nível 5-6 (1 tributo)
  { id: "storm_hawk", name: "Falcão da Tempestade", type: "MONSTER", level: 5, attack: 2100, defense: 1400, image: image("storm_hawk"), description: "Cavalga os raios do céu." },
  { id: "iron_minotaur", name: "Minotauro de Ferro", type: "MONSTER", level: 6, attack: 2400, defense: 1800, image: image("iron_minotaur"), description: "Ninguém escapa de seu labirinto." },
  { id: "frost_witch", name: "Bruxa do Gelo", type: "MONSTER", level: 5, attack: 1900, defense: 2000, image: image("frost_witch"), description: "Congela o que toca." },
  // Monstros nível 7+ (2 tributos)
  { id: "ash_dragon", name: "Dragão de Cinzas", type: "MONSTER", level: 7, attack: 2800, defense: 2100, image: image("ash_dragon"), description: "Um dragão que renasce das próprias cinzas." },
  { id: "abyss_titan", name: "Titã do Abismo", type: "MONSTER", level: 8, attack: 3000, defense: 2500, image: image("abyss_titan"), description: "Desperta das profundezas uma vez por século." },
  { id: "sun_phoenix", name: "Fênix Solar", type: "MONSTER", level: 7, attack: 2600, defense: 2300, image: image("sun_phoenix"), description: "Sua luz queima e cura ao mesmo tempo." },
  // Magias
  { id: "healing_spring", name: "Fonte Curativa", type: "SPELL", image: image("healing_spring"), description: "Recupera pontos de vida do conjurador." },
  { id: "power_surge", name: "Surto de Poder", type: "SPELL", image: image("power_surge"), description: "Aumenta o ataque de um monstro até o fim do turno." },
  { id: "wind_gust", name: "Rajada de Vento", type: "SPELL", image: image("wind_gust"), description: "Devolve uma carta do campo à mão do dono." },
  { id: "arcane_draw", name: "Sabedoria Arcana", type: "SPELL", image: image("arcane_draw"), description: "Compre 1 carta." },
  // Armadilhas
  { id: "spike_pit", name: "Fosso de Espinhos", type: "TRAP", image: image("spike_pit"), description: "Destrói um monstro que declarou ataque." },
  { id: "mirror_wall", name: "Muralha Espelhada", type: "TRAP", image: image("mirror_wall"), description: "Anula um ataque." },
  { id: "hidden_snare", name: "Laço Escondido", type: "TRAP", image: image("hidden_snare"), description: "Impede uma invocação." },
  { id: "dark_veil", name: "Véu Sombrio", type: "TRAP", image: image("dark_veil"), description: "Cancela a ativação de uma magia." },
];

export const getCard = (id: string): Card | undefined => CARDS.find((card) => card.id === id);
