// src/client/screens/deckPicker.ts
// Componente DOM dos botões de imagem de deck, reutilizado na sala de espera e na revanche.
import type { DeckId } from "../../engine/decks.js";
import { deckOptions } from "./deckSelect.js";
import { el } from "./dom.js";

export type DeckPicker = {
  element: HTMLDivElement;
  /** Marca o deck escolhido e, com `locked`, desabilita os botões. */
  update: (selected: DeckId | null, locked: boolean) => void;
};

export const createDeckPicker = (ariaLabel: string, onPick: (id: DeckId) => void): DeckPicker => {
  const element = el("div", "deck-select");
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", ariaLabel);
  const buttons = new Map<DeckId, HTMLButtonElement>();
  for (const option of deckOptions()) {
    const button = el("button", "deck-option");
    button.type = "button";
    button.setAttribute("aria-label", option.label);
    const image = el("img", "deck-image");
    image.alt = "";
    image.src = option.image;
    // Sem a imagem, o nome em texto continua identificando o deck.
    image.addEventListener("error", () => image.remove());
    button.append(image, el("span", "deck-name", option.name));
    button.addEventListener("click", () => onPick(option.id));
    buttons.set(option.id, button);
    element.append(button);
  }
  const update = (selected: DeckId | null, locked: boolean) => {
    for (const [id, button] of buttons) {
      const active = id === selected;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("selected", active);
      button.disabled = locked;
    }
  };
  return { element, update };
};
