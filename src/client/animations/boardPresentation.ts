// src/client/animations/boardPresentation.ts
// Projeção visual pura: retém a mesa anterior e aplica saídas/chegadas sem alterar a visão recebida.
import type { EventView } from "../../engine/eventView.js";
import type { PlayerView } from "../../engine/playerView.js";
import { getCard } from "../../engine/cards.js";
import { layoutBoard, pileLayers, pileTopY, slotKey, slotPosition, type CardPlacement, type Side } from "../scene/layout.js";
import { buildFeedback, type BoardEffect, type FeedbackStep } from "./matchFeedback.js";

export type PresentationStep = {
  feedback: FeedbackStep;
  departures: string[];
  arrivals: CardPlacement[];
  start?: CardPlacement[];
  finish?: CardPlacement[];
};

const pileTop = (count: number): { layers: number; y: number } => {
  const layers = pileLayers(count);
  return { layers, y: pileTopY(layers) };
};

/** Um lote sempre termina nas colocações exatas da visão recebida, sem simular regras. */
export const buildPresentationSteps = (before: PlayerView | null, after: PlayerView, events: readonly EventView[]): PresentationStep[] => {
  const finish = layoutBoard(after);
  const empty = (): PresentationStep => ({ feedback: { sound: null, effects: [], notice: null }, departures: [], arrivals: [], start: finish, finish });
  if (!before || before.viewer !== after.viewer) return [empty()];
  const start = layoutBoard(before);
  const removed = start.filter((placement) => {
    const [side, kind, rawZone] = placement.key.split(":") as [Side, string, string];
    const field = kind === "monster" ? "monsters" : kind === "spellTrap" ? "spellTraps" : null;
    if (!field) return false;
    const zone = Number(rawZone);
    const old = before[side][field][zone];
    const next = after[side][field][zone];
    if (!old) return false;
    if (!next || old.cardId !== next.cardId) return true;
    return "summonedOnTurn" in old && "summonedOnTurn" in next ? old.summonedOnTurn !== next.summonedOnTurn
      : "setOnTurn" in old && "setOnTurn" in next && old.setOnTurn !== next.setOnTurn;
  });
  const used = new Set<string>();
  const feedbacks = buildFeedback(before, after, events);
  const steps: PresentationStep[] = [];
  // Contagens públicas correndo ao longo do lote: cada chegada/compra move 1 camada.
  const graveCount = { you: before.you.graveyard.length, opponent: before.opponent.graveyard.length };
  const deckCount = { you: before.you.deckCount, opponent: before.opponent.deckCount };
  for (let index = 0; index < feedbacks.length; index++) {
    let feedback = feedbacks[index]!;
    const departures: string[] = [];
    const arrivals: CardPlacement[] = [];
    const effects: BoardEffect[] = [];
    for (const effect of feedback.effects) {
      if (effect.kind !== "graveyard") { effects.push(effect); continue; }
      const side = feedback.notice!.side;
      const type = getCard(effect.cardId)?.type;
      const candidates = removed.filter((placement) => !used.has(placement.key) && placement.key.startsWith(`${side}:`)
        && (placement.cardId === effect.cardId || (placement.cardId === null && placement.key.includes(type === "MONSTER" ? ":monster:" : ":spellTrap:"))));
      const grouped = candidates.length > 1 && candidates.every((placement) => placement.cardId === effect.cardId)
        && feedbacks.slice(index, index + candidates.length).length === candidates.length
        && feedbacks.slice(index, index + candidates.length).every((next) => next.notice?.kind === "GRAVEYARD" && next.notice.side === side && next.notice.cardId === effect.cardId);
      // Cópias públicas iguais saem juntas, sem parear uma delas arbitrariamente
      // com um evento. Origens ocultas ambíguas usam o efeito neutro.
      for (const candidate of candidates) { departures.push(candidate.key); used.add(candidate.key); }
      const origin = candidates.length === 1 ? candidates[0] : null;
      const copies = grouped ? candidates.length : 1;
      const baseCount = graveCount[side];
      graveCount[side] += copies;
      arrivals.push({ key: slotKey(side, "graveyard", 0), cardId: effect.cardId, faceDown: false, yaw: side === "you" ? 0 : Math.PI, ...pileTop(graveCount[side]), ...slotPosition(side, "graveyard") });
      if (grouped) {
        effects.push(...candidates.map((placement, copy) => ({ ...effect, from: { x: placement.x, z: placement.z }, yaw: placement.yaw, toY: pileTop(baseCount + copy + 1).y })));
        feedback = { ...feedback, notice: { ...feedback.notice!, text: `${candidates.length} cópias de ${getCard(effect.cardId)?.name ?? effect.cardId} foram ao cemitério (${side === "you" ? "Você" : "Oponente"})` } };
        index += candidates.length - 1;
      } else effects.push({ ...effect, ...(origin ? { from: { x: origin.x, z: origin.z }, yaw: origin.yaw } : {}), toY: pileTop(graveCount[side]).y });
    }
    if (feedback.drewSide) {
      const side = feedback.drewSide;
      deckCount[side] = Math.max(after[side].deckCount, deckCount[side] - 1);
      const key = slotKey(side, "deck", 0);
      const layers = pileLayers(deckCount[side]);
      if (layers === 0) departures.push(key);
      else arrivals.push({ key, cardId: null, faceDown: true, yaw: side === "you" ? 0 : Math.PI, layers, y: pileTopY(layers), ...slotPosition(side, "deck") });
    }
    steps.push({ feedback: { ...feedback, effects }, departures, arrivals });
  }
  if (steps.length === 0) return [empty()];
  steps[0]!.start = start;
  steps[steps.length - 1]!.finish = finish;
  return steps;
};

export const beginPresentationStep = (current: readonly CardPlacement[], step: PresentationStep): CardPlacement[] =>
  (step.start ?? current).filter((placement) => !step.departures.includes(placement.key));

export const arrivePresentationStep = (current: readonly CardPlacement[], step: PresentationStep): CardPlacement[] => [
  ...current.filter((placement) => !step.arrivals.some((arrival) => arrival.key === placement.key)), ...step.arrivals,
];

export const finishPresentationStep = (current: readonly CardPlacement[], step: PresentationStep): CardPlacement[] =>
  [...(step.finish ?? current)];
