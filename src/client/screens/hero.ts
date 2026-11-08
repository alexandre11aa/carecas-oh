// src/client/screens/hero.ts
import { CARD_BACK_PATH } from "../scene/texturePaths.js";
import { el } from "./dom.js";
import { trackImage } from "./pageLoading.js";

const DECO_FRONT_PATH = "/cards/esquiva_da_gloria_divina.webp";

/** Carta decorativa inclinada. O fundo em CSS é o fallback: a imagem segura o loading até carregar e some se falhar. */
const createDecoCard = (className: string, src: string): HTMLElement => {
  const card = el("div", `deco-card ${className}`);
  card.setAttribute("aria-hidden", "true");
  const image = el("img");
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.decoding = "async";
  image.draggable = false;
  image.addEventListener("error", () => image.remove());
  image.src = src;
  trackImage(image);
  card.append(image);
  return card;
};

/** Cabeçalho temático: título dourado entre duas cartas decorativas, usado na home e nas páginas Guia e Cartas. */
export const createHero = (title: string, subtitle?: string): HTMLElement => {
  const hero = el("header", "hero");
  hero.append(
    createDecoCard("deco-left", CARD_BACK_PATH),
    createDecoCard("deco-right", DECO_FRONT_PATH),
    el("h1", "game-title", title),
    ...(subtitle ? [el("p", "hero-subtitle", subtitle)] : []),
  );
  return hero;
};
