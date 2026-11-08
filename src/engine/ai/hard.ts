// src/engine/ai/hard.ts
// Nível Difícil: pontua cada ação aceita pelo motor (uma jogada à frente) e escolhe a de maior valor, em vez de ordem fixa.
// Determinístico, sem aleatoriedade (devolve a mesma semente). Só lê o `playerView` do próprio lado.
import { getCard } from "../cards.js";
import { INITIAL_LIFE_POINTS } from "../createMatch.js";
import type { HiddenMonsterView, PlayerView } from "../playerView.js";
import type { Action, Card, MonsterCard, MonsterOnField, MonsterPosition, SpellEffect } from "../types.js";
import type { AiContext } from "./easy.js";
import type { AiDecision } from "./types.js";

/** Vida considerada baixa: cura, mantém defensores e prefere defesa. */
export const HARD_LOW_LIFE = INITIAL_LIFE_POINTS / 2;
/** Com o deck abaixo disso o Difícil não usa `DRAW` (evita perder por deck vazio). */
export const HARD_DRAW_MIN_DECK = 5;
/** Estimativas para monstros virados do oponente (a identidade nunca é lida). */
export const HARD_HIDDEN_ATK = 1200;
export const HARD_HIDDEN_DEF = 1800;
export const HARD_HIDDEN_VALUE = 1500;
/** Ganho mínimo para gastar uma armadilha quando a jogada não é letal. */
export const HARD_TRAP_MIN_BENEFIT = 700;

const LETHAL = 100000;
const LETHAL_PLAN = 50000;
const RISK = 8000;
const DAMAGE_WEIGHT = 0.5;
const WASTE_WEIGHT = 0.05;
const SPELL_COST = 400;
const SET_TRAP_SCORE = 350;

type Unit = { atk: number; def: number; position: MonsterPosition; value: number; hidden: boolean };
type Spell = Extract<Action, { type: "ACTIVATE_SPELL" }>;
type Ctx = { view: PlayerView; valid: Action[]; burn: number; readyAttack: number };

const monsterCard = (cardId: string | null): MonsterCard | null => {
  const card = cardId ? getCard(cardId) : undefined;
  return card?.type === "MONSTER" ? card : null;
};

const monsterValue = (cardId: string): number => {
  const card = monsterCard(cardId);
  return card ? card.attack + card.defense * 0.4 : 0;
};

const attackOf = (m: MonsterOnField): number => (monsterCard(m.cardId)?.attack ?? 0) + (m.attackBonus ?? 0);
const defenseOf = (m: MonsterOnField): number => monsterCard(m.cardId)?.defense ?? 0;

const unitOf = (m: MonsterOnField | HiddenMonsterView): Unit =>
  m.cardId === null
    ? { atk: HARD_HIDDEN_ATK, def: HARD_HIDDEN_DEF, position: m.position, value: HARD_HIDDEN_VALUE, hidden: true }
    : { atk: attackOf(m), def: defenseOf(m), position: m.position, value: monsterValue(m.cardId), hidden: false };

const ownMonsters = (view: PlayerView): MonsterOnField[] => view.you.monsters.flatMap((m) => (m ? [m] : []));
const oppUnits = (view: PlayerView): Unit[] => view.opponent.monsters.flatMap((m) => (m ? [unitOf(m)] : []));
const ownUnits = (view: PlayerView): Unit[] => ownMonsters(view).map(unitOf);
const isLowLife = (view: PlayerView): boolean => view.you.lifePoints <= HARD_LOW_LIFE;

/** Maior ATK entre os monstros do oponente visíveis em ataque. */
const strongestOppAttack = (view: PlayerView): number =>
  Math.max(
    0,
    ...view.opponent.monsters.flatMap((m) => (m && m.cardId !== null && m.position === "ATTACK" ? [attackOf(m)] : [])),
  );

/** Dano que os atacantes causariam: cada bloqueador (os mais fortes) absorve um atacante (os mais fortes). */
const counterDamage = (attackers: Unit[], blockers: Unit[]): number => {
  const atks = attackers
    .filter((u) => u.position === "ATTACK" || u.hidden)
    .map((u) => u.atk)
    .sort((a, b) => b - a);
  const blocks = blockers.map((u) => (u.position === "ATTACK" ? u.atk : u.def)).sort((a, b) => b - a);
  return atks.reduce((sum, atk, i) => sum + Math.max(0, atk - (blocks[i] ?? 0)), 0);
};

const maxBy = <T>(items: T[], score: (item: T) => number): T | undefined =>
  items.reduce<T | undefined>((best, item) => (best === undefined || score(item) > score(best) ? item : best), undefined);

const spellEffect = (cardId: string): SpellEffect | null => {
  const card = getCard(cardId);
  return card?.type === "SPELL" ? card.effect : null;
};

/**
 * Valor de atacar `targetZone` (null = direto) com `atk`: alvo destruído + dano causado
 * - dano sofrido - atacante perdido, com bônus de letal e ajuste pelo risco de contra-ataque letal.
 */
const evalAttack = (
  view: PlayerView,
  attacker: MonsterOnField,
  attackerZone: number,
  atk: number,
  targetZone: number | null,
): number => {
  const myLife = view.you.lifePoints;
  const oppLife = view.opponent.lifePoints;
  const target = targetZone === null ? null : (view.opponent.monsters[targetZone] ?? null);
  if (targetZone !== null && !target) return -LETHAL;

  let dmgToOpp = 0;
  let dmgToMe = 0;
  let kill = false;
  let lose = false;
  let targetValue = 0;
  let required = 0;
  if (!target) {
    dmgToOpp = atk;
  } else {
    const u = unitOf(target);
    targetValue = u.value;
    if (u.position === "ATTACK") {
      required = u.atk;
      const diff = atk - u.atk;
      kill = diff >= 0;
      lose = diff <= 0;
      dmgToOpp = Math.max(diff, 0);
      dmgToMe = Math.max(-diff, 0);
    } else {
      required = u.def;
      const diff = atk - u.def;
      kill = diff > 0;
      dmgToMe = Math.max(-diff, 0);
    }
  }
  if (dmgToMe >= myLife) return -LETHAL;
  if (dmgToOpp >= oppLife) return LETHAL + atk;

  const othersAtk = view.you.monsters
    .flatMap((m, zone) => (m && zone !== attackerZone && m.position === "ATTACK" && !m.hasAttacked ? [m] : []))
    .reduce((sum, m) => sum + attackOf(m), 0);
  const oppLeft = oppUnits(view).length - (kill ? 1 : 0);
  const lifeWeight = isLowLife(view) ? 1.5 : 0.8;

  let score =
    (kill ? targetValue : 0) +
    dmgToOpp * DAMAGE_WEIGHT -
    dmgToMe * lifeWeight -
    (lose ? monsterValue(attacker.cardId) : 0) -
    (kill ? Math.max(0, atk - required) * WASTE_WEIGHT : 0);
  if (oppLeft === 0 && dmgToOpp + othersAtk >= oppLife) score += LETHAL_PLAN;

  // Contra-ataque letal: premia a jogada que o desfaz e evita gastar um monstro (ou vida) enquanto continua exposto a ele.
  const oppAfter = view.opponent.monsters.flatMap((m, zone) => (m && !(kill && zone === targetZone) ? [unitOf(m)] : []));
  const mineAfter = view.you.monsters.flatMap((m, zone) => (m && !(lose && zone === attackerZone) ? [unitOf(m)] : []));
  const riskBase = counterDamage(oppUnits(view), ownUnits(view)) >= myLife;
  const riskAfter = counterDamage(oppAfter, mineAfter) >= myLife - dmgToMe;
  if (riskAfter && (lose || dmgToMe > 0)) score -= RISK;
  if (!riskAfter && riskBase) score += RISK;
  return score;
};

const attackZones = (view: PlayerView): (number | null)[] => {
  const zones = view.opponent.monsters.flatMap((m, zone) => (m ? [zone] : []));
  return zones.length === 0 ? [null] : zones;
};

/** Melhor valor de ataque do monstro com `atk` (0 se não pode ou não compensa atacar). */
const bestAttack = (view: PlayerView, m: MonsterOnField, attackerZone: number, atk: number): number => {
  if (view.turn <= 1 || m.position !== "ATTACK" || m.hasAttacked) return 0;
  return Math.max(0, ...attackZones(view).map((target) => evalAttack(view, m, attackerZone, atk, target)));
};

const scoreAttackAction = (view: PlayerView, a: Extract<Action, { type: "ATTACK" }>): number => {
  const m = view.you.monsters[a.attackerZone];
  return m ? evalAttack(view, m, a.attackerZone, attackOf(m), a.targetZone) : -1;
};

/** Valor do tributo: o de menor valor primeiro; com vida baixa os defensores valem mais (são mantidos). */
const tributeCost = (view: PlayerView, tributeZones: number[]): number =>
  tributeZones.reduce((sum, zone) => {
    const m = view.you.monsters[zone];
    if (!m) return sum;
    return sum + monsterValue(m.cardId) * (isLowLife(view) && m.position === "DEFENSE" ? 2.5 : 1);
  }, 0);

const scoreSummon = (view: PlayerView, a: Extract<Action, { type: "SUMMON_CARD" | "SET_MONSTER" }>): number => {
  const card = monsterCard(a.cardId);
  if (!card) return -1;
  const value = monsterValue(a.cardId);
  const cost = tributeCost(view, a.tributeZones);
  if (a.tributeZones.length > 0 && value - cost < 500) return -1;
  const threat = strongestOppAttack(view);
  const weaker = card.attack < threat;
  if (a.type === "SUMMON_CARD") {
    return value - cost - (weaker ? (threat - card.attack) * 0.5 + (isLowLife(view) ? 400 : 0) : 0);
  }
  return value * 0.5 + card.defense * 0.3 - cost + (weaker ? 300 : 0) + (isLowLife(view) ? 400 : 0);
};

const scorePosition = (view: PlayerView, a: Extract<Action, { type: "CHANGE_POSITION" | "FLIP_SUMMON" }>): number => {
  const m = view.you.monsters[a.zone];
  if (!m || (m.faceDown && a.type === "CHANGE_POSITION")) return -1;
  const atk = attackOf(m);
  const threat = strongestOppAttack(view);
  const hasOpp = oppUnits(view).length > 0;
  const canAttackNow = view.phase === "MAIN_1" && !m.hasAttacked;
  const asAttacker = (): number => (canAttackNow ? bestAttack(view, { ...m, position: "ATTACK" }, a.zone, atk) : 0);

  if (m.position === "ATTACK") {
    // Só se protege quando não há ataque que compense e o monstro é mais fraco que a ameaça.
    if (asAttacker() > 0 || atk >= threat) return -1;
    return 300 + Math.min(threat - atk, 1000) * 0.3 + (isLowLife(view) ? 300 : 0);
  }
  const potential = asAttacker();
  if (potential > 0) return 500 + potential;
  if (isLowLife(view) && threat > 0) return -1;
  if (!hasOpp || atk > threat) return a.type === "FLIP_SUMMON" ? 450 : 350;
  return -1;
};

/** Magia de dano/cura: a cura só vale com vida baixa ou para evitar a derrota; o dano espera o letal ou a Principal 2. */
const healAmount = (view: PlayerView, effect: SpellEffect): number => {
  if (effect.kind === "HEAL" || effect.kind === "DRAIN") return effect.amount;
  if (effect.kind === "HEAL_PER_MONSTER") {
    return Math.min(effect.amountPerMonster * ownMonsters(view).length, effect.maxAmount);
  }
  return 0;
};

const burnAmount = (effect: SpellEffect | null): number =>
  effect && (effect.kind === "DAMAGE" || effect.kind === "DRAIN") ? effect.amount : 0;

const scoreSpell = (ctx: Ctx, a: Spell): number => {
  const { view } = ctx;
  const effect = spellEffect(a.cardId);
  if (!effect) return -1;
  const oppLife = view.opponent.lifePoints;
  const main1 = view.phase === "MAIN_1";
  const targetUnit = (): Unit | null => {
    const m = a.targetZone == null ? null : (view.opponent.monsters[a.targetZone] ?? null);
    return m ? unitOf(m) : null;
  };
  /** Remover o único monstro do oponente abre o ataque direto letal. */
  const clearsForLethal = (): boolean => {
    if (!main1 || view.turn <= 1 || oppUnits(view).length !== 1) return false;
    const ready = ownMonsters(view).filter((m) => m.position === "ATTACK" && !m.hasAttacked);
    return ready.reduce((sum, m) => sum + attackOf(m), 0) + ctx.burn >= oppLife;
  };

  switch (effect.kind) {
    case "DRAW":
      if (view.you.deckCount < HARD_DRAW_MIN_DECK) return -1;
      return view.you.normalSummonUsed ? 150 : 1200; // antes de invocar, para escolher entre mais cartas
    case "HEAL":
    case "HEAL_PER_MONSTER":
    case "DRAIN": {
      const heal = healAmount(view, effect);
      const damage = burnAmount(effect);
      let value = 0;
      if (damage > 0) {
        if (damage >= oppLife) return LETHAL;
        if (ctx.burn + ctx.readyAttack >= oppLife) return LETHAL_PLAN;
        if (view.phase === "MAIN_2" || oppLife <= 3000) value += damage * 0.4;
      }
      const risk = counterDamage(oppUnits(view), ownUnits(view));
      if (isLowLife(view)) value += heal;
      else if (risk >= view.you.lifePoints && view.you.lifePoints + heal > risk) value += 20000;
      return value > 0 ? value : -1;
    }
    case "DAMAGE":
      if (effect.amount >= oppLife) return LETHAL;
      if (ctx.burn + ctx.readyAttack >= oppLife) return LETHAL_PLAN;
      if (view.phase === "MAIN_2" || oppLife <= 3000) return effect.amount * 0.4;
      return -1;
    case "DESTROY_MONSTER": {
      const u = targetUnit();
      if (!u) return -1;
      if (clearsForLethal()) return LETHAL_PLAN;
      if (u.value < 1200) return -1;
      // Antes do ataque o alvo forte vale mais; na Principal 2 só remove ameaça.
      return (u.value * 1.2 + 300) * (main1 ? 1 : 0.7);
    }
    case "BOUNCE_MONSTER": {
      const u = targetUnit();
      if (!u || !main1) return -1;
      if (clearsForLethal()) return LETHAL_PLAN;
      return u.value >= 1500 ? u.value * 0.6 + 200 : -1;
    }
    case "DESTROY_SPELL_TRAP":
      return main1 && view.opponent.spellTraps.some((s) => s !== null) ? 450 : -1;
    case "BOOST_ATTACK": {
      const m = a.targetZone == null ? null : view.you.monsters[a.targetZone];
      if (!m || !main1) return -1;
      const zone = a.targetZone as number;
      const gain = bestAttack(view, m, zone, attackOf(m) + effect.amount) - bestAttack(view, m, zone, attackOf(m));
      return gain - SPELL_COST;
    }
    case "BOOST_ALL_ATTACK": {
      if (!main1) return -1;
      const gain = view.you.monsters.reduce(
        (sum, m, zone) =>
          m ? sum + bestAttack(view, m, zone, attackOf(m) + effect.amount) - bestAttack(view, m, zone, attackOf(m)) : sum,
        0,
      );
      return gain - SPELL_COST;
    }
    case "REVIVE_MONSTER": {
      const best = maxBy(
        view.you.graveyard.filter((id) => (monsterCard(id)?.level ?? 99) <= effect.maxLevel),
        (id) => monsterCard(id)?.attack ?? 0,
      );
      return best ? monsterValue(best) * 0.9 : -1;
    }
  }
};

const scoreAction = (ctx: Ctx, a: Action): number => {
  switch (a.type) {
    case "SUMMON_CARD":
    case "SET_MONSTER":
      return scoreSummon(ctx.view, a);
    case "SET_SPELL_TRAP":
      return getCard(a.cardId)?.type === "TRAP" ? SET_TRAP_SCORE : -1;
    case "ACTIVATE_SPELL":
      return scoreSpell(ctx, a);
    case "CHANGE_POSITION":
    case "FLIP_SUMMON":
      return scorePosition(ctx.view, a);
    case "ATTACK":
      return scoreAttackAction(ctx.view, a);
    default:
      return 0;
  }
};

const buildContext = (view: PlayerView, valid: Action[]): Ctx => {
  const burnCards = new Set(valid.flatMap((a) => (a.type === "ACTIVATE_SPELL" ? [a.cardId] : [])));
  const burn = [...burnCards].reduce((sum, id) => sum + burnAmount(spellEffect(id)), 0);
  const noDefenders = oppUnits(view).length === 0;
  const readyAttack =
    noDefenders && view.turn > 1
      ? ownMonsters(view)
          .filter((m) => m.position === "ATTACK" && !m.hasAttacked)
          .reduce((sum, m) => sum + attackOf(m), 0)
      : 0;
  return { view, valid, burn, readyAttack };
};

type AttackResponse = Extract<Action, { type: "ATTACK" }>;

/** Armadilha contra um ataque: pesa o que o ataque causaria (alvo valioso, dano, letal) e o ganho em destruir o atacante. */
const respondToAttack = (view: PlayerView, valid: Action[], attack: AttackResponse): Action | null => {
  const attacker = view.opponent.monsters[attack.attackerZone];
  if (!attacker || attacker.cardId === null) return null;
  const atk = attackOf(attacker);
  const target = attack.targetZone === null ? null : (view.you.monsters[attack.targetZone] ?? null);

  let damage = 0;
  let lostValue = 0;
  let attackerDies = false;
  if (!target) {
    damage = atk;
  } else if (target.position === "ATTACK") {
    const diff = atk - attackOf(target);
    if (diff >= 0) lostValue = monsterValue(target.cardId);
    damage = Math.max(diff, 0);
    attackerDies = diff <= 0;
  } else if (atk > defenseOf(target)) {
    lostValue = monsterValue(target.cardId);
  }
  const lethal = damage >= view.you.lifePoints;
  const harm = lostValue + damage * 0.8;
  const killGain = attackerDies ? 0 : monsterValue(attacker.cardId);

  const options = valid.flatMap((a) => {
    if (a.type !== "ACTIVATE_TRAP") return [];
    const card = trapCardAt(view, a);
    const effect = card?.type === "TRAP" ? card.effect : null;
    if (effect?.kind === "NEGATE_ATTACK") return [{ a, benefit: harm }];
    if (effect?.kind === "DESTROY_ATTACKER" && (effect.maxAttack === undefined || atk <= effect.maxAttack)) {
      return [{ a, benefit: harm + killGain }];
    }
    return [];
  });
  const best = maxBy(options, (o) => o.benefit);
  if (!best) return null;
  return lethal || best.benefit >= HARD_TRAP_MIN_BENEFIT ? best.a : null;
};

const trapCardAt = (view: PlayerView, a: Action): Card | undefined => {
  const slot = a.type === "ACTIVATE_TRAP" ? view.you.spellTraps[a.zone] : null;
  return slot ? getCard(slot.cardId) : undefined;
};

const trapKind = (view: PlayerView, a: Action): string | null => {
  const card = trapCardAt(view, a);
  return card?.type === "TRAP" ? card.effect.kind : null;
};

const respondToSummon = (view: PlayerView, valid: Action[], cardId: string): Action | null =>
  (monsterCard(cardId)?.attack ?? 0) >= 1800 ? (valid.find((a) => trapKind(view, a) === "NEGATE_SUMMON") ?? null) : null;

const respondToSpell = (view: PlayerView, valid: Action[], spell: Spell): Action | null => {
  const effect = spellEffect(spell.cardId);
  if (!effect) return null;
  const mine = spell.targetZone == null ? null : (view.you.monsters[spell.targetZone] ?? null);
  const threatens =
    ((effect.kind === "DAMAGE" || effect.kind === "DRAIN") && effect.amount >= view.you.lifePoints) ||
    (effect.kind === "DESTROY_MONSTER" && mine !== null && monsterValue(mine.cardId) >= 1500);
  return threatens ? (valid.find((a) => trapKind(view, a) === "NEGATE_SPELL") ?? null) : null;
};

const chooseResponse = (view: PlayerView, valid: Action[]): Action | null => {
  const pending = view.pendingResponse;
  if (!pending?.canRespond) return null;
  const { action } = pending;
  if (pending.trigger === "ATTACK_DECLARED" && action.type === "ATTACK") return respondToAttack(view, valid, action);
  if (pending.trigger === "SUMMON" && action.type === "SUMMON_CARD") return respondToSummon(view, valid, action.cardId);
  if (pending.trigger === "SPELL_ACTIVATION" && action.type === "ACTIVATE_SPELL") return respondToSpell(view, valid, action);
  return null;
};

export const chooseHard = ({ view, valid }: AiContext, seed: number): AiDecision => {
  const find = (type: Action["type"]): Action | undefined => valid.find((a) => a.type === type);
  const pick = (): Action | null => {
    if (view.pendingResponse) return chooseResponse(view, valid) ?? find("PASS_RESPONSE") ?? valid[0] ?? null;
    if (view.phase !== "DRAW") {
      const ctx = buildContext(view, valid);
      const scored = valid.map((action) => ({ action, score: scoreAction(ctx, action) })).filter((o) => o.score > 0);
      const best = maxBy(scored, (o) => o.score);
      if (best) return best.action;
    }
    switch (view.phase) {
      case "MAIN_1":
      case "BATTLE":
        return find("NEXT_PHASE") ?? find("END_TURN") ?? valid[0] ?? null;
      case "MAIN_2":
      case "END":
        return find("END_TURN") ?? valid[0] ?? null;
      default:
        return find("NEXT_PHASE") ?? valid[0] ?? null;
    }
  };
  return { action: pick(), seed };
};
