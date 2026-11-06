// src/client/screens/matchEnd.ts
// Lógica pura da tela de fim: textos de resultado e estado do botão de revanche.
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

/** Revanche: precisa do oponente na sala; o botão alterna entre votar e retirar o voto. */
export const rematchState = (
  ended: MatchEnded | null,
  opponentInRoom: boolean,
): { label: string; accept: boolean; disabled: boolean; status: string } => {
  const voted = ended?.rematch.you === true;
  const status = !opponentInRoom
    ? "O oponente saiu: não há revanche."
    : ended?.rematch.opponent
      ? "O oponente quer jogar novamente."
      : voted
        ? "Aguardando o oponente..."
        : "";
  return {
    label: voted ? "Cancelar revanche" : "Jogar novamente",
    accept: !voted,
    disabled: !opponentInRoom || ended === null,
    status,
  };
};

/** O botão "Desistir" só existe com a partida em andamento: sem vencedor e sem resultado. */
export const canSurrender = (winner: PlayerId | null, ended: MatchEnded | null): boolean => winner === null && ended === null;
