// src/client/animations/matchFeedback.ts
// Planeja a apresentação usando apenas eventos filtrados e as duas visões públicas.
import type { EventView } from "../../engine/eventView.js";
import type { PlayerView } from "../../engine/playerView.js";
import { allSlots, slotPosition, type Side, type Slot } from "../scene/layout.js";
import { buildNotices, type Notice } from "../screens/matchNotices.js";

export const SOUND_NAMES = ["activate", "attack", "damage", "destroyed", "draw", "equip", "flip", "gainlp", "nextturn", "phase", "set", "summon", "victory", "defeat"] as const;
export type SoundName = typeof SOUND_NAMES[number];
type Point = { x: number; z: number };
export type BoardEffect =
  | { kind: "attack"; from: Point; to: Point }
  | { kind: "impact" | "defend"; at: Point }
  | { kind: "graveyard"; from: Point; to: Point; cardId: string; yaw?: number }
  | { kind: "damage" | "heal"; side: Side };
export type FeedbackStep = { sound: SoundName | null; effects: BoardEffect[]; notice: Notice | null };

const soundFor = (event: EventView): SoundName | null => {
  switch (event.type) {
    case "CARD_DRAWN": return "draw";
    case "TURN_STARTED": return "nextturn";
    case "PHASE_CHANGED": return "phase";
    case "MONSTER_SUMMONED": return event.faceDown ? "set" : "summon";
    case "SPELL_TRAP_SET": return "set";
    case "SPELL_ACTIVATED":
    case "TRAP_ACTIVATED": return "activate";
    case "MONSTER_FLIPPED":
    case "POSITION_CHANGED": return "flip";
    case "ATTACK_BOOSTED": return "equip";
    case "ATTACK_DECLARED": return "attack";
    case "CARD_SENT_TO_GRAVEYARD": return "destroyed";
    case "DAMAGE_DEALT": return event.amount > 0 ? "damage" : null;
    case "LIFE_RESTORED": return event.amount > 0 ? "gainlp" : null;
    default: return null;
  }
};

/** Só escolhe uma origem quando a diferença de zonas a identifica sem ambiguidade. */
const departedSlot = (before: PlayerView | null, after: PlayerView, side: Side, cardId: string, used: Set<string>): Slot | null => {
  if (!before || before.viewer !== after.viewer) return null;
  const candidates = allSlots().filter((slot) => {
    if (slot.side !== side || used.has(slot.key)) return false;
    const kind = slot.kind === "monster" ? "monsters" : slot.kind === "spellTrap" ? "spellTraps" : null;
    if (!kind) return false;
    const old = before[side][kind][slot.zone];
    const next = after[side][kind][slot.zone];
    return old && (!next || next.cardId !== old.cardId) && (old.cardId === cardId || old.cardId === null);
  });
  if (candidates.length !== 1) return null;
  used.add(candidates[0]!.key);
  return candidates[0]!;
};

export const buildFeedback = (before: PlayerView | null, after: PlayerView, events: readonly EventView[]): FeedbackStep[] => {
  const steps: FeedbackStep[] = [];
  const used = new Set<string>();
  for (const event of events) {
    const side: Side = "player" in event && event.player === after.viewer ? "you" : "opponent";
    const enemy: Side = side === "you" ? "opponent" : "you";
    const effects: BoardEffect[] = [];
    let impact: BoardEffect | null = null;
    if (event.type === "ATTACK_DECLARED") {
      const candidates = before?.[side].monsters.flatMap((monster, zone) => {
        if (!monster || monster.cardId !== event.attackerCardId || monster.hasAttacked) return [];
        const next = after[side].monsters[zone];
        return !next || ("hasAttacked" in next && next.hasAttacked) ? [zone] : [];
      }) ?? [];
      const from = candidates.length === 1 ? slotPosition(side, "monster", candidates[0]) : { x: 0, z: side === "you" ? 1.4 : -1.4 };
      const to = event.targetZone === null ? { x: 0, z: enemy === "you" ? 5 : -5 } : slotPosition(enemy, "monster", event.targetZone);
      effects.push({ kind: "attack", from, to });
      if (event.targetZone !== null) {
        const defender = before?.[enemy].monsters[event.targetZone];
        impact = { kind: defender?.position === "DEFENSE" ? "defend" : "impact", at: to };
      }
    }
    if (event.type === "CARD_SENT_TO_GRAVEYARD") {
      const origin = departedSlot(before, after, side, event.cardId, used);
      const to = slotPosition(side, "graveyard");
      // Magia vinda da mão não tem zona pública: parte de perto do cemitério.
      const from = origin ? { x: origin.x, z: origin.z } : { x: to.x * 0.65, z: to.z };
      effects.push({ kind: "graveyard", from, to, cardId: event.cardId });
    }
    if (event.type === "DAMAGE_DEALT" && event.amount > 0) effects.push({ kind: "damage", side });
    if (event.type === "LIFE_RESTORED" && event.amount > 0) effects.push({ kind: "heal", side });
    const sound = soundFor(event);
    const notice = buildNotices([event], after.viewer)[0] ?? null;
    if (sound || effects.length || notice) steps.push({ sound, effects, notice });
    if (impact) steps.push({ sound: "damage", effects: [impact], notice: null });
  }
  return steps;
};
