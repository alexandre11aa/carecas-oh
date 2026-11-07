// src/engine/ai/easy.ts
// Nível Fácil: ações válidas com pouca estratégia (invoca o primeiro que consegue, magia e ataque ao acaso).
import type { PlayerView } from "../playerView.js";
import { nextRandom } from "../rng.js";
import type { Action } from "../types.js";
import type { AiDecision } from "./types.js";

/** Chance de o Fácil ativar uma armadilha quando há janela de resposta (sem avaliar o ataque). */
export const EASY_TRAP_CHANCE = 0.3;
const SKIP_SPELL_CHANCE = 0.3;
const SKIP_ATTACK_CHANCE = 0.15;

/** Contexto que cada nível recebe: a visão do lado e só as ações que o motor aceitou. */
export type AiContext = { view: PlayerView; valid: Action[] };

const pickOne = <T>(items: readonly T[], seed: number): { item: T; seed: number } => {
  const rng = nextRandom(seed);
  return { item: items[Math.floor(rng.value * items.length)]!, seed: rng.seed };
};

const chance = (probability: number, seed: number): { hit: boolean; seed: number } => {
  const rng = nextRandom(seed);
  return { hit: rng.value < probability, seed: rng.seed };
};

const firstOfType = (valid: Action[], type: Action["type"]): Action | undefined => valid.find((a) => a.type === type);

export const chooseEasy = ({ view, valid }: AiContext, seed: number): AiDecision => {
  const advance = (): Action | null =>
    firstOfType(valid, view.phase === "MAIN_2" || view.phase === "END" ? "END_TURN" : "NEXT_PHASE") ??
    firstOfType(valid, "END_TURN") ??
    valid[0] ??
    null;

  if (view.pendingResponse) {
    const traps = valid.filter((a) => a.type === "ACTIVATE_TRAP");
    const roll = chance(EASY_TRAP_CHANCE, seed);
    if (roll.hit && traps.length > 0) {
      const pick = pickOne(traps, roll.seed);
      return { action: pick.item, seed: pick.seed };
    }
    return { action: firstOfType(valid, "PASS_RESPONSE") ?? valid[0] ?? null, seed: roll.seed };
  }

  if (view.phase === "MAIN_1" || view.phase === "MAIN_2") {
    // Invoca o primeiro monstro da mão que consegue, tributando ao acaso.
    const summons = valid.filter((a) => a.type === "SUMMON_CARD");
    const firstSummon = summons[0];
    if (firstSummon && firstSummon.type === "SUMMON_CARD") {
      const sameCard = summons.filter((a) => a.type === "SUMMON_CARD" && a.cardId === firstSummon.cardId);
      const pick = pickOne(sameCard, seed);
      return { action: pick.item, seed: pick.seed };
    }
    const others = valid.filter(
      (a) =>
        a.type === "SET_SPELL_TRAP" ||
        a.type === "ACTIVATE_SPELL" ||
        a.type === "CHANGE_POSITION" ||
        a.type === "FLIP_SUMMON",
    );
    const roll = chance(SKIP_SPELL_CHANCE, seed);
    if (others.length === 0 || roll.hit) return { action: advance(), seed: roll.seed };
    const pick = pickOne(others, roll.seed);
    return { action: pick.item, seed: pick.seed };
  }

  if (view.phase === "BATTLE") {
    const attacks = valid.filter((a) => a.type === "ATTACK");
    const roll = chance(SKIP_ATTACK_CHANCE, seed);
    if (attacks.length === 0 || roll.hit) return { action: advance(), seed: roll.seed };
    const pick = pickOne(attacks, roll.seed);
    return { action: pick.item, seed: pick.seed };
  }

  return { action: advance(), seed };
};
