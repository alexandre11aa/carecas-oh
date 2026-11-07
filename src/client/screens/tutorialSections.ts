// src/client/screens/tutorialSections.ts
import { CARDS } from "../../engine/cards.js";
import { DECKS } from "../../engine/decks.js";
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

export type CardGroup = { kind: CardKind; title: string; cards: readonly CardDetail[] };

const GROUP_TITLES: Record<CardKind, string> = { monster: "Monstros", spell: "Magias", trap: "Armadilhas" };

/** Catálogo agrupado por tipo (monstros, magias, armadilhas), gerado de `CARDS` na ordem em que aparecem. */
export const groupCardsByType = (): readonly CardGroup[] => {
  const details = CARDS.map((card) => buildCardDetail(card.id)).filter((d): d is CardDetail => d !== null);
  return (["monster", "spell", "trap"] as const)
    .map((kind) => ({ kind, title: GROUP_TITLES[kind], cards: details.filter((d) => d.kind === kind) }))
    .filter((group) => group.cards.length > 0);
};

/** Id do elemento HTML da seção (alvo da âncora). */
export const sectionElementId = (id: string): string => `tutorial-${id}`;

/** Âncora (`#...`) que leva à seção. */
export const sectionHref = (id: string): string => `#${sectionElementId(id)}`;

/** Os links para guia e cartas aparecem na home geral e ficam ocultos no convite `/sala/CODIGO`. */
export const isTutorialVisible = (presetCode: string | null): boolean => presetCode === null;

/**
 * Seção ativa: a primeira, na ordem do tutorial, entre as que estão na faixa de leitura.
 * Sem nenhuma visível, mantém a atual (`null` se nunca houve).
 */
export const pickActiveSection = (
  sections: readonly TutorialSection[],
  visibleIds: ReadonlySet<string>,
  current: string | null,
): string | null => sections.find((section) => visibleIds.has(section.id))?.id ?? current;
