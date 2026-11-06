// src/client/screens/tutorialSections.ts
import { CARDS } from "../../engine/cards.js";
import { buildCardDetail, type CardDetail, type CardKind } from "./cardDetail.js";

/** Bloco de conteúdo de uma seção: lista, tabela ou o catálogo de cartas (gerado de `CARDS`). */
export type TutorialBlock =
  | { kind: "list"; items: readonly string[] }
  | { kind: "table"; headers: readonly string[]; rows: readonly (readonly string[])[] }
  | { kind: "cards" };

/** Seção do tutorial da tela inicial. */
export type TutorialSection = {
  id: string;
  title: string;
  /** Texto curto exibido sob o título. */
  summary: string;
  /** Conteúdo escaneável exibido após o resumo. */
  details: readonly TutorialBlock[];
};

export const TUTORIAL_SECTIONS: readonly TutorialSection[] = [
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
    summary: "Existem 20 cartas e cada jogador recebe 10 delas.",
    details: [
      {
        kind: "list",
        items: [
          "Ao iniciar, cada jogador recebe 10 cartas sorteadas, sem repetição e sem cartas em comum com o oponente.",
          "A mão inicial tem 5 cartas; as outras 5 ficam no deck.",
          "A mão e a ordem do deck do oponente não aparecem para você.",
        ],
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
          "Algumas magias pedem um alvo: um monstro seu (reforço de ataque, que vale até o fim do turno) ou um monstro do oponente (destruição).",
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
          "Revanche: precisa dos dois jogadores; os lados são trocados, as 10 cartas de cada um são sorteadas de novo e a vida volta a 8000.",
          "Se preferir, volte ao lobby.",
        ],
      },
    ],
  },
  {
    id: "cartas",
    title: "Cartas",
    summary: "Todas as cartas do jogo, com efeito e mecânica.",
    details: [{ kind: "cards" }],
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

/** O tutorial aparece na home geral e fica oculto no convite `/sala/CODIGO`. */
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
