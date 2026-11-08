// src/engine/rules/hand.ts
// Remoção de cartas de uma lista tratando cópias repetidas como cartas distintas. Funções puras.

/** Devolve a lista sem UMA ocorrência de `cardId` (a primeira); as demais cópias permanecem. */
export const removeOne = (cards: readonly string[], cardId: string): string[] => {
  const index = cards.indexOf(cardId);
  return index === -1 ? [...cards] : [...cards.slice(0, index), ...cards.slice(index + 1)];
};
