// src/client/screens/tutorialScreen.ts
import { el } from "./dom.js";
import type { Screen } from "./dom.js";
import { trackImage } from "./pageLoading.js";
import { createFooter } from "./footer.js";
import { createHero } from "./hero.js";
import { createScrollButton } from "./scrollButtonView.js";
import { createCardView } from "./cardView.js";
import {
  GUIDE_SECTIONS,
  groupCardsByDeck,
  isScrolledToBottom,
  pickActiveSection,
  sectionElementId,
  sectionHref,
  sectionIdFromHash,
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

const createPage = (title: string, content: HTMLElement[], destroy?: () => void): Screen => {
  const element = el("div", "home tutorial-page");
  const scrollButton = createScrollButton();
  element.append(createHero(title), ...content, createFooter(), scrollButton.element);
  return {
    element,
    update: () => undefined,
    destroy: () => {
      scrollButton.destroy();
      destroy?.();
    },
  };
};

/** Página `/guia`: menu de âncoras e seções do guia; a seção ativa vem de um IntersectionObserver, da rolagem (fim da página) e do hash. */
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
  // Hash de âncora: vale enquanto a página fica no fim; ao subir, a leitura volta a mandar.
  let hashId: string | null = sectionIdFromHash(window.location.hash);
  const atBottom = () =>
    isScrolledToBottom({
      scrollTop: window.scrollY,
      viewportHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
    });
  const markActive = () => {
    active = pickActiveSection(GUIDE_SECTIONS, visible, active, { atBottom: atBottom(), hashId });
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

  const onScroll = () => {
    if (!atBottom()) hashId = null;
    markActive();
  };
  const onHashChange = () => {
    hashId = sectionIdFromHash(window.location.hash);
    markActive();
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("hashchange", onHashChange);
  // A página é montada depois da carga (SPA), então o navegador não rola até o hash sozinho.
  requestAnimationFrame(() => {
    if (hashId) document.getElementById(sectionElementId(hashId))?.scrollIntoView({ behavior: "instant" });
    markActive();
  });

  return createPage("Guia", [element], () => {
    observer?.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("hashchange", onHashChange);
  });
};

/** Página `/cartas`: catálogo agrupado por deck, gerado de `DECKS`; destaca a magia de efeito único de cada deck. */
export const createCardsPage = (): Screen => {
  const catalog = el("div", "tutorial tutorial-catalog");
  for (const group of groupCardsByDeck()) {
    const { monsters, spells, traps } = group.composition;
    const header = el("div", "deck-catalog-header");
    const image = el("img", "deck-catalog-image");
    image.alt = "";
    image.src = group.image;
    trackImage(image);
    // Sem a imagem, o nome do deck continua identificando o grupo.
    image.addEventListener("error", () => image.remove());
    const info = el("div", "deck-catalog-info");
    info.append(
      el("h3", "tutorial-group-title", `Deck ${group.name}`),
      el("p", "tutorial-summary", `${monsters} monstros · ${spells} magias · ${traps} armadilhas (20 cartas)`),
    );
    if (group.signatureSpell) {
      info.append(el("p", "deck-signature", `Magia exclusiva: ${group.signatureSpell.name} — ${group.signatureSpell.effect}`));
    }
    header.append(image, info);
    const grid = el("div", "tutorial-card-grid");
    for (const card of group.cards) {
      const view = createCardView(card);
      if (card.id === group.signatureSpell?.id) view.classList.add("signature");
      const slot = el("div", "tutorial-card-slot");
      slot.append(view, el("span", "card-copies", `×${card.copies}`));
      grid.append(slot);
    }
    const section = el("section", "deck-catalog");
    section.append(header, grid);
    catalog.append(section);
  }
  return createPage("Cartas", [catalog]);
};
