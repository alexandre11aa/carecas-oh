// src/client/screens/handReconcile.ts
// Lógica pura: decide quais botões da mão podem ser reaproveitados entre atualizações.

/**
 * Para cada posição da nova mão, devolve `true` se o botão atual da mesma posição já mostra a mesma carta
 * (e pode ser mantido, preservando a arte PNG já carregada e o foco do teclado) ou `false` se precisa ser criado.
 */
export const reusableHandSlots = (current: readonly string[], next: readonly string[]): boolean[] =>
  next.map((cardId, index) => current[index] === cardId);
