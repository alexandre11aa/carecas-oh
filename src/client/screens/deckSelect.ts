// src/client/screens/deckSelect.ts
import { DECKS, type DeckId } from "../../engine/index.js";

export type DeckOption = { id: DeckId; name: string; image: string; label: string };

/** Decks para exibir: id, nome e imagem (`public/decks/<id>.png`), na ordem de `DECKS`. */
export const deckOptions = (): DeckOption[] =>
  DECKS.map((deck) => ({ id: deck.id, name: deck.name, image: `/decks/${deck.id}.png`, label: `Deck ${deck.name}` }));

/** Valida um valor desconhecido (por exemplo, vindo do servidor) como `DeckId`. */
export const asDeckId = (value: unknown): DeckId | null =>
  DECKS.find((deck) => deck.id === value)?.id ?? null;

/** Nova seleção ao clicar num deck: só muda enquanto o jogador não está pronto. */
export const selectDeck = (current: DeckId | null, clicked: DeckId, ready: boolean): DeckId | null =>
  ready ? current : clicked;

/** O botão "Pronto" exige sala cheia, conexão online, deck escolhido e ainda não estar pronto. */
export const canMarkReady = (input: { full: boolean; online: boolean; deckId: DeckId | null; ready: boolean }): boolean =>
  input.full && input.online && input.deckId !== null && !input.ready;

/** Payload de `room:ready`; sem deck não há payload. */
export const readyPayload = (deckId: DeckId | null): { deckId: DeckId } | null =>
  deckId ? { deckId } : null;
