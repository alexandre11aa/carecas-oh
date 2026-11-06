// src/client/screens/tutorialSections.ts

/** Seção do tutorial da tela inicial. O conteúdo detalhado entra preenchendo `summary`/`details`. */
export type TutorialSection = {
  id: string;
  title: string;
  /** Texto curto exibido sob o título. */
  summary: string;
};

export const TUTORIAL_SECTIONS: readonly TutorialSection[] = [
  { id: "objetivo", title: "Objetivo", summary: "Zere os pontos de vida do oponente ou deixe-o sem cartas para comprar." },
  { id: "turno", title: "Fases do turno", summary: "Compra, Principal 1, Batalha, Principal 2 e Fim." },
  { id: "monstros", title: "Monstros e tributo", summary: "Invoque monstros; os mais fortes exigem tributos." },
  { id: "combate", title: "Combate", summary: "Ataque com monstros em posição de ataque e compare ATK e DEF." },
  { id: "magias-armadilhas", title: "Magias e armadilhas", summary: "Magias têm efeito imediato; armadilhas respondem no turno do oponente." },
  { id: "cartas", title: "Catálogo de cartas", summary: "Conheça as cartas do jogo." },
];

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
