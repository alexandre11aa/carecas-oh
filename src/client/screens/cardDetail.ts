// src/client/screens/cardDetail.ts
import { getCard } from "../../engine/cards.js";
import type { PlayerView } from "../../engine/playerView.js";
import type { Slot } from "../scene/layout.js";

export type CardKind = "monster" | "spell" | "trap";

/** Textos prontos de uma carta para exibição (rótulos em português). */
export type CardDetail = {
  id: string;
  kind: CardKind;
  name: string;
  typeLabel: string;
  /** "ATK 1600 / DEF 1200" para monstros; null nas demais. */
  stats: string | null;
  /** Efeito da carta (`description`). */
  effect: string;
  /** Mecânica da carta (`flavor`). */
  mechanic: string;
};

const TYPE_LABELS = { SPELL: "Magia", TRAP: "Armadilha" } as const;

/** Monta os textos da carta; devolve null para carta oculta (`null`) ou desconhecida. */
export const buildCardDetail = (cardId: string | null | undefined): CardDetail | null => {
  if (!cardId) return null;
  const card = getCard(cardId);
  if (!card) return null;
  const base = { id: card.id, name: card.name, effect: card.description, mechanic: card.flavor };
  if (card.type === "MONSTER") {
    return { ...base, kind: "monster", typeLabel: `Monstro · Nível ${card.level}`, stats: `ATK ${card.attack} / DEF ${card.defense}` };
  }
  return { ...base, kind: card.type === "SPELL" ? "spell" : "trap", typeLabel: TYPE_LABELS[card.type], stats: null };
};

/** Id da carta visível num slot da mesa; null para slot vazio, deck ou carta oculta do oponente. */
export const slotCardId = (view: PlayerView, slot: Slot): string | null => {
  const side = slot.side === "you" ? view.you : view.opponent;
  if (slot.kind === "monster") return side.monsters[slot.zone]?.cardId ?? null;
  if (slot.kind === "spellTrap") return side.spellTraps[slot.zone]?.cardId ?? null;
  if (slot.kind === "graveyard") return side.graveyard[side.graveyard.length - 1] ?? null;
  return null;
};
