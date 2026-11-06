// src/engine/playerView.ts
// Único caminho de dados aos jogadores: filtra o estado e remove toda informação oculta.
import type {
  Action,
  MatchState,
  MonsterOnField,
  MonsterPosition,
  Phase,
  PlayerId,
  PlayerState,
  SpellTrapOnField,
  TrapTrigger,
} from "./types.js";

/** Monstro do oponente virado: só a posição e o turno de invocação são públicos (a identidade nunca). */
export type HiddenMonsterView = {
  cardId: null;
  faceDown: true;
  position: MonsterPosition;
  summonedOnTurn: number;
};

/** Magia/armadilha do oponente baixada: ocupa a zona, mas a identidade é oculta. */
export type HiddenSpellTrapView = {
  cardId: null;
  faceDown: true;
  setOnTurn: number;
};

/** Campo do oponente: cartas viradas aparecem sem identidade; as viradas para cima são públicas. */
export type OpponentPlayerView = {
  id: PlayerId;
  lifePoints: number;
  handCount: number;
  deckCount: number;
  monsters: (MonsterOnField | HiddenMonsterView | null)[];
  spellTraps: (SpellTrapOnField | HiddenSpellTrapView | null)[];
  /** Cemitério é público (cartas viradas para cima). */
  graveyard: string[];
  normalSummonUsed: boolean;
};

/** Próprio lado: tudo visível, exceto a ordem do deck (só a contagem). */
export type OwnPlayerView = Omit<PlayerState, "deck"> & { deckCount: number };

/** Janela de resposta: só quem pode agir vê o gatilho e a ação interrompida. */
export type PendingResponseView =
  | { responder: PlayerId; canRespond: true; trigger: TrapTrigger; action: Action }
  | { responder: PlayerId; canRespond: false };

export type PlayerView = {
  viewer: PlayerId;
  turn: number;
  currentPlayer: PlayerId;
  phase: Phase;
  winner: PlayerId | null;
  you: OwnPlayerView;
  opponent: OpponentPlayerView;
  pendingResponse: PendingResponseView | null;
};

const opponentOf = (player: PlayerId): PlayerId => (player === "P1" ? "P2" : "P1");

const viewMonster = (monster: MonsterOnField | null): MonsterOnField | HiddenMonsterView | null => {
  if (!monster) return null;
  if (!monster.faceDown) return { ...monster };
  return { cardId: null, faceDown: true, position: monster.position, summonedOnTurn: monster.summonedOnTurn };
};

const viewSpellTrap = (card: SpellTrapOnField | null): SpellTrapOnField | HiddenSpellTrapView | null => {
  if (!card) return null;
  if (!card.faceDown) return { ...card };
  return { cardId: null, faceDown: true, setOnTurn: card.setOnTurn };
};

/**
 * Ação interrompida como o defensor pode vê-la: ids de monstros virados do jogador do turno
 * (tributos) são removidos, pois revelariam cartas ocultas.
 */
const sanitizeAction = (action: Action, actor: PlayerState): Action => {
  const hiddenIds = new Set(
    actor.monsters.filter((m): m is MonsterOnField => m !== null && m.faceDown).map((m) => m.cardId),
  );
  if (action.type === "SUMMON_CARD" || action.type === "SET_MONSTER") {
    return { ...action, tributeCardIds: action.tributeCardIds.filter((id) => !hiddenIds.has(id)) };
  }
  return action;
};

const viewPending = (state: MatchState, viewer: PlayerId): PendingResponseView | null => {
  const pending = state.pendingResponse;
  if (!pending) return null;
  if (pending.responder !== viewer) return { responder: pending.responder, canRespond: false };
  return {
    responder: pending.responder,
    canRespond: true,
    trigger: pending.trigger,
    action: sanitizeAction(pending.action, state.players[opponentOf(viewer)]),
  };
};

/**
 * Estado visível a `viewer`. Nunca inclui: semente, ordem dos decks, mão do oponente (só a contagem),
 * identidade de cartas viradas do oponente nem o conteúdo de `pendingResponse` para quem não pode agir.
 * Públicos: pontos de vida, fase, turno, cemitérios, `attackBonus`, `hasAttacked` e
 * `changedPositionOnTurn` de monstros virados para cima, e `normalSummonUsed`.
 */
export const playerView = (state: MatchState, viewer: PlayerId): PlayerView => {
  const own = state.players[viewer];
  const other = state.players[opponentOf(viewer)];
  const { deck, ...ownRest } = own;
  return {
    viewer,
    turn: state.turn,
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    winner: state.winner,
    you: { ...ownRest, hand: [...own.hand], deckCount: deck.length },
    opponent: {
      id: other.id,
      lifePoints: other.lifePoints,
      handCount: other.hand.length,
      deckCount: other.deck.length,
      monsters: other.monsters.map(viewMonster),
      spellTraps: other.spellTraps.map(viewSpellTrap),
      graveyard: [...other.graveyard],
      normalSummonUsed: other.normalSummonUsed,
    },
    pendingResponse: viewPending(state, viewer),
  };
};
