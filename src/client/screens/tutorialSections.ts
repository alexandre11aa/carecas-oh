// src/client/screens/tutorialSections.ts
import { CARDS, getCard } from "../../engine/cards.js";
import { DECKS, type DeckId } from "../../engine/decks.js";
import { buildCardDetail, type CardDetail, type CardKind } from "./cardDetail.js";

/** Bloco de conteúdo de uma seção: lista ou tabela. */
export type TutorialBlock =
  | { kind: "list"; items: readonly string[] }
  | { kind: "table"; headers: readonly string[]; rows: readonly (readonly string[])[] };

/** Seção da página do guia (`/guia`). */
export type TutorialSection = {
  id: string;
  title: string;
  /** Texto curto exibido sob o título. */
  summary: string;
  /** Conteúdo escaneável exibido após o resumo. */
  details: readonly TutorialBlock[];
};

export const GUIDE_SECTIONS: readonly TutorialSection[] = [
  {
    id: "objetivo",
    title: "Objetivo e vida",
    summary: "Partida 1x1: vença zerando a vida do oponente ou deixando-o sem carta para comprar.",
    details: [
      {
        kind: "list",
        items: [
          "Cada jogador começa com 8000 pontos de vida.",
          "Vence quem zerar os pontos de vida do oponente.",
          "Perde quem não puder comprar quando for obrigado a comprar.",
        ],
      },
    ],
  },
  {
    id: "decks",
    title: "Decks e mão inicial",
    summary: "Antes de cada partida, cada jogador escolhe um dos 6 decks fixos de 10 cartas.",
    details: [
      {
        kind: "list",
        items: [
          "A escolha do deck vale para cada partida, inclusive na revanche.",
          "Os decks são fixos: não dá para editar nem trocar cartas.",
          "Os dois jogadores podem escolher o mesmo deck.",
          "A escolha é secreta: o oponente só descobre o seu deck quando a partida começa.",
          "O deck é embaralhado com a semente da partida: a mão inicial tem 5 cartas aleatórias e as outras 5 ficam no deck, compradas em ordem aleatória.",
          "A mão e a ordem do deck do oponente não aparecem para você.",
        ],
      },
      {
        kind: "table",
        headers: ["Deck", "Monstros", "Magias", "Armadilhas"],
        rows: DECKS.map((deck) => {
          const count = (type: "MONSTER" | "SPELL" | "TRAP"): string =>
            String(deck.cardIds.filter((id) => CARDS.find((card) => card.id === id)?.type === type).length);
          return [deck.name, count("MONSTER"), count("SPELL"), count("TRAP")];
        }),
      },
    ],
  },
  {
    id: "turno",
    title: "Fases do turno",
    summary: "Compra, Principal 1, Batalha, Principal 2 e Fim.",
    details: [
      {
        kind: "table",
        headers: ["Fase", "O que acontece"],
        rows: [
          ["Compra", "O jogador do turno compra 1 carta."],
          ["Principal 1", "Invocar, baixar, mudar posição e usar magias."],
          ["Batalha", "Monstros em ataque podem atacar."],
          ["Principal 2", "O mesmo da Principal 1, respeitando os limites do turno."],
          ["Fim", "O turno passa ao oponente."],
        ],
      },
      {
        kind: "list",
        items: [
          "Quem começa a partida não pode atacar no primeiro turno.",
          "Cada turno tem limite de 30 segundos; o tempo reinicia a cada ação válida.",
          "Se o tempo acabar, o servidor encerra o turno por você (ou passa a resposta de armadilha pendente).",
        ],
      },
    ],
  },
  {
    id: "monstros",
    title: "Monstros, tributo e posições",
    summary: "O campo tem 5 zonas de monstro por jogador e 1 invocação normal por turno.",
    details: [
      {
        kind: "table",
        headers: ["Nível do monstro", "Tributos exigidos"],
        rows: [
          ["1 a 4", "Nenhum"],
          ["5 a 6", "1 monstro do seu campo"],
          ["7 ou mais", "2 monstros do seu campo"],
        ],
      },
      {
        kind: "list",
        items: [
          "Os tributos são monstros do seu próprio campo e vão ao cemitério.",
          "Invocação normal: 1 por turno, em posição de ataque, virada para cima.",
          "Baixar em defesa virada: o monstro entra de face para baixo, em defesa, e conta como a invocação normal do turno.",
          "Mudança de posição: uma vez por turno por monstro, nas fases Principais, entre ataque e defesa.",
          "Um monstro não muda de posição no turno em que foi invocado nem depois de atacar.",
          "Um monstro virado vira-se para cima ao mudar para ataque.",
        ],
      },
    ],
  },
  {
    id: "combate",
    title: "Combate",
    summary: "Cada monstro em ataque ataca uma vez por turno, na fase de Batalha.",
    details: [
      {
        kind: "table",
        headers: ["Situação", "Resultado"],
        rows: [
          ["Ataque contra ataque (ATK maior)", "O monstro mais fraco é destruído e seu dono sofre a diferença de ATK como dano."],
          ["Ataque contra ataque (empate)", "Os dois monstros são destruídos, sem dano."],
          ["Ataque contra defesa (ATK maior que a DEF)", "O monstro em defesa é destruído, sem dano aos pontos de vida."],
          ["Ataque contra defesa (ATK menor que a DEF)", "O atacante sofre a diferença como dano."],
          ["Ataque direto", "Só é permitido quando o oponente não tem monstros; o dano é o ATK do atacante."],
        ],
      },
      { kind: "list", items: ["Atacar um monstro virado o vira para cima antes da comparação."] },
    ],
  },
  {
    id: "magias",
    title: "Magias",
    summary: "Ativadas pelo jogador do turno, com efeito imediato.",
    details: [
      {
        kind: "list",
        items: [
          "Ative magias da mão nas fases Principais; depois de usada, a magia vai ao cemitério.",
          "Também é possível baixar a magia virada na zona de magia/armadilha e ativá-la depois.",
          "Algumas magias pedem um alvo: um monstro seu (reforço de ataque, que vale até o fim do turno), um monstro do oponente (destruição ou devolução à mão) ou uma magia/armadilha do oponente (destruição, mesmo virada).",
          "Outras não pedem alvo: reforçam todos os seus monstros, curam, causam dano ou drenam vida, fazem comprar cartas ou trazem de volta ao campo um monstro do seu cemitério.",
          "O texto exato de cada efeito está na página de cartas.",
          "A ativação de uma magia pode ser respondida por uma armadilha do oponente.",
        ],
      },
    ],
  },
  {
    id: "armadilhas",
    title: "Armadilhas e janela de resposta",
    summary: "Baixadas viradas e ativadas no turno do oponente.",
    details: [
      {
        kind: "list",
        items: [
          "Baixe a armadilha virada na zona de magia/armadilha.",
          "Ela só pode ser ativada a partir do turno seguinte ao que foi baixada.",
          "Quando o jogador do turno declara um ataque, invoca um monstro ou ativa uma magia, o jogo abre uma janela de resposta.",
          "Na janela, o oponente decide ativar uma armadilha ou passar.",
          "O efeito da armadilha resolve antes da ação original, que pode ser cancelada por ele.",
          "Há apenas uma resposta por janela: não existe cadeia de efeitos.",
        ],
      },
    ],
  },
  {
    id: "ia",
    title: "Duelar com IA",
    summary: "Jogue sozinho contra o computador, sem sala de espera nem outro jogador.",
    details: [
      {
        kind: "list",
        items: [
          "Na página inicial, toque em \"Duelar com IA\", escolha o nível e o seu deck e inicie o duelo: a partida começa na hora.",
          "A IA joga no servidor, uma ação por vez e com uma pequena pausa, para você acompanhar cada jogada.",
          "A IA joga com um deck aleatório, sorteado entre os 6 decks fixos.",
          "O limite de 30 segundos vale só para você: na vez da IA não há relógio.",
          "Revanche: a IA sempre aceita. Você escolhe o deck de novo, os lados são trocados, o nível é mantido e a IA recebe outro deck aleatório.",
          "Sair da sala no meio da partida é desistência e encerra o duelo; perder a conexão não conta, você pode voltar.",
        ],
      },
      {
        kind: "table",
        headers: ["Nível", "Como a IA joga"],
        rows: [
          ["Fácil", "Joga sem pressa e comete erros. Bom para aprender."],
          ["Médio", "Joga com bom senso, mas ainda pode ser surpreendida."],
          ["Difícil", "Calcula as jogadas e aproveita cada brecha."],
        ],
      },
    ],
  },
  {
    id: "fim",
    title: "Fim de jogo e revanche",
    summary: "A partida termina quando alguém vence; depois é possível jogar de novo.",
    details: [
      {
        kind: "list",
        items: [
          "A partida termina quando a vida de um jogador chega a zero ou quando alguém não pode comprar.",
          "Sair da sala no meio da partida é desistência: o outro jogador vence. Perder a conexão não conta como desistência.",
          "Revanche: precisa dos dois jogadores; os lados são trocados, cada jogador escolhe o deck de novo e a vida volta a 8000.",
          "Se preferir, volte ao lobby.",
        ],
      },
    ],
  },
];

export type DeckComposition = { monsters: number; spells: number; traps: number };

export type DeckCatalogGroup = {
  id: DeckId;
  name: string;
  /** Imagem do deck (`public/decks/<id>.png`). */
  image: string;
  composition: DeckComposition;
  /** Todas as cartas do deck, na ordem de `DECKS`. */
  cards: readonly CardDetail[];
  /** Magia de efeito único (nenhuma outra carta do jogo tem o mesmo `kind`), destacada na página; `null` se não houver. */
  signatureSpell: CardDetail | null;
};

const effectKindCounts = (): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const card of CARDS) {
    if (card.type !== "SPELL") continue;
    counts.set(card.effect.kind, (counts.get(card.effect.kind) ?? 0) + 1);
  }
  return counts;
};

/** Catálogo agrupado por deck, gerado de `DECKS`; cartas fora de qualquer deck não aparecem. */
export const groupCardsByDeck = (): readonly DeckCatalogGroup[] => {
  const kindCounts = effectKindCounts();
  return DECKS.map((deck) => {
    const cards = deck.cardIds.map((id) => buildCardDetail(id)).filter((d): d is CardDetail => d !== null);
    const count = (kind: CardKind): number => cards.filter((card) => card.kind === kind).length;
    const signature = deck.cardIds.find((id) => {
      const card = getCard(id);
      return card?.type === "SPELL" && kindCounts.get(card.effect.kind) === 1;
    });
    return {
      id: deck.id,
      name: deck.name,
      image: `/decks/${deck.id}.png`,
      composition: { monsters: count("monster"), spells: count("spell"), traps: count("trap") },
      cards,
      signatureSpell: signature ? buildCardDetail(signature) : null,
    };
  });
};

/** Id do elemento HTML da seção (alvo da âncora). */
export const sectionElementId = (id: string): string => `tutorial-${id}`;

/** Âncora (`#...`) que leva à seção. */
export const sectionHref = (id: string): string => `#${sectionElementId(id)}`;

/** Id da seção a partir de um hash (`#tutorial-<id>`); `null` se não for âncora de seção. */
export const sectionIdFromHash = (hash: string): string | null =>
  GUIDE_SECTIONS.find((section) => hash === sectionHref(section.id))?.id ?? null;

/** Rolagem no fim da página (com tolerância de 2px); página que não rola também conta. */
export const isScrolledToBottom = (metrics: {
  scrollTop: number;
  viewportHeight: number;
  scrollHeight: number;
}): boolean => metrics.scrollTop + metrics.viewportHeight >= metrics.scrollHeight - 2;

/**
 * Seção ativa: a primeira, na ordem do tutorial, entre as que estão na faixa de leitura.
 * No fim da página, as últimas seções (curtas) não alcançam a faixa: vale a do hash (se houver) ou a última.
 * Sem nenhuma visível, mantém a atual (`null` se nunca houve).
 */
export const pickActiveSection = (
  sections: readonly TutorialSection[],
  visibleIds: ReadonlySet<string>,
  current: string | null,
  options: { atBottom?: boolean; hashId?: string | null } = {},
): string | null => {
  if (options.atBottom) {
    const hashed = sections.find((section) => section.id === options.hashId);
    return hashed?.id ?? sections[sections.length - 1]?.id ?? current;
  }
  return sections.find((section) => visibleIds.has(section.id))?.id ?? current;
};
