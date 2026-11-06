// src/client/screens/matchNotices.ts
// Lógica pura: EventView (já filtrado por eventView) -> avisos de interface, em ordem. Só usa o que o evento entrega.
import { getCard } from "../../engine/cards.js";
import type { EventView } from "../../engine/eventView.js";
import type { PlayerId } from "../../engine/types.js";

export const MAX_LIFE = 8000;

export type NoticeKind = "CARD" | "SUMMON" | "GRAVEYARD" | "DAMAGE" | "HEAL" | "END";
export type NoticeSide = "you" | "opponent";

export type Notice = {
  kind: NoticeKind;
  side: NoticeSide;
  text: string;
  /** Carta pública do evento; null quando oculta (ou sem carta). */
  cardId: string | null;
  /** Valor de dano/cura (sempre positivo). */
  amount?: number;
  /** Só em `END`: o espectador venceu. */
  victory?: boolean;
};

const cardName = (cardId: string): string => getCard(cardId)?.name ?? cardId;
const who = (side: NoticeSide): string => (side === "you" ? "Você" : "Oponente");

/** Converte os eventos recebidos em avisos, mantendo a ordem. Eventos sem feedback visual são ignorados. */
export const buildNotices = (events: readonly EventView[], viewer: PlayerId): Notice[] => {
  const notices: Notice[] = [];
  for (const event of events) {
    if (event.type === "MATCH_ENDED") {
      const victory = event.winner === viewer;
      notices.push({ kind: "END", side: victory ? "you" : "opponent", text: victory ? "Vitória!" : "Derrota", cardId: null, victory });
      continue;
    }
    if (!("player" in event)) continue;
    const side: NoticeSide = event.player === viewer ? "you" : "opponent";
    switch (event.type) {
      case "SPELL_ACTIVATED":
        notices.push({ kind: "CARD", side, text: `${who(side)} ativou a magia ${cardName(event.cardId)}`, cardId: event.cardId });
        break;
      case "TRAP_ACTIVATED":
        notices.push({ kind: "CARD", side, text: `${who(side)} ativou a armadilha ${cardName(event.cardId)}`, cardId: event.cardId });
        break;
      case "SPELL_TRAP_SET":
        notices.push({
          kind: "CARD",
          side,
          text: event.cardId ? `${who(side)} baixou ${cardName(event.cardId)}` : `${who(side)} baixou uma carta virada`,
          cardId: event.cardId,
        });
        break;
      case "MONSTER_SUMMONED": {
        const position = event.position === "ATTACK" ? "em ataque" : "em defesa";
        notices.push({
          kind: "SUMMON",
          side,
          text: event.faceDown || !event.cardId ? `${who(side)}: Monstro baixado` : `${who(side)} invocou ${cardName(event.cardId)} ${position}`,
          cardId: event.faceDown ? null : event.cardId,
        });
        break;
      }
      case "CARD_SENT_TO_GRAVEYARD":
        notices.push({ kind: "GRAVEYARD", side, text: `${cardName(event.cardId)} foi ao cemitério (${who(side)})`, cardId: event.cardId });
        break;
      case "DAMAGE_DEALT":
        notices.push({ kind: "DAMAGE", side, text: `${who(side)} sofreu ${event.amount} de dano`, cardId: null, amount: event.amount });
        break;
      case "LIFE_RESTORED":
        notices.push({ kind: "HEAL", side, text: `${who(side)} recuperou ${event.amount} de vida`, cardId: null, amount: event.amount });
        break;
      default:
        break;
    }
  }
  return notices;
};

/** Texto da variação flutuante: "-800" / "+1000". */
export const deltaText = (notice: Pick<Notice, "kind" | "amount">): string =>
  `${notice.kind === "DAMAGE" ? "-" : "+"}${notice.amount ?? 0}`;

/** Largura da barra de vida em porcentagem (0 a 100). */
export const lifePercent = (lifePoints: number): number =>
  Math.round(Math.min(1, Math.max(0, lifePoints / MAX_LIFE)) * 100);

/** Lados que sofrem variação de vida no lote (a vida exibida só anima quando o aviso aparece). */
export const lifeSides = (notices: readonly Notice[]): Set<NoticeSide> =>
  new Set(notices.filter((n) => n.kind === "DAMAGE" || n.kind === "HEAL").map((n) => n.side));
