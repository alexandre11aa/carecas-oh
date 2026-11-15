// src/client/screens/cardModal.ts
// Lógica pura do modal que amplia a carta em /cartas: estado aberto/fechado, teclas e foco preso.

export type CardModalState = { open: false } | { open: true; cardId: string };

export const CLOSED_MODAL: CardModalState = { open: false };

/** Abre o modal com a carta; abrir de novo com outra carta troca a carta. */
export const openCardModal = (_state: CardModalState, cardId: string): CardModalState => ({ open: true, cardId });

/** Fecha o modal; fechar um modal já fechado mantém o mesmo estado. */
export const closeCardModal = (state: CardModalState): CardModalState => (state.open ? CLOSED_MODAL : state);

/** Ação de uma tecla com o modal aberto: Esc fecha, Tab circula o foco; modal fechado ignora tudo. */
export const modalKeyAction = (state: CardModalState, key: string, shift = false): "close" | "focusNext" | "focusPrev" | null => {
  if (!state.open) return null;
  if (key === "Escape") return "close";
  if (key === "Tab") return shift ? "focusPrev" : "focusNext";
  return null;
};

/** Índice do próximo foco entre `count` elementos focáveis, circular; -1 se não houver nenhum. */
export const nextFocusIndex = (current: number, count: number, direction: "focusNext" | "focusPrev"): number => {
  if (count <= 0) return -1;
  if (direction === "focusNext") return current < 0 || current >= count - 1 ? 0 : current + 1;
  return current <= 0 || current >= count ? count - 1 : current - 1;
};

/** Teclas que ativam a carta do catálogo (operável pelo teclado). */
export const isActivationKey = (key: string): boolean => key === "Enter" || key === " ";
