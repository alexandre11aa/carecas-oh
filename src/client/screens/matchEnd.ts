// src/client/screens/matchEnd.ts
// Lógica pura da tela de fim: textos de resultado e estado do botão de revanche.
import type { DeckId } from "../../engine/decks.js";
import type { PlayerId } from "../../engine/types.js";
import type { MatchEnded } from "../state.js";

const REASONS: Record<MatchEnded["reason"], string> = {
  LIFE_ZERO: "Os pontos de vida do perdedor chegaram a zero.",
  DECK_OUT: "O perdedor ficou sem cartas para comprar.",
  OPPONENT_LEFT: "O oponente saiu da partida.",
};

/** Título e motivo do resultado. Sem `ended` (ainda não chegou `match:ended`), mostra só o título. */
export const endSummary = (viewer: PlayerId, winner: PlayerId, ended: MatchEnded | null): { title: string; reason: string } => ({
  title: winner === viewer ? "Você venceu!" : "Você perdeu.",
  reason: ended ? REASONS[ended.reason] : "",
});

/** Revanche: precisa do oponente na sala e de um deck escolhido para votar; o botão alterna entre votar e retirar o voto. */
export const rematchState = (
  ended: MatchEnded | null,
  opponentInRoom: boolean,
  deckId: DeckId | null,
): { label: string; accept: boolean; disabled: boolean; status: string; decksLocked: boolean } => {
  const voted = ended?.rematch.you === true;
  const status = !opponentInRoom
    ? "O oponente saiu: não há revanche."
    : ended?.rematch.opponent
      ? "O oponente quer jogar novamente."
      : voted
        ? "Aguardando o oponente..."
        : deckId === null
          ? "Escolha um deck para jogar novamente."
          : "";
  return {
    label: voted ? "Cancelar revanche" : "Jogar novamente",
    accept: !voted,
    disabled: !opponentInRoom || ended === null || (!voted && deckId === null),
    status,
    decksLocked: voted || !opponentInRoom,
  };
};

/** Payload de `match:rematch`: votar leva o deck; retirar o voto não leva nada. Sem deck, não há voto. */
export const rematchPayload = (accept: boolean, deckId: DeckId | null): { deckId: DeckId } | { accept: false } | null =>
  !accept ? { accept: false } : deckId ? { deckId } : null;

/** O botão "Desistir" só existe com a partida em andamento: sem vencedor e sem resultado. */
export const canSurrender = (winner: PlayerId | null, ended: MatchEnded | null): boolean => winner === null && ended === null;
