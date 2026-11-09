// src/client/screens/matchEnd.ts
// Lógica pura da tela de fim: textos de resultado e estado do botão de revanche.
import type { DeckId } from "../../engine/decks.js";
import type { SoundName } from "../animations/matchFeedback.js";
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

/** Tipo do aviso de revanche: `none` não ocupa espaço; `warning` é alerta (oponente saiu ou falta deck); `info` é informativo. */
export type RematchNoticeKind = "none" | "info" | "warning";

/**
 * Revanche: precisa do oponente na sala e de um deck escolhido para votar; o botão alterna entre votar e retirar o voto.
 * Contra a IA (`vsAi`) o oponente está sempre presente e não há voto: "Jogar novamente" só exige o deck e reinicia direto.
 */
export const rematchState = (
  ended: MatchEnded | null,
  opponentInRoom: boolean,
  deckId: DeckId | null,
  vsAi = false,
): { label: string; accept: boolean; disabled: boolean; status: string; statusKind: RematchNoticeKind; decksLocked: boolean } => {
  if (vsAi) {
    const missing = deckId === null;
    return {
      label: "Jogar novamente",
      accept: true,
      disabled: ended === null || missing,
      status: missing ? "Escolha um deck para jogar novamente." : "",
      statusKind: missing ? "warning" : "none",
      decksLocked: false,
    };
  }
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
  const missingDeck = opponentInRoom && !ended?.rematch.opponent && !voted && deckId === null;
  const statusKind: RematchNoticeKind = status === "" ? "none" : !opponentInRoom || missingDeck ? "warning" : "info";
  return {
    label: voted ? "Cancelar revanche" : "Jogar novamente",
    accept: !voted,
    disabled: !opponentInRoom || ended === null || (!voted && deckId === null),
    status,
    statusKind,
    decksLocked: voted || !opponentInRoom,
  };
};

/** Payload de `match:rematch`: votar leva o deck; retirar o voto não leva nada. Sem deck, não há voto. */
export const rematchPayload = (accept: boolean, deckId: DeckId | null): { deckId: DeckId } | { accept: false } | null =>
  !accept ? { accept: false } : deckId ? { deckId } : null;

/** O botão "Desistir" só existe com a partida em andamento: sem vencedor e sem resultado. */
export const canSurrender = (winner: PlayerId | null, ended: MatchEnded | null): boolean => winner === null && ended === null;

/** Som do fim da partida: vitória para o vencedor (inclusive por desistência do oponente ou fim por tempo) e derrota para o perdedor. */
export const endSoundFor = (viewer: PlayerId, winner: PlayerId): Extract<SoundName, "victory" | "defeat"> =>
  winner === viewer ? "victory" : "defeat";

/**
 * Toca o som do fim uma vez por partida. `armed` fica verdadeiro ao ver a partida em andamento; uma tela aberta
 * já com a partida encerrada (reconexão, recarga) nasce desarmada e não toca. A revanche (sem vencedor) rearma.
 */
export const nextEndSound = (armed: boolean, viewer: PlayerId, winner: PlayerId | null): { sound: SoundName | null; armed: boolean } => {
  if (winner === null) return { sound: null, armed: true };
  return armed ? { sound: endSoundFor(viewer, winner), armed: false } : { sound: null, armed: false };
};
