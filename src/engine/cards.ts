// src/engine/cards.ts
// 20 cartas provisórias; valores gerados aleatoriamente uma vez e fixados aqui.
import type { Card } from "./types.js";

const image = (id: string): string => `/cards/${id}.png`;

export const CARDS: readonly Card[] = [
  // Monstros nível 1-4 (sem tributo)
  { id: "ash_sprite", name: "Fagulha de Cinzas", type: "MONSTER", level: 2, attack: 700, defense: 500, image: image("ash_sprite"), description: "Uma pequena chama que brilha no escuro.", flavor: "Nasce de uma brasa esquecida e teme apenas a chuva." },
  { id: "moss_golem", name: "Golem de Musgo", type: "MONSTER", level: 3, attack: 1100, defense: 1500, image: image("moss_golem"), description: "Um guardião lento coberto de musgo.", flavor: "Dorme por décadas até que alguém pise em seu bosque." },
  { id: "dune_scout", name: "Batedor das Dunas", type: "MONSTER", level: 4, attack: 1700, defense: 900, image: image("dune_scout"), description: "Rápido como o vento do deserto.", flavor: "Seus passos não deixam rastro na areia do deserto." },
  { id: "tide_imp", name: "Diabrete da Maré", type: "MONSTER", level: 1, attack: 600, defense: 800, image: image("tide_imp"), description: "Adora molhar os distraídos.", flavor: "Vive nas poças deixadas pela maré e ri de quem escorrega." },
  { id: "bone_knight", name: "Cavaleiro de Ossos", type: "MONSTER", level: 4, attack: 1500, defense: 1300, image: image("bone_knight"), description: "Serve a um rei esquecido.", flavor: "Jurou lealdade em vida e ainda cumpre o juramento depois dela." },
  { id: "crystal_bat", name: "Morcego de Cristal", type: "MONSTER", level: 3, attack: 1300, defense: 600, image: image("crystal_bat"), description: "Suas asas refletem a luz da lua.", flavor: "Caça sob o luar, guiada pelo brilho das próprias asas." },
  // Monstros nível 5-6 (1 tributo)
  { id: "storm_hawk", name: "Falcão da Tempestade", type: "MONSTER", level: 5, attack: 2100, defense: 1400, image: image("storm_hawk"), description: "Cavalga os raios do céu.", flavor: "Dizem que o trovão é apenas o eco de seu grito." },
  { id: "iron_minotaur", name: "Minotauro de Ferro", type: "MONSTER", level: 6, attack: 2400, defense: 1800, image: image("iron_minotaur"), description: "Ninguém escapa de seu labirinto.", flavor: "Forjado numa fornalha sem nome, guarda um labirinto sem saída." },
  { id: "frost_witch", name: "Bruxa do Gelo", type: "MONSTER", level: 5, attack: 1900, defense: 2000, image: image("frost_witch"), description: "Congela o que toca.", flavor: "Seu sussurro congela o ar antes mesmo de ser ouvido." },
  // Monstros nível 7+ (2 tributos)
  { id: "ash_dragon", name: "Dragão de Cinzas", type: "MONSTER", level: 7, attack: 2800, defense: 2100, image: image("ash_dragon"), description: "Um dragão que renasce das próprias cinzas.", flavor: "Cada vez que cai, ergue-se mais poderoso das próprias cinzas." },
  { id: "abyss_titan", name: "Titã do Abismo", type: "MONSTER", level: 8, attack: 3000, defense: 2500, image: image("abyss_titan"), description: "Desperta das profundezas uma vez por século.", flavor: "As águas se recolhem quando ele desperta no fundo do abismo." },
  // Magias
  { id: "healing_spring", name: "Fonte Curativa", type: "SPELL", effect: { kind: "HEAL", amount: 1000 }, image: image("healing_spring"), description: "Recupera pontos de vida do conjurador.", flavor: "Fonte abençoada que concede refrigério a quem disfruta da oportunidade de beber sua água." },
  { id: "power_surge", name: "Surto de Poder", type: "SPELL", effect: { kind: "BOOST_ATTACK", amount: 700 }, image: image("power_surge"), description: "Aumenta o ataque de um monstro até o fim do turno.", flavor: "Uma onda de energia pura que enche de coragem quem a recebe." },
  { id: "wind_gust", name: "Rajada de Vento", type: "SPELL", effect: { kind: "DESTROY_MONSTER", maxAttack: 2000 }, image: image("wind_gust"), description: "Destrói um monstro do oponente com ATK 2000 ou menos.", flavor: "Um sopro furioso que varre do campo quem ousa ficar no caminho." },
  { id: "fire_bolt", name: "Raio de Fogo", type: "SPELL", effect: { kind: "DAMAGE", amount: 800 }, image: image("fire_bolt"), description: "Causa 800 de dano direto ao oponente.", flavor: "Faísca lançada com precisão, deixa uma marca que arde por dias." },
  { id: "arcane_draw", name: "Sabedoria Arcana", type: "SPELL", effect: { kind: "DRAW", count: 1 }, image: image("arcane_draw"), description: "Compre 1 carta.", flavor: "Os antigos tomos revelam seus segredos a quem sabe ouvi-los." },
  // Armadilhas
  { id: "spike_pit", name: "Fosso de Espinhos", type: "TRAP", trigger: "ATTACK_DECLARED", effect: { kind: "DESTROY_ATTACKER", maxAttack: 2000 }, image: image("spike_pit"), description: "Destrói um monstro atacante com ATK 2000 ou menos.", flavor: "O chão parece firme, até o primeiro passo em falso." },
  { id: "divine_glory_evasion", name: "Esquiva da Glória Divina", type: "TRAP", trigger: "ATTACK_DECLARED", effect: { kind: "NEGATE_ATTACK" }, image: "/cards/esquiva_da_gloria_divina.png", description: "Anula um ataque.", flavor: "Quem investe contra ela só encontra o próprio reflexo." },
  { id: "hidden_snare", name: "Laço Escondido", type: "TRAP", trigger: "SUMMON", effect: { kind: "NEGATE_SUMMON" }, image: image("hidden_snare"), description: "Impede uma invocação.", flavor: "Esperou em silêncio por tanto tempo que quase foi esquecido." },
  { id: "dark_veil", name: "Véu Sombrio", type: "TRAP", trigger: "SPELL_ACTIVATION", effect: { kind: "NEGATE_SPELL" }, image: image("dark_veil"), description: "Cancela a ativação de uma magia.", flavor: "Uma cortina de sombras que abafa até as palavras mais poderosas." },
];

export const getCard = (id: string): Card | undefined => CARDS.find((card) => card.id === id);
