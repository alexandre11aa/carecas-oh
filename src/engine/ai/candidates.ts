// src/engine/ai/candidates.ts
// Gera as ações candidatas a partir do que `playerView` mostra ao lado da IA (sem a mão do oponente nem os decks).
import { getCard } from "../cards.js";
import { requiredTributes } from "../rules/summon.js";
import type { PlayerView } from "../playerView.js";
import type { Action } from "../types.js";

const occupiedZones = (slots: readonly unknown[]): number[] => slots.flatMap((s, zone) => (s ? [zone] : []));

/** Combinações de `size` ids (size 0, 1 ou 2), mantendo a ordem. */
const combinations = (ids: string[], size: number): string[][] => {
  if (size === 0) return [[]];
  if (size === 1) return ids.map((id) => [id]);
  return ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [a, b]));
};

const summonCandidates = (view: PlayerView): Action[] => {
  const own = view.you;
  if (own.normalSummonUsed) return [];
  const fieldIds = own.monsters.flatMap((m) => (m ? [m.cardId] : []));
  const result: Action[] = [];
  for (const cardId of new Set(own.hand)) {
    const card = getCard(cardId);
    if (card?.type !== "MONSTER") continue;
    for (const tributeCardIds of combinations(fieldIds, requiredTributes(card.level))) {
      const zone = own.monsters.findIndex((m) => m === null || tributeCardIds.includes(m.cardId));
      if (zone === -1) continue;
      result.push({ type: "SUMMON_CARD", cardId, tributeCardIds, zone });
      result.push({ type: "SET_MONSTER", cardId, tributeCardIds, zone });
    }
  }
  return result;
};

const spellCandidates = (view: PlayerView): Action[] => {
  const own = view.you;
  const result: Action[] = [];
  const sources = new Set([...own.hand, ...own.spellTraps.flatMap((s) => (s ? [s.cardId] : []))]);
  for (const cardId of sources) {
    const card = getCard(cardId);
    if (!card || card.type === "MONSTER") continue;
    if (own.hand.includes(cardId) && own.spellTraps.includes(null)) result.push({ type: "SET_SPELL_TRAP", cardId });
    if (card.type === "TRAP") continue;
    const effect = card.effect;
    switch (effect.kind) {
      case "BOOST_ATTACK":
        for (const targetZone of occupiedZones(own.monsters)) result.push({ type: "ACTIVATE_SPELL", cardId, targetZone });
        break;
      case "DESTROY_MONSTER":
        // Com `maxAttack`, a validação dependeria do ATK de um monstro virado: só alvos visíveis.
        view.opponent.monsters.forEach((m, targetZone) => {
          if (m && (effect.maxAttack === undefined || !m.faceDown)) {
            result.push({ type: "ACTIVATE_SPELL", cardId, targetZone });
          }
        });
        break;
      case "BOUNCE_MONSTER":
        for (const targetZone of occupiedZones(view.opponent.monsters)) {
          result.push({ type: "ACTIVATE_SPELL", cardId, targetZone });
        }
        break;
      case "DESTROY_SPELL_TRAP":
        for (const targetZone of occupiedZones(view.opponent.spellTraps)) {
          result.push({ type: "ACTIVATE_SPELL", cardId, targetZone });
        }
        break;
      case "DRAW":
        // Comprar com o deck sem cartas suficientes derrota o conjurador: nunca é candidato.
        if (own.deckCount >= effect.count) result.push({ type: "ACTIVATE_SPELL", cardId });
        break;
      default:
        result.push({ type: "ACTIVATE_SPELL", cardId });
    }
  }
  return result;
};

const positionCandidates = (view: PlayerView): Action[] =>
  view.you.monsters.flatMap((m): Action[] => {
    if (!m) return [];
    const change: Action = { type: "CHANGE_POSITION", cardId: m.cardId };
    return m.faceDown ? [change, { type: "FLIP_SUMMON", cardId: m.cardId }] : [change];
  });

const attackCandidates = (view: PlayerView): Action[] => {
  if (view.turn <= 1) return []; // no primeiro turno da partida ninguém ataca
  const targets = occupiedZones(view.opponent.monsters);
  return view.you.monsters.flatMap((m): Action[] => {
    if (!m || m.position !== "ATTACK" || m.hasAttacked) return [];
    if (targets.length === 0) return [{ type: "ATTACK", attackerCardId: m.cardId, targetZone: null }];
    return targets.map((targetZone): Action => ({ type: "ATTACK", attackerCardId: m.cardId, targetZone }));
  });
};

const responseCandidates = (view: PlayerView): Action[] => {
  const traps = view.you.spellTraps.flatMap((s): Action[] =>
    s && getCard(s.cardId)?.type === "TRAP" ? [{ type: "ACTIVATE_TRAP", cardId: s.cardId }] : [],
  );
  return [...traps, { type: "PASS_RESPONSE" }];
};

/** Todas as ações plausíveis para o lado do `view`, ainda sem validar no motor. */
export const generateCandidates = (view: PlayerView): Action[] => {
  if (view.pendingResponse) return view.pendingResponse.canRespond ? responseCandidates(view) : [];
  switch (view.phase) {
    case "DRAW":
      return [{ type: "NEXT_PHASE" }];
    case "MAIN_1":
    case "MAIN_2":
      return [
        ...summonCandidates(view),
        ...spellCandidates(view),
        ...positionCandidates(view),
        { type: "NEXT_PHASE" },
        { type: "END_TURN" },
      ];
    case "BATTLE":
      return [...attackCandidates(view), { type: "NEXT_PHASE" }, { type: "END_TURN" }];
    case "END":
      return [{ type: "END_TURN" }];
  }
};
