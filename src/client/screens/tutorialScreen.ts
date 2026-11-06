// src/client/screens/tutorialScreen.ts
import { el } from "./dom.js";
import { createCardView } from "./cardView.js";
import {
  TUTORIAL_SECTIONS,
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
  if (block.kind === "table") {
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
  }
  const catalog = el("div", "tutorial-catalog");
  for (const group of groupCardsByType()) {
    const grid = el("div", "tutorial-card-grid");
    for (const card of group.cards) grid.append(createCardView(card));
    catalog.append(el("h3", "tutorial-group-title", group.title), grid);
  }
  return catalog;
};

export type Tutorial = {
  /** Botão/link "role para ver o tutorial", colocado no lobby. */
  cta: HTMLAnchorElement;
  /** Menu de âncoras e seções empilhadas. */
  element: HTMLElement;
  destroy: () => void;
};

/** Monta o tutorial em página infinita; a seção ativa vem de um IntersectionObserver. */
export const createTutorial = (): Tutorial => {
  const cta = el("a", "tutorial-cta", "Role para ver o tutorial ↓");
  cta.href = sectionHref(TUTORIAL_SECTIONS[0].id);

  const element = el("div", "tutorial");
  const nav = el("nav", "tutorial-nav");
  nav.setAttribute("aria-label", "Seções do tutorial");
  const links = new Map<string, HTMLAnchorElement>();
  const sectionElements: HTMLElement[] = [];

  for (const section of TUTORIAL_SECTIONS) {
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
    active = pickActiveSection(TUTORIAL_SECTIONS, visible, active);
    for (const [id, link] of links) {
      if (id === active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  };

  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== "undefined") {
    // Faixa de leitura no meio superior da tela.
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
      { rootMargin: "-40% 0px -55% 0px" },
    );
    for (const node of sectionElements) observer.observe(node);
  }

  return { cta, element, destroy: () => observer?.disconnect() };
};
