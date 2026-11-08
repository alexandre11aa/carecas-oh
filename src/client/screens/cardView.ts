// src/client/screens/cardView.ts
import { el } from "./dom.js";
import { applyCardArt } from "./cardArtImage.js";
import type { CardDetail } from "./cardDetail.js";

/** Componente HTML de carta (nome, tipo, ATK/DEF, efeito, mecânica). Reutilizável na partida e no tutorial. */
export const createCardView = (detail: CardDetail): HTMLElement => {
  const card = el("article", `card-view ${detail.kind}`);
  const labeled = (label: string, text: string) => {
    const block = el("p", "card-view-text");
    block.append(el("b", undefined, `${label}: `), document.createTextNode(text));
    return block;
  };
  card.append(el("h3", "card-view-name", detail.name), el("p", "card-view-type", detail.typeLabel));
  if (detail.stats) card.append(el("p", "card-view-stats", detail.stats));
  card.append(labeled("Efeito", detail.effect), labeled("Mecânica", detail.mechanic));
  // Com WebP/PNG, a arte traz nome, tipo, efeito e texto: o texto HTML fica só para leitores de tela (`has-art`).
  applyCardArt(card, detail.id, `${detail.name}. ${detail.typeLabel}${detail.stats ? `. ${detail.stats}` : ""}`, { showLoading: true });
  return card;
};
