// src/client/scene/layout.ts
// Lógica pura (sem WebGL): converte o PlayerView em posições de cartas sobre a mesa.
import type { PlayerView } from "../../engine/playerView.js";
import { DECK_SIZE } from "../../engine/decks.js";
import { zoneOuterSize } from "./tableDesign.js";

export const CARD_HEIGHT = 2;
/** Proporção das artes: 1030:1500. */
export const CARD_WIDTH = (CARD_HEIGHT * 1030) / 1500;
/** Espaçamento entre zonas: comporta a carta em defesa girada (largura = CARD_HEIGHT = 2,0) com folga de 0,1. */
export const ZONE_SPACING = 2.1;
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
  /** Camadas da pilha (só deck e cemitério): cresce com a quantidade real, limitado a `PILE_MAX_LAYERS`. */
  layers?: number;
  /** Altura (y) do topo da pilha (só deck e cemitério). */
  y?: number;
};

/** Teto de camadas visíveis de uma pilha: o tamanho do deck. */
export const PILE_MAX_LAYERS = DECK_SIZE;
/** Altura da carta isolada sobre a mesa (mesma de uma pilha de 1 camada). */
export const CARD_BASE_Y = 0.02;
/** Espessura de cada camada da pilha. */
export const PILE_LAYER_THICKNESS = 0.06;

/** Camadas de uma pilha: 0 se vazia, 1 a 1 com a quantidade, limitada a `PILE_MAX_LAYERS`. */
export const pileLayers = (count: number): number => {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(Math.floor(count), PILE_MAX_LAYERS);
};

/** Altura total da pilha acima da mesa (sem contar a folga de `CARD_BASE_Y`). */
export const pileHeight = (layers: number): number => Math.max(0, layers) * PILE_LAYER_THICKNESS;

/** y do topo da pilha: a 1ª camada fica em `CARD_BASE_Y` e cada camada extra sobe a espessura. */
export const pileTopY = (layers: number): number => CARD_BASE_Y + Math.max(0, layers - 1) * PILE_LAYER_THICKNESS;

/** Espessura da placa do corpo: um pouco menor que a camada, para o vão marcar as bordas das cartas. */
export const PILE_BODY_THICKNESS = PILE_LAYER_THICKNESS * 0.9;

/**
 * Alturas (y do centro) das placas do corpo de uma pilha: uma por camada abaixo do topo, pois a carta do topo
 * é a própria malha da carta. Com `layers` camadas há `layers - 1` placas; 0 ou 1 camada não tem corpo.
 * A face de cima de cada placa fica logo abaixo do plano da camada seguinte.
 */
export const pileBodyYs = (layers: number): number[] => {
  const count = Math.max(0, Math.floor(Number.isFinite(layers) ? layers : 0)) - 1;
  const ys: number[] = [];
  for (let i = 0; i < count; i++) ys.push(CARD_BASE_Y + (i + 1) * PILE_LAYER_THICKNESS - PILE_BODY_THICKNESS / 2 - 0.001);
  return ys;
};

/** Z de cada fileira (lado "you"); a altura externa da zona deve caber na distância entre fileiras. */
export const ROW_Z: Record<SlotKind, number> = { monster: 1.4, spellTrap: 3.6, graveyard: 1.4, deck: 3.6 };
/** Centro das pilhas: borda interna (6,1 - 0,765) fica além da carta de defesa da zona da ponta (4,2 + 1,0). */
export const PILE_X = 6.1;

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
  const deckLayers = pileLayers(deckCount);
  if (deckLayers > 0) {
    placements.push({
      key: slotKey(side, "deck", 0),
      cardId: null,
      faceDown: true,
      yaw: baseYaw,
      layers: deckLayers,
      y: pileTopY(deckLayers),
      ...slotPosition(side, "deck"),
    });
  }
  const top = graveyard[graveyard.length - 1];
  if (top !== undefined) {
    const graveLayers = pileLayers(graveyard.length);
    placements.push({
      key: slotKey(side, "graveyard", 0),
      cardId: top,
      faceDown: false,
      yaw: baseYaw,
      layers: graveLayers,
      y: pileTopY(graveLayers),
      ...slotPosition(side, "graveyard"),
    });
  }
  return placements;
};

/** Cartas visíveis na mesa para o estado recebido (a mão fica no HTML). */
export const layoutBoard = (view: PlayerView): CardPlacement[] => [
  ...sidePlacements("you", view.you.monsters, view.you.spellTraps, view.you.deckCount, view.you.graveyard),
  ...sidePlacements("opponent", view.opponent.monsters, view.opponent.spellTraps, view.opponent.deckCount, view.opponent.graveyard),
];

/** Slot sob um ponto do plano da mesa (coordenadas x/z do mundo), ou null se o ponto cair fora de qualquer slot.
 * A área de clique é a área externa da zona desenhada (`zoneOuterSize`), com o mesmo centro do desenho. */
export const pickSlot = (x: number, z: number): Slot | null => {
  const outer = zoneOuterSize();
  const halfWidth = outer.width / 2;
  const halfHeight = outer.height / 2;
  return allSlots().find((slot) => Math.abs(x - slot.x) <= halfWidth && Math.abs(z - slot.z) <= halfHeight) ?? null;
};
