// src/client/scene/layout.ts
// Lógica pura (sem WebGL): converte o PlayerView em posições de cartas sobre a mesa.
import type { PlayerView } from "../../engine/playerView.js";

export const CARD_WIDTH = 1.4;
export const CARD_HEIGHT = 2;
export const ZONE_SPACING = 1.8;
export const ZONE_COUNT = 5;

/** Lado da mesa: "you" fica perto da câmera, "opponent" do lado oposto. */
export type Side = "you" | "opponent";
export type SlotKind = "monster" | "spellTrap" | "deck" | "graveyard";

export type Slot = { key: string; side: Side; kind: SlotKind; zone: number; x: number; z: number };

export type CardPlacement = {
  key: string;
  /** Identidade da carta; null quando é desconhecida (monstro virado do oponente, deck). */
  cardId: string | null;
  faceDown: boolean;
  x: number;
  z: number;
  /** Rotação em torno do eixo vertical, em radianos. */
  yaw: number;
};

const ROW_Z: Record<SlotKind, number> = { monster: 1.4, spellTrap: 3.6, graveyard: 1.4, deck: 3.6 };
const PILE_X = 5.6;

/** Posição de um slot; o lado do oponente é a mesa girada 180 graus. */
export const slotPosition = (side: Side, kind: SlotKind, zone = 0): { x: number; z: number } => {
  const sign = side === "you" ? 1 : -1;
  const base = kind === "deck" || kind === "graveyard" ? PILE_X : (zone - (ZONE_COUNT - 1) / 2) * ZONE_SPACING;
  return { x: base * sign, z: ROW_Z[kind] * sign };
};

export const slotKey = (side: Side, kind: SlotKind, zone: number): string => `${side}:${kind}:${zone}`;

/** Todos os slots da mesa (zonas de monstro e magia/armadilha, deck e cemitério dos dois lados). */
export const allSlots = (): Slot[] => {
  const slots: Slot[] = [];
  for (const side of ["you", "opponent"] as const) {
    for (let zone = 0; zone < ZONE_COUNT; zone++) {
      for (const kind of ["monster", "spellTrap"] as const) {
        slots.push({ key: slotKey(side, kind, zone), side, kind, zone, ...slotPosition(side, kind, zone) });
      }
    }
    for (const kind of ["deck", "graveyard"] as const) {
      slots.push({ key: slotKey(side, kind, 0), side, kind, zone: 0, ...slotPosition(side, kind) });
    }
  }
  return slots;
};

type FieldCard = { cardId: string | null; faceDown?: boolean; position?: "ATTACK" | "DEFENSE" };

const sidePlacements = (
  side: Side,
  monsters: readonly (FieldCard | null)[],
  spellTraps: readonly (FieldCard | null)[],
  deckCount: number,
  graveyard: readonly string[],
): CardPlacement[] => {
  const baseYaw = side === "you" ? 0 : Math.PI;
  const placements: CardPlacement[] = [];
  monsters.forEach((card, zone) => {
    if (!card) return;
    const yaw = baseYaw + (card.position === "DEFENSE" ? Math.PI / 2 : 0);
    placements.push({
      key: slotKey(side, "monster", zone),
      cardId: card.cardId,
      faceDown: card.faceDown === true || card.cardId === null,
      yaw,
      ...slotPosition(side, "monster", zone),
    });
  });
  spellTraps.forEach((card, zone) => {
    if (!card) return;
    placements.push({
      key: slotKey(side, "spellTrap", zone),
      cardId: card.cardId,
      faceDown: card.faceDown === true || card.cardId === null,
      yaw: baseYaw,
      ...slotPosition(side, "spellTrap", zone),
    });
  });
  if (deckCount > 0) {
    placements.push({ key: slotKey(side, "deck", 0), cardId: null, faceDown: true, yaw: baseYaw, ...slotPosition(side, "deck") });
  }
  const top = graveyard[graveyard.length - 1];
  if (top !== undefined) {
    placements.push({ key: slotKey(side, "graveyard", 0), cardId: top, faceDown: false, yaw: baseYaw, ...slotPosition(side, "graveyard") });
  }
  return placements;
};

/** Cartas visíveis na mesa para o estado recebido (a mão fica no HTML). */
export const layoutBoard = (view: PlayerView): CardPlacement[] => [
  ...sidePlacements("you", view.you.monsters, view.you.spellTraps, view.you.deckCount, view.you.graveyard),
  ...sidePlacements("opponent", view.opponent.monsters, view.opponent.spellTraps, view.opponent.deckCount, view.opponent.graveyard),
];

/** Slot sob um ponto do plano da mesa (coordenadas x/z do mundo), ou null se o ponto cair fora de qualquer slot. */
export const pickSlot = (x: number, z: number): Slot | null => {
  const halfWidth = ZONE_SPACING / 2;
  const halfHeight = CARD_HEIGHT / 2;
  return allSlots().find((slot) => Math.abs(x - slot.x) <= halfWidth && Math.abs(z - slot.z) <= halfHeight) ?? null;
};
