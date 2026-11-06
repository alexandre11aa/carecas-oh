// src/engine/rules/traps.ts
// Armadilhas: janela de resposta do defensor e efeitos como dados. Uma resposta por janela (sem cadeia). Funções puras.
import { getCard } from "../cards";
import type {
  Action,
  ActionResult,
  GameEvent,
  MatchState,
  PlayerId,
  PlayerState,
  TrapEffect,
  TrapTrigger,
} from "../types";
import { opponentOf } from "./turn";

type Failure = Extract<ActionResult, { ok: false }>;
type Success = Extract<ActionResult, { ok: true }>;
/** Executa de fato a ação interrompida; vem de `applyAction` para evitar import circular. */
export type ResumeAction = (state: MatchState, player: PlayerId, action: Action) => ActionResult;

const fail = (code: Failure["code"]): Failure => ({ ok: false, code });

const withPlayer = (state: MatchState, player: PlayerId, data: PlayerState): MatchState => ({
  ...state,
  players: { ...state.players, [player]: data },
});

/** Gatilho que a ação do jogador do turno abre, ou nulo se ela não pode ser respondida. */
export const triggerOf = (action: Action): TrapTrigger | null => {
  switch (action.type) {
    case "ATTACK":
      return "ATTACK_DECLARED";
    case "SUMMON_CARD":
      return "SUMMON";
    case "ACTIVATE_SPELL":
      return "SPELL_ACTIVATION";
    default:
      return null;
  }
};

/** Armadilhas baixadas que o defensor pode ativar neste gatilho: viradas, de turno anterior e com o gatilho certo. */
const eligibleTraps = (state: MatchState, responder: PlayerId, trigger: TrapTrigger): string[] =>
  state.players[responder].spellTraps.flatMap((slot) => {
    if (!slot || !slot.faceDown || slot.setOnTurn >= state.turn) return [];
    const card = getCard(slot.cardId);
    return card?.type === "TRAP" && card.trigger === trigger ? [slot.cardId] : [];
  });

/**
 * Se o defensor tem uma armadilha elegível, devolve o estado com a janela aberta
 * (a ação do jogador do turno fica guardada e ainda não foi aplicada). Senão, nulo.
 */
export const openResponseWindow = (state: MatchState, player: PlayerId, action: Action): Success | null => {
  const trigger = triggerOf(action);
  if (!trigger) return null;
  const responder = opponentOf(player);
  if (eligibleTraps(state, responder, trigger).length === 0) return null;
  return {
    ok: true,
    state: { ...state, pendingResponse: { trigger, responder, action } },
    events: [{ type: "RESPONSE_WINDOW_OPENED", responder, trigger }],
  };
};

type EffectOutcome = { state: MatchState; events: GameEvent[]; resume: boolean };

const toGraveyard = (owner: PlayerId, data: PlayerState, cardId: string, events: GameEvent[]): PlayerState => {
  events.push({ type: "CARD_SENT_TO_GRAVEYARD", player: owner, cardId });
  return { ...data, graveyard: [...data.graveyard, cardId] };
};

/** Aplica o efeito da armadilha à ação interrompida. `resume` diz se a ação original ainda deve resolver. */
export const resolveTrapEffect = (
  effect: TrapEffect,
  state: MatchState,
  actor: PlayerId,
  pending: Action,
): EffectOutcome => {
  const events: GameEvent[] = [];
  const data = state.players[actor];
  switch (effect.kind) {
    case "NEGATE_ATTACK": {
      if (pending.type !== "ATTACK") return { state, events, resume: true };
      events.push({ type: "ATTACK_NEGATED", player: actor, attackerCardId: pending.attackerCardId });
      const monsters = data.monsters.map((m) =>
        m?.cardId === pending.attackerCardId ? { ...m, hasAttacked: true } : m,
      );
      return { state: withPlayer(state, actor, { ...data, monsters }), events, resume: false };
    }
    case "DESTROY_ATTACKER": {
      if (pending.type !== "ATTACK") return { state, events, resume: true };
      const monsters = data.monsters.map((m) => (m?.cardId === pending.attackerCardId ? null : m));
      const next = toGraveyard(actor, { ...data, monsters }, pending.attackerCardId, events);
      return { state: withPlayer(state, actor, next), events, resume: false };
    }
    case "NEGATE_SUMMON": {
      if (pending.type !== "SUMMON_CARD") return { state, events, resume: true };
      events.push({ type: "SUMMON_NEGATED", player: actor, cardId: pending.cardId });
      const hand = data.hand.filter((id) => id !== pending.cardId);
      const next = toGraveyard(actor, { ...data, hand, normalSummonUsed: true }, pending.cardId, events);
      return { state: withPlayer(state, actor, next), events, resume: false };
    }
    case "NEGATE_SPELL": {
      if (pending.type !== "ACTIVATE_SPELL") return { state, events, resume: true };
      events.push({ type: "SPELL_NEGATED", player: actor, cardId: pending.cardId });
      const hand = data.hand.filter((id) => id !== pending.cardId);
      const spellTraps = data.spellTraps.map((s) => (s?.cardId === pending.cardId ? null : s));
      const next = toGraveyard(actor, { ...data, hand, spellTraps }, pending.cardId, events);
      return { state: withPlayer(state, actor, next), events, resume: false };
    }
    case "DAMAGE": {
      const lifePoints = Math.max(0, data.lifePoints - effect.amount);
      events.push({ type: "DAMAGE_DEALT", player: actor, amount: effect.amount });
      const next = withPlayer(state, actor, { ...data, lifePoints });
      if (lifePoints > 0) return { state: next, events, resume: true };
      const winner = opponentOf(actor);
      events.push({ type: "MATCH_ENDED", winner });
      return { state: { ...next, winner }, events, resume: false };
    }
  }
};

/**
 * Resposta do defensor à janela aberta: ativa uma armadilha (efeito resolve antes da ação original)
 * ou passa. Em seguida retoma a ação interrompida, a menos que o efeito a tenha cancelado.
 */
export const respond = (
  state: MatchState,
  responder: PlayerId,
  action: Extract<Action, { type: "ACTIVATE_TRAP" | "PASS_RESPONSE" }>,
  resume: ResumeAction,
): ActionResult => {
  const window = state.pendingResponse;
  if (!window) return fail("NO_RESPONSE_WINDOW");
  const actor = state.currentPlayer;
  const open: MatchState = { ...state, pendingResponse: null };

  if (action.type === "PASS_RESPONSE") {
    const resumed = resume(open, actor, window.action);
    if (!resumed.ok) return resumed;
    return {
      ok: true,
      state: resumed.state,
      events: [{ type: "RESPONSE_PASSED", player: responder }, ...resumed.events],
    };
  }

  const mine = state.players[responder];
  const zone = mine.spellTraps.findIndex((s) => s?.cardId === action.cardId);
  const slot = mine.spellTraps[zone];
  if (!slot) return fail("TRAP_NOT_AVAILABLE");
  const card = getCard(action.cardId);
  if (card?.type !== "TRAP") return fail("NOT_A_TRAP");
  if (slot.setOnTurn >= state.turn) return fail("TRAP_NOT_ACTIVE_YET");
  if (card.trigger !== window.trigger) return fail("TRAP_TRIGGER_MISMATCH");

  const events: GameEvent[] = [
    { type: "TRAP_ACTIVATED", player: responder, cardId: action.cardId, trigger: window.trigger },
  ];
  const spent = toGraveyard(
    responder,
    { ...mine, spellTraps: mine.spellTraps.map((s, i) => (i === zone ? null : s)) },
    action.cardId,
    events,
  );
  const base: MatchState = { ...open, players: { ...open.players, [responder]: spent } };
  const outcome = resolveTrapEffect(card.effect, base, actor, window.action);
  events.push(...outcome.events);
  if (!outcome.resume) return { ok: true, state: outcome.state, events };

  // A ação original só resolve se continuar válida; se a armadilha a inviabilizou, ela é descartada.
  const resumed = resume(outcome.state, actor, window.action);
  if (!resumed.ok) return { ok: true, state: outcome.state, events };
  return { ok: true, state: resumed.state, events: [...events, ...resumed.events] };
};
