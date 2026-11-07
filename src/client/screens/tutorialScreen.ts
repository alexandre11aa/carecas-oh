// src/client/screens/tutorialScreen.ts
import { el, linkTo } from "./dom.js";
import type { Screen } from "./dom.js";
import { createFooter } from "./footer.js";
import { createCardView } from "./cardView.js";
import {
  GUIDE_SECTIONS,
  groupCardsByType,
  pickActiveSection,
  sectionElementId,
  sectionHref,
  type TutorialBlock,
} from "./tutorialSections.js";

const renderBlock = (block: TutorialBlock): HTMLElement => {
  if (block.kind === "list") {
    const list = el("ul", "tutorial-list");
    for (const item of block.items) list.append(el("li", undefined, item));
    return list;
  }
  const table = el("table", "tutorial-table");
  const headRow = el("tr");
  for (const header of block.headers) headRow.append(el("th", undefined, header));
  const head = el("thead");
  head.append(headRow);
  const body = el("tbody");
  for (const row of block.rows) {
    const tr = el("tr");
    for (const cell of row) tr.append(el("td", undefined, cell));
    body.append(tr);
  }
  table.append(head, body);
  return table;
};

/** Links da home para as páginas do guia e das cartas. */
export const createTutorialLinks = (): HTMLElement => {
  const links = el("nav", "tutorial-links");
  links.setAttribute("aria-label", "Menu");
  links.append(linkTo("/guia", "Guia do jogo", "tutorial-cta"), linkTo("/cartas", "Cartas", "tutorial-cta"));
  return links;
};

const createPage = (title: string, content: HTMLElement[], destroy?: () => void): Screen => {
  const element = el("div", "home tutorial-page");
  const back = linkTo("/", "← Voltar ao menu", "tutorial-back");
  element.append(back, el("h1", undefined, title), ...content, createFooter());
  return { element, update: () => undefined, destroy };
};

/** Página `/guia`: menu de âncoras e seções do guia; a seção ativa vem de um IntersectionObserver. */
export const createGuidePage = (): Screen => {
  const element = el("div", "tutorial");
  const nav = el("nav", "tutorial-nav");
  nav.setAttribute("aria-label", "Seções do guia");
  const links = new Map<string, HTMLAnchorElement>();
  const sectionElements: HTMLElement[] = [];

  for (const section of GUIDE_SECTIONS) {
    const link = el("a", undefined, section.title);
    link.href = sectionHref(section.id);
    links.set(section.id, link);
    nav.append(link);

    const node = el("section", "tutorial-section");
    node.id = sectionElementId(section.id);
    node.dataset.sectionId = section.id;
    node.append(el("h2", undefined, section.title), el("p", "tutorial-summary", section.summary));
    for (const block of section.details) node.append(renderBlock(block));
    sectionElements.push(node);
  }
  element.append(nav, ...sectionElements);

  let active: string | null = null;
  const visible = new Set<string>();
  const markActive = () => {
    active = pickActiveSection(GUIDE_SECTIONS, visible, active);
    for (const [id, link] of links) {
      if (id === active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  };

  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== "undefined") {
    // Faixa de leitura logo abaixo da barra fixa, para que a seção levada ao topo por uma âncora fique ativa.
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.sectionId;
          if (!id) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        markActive();
      },
      { rootMargin: "-20% 0px -75% 0px" },
    );
    for (const node of sectionElements) observer.observe(node);
  }

  return createPage("Guia", [element], () => observer?.disconnect());
};

/** Página `/cartas`: catálogo de todas as cartas, gerado de `CARDS`. */
export const createCardsPage = (): Screen => {
  const catalog = el("div", "tutorial tutorial-catalog");
  for (const group of groupCardsByType()) {
    const grid = el("div", "tutorial-card-grid");
    for (const card of group.cards) grid.append(createCardView(card));
    catalog.append(el("h3", "tutorial-group-title", group.title), grid);
  }
  return createPage("Cartas", [catalog]);
};
