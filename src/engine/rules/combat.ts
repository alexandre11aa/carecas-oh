// src/engine/rules/combat.ts
// Combate: ataque entre monstros, ataque direto, dano e vitória por pontos de vida. Funções puras.
import { getCard } from "../cards";
import type {
  Action,
  ActionResult,
  GameEvent,
  MatchState,
  MonsterOnField,
  PlayerId,
  PlayerState,
} from "../types";
import { canAttack, opponentOf } from "./turn";

type Failure = Extract<ActionResult, { ok: false }>;
type AttackAction = Extract<Action, { type: "ATTACK" }>;

const fail = (code: Failure["code"]): Failure => ({ ok: false, code });

const statOf = (monster: MonsterOnField, stat: "attack" | "defense"): number => {
  const card = getCard(monster.cardId);
  return card?.type === "MONSTER" ? card[stat] : 0;
};

/** Ataca com um monstro em ataque, uma vez por turno, contra um monstro do oponente ou direto (alvo nulo). */
export const attack = (state: MatchState, player: PlayerId, action: AttackAction): ActionResult => {
  if (state.phase !== "BATTLE") return fail("INVALID_PHASE");
  if (!canAttack(state)) return fail("ATTACK_NOT_ALLOWED_ON_FIRST_TURN");

  const enemyId = opponentOf(player);
  const self = state.players[player];
  const enemy = state.players[enemyId];

  const attackerZone = self.monsters.findIndex((m) => m?.cardId === action.attackerCardId);
  const attacker = self.monsters[attackerZone];
  if (!attacker) return fail("MONSTER_NOT_ON_FIELD");
  if (attacker.position !== "ATTACK") return fail("NOT_IN_ATTACK_POSITION");
  if (attacker.hasAttacked) return fail("ALREADY_ATTACKED");

  const events: GameEvent[] = [
    { type: "ATTACK_DECLARED", player, attackerCardId: attacker.cardId, targetCardId: action.targetCardId },
  ];
  const atk = statOf(attacker, "attack");
  let selfData: PlayerState = {
    ...self,
    monsters: self.monsters.map((m, i) => (i === attackerZone ? { ...attacker, hasAttacked: true } : m)),
  };
  let enemyData: PlayerState = enemy;

  const damage = (target: PlayerId, data: PlayerState, amount: number): PlayerState => {
    if (amount > 0) events.push({ type: "DAMAGE_DEALT", player: target, amount });
    return { ...data, lifePoints: Math.max(0, data.lifePoints - amount) };
  };
  const destroy = (owner: PlayerId, data: PlayerState, zone: number): PlayerState => {
    const destroyed = data.monsters[zone];
    if (!destroyed) return data;
    events.push({ type: "CARD_SENT_TO_GRAVEYARD", player: owner, cardId: destroyed.cardId });
    return {
      ...data,
      monsters: data.monsters.map((m, i) => (i === zone ? null : m)),
      graveyard: [...data.graveyard, destroyed.cardId],
    };
  };

  if (action.targetCardId === null) {
    if (enemy.monsters.some((m) => m !== null)) return fail("DIRECT_ATTACK_NOT_ALLOWED");
    enemyData = damage(enemyId, enemyData, atk);
  } else {
    const targetZone = enemy.monsters.findIndex((m) => m?.cardId === action.targetCardId);
    const target = enemy.monsters[targetZone];
    if (!target) return fail("INVALID_TARGET");

    if (target.position === "ATTACK") {
      const diff = atk - statOf(target, "attack");
      if (diff >= 0) enemyData = destroy(enemyId, enemyData, targetZone);
      if (diff <= 0) selfData = destroy(player, selfData, attackerZone);
      if (diff > 0) enemyData = damage(enemyId, enemyData, diff);
      if (diff < 0) selfData = damage(player, selfData, -diff);
    } else {
      if (target.faceDown) {
        events.push({ type: "MONSTER_FLIPPED", player: enemyId, cardId: target.cardId });
        enemyData = {
          ...enemyData,
          monsters: enemyData.monsters.map((m, i) => (i === targetZone && m ? { ...m, faceDown: false } : m)),
        };
      }
      const diff = atk - statOf(target, "defense");
      if (diff > 0) enemyData = destroy(enemyId, enemyData, targetZone);
      if (diff < 0) selfData = damage(player, selfData, -diff);
    }
  }

  let winner: PlayerId | null = null;
  if (enemyData.lifePoints === 0) winner = player;
  else if (selfData.lifePoints === 0) winner = enemyId;
  if (winner) events.push({ type: "MATCH_ENDED", winner });

  return {
    ok: true,
    state: { ...state, winner, players: { ...state.players, [player]: selfData, [enemyId]: enemyData } },
    events,
  };
};
