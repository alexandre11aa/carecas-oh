// src/engine/ai/medium.ts
// Nível Médio: heurísticas simples e determinísticas sobre as ações que o motor aceitou (sem aleatoriedade).
import { getCard } from "../cards.js";
import { INITIAL_LIFE_POINTS } from "../createMatch.js";
import type { PlayerView } from "../playerView.js";
import type { Action, MonsterCard, MonsterOnField, SpellEffect } from "../types.js";
import type { AiContext } from "./easy.js";
import type { AiDecision } from "./types.js";

/** O Médio cura quando a vida está abaixo de metade da inicial. */
export const MEDIUM_HEAL_BELOW = INITIAL_LIFE_POINTS / 2;
/** Dano considerado "grande" para ativar uma armadilha de ataque. */
export const MEDIUM_BIG_DAMAGE = 1000;
/** Só ataca monstro virado (identidade oculta) com ATK acima desta estimativa de DEF. */
export const MEDIUM_HIDDEN_DEFENSE_ESTIMATE = 2000;

type OppMonster = PlayerView["opponent"]["monsters"][number];
type Kind = SpellEffect["kind"];
type Summon = Extract<Action, { type: "SUMMON_CARD" }>;

const monsterCard = (cardId: string | null): MonsterCard | null => {
  const card = cardId ? getCard(cardId) : undefined;
  return card?.type === "MONSTER" ? card : null;
};

const attackOf = (m: MonsterOnField): number => (monsterCard(m.cardId)?.attack ?? 0) + (m.attackBonus ?? 0);
const defenseOf = (m: MonsterOnField): number => monsterCard(m.cardId)?.defense ?? 0;
const cardAttack = (cardId: string): number => monsterCard(cardId)?.attack ?? 0;

/** Monstros do oponente com identidade conhecida (viradas para cima). */
const visibleOpp = (view: PlayerView): MonsterOnField[] =>
  view.opponent.monsters.flatMap((m) => (m && m.cardId !== null ? [m as MonsterOnField] : []));

/** Maior ATK entre os monstros do oponente em ataque (a ameaça real). */
const strongestOppAttack = (view: PlayerView): number =>
  Math.max(0, ...visibleOpp(view).filter((m) => m.position === "ATTACK").map(attackOf));

/** Valor que um ATK precisa superar para vencer o alvo; alvo virado usa a estimativa de DEF. */
const targetStrength = (target: OppMonster): number => {
  if (!target) return 0;
  if (target.cardId === null) return MEDIUM_HIDDEN_DEFENSE_ESTIMATE;
  const m = target as MonsterOnField;
  return m.position === "ATTACK" ? attackOf(m) : defenseOf(m);
};

const beats = (atk: number, target: OppMonster): boolean => target !== null && atk > targetStrength(target);

const ownByCard = (view: PlayerView, cardId: string): MonsterOnField | undefined =>
  view.you.monsters.find((m) => m?.cardId === cardId) ?? undefined;

const spellEffect = (cardId: string): SpellEffect | null => {
  const card = getCard(cardId);
  return card?.type === "SPELL" ? card.effect : null;
};

const maxBy = <T>(items: T[], score: (item: T) => number): T | undefined =>
  items.reduce<T | undefined>((best, item) => (best === undefined || score(item) > score(best) ? item : best), undefined);

const minBy = <T>(items: T[], score: (item: T) => number): T | undefined => maxBy(items, (i) => -score(i));

const spells = (valid: Action[], kinds: Kind[]): Extract<Action, { type: "ACTIVATE_SPELL" }>[] =>
  valid.filter((a): a is Extract<Action, { type: "ACTIVATE_SPELL" }> => {
    if (a.type !== "ACTIVATE_SPELL") return false;
    const effect = spellEffect(a.cardId);
    return effect !== null && kinds.includes(effect.kind);
  });

/** Soma do ATK dos monstros próprios usados como tributo. */
const tributeCost = (view: PlayerView, tributes: string[]): number =>
  tributes.reduce((sum, id) => {
    const m = ownByCard(view, id);
    return sum + (m ? attackOf(m) : 0);
  }, 0);

const chooseSummon = (view: PlayerView, valid: Action[]): Action | null => {
  // Para cada carta, a combinação de tributos mais fraca; só vale se o monstro novo superar os tributados.
  const best = new Map<string, Summon>();
  for (const a of valid) {
    if (a.type !== "SUMMON_CARD") continue;
    const current = best.get(a.cardId);
    if (!current || tributeCost(view, a.tributeCardIds) < tributeCost(view, current.tributeCardIds)) best.set(a.cardId, a);
  }
  const worthIt = [...best.values()].filter(
    (a) => a.tributeCardIds.length === 0 || cardAttack(a.cardId) > tributeCost(view, a.tributeCardIds),
  );
  const strongest = maxBy(worthIt, (a) => cardAttack(a.cardId));
  if (strongest && cardAttack(strongest.cardId) > strongestOppAttack(view)) return strongest;
  // Sem vantagem para atacar: baixa em defesa virada (sem tributo) o monstro de maior DEF.
  const sets = valid.filter((a) => a.type === "SET_MONSTER" && a.tributeCardIds.length === 0);
  return maxBy(sets, (a) => (a.type === "SET_MONSTER" ? (monsterCard(a.cardId)?.defense ?? 0) : 0)) ?? null;
};

const choosePosition = (view: PlayerView, valid: Action[]): Action | null => {
  const threat = strongestOppAttack(view);
  const hasOpp = visibleOpp(view).length > 0;
  for (const action of valid) {
    if (action.type !== "CHANGE_POSITION" && action.type !== "FLIP_SUMMON") continue;
    const m = ownByCard(view, action.cardId);
    if (!m || (m.faceDown && action.type === "CHANGE_POSITION")) continue;
    const atk = attackOf(m);
    if (action.type === "FLIP_SUMMON") {
      if (!hasOpp || atk > threat) return action;
    } else if (m.position === "ATTACK" && hasOpp && atk < threat) {
      return action;
    } else if (m.position === "DEFENSE" && (!hasOpp || atk > threat)) {
      return action;
    }
  }
  return null;
};

/** BOOST_ATTACK só quando o reforço transforma um ataque que perderia em um que vence. */
const chooseBoost = (view: PlayerView, valid: Action[]): Action | null => {
  if (view.turn <= 1 || view.phase !== "MAIN_1") return null;
  const options: { action: Action; value: number }[] = [];
  for (const action of spells(valid, ["BOOST_ATTACK"])) {
    const effect = spellEffect(action.cardId);
    const m = action.targetZone == null ? null : view.you.monsters[action.targetZone];
    if (effect?.kind !== "BOOST_ATTACK" || !m || m.position !== "ATTACK" || m.hasAttacked) continue;
    const atk = attackOf(m);
    for (const target of view.opponent.monsters) {
      if (target && !beats(atk, target) && beats(atk + effect.amount, target)) {
        options.push({ action, value: targetStrength(target) });
      }
    }
  }
  return maxBy(options, (o) => o.value)?.action ?? null;
};

/** DESTROY_MONSTER no monstro mais forte do oponente que a magia consegue destruir. */
const chooseDestroy = (view: PlayerView, valid: Action[]): Action | null =>
  maxBy(
    spells(valid, ["DESTROY_MONSTER"]).filter((a) => a.targetZone != null),
    (a) => targetStrength(view.opponent.monsters[a.targetZone ?? 0] ?? null),
  ) ?? null;

const chooseMain = (view: PlayerView, valid: Action[]): Action | null =>
  spells(valid, ["DRAW"])[0] ??
  (view.you.lifePoints < MEDIUM_HEAL_BELOW ? spells(valid, ["HEAL", "HEAL_PER_MONSTER"])[0] : undefined) ??
  chooseDestroy(view, valid) ??
  chooseSummon(view, valid) ??
  chooseBoost(view, valid) ??
  choosePosition(view, valid) ??
  spells(valid, ["DAMAGE", "DRAIN"])[0] ??
  valid.find((a) => a.type === "SET_SPELL_TRAP" && getCard(a.cardId)?.type === "TRAP") ??
  null;

/** Ataca só quando vence: o alvo mais forte possível, com o atacante mais fraco que ainda vence. */
const chooseAttack = (view: PlayerView, valid: Action[]): Action | null => {
  const wins = valid.flatMap((a) => {
    if (a.type !== "ATTACK") return [];
    const m = ownByCard(view, a.attackerCardId);
    if (!m) return [];
    if (a.targetZone === null) return [{ a, atk: attackOf(m), strength: 0 }];
    const target = view.opponent.monsters[a.targetZone] ?? null;
    return beats(attackOf(m), target) ? [{ a, atk: attackOf(m), strength: targetStrength(target) }] : [];
  });
  const top = Math.max(-1, ...wins.map((w) => w.strength));
  return minBy(wins.filter((w) => w.strength === top), (w) => w.atk)?.a ?? null;
};

/** Ativa armadilha de ataque se o atacante é mais forte que o melhor defensor ou o dano é grande. */
const chooseResponse = (view: PlayerView, valid: Action[]): Action | null => {
  const pending = view.pendingResponse;
  if (!pending?.canRespond || pending.trigger !== "ATTACK_DECLARED" || pending.action.type !== "ATTACK") return null;
  const { attackerCardId, targetZone } = pending.action;
  const attacker = visibleOpp(view).find((m) => m.cardId === attackerCardId);
  if (!attacker) return null;
  const atk = attackOf(attacker);
  const target = targetZone === null ? null : view.you.monsters[targetZone];
  const bestDefender = Math.max(
    0,
    ...view.you.monsters.flatMap((m) => (m ? [m.position === "ATTACK" ? attackOf(m) : defenseOf(m)] : [])),
  );
  const damage = targetZone === null ? atk : target?.position === "ATTACK" ? Math.max(0, atk - attackOf(target)) : 0;
  if (atk <= bestDefender && damage < MEDIUM_BIG_DAMAGE) return null;
  const traps = valid.filter((a) => a.type === "ACTIVATE_TRAP");
  const effectOf = (a: Action) => {
    const card = a.type === "ACTIVATE_TRAP" ? getCard(a.cardId) : undefined;
    return card?.type === "TRAP" ? card.effect : null;
  };
  const kill = traps.find((a) => {
    const effect = effectOf(a);
    return effect?.kind === "DESTROY_ATTACKER" && (effect.maxAttack === undefined || atk <= effect.maxAttack);
  });
  return kill ?? traps.find((a) => effectOf(a)?.kind === "NEGATE_ATTACK") ?? null;
};

export const chooseMedium = ({ view, valid }: AiContext, seed: number): AiDecision => {
  const find = (type: Action["type"]): Action | undefined => valid.find((a) => a.type === type);
  const pick = (): Action | null => {
    if (view.pendingResponse) return chooseResponse(view, valid) ?? find("PASS_RESPONSE") ?? valid[0] ?? null;
    switch (view.phase) {
      case "MAIN_1":
        return chooseMain(view, valid) ?? find("NEXT_PHASE") ?? find("END_TURN") ?? valid[0] ?? null;
      case "MAIN_2":
        return chooseMain(view, valid) ?? find("END_TURN") ?? valid[0] ?? null;
      case "BATTLE":
        return chooseAttack(view, valid) ?? find("NEXT_PHASE") ?? find("END_TURN") ?? valid[0] ?? null;
      case "END":
        return find("END_TURN") ?? valid[0] ?? null;
      default:
        return find("NEXT_PHASE") ?? valid[0] ?? null;
    }
  };
  return { action: pick(), seed };
};
