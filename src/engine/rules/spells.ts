// src/engine/rules/spells.ts
// Baixar magia/armadilha e ativar magia; os efeitos vêm de dados em cards.ts. Funções puras.
import { getCard } from "../cards.js";
import type {
  Action,
  ActionResult,
  GameEvent,
  MatchState,
  MonsterOnField,
  PlayerId,
  PlayerState,
  SpellEffect,
} from "../types.js";
import { opponentOf } from "./turn.js";

type Failure = Extract<ActionResult, { ok: false }>;

const fail = (code: Failure["code"]): Failure => ({ ok: false, code });

const isMainPhase = (state: MatchState): boolean => state.phase === "MAIN_1" || state.phase === "MAIN_2";

/** Baixa uma magia ou armadilha da mão, virada para baixo, na primeira zona livre. */
export const setSpellTrap = (
  state: MatchState,
  player: PlayerId,
  action: Extract<Action, { type: "SET_SPELL_TRAP" }>,
): ActionResult => {
  if (!isMainPhase(state)) return fail("INVALID_PHASE");
  const current = state.players[player];
  if (!current.hand.includes(action.cardId)) return fail("CARD_NOT_IN_HAND");
  const card = getCard(action.cardId);
  if (!card || card.type === "MONSTER") return fail("NOT_A_SPELL_OR_TRAP");
  const zone = current.spellTraps.indexOf(null);
  if (zone === -1) return fail("SPELL_TRAP_ZONES_FULL");

  const spellTraps = current.spellTraps.map((s, i) =>
    i === zone ? { cardId: action.cardId, faceDown: true, setOnTurn: state.turn } : s,
  );
  return {
    ok: true,
    state: {
      ...state,
      players: {
        ...state.players,
        [player]: { ...current, hand: current.hand.filter((id) => id !== action.cardId), spellTraps },
      },
    },
    events: [{ type: "SPELL_TRAP_SET", player, cardId: action.cardId, zone }],
  };
};

type Resolution = { self: PlayerState; enemy: PlayerState; events: GameEvent[]; winner: PlayerId | null } | Failure;

const resolveEffect = (
  effect: SpellEffect,
  player: PlayerId,
  self: PlayerState,
  enemy: PlayerState,
  targetZone: number | null,
  turn: number,
): Resolution => {
  const enemyId = opponentOf(player);
  const events: GameEvent[] = [];
  switch (effect.kind) {
    case "HEAL":
      events.push({ type: "LIFE_RESTORED", player, amount: effect.amount });
      return { self: { ...self, lifePoints: self.lifePoints + effect.amount }, enemy, events, winner: null };
    case "DAMAGE": {
      const lifePoints = Math.max(0, enemy.lifePoints - effect.amount);
      events.push({ type: "DAMAGE_DEALT", player: enemyId, amount: effect.amount });
      return { self, enemy: { ...enemy, lifePoints }, events, winner: lifePoints === 0 ? player : null };
    }
    case "DRAW": {
      if (self.deck.length < effect.count) return { self, enemy, events, winner: enemyId };
      const drawn = self.deck.slice(0, effect.count);
      for (const cardId of drawn) events.push({ type: "CARD_DRAWN", player, cardId });
      return {
        self: { ...self, deck: self.deck.slice(effect.count), hand: [...self.hand, ...drawn] },
        enemy,
        events,
        winner: null,
      };
    }
    case "BOOST_ATTACK": {
      const zone = targetZone ?? -1;
      const target = self.monsters[zone];
      if (!target) return fail("INVALID_TARGET");
      events.push({ type: "ATTACK_BOOSTED", player, cardId: target.cardId, zone, amount: effect.amount });
      const monsters = self.monsters.map((m, i) =>
        i === zone && m ? { ...m, attackBonus: (m.attackBonus ?? 0) + effect.amount } : m,
      );
      return { self: { ...self, monsters }, enemy, events, winner: null };
    }
    case "BOOST_ALL_ATTACK": {
      const monsters = self.monsters.map((m, zone) => {
        if (!m) return m;
        events.push({ type: "ATTACK_BOOSTED", player, cardId: m.cardId, zone, amount: effect.amount });
        return { ...m, attackBonus: (m.attackBonus ?? 0) + effect.amount };
      });
      return { self: { ...self, monsters }, enemy, events, winner: null };
    }
    case "HEAL_PER_MONSTER": {
      const count = self.monsters.filter((m) => m !== null).length;
      const amount = Math.min(effect.maxAmount, effect.amountPerMonster * count);
      if (amount > 0) events.push({ type: "LIFE_RESTORED", player, amount });
      return { self: { ...self, lifePoints: self.lifePoints + amount }, enemy, events, winner: null };
    }
    case "REVIVE_MONSTER": {
      let best = -1;
      let bestAttack = -1;
      self.graveyard.forEach((id, i) => {
        const card = getCard(id);
        if (card?.type !== "MONSTER" || card.level > effect.maxLevel) return;
        if (card.attack > bestAttack) {
          best = i;
          bestAttack = card.attack;
        }
      });
      if (best === -1) return fail("NO_ELIGIBLE_MONSTER");
      const zone = self.monsters.indexOf(null);
      if (zone === -1) return fail("FIELD_FULL");
      const cardId = self.graveyard[best]!;
      events.push({ type: "MONSTER_SUMMONED", player, cardId, zone, position: "ATTACK", faceDown: false });
      const revived: MonsterOnField = {
        cardId,
        position: "ATTACK",
        faceDown: false,
        summonedOnTurn: turn,
        hasAttacked: false,
        changedPositionOnTurn: null,
      };
      return {
        self: {
          ...self,
          monsters: self.monsters.map((m, i) => (i === zone ? revived : m)),
          graveyard: self.graveyard.filter((_, i) => i !== best),
        },
        enemy,
        events,
        winner: null,
      };
    }
    case "DESTROY_SPELL_TRAP": {
      const zone = targetZone ?? -1;
      const target = enemy.spellTraps[zone];
      if (!target) return fail("INVALID_TARGET");
      events.push({ type: "CARD_SENT_TO_GRAVEYARD", player: enemyId, cardId: target.cardId });
      return {
        self,
        enemy: {
          ...enemy,
          spellTraps: enemy.spellTraps.map((s, i) => (i === zone ? null : s)),
          graveyard: [...enemy.graveyard, target.cardId],
        },
        events,
        winner: null,
      };
    }
    case "DRAIN": {
      const lifePoints = Math.max(0, enemy.lifePoints - effect.amount);
      events.push({ type: "DAMAGE_DEALT", player: enemyId, amount: effect.amount });
      events.push({ type: "LIFE_RESTORED", player, amount: effect.amount });
      return {
        self: { ...self, lifePoints: self.lifePoints + effect.amount },
        enemy: { ...enemy, lifePoints },
        events,
        winner: lifePoints === 0 ? player : null,
      };
    }
    case "BOUNCE_MONSTER": {
      const zone = targetZone ?? -1;
      const target = enemy.monsters[zone];
      if (!target) return fail("INVALID_TARGET");
      events.push({ type: "CARD_RETURNED_TO_HAND", player: enemyId, cardId: target.cardId, zone, faceDown: target.faceDown });
      return {
        self,
        enemy: {
          ...enemy,
          monsters: enemy.monsters.map((m, i) => (i === zone ? null : m)),
          hand: [...enemy.hand, target.cardId],
        },
        events,
        winner: null,
      };
    }
    case "DESTROY_MONSTER": {
      const zone = targetZone ?? -1;
      const target = enemy.monsters[zone];
      if (!target) return fail("INVALID_TARGET");
      const targetCard = getCard(target.cardId);
      const attack = targetCard?.type === "MONSTER" ? targetCard.attack + (target.attackBonus ?? 0) : 0;
      if (effect.maxAttack !== undefined && attack > effect.maxAttack) return fail("INVALID_TARGET");
      events.push({ type: "CARD_SENT_TO_GRAVEYARD", player: enemyId, cardId: target.cardId });
      return {
        self,
        enemy: {
          ...enemy,
          monsters: enemy.monsters.map((m, i) => (i === zone ? null : m)),
          graveyard: [...enemy.graveyard, target.cardId],
        },
        events,
        winner: null,
      };
    }
  }
};

/** Ativa uma magia da mão ou baixada no campo; o efeito resolve na hora e a carta vai ao cemitério. */
export const activateSpell = (
  state: MatchState,
  player: PlayerId,
  action: Extract<Action, { type: "ACTIVATE_SPELL" }>,
): ActionResult => {
  if (!isMainPhase(state)) return fail("INVALID_PHASE");
  const current = state.players[player];
  const inHand = current.hand.includes(action.cardId);
  const zone = current.spellTraps.findIndex((s) => s?.cardId === action.cardId);
  if (!inHand && zone === -1) return fail("SPELL_NOT_AVAILABLE");
  const card = getCard(action.cardId);
  if (!card || card.type !== "SPELL") return fail("NOT_A_SPELL");

  const enemyId = opponentOf(player);
  const targetZone = action.targetZone ?? null;
  const base: PlayerState = inHand
    ? { ...current, hand: current.hand.filter((id) => id !== action.cardId) }
    : { ...current, spellTraps: current.spellTraps.map((s, i) => (i === zone ? null : s)) };

  const resolved = resolveEffect(card.effect, player, base, state.players[enemyId], targetZone, state.turn);
  if ("ok" in resolved) return resolved;

  const events: GameEvent[] = [
    { type: "SPELL_ACTIVATED", player, cardId: action.cardId, targetZone },
    ...resolved.events,
    { type: "CARD_SENT_TO_GRAVEYARD", player, cardId: action.cardId },
  ];
  if (resolved.winner) events.push({ type: "MATCH_ENDED", winner: resolved.winner });
  return {
    ok: true,
    state: {
      ...state,
      winner: resolved.winner,
      players: {
        ...state.players,
        [player]: { ...resolved.self, graveyard: [...resolved.self.graveyard, action.cardId] },
        [enemyId]: resolved.enemy,
      },
    },
    events,
  };
};
