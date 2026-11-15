// src/client/screens/cardModalView.ts
import { el } from "./dom.js";
import { createCardView } from "./cardView.js";
import { buildCardDetail } from "./cardDetail.js";
import { CLOSED_MODAL, closeCardModal, isActivationKey, modalKeyAction, nextFocusIndex, openCardModal, type CardModalState } from "./cardModal.js";

export type CardModal = {
  /** Torna a carta do catálogo clicável (clique, Enter e Espaço) e abre o modal com ela. */
  bind: (trigger: HTMLElement, cardId: string) => void;
  destroy: () => void;
};

/** Modal que amplia a carta: `role="dialog"`, foco preso, Esc/fundo/botão fecham e o foco volta à carta de origem. */
export const createCardModal = (): CardModal => {
  let state: CardModalState = CLOSED_MODAL;
  let overlay: HTMLElement | null = null;
  let opener: HTMLElement | null = null;
  let previousOverflow = "";

  const focusables = (): HTMLElement[] => (overlay ? [...overlay.querySelectorAll<HTMLElement>("button")] : []);

  const close = () => {
    if (!state.open || !overlay) return;
    state = closeCardModal(state);
    const node = overlay;
    overlay = null;
    document.removeEventListener("keydown", onKeyDown, true);
    document.body.style.overflow = previousOverflow;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.classList.add("closing");
    if (reduce) node.remove();
    else {
      node.addEventListener("animationend", () => node.remove(), { once: true });
      setTimeout(() => node.remove(), 300);
    }
    opener?.focus();
    opener = null;
  };

  function onKeyDown(event: KeyboardEvent) {
    const action = modalKeyAction(state, event.key, event.shiftKey);
    if (!action) return;
    event.preventDefault();
    if (action === "close") {
      close();
      return;
    }
    const items = focusables();
    const index = nextFocusIndex(items.indexOf(document.activeElement as HTMLElement), items.length, action);
    items[index]?.focus();
  }

  const open = (trigger: HTMLElement, cardId: string) => {
    const detail = buildCardDetail(cardId);
    if (!detail || state.open) return;
    state = openCardModal(state, cardId);
    opener = trigger;
    const node = el("div", "card-modal");
    const dialog = el("div", "card-modal-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", detail.name);
    const closeButton = el("button", "card-modal-close", "Fechar");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Fechar carta ampliada");
    closeButton.addEventListener("click", close);
    dialog.append(createCardView(detail), closeButton);
    node.append(dialog);
    // Clique fora da carta (no fundo escurecido) fecha.
    node.addEventListener("click", (event) => {
      if (event.target === node) close();
    });
    overlay = node;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.append(node);
    document.addEventListener("keydown", onKeyDown, true);
    closeButton.focus();
  };

  return {
    bind: (trigger, cardId) => {
      trigger.tabIndex = 0;
      trigger.setAttribute("role", "button");
      trigger.classList.add("card-clickable");
      trigger.addEventListener("click", () => open(trigger, cardId));
      trigger.addEventListener("keydown", (event) => {
        if (!isActivationKey(event.key)) return;
        event.preventDefault();
        open(trigger, cardId);
      });
    },
    destroy: () => {
      overlay?.remove();
      overlay = null;
      if (state.open) document.body.style.overflow = previousOverflow;
      state = CLOSED_MODAL;
      document.removeEventListener("keydown", onKeyDown, true);
    },
  };
};
