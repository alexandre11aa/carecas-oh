// src/engine/rules/summon.ts
// Invocação normal, baixar em defesa virada, tributo, mudança de posição e invocação por virada. Funções puras.
import { removeOne } from "./hand.js";
import { getCard } from "../cards.js";
import type {
  Action,
  ActionResult,
  GameEvent,
  MatchState,
  MonsterOnField,
  PlayerId,
  PlayerState,
} from "../types.js";

type Failure = Extract<ActionResult, { ok: false }>;
type SummonAction = Extract<Action, { type: "SUMMON_CARD" | "SET_MONSTER" }>;

const isMainPhase = (state: MatchState): boolean => state.phase === "MAIN_1" || state.phase === "MAIN_2";

const fail = (code: Failure["code"]): Failure => ({ ok: false, code });

const withPlayer = (state: MatchState, player: PlayerId, data: PlayerState): MatchState => ({
  ...state,
  players: { ...state.players, [player]: data },
});

/** Tributos exigidos: níveis 1-4 nenhum, 5-6 um, 7 ou mais dois. */
export const requiredTributes = (level: number): number => (level >= 7 ? 2 : level >= 5 ? 1 : 0);

/** Invoca (ataque, virado para cima) ou baixa (defesa virada) um monstro da mão, com tributos se exigidos. */
export const summonMonster = (state: MatchState, player: PlayerId, action: SummonAction): ActionResult => {
  if (!isMainPhase(state)) return fail("INVALID_PHASE");
  const current = state.players[player];
  if (!current.hand.includes(action.cardId)) return fail("CARD_NOT_IN_HAND");
  const card = getCard(action.cardId);
  if (!card || card.type !== "MONSTER") return fail("NOT_A_MONSTER");
  if (current.normalSummonUsed) return fail("NORMAL_SUMMON_ALREADY_USED");

  const tributeZones = action.tributeZones;
  const needed = requiredTributes(card.level);
  if (tributeZones.length < needed) return fail("NOT_ENOUGH_TRIBUTES");
  const unique = new Set(tributeZones);
  const onField = (z: number): boolean => Number.isInteger(z) && current.monsters[z] != null;
  if (tributeZones.length > needed || unique.size !== tributeZones.length || !tributeZones.every(onField)) {
    return fail("INVALID_TRIBUTES");
  }
  const tributeIds = tributeZones.map((z) => current.monsters[z]?.cardId ?? "");

  const monsters = current.monsters.map((m, i) => (unique.has(i) ? null : m));
  if (!monsters.includes(null)) return fail("FIELD_FULL");
  const { zone } = action;
  if (!Number.isInteger(zone) || zone < 0 || zone >= monsters.length) return fail("INVALID_ZONE");
  if (monsters[zone] !== null) return fail("ZONE_OCCUPIED");

  const faceDown = action.type === "SET_MONSTER";
  const position = faceDown ? "DEFENSE" : "ATTACK";
  monsters[zone] = {
    cardId: action.cardId,
    position,
    faceDown,
    summonedOnTurn: state.turn,
    hasAttacked: false,
    changedPositionOnTurn: null,
  };
  const events: GameEvent[] = [
    ...tributeIds.map((cardId): GameEvent => ({ type: "CARD_SENT_TO_GRAVEYARD", player, cardId })),
    { type: "MONSTER_SUMMONED", player, cardId: action.cardId, zone, position, faceDown },
  ];
  return {
    ok: true,
    state: withPlayer(state, player, {
      ...current,
      hand: removeOne(current.hand, action.cardId),
      monsters,
      graveyard: [...current.graveyard, ...tributeIds],
      normalSummonUsed: true,
    }),
    events,
  };
};

type PositionCheck = { monster: MonsterOnField; zone: number } | Failure;

const checkPositionChange = (state: MatchState, player: PlayerId, zone: number): PositionCheck => {
  if (!isMainPhase(state)) return fail("INVALID_PHASE");
  const monster = Number.isInteger(zone) ? state.players[player].monsters[zone] : null;
  if (!monster) return fail("MONSTER_NOT_ON_FIELD");
  if (monster.summonedOnTurn === state.turn || monster.hasAttacked) return fail("CANNOT_CHANGE_POSITION");
  if (monster.changedPositionOnTurn === state.turn) return fail("ALREADY_CHANGED_POSITION");
  return { monster, zone };
};

const replaceMonster = (state: MatchState, player: PlayerId, zone: number, monster: MonsterOnField): MatchState => {
  const current = state.players[player];
  const monsters = current.monsters.map((m, i) => (i === zone ? monster : m));
  return withPlayer(state, player, { ...current, monsters });
};

/** Alterna ataque/defesa, uma vez por turno. Monstro virado vira-se para cima ao mudar para ataque. */
export const changePosition = (
  state: MatchState,
  player: PlayerId,
  action: Extract<Action, { type: "CHANGE_POSITION" }>,
): ActionResult => {
  const check = checkPositionChange(state, player, action.zone);
  if ("ok" in check) return check;
  const { monster, zone } = check;
  const position = monster.position === "ATTACK" ? "DEFENSE" : "ATTACK";
  const updated: MonsterOnField = {
    ...monster,
    position,
    faceDown: position === "ATTACK" ? false : monster.faceDown,
    changedPositionOnTurn: state.turn,
  };
  return {
    ok: true,
    state: replaceMonster(state, player, zone, updated),
    events: [{ type: "POSITION_CHANGED", player, cardId: monster.cardId, position, faceDown: updated.faceDown }],
  };
};

/** Vira para cima, em ataque, um monstro baixado em defesa virada. Conta como a mudança de posição do turno. */
export const flipSummon = (
  state: MatchState,
  player: PlayerId,
  action: Extract<Action, { type: "FLIP_SUMMON" }>,
): ActionResult => {
  const check = checkPositionChange(state, player, action.zone);
  if ("ok" in check) return check;
  const { monster, zone } = check;
  if (!monster.faceDown) return fail("NOT_FACE_DOWN");
  const updated: MonsterOnField = {
    ...monster,
    position: "ATTACK",
    faceDown: false,
    changedPositionOnTurn: state.turn,
  };
  return {
    ok: true,
    state: replaceMonster(state, player, zone, updated),
    events: [{ type: "MONSTER_FLIPPED", player, cardId: monster.cardId }],
  };
};
