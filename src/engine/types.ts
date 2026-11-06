// src/engine/types.ts
// Tipos serializáveis em JSON: cartas, ações e estado da partida.

export type CardType = "MONSTER" | "SPELL" | "TRAP";

export type MonsterCard = {
  id: string;
  name: string;
  type: "MONSTER";
  level: number;
  attack: number;
  defense: number;
  image: string;
  description: string;
};

export type SpellCard = {
  id: string;
  name: string;
  type: "SPELL";
  image: string;
  description: string;
};

export type TrapCard = {
  id: string;
  name: string;
  type: "TRAP";
  image: string;
  description: string;
};

export type Card = MonsterCard | SpellCard | TrapCard;

export type PlayerId = "P1" | "P2";

export type Phase = "DRAW" | "MAIN_1" | "BATTLE" | "MAIN_2" | "END";

export type MonsterPosition = "ATTACK" | "DEFENSE";

export type MonsterOnField = {
  cardId: string;
  position: MonsterPosition;
  faceDown: boolean;
  summonedOnTurn: number;
  hasAttacked: boolean;
  changedPositionOnTurn: number | null;
};

export type SpellTrapOnField = {
  cardId: string;
  faceDown: boolean;
  setOnTurn: number;
};

export type PlayerState = {
  id: PlayerId;
  lifePoints: number;
  deck: string[];
  hand: string[];
  monsters: (MonsterOnField | null)[];
  spellTraps: (SpellTrapOnField | null)[];
  graveyard: string[];
  normalSummonUsed: boolean;
};

export type MatchState = {
  seed: number;
  turn: number;
  currentPlayer: PlayerId;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
  winner: PlayerId | null;
};

export type Action =
  | { type: "SUMMON_CARD"; cardId: string; tributeCardIds: string[]; zone: number }
  | { type: "SET_MONSTER"; cardId: string; tributeCardIds: string[]; zone: number }
  | { type: "SET_TRAP"; cardId: string }
  | { type: "CHANGE_POSITION"; cardId: string }
  | { type: "FLIP_SUMMON"; cardId: string }
  | { type: "ACTIVATE_SPELL"; cardId: string }
  | { type: "ACTIVATE_TRAP"; cardId: string }
  | { type: "ATTACK"; attackerCardId: string; targetCardId: string | null }
  | { type: "NEXT_PHASE" }
  | { type: "END_TURN" };

export type ErrorCode =
  | "MATCH_ENDED"
  | "NOT_YOUR_TURN"
  | "INVALID_PHASE"
  | "ACTION_NOT_AVAILABLE"
  | "CARD_NOT_IN_HAND"
  | "NOT_A_MONSTER"
  | "NORMAL_SUMMON_ALREADY_USED"
  | "INVALID_ZONE"
  | "ZONE_OCCUPIED"
  | "FIELD_FULL"
  | "NOT_ENOUGH_TRIBUTES"
  | "INVALID_TRIBUTES"
  | "MONSTER_NOT_ON_FIELD"
  | "CANNOT_CHANGE_POSITION"
  | "ALREADY_CHANGED_POSITION"
  | "NOT_FACE_DOWN";

export type GameEvent =
  | { type: "CARD_DRAWN"; player: PlayerId; cardId: string }
  | { type: "PHASE_CHANGED"; phase: Phase }
  | { type: "TURN_STARTED"; player: PlayerId; turn: number }
  | { type: "MATCH_ENDED"; winner: PlayerId }
  | { type: "MONSTER_SUMMONED"; player: PlayerId; cardId: string; zone: number; position: MonsterPosition; faceDown: boolean }
  | { type: "CARD_SENT_TO_GRAVEYARD"; player: PlayerId; cardId: string }
  | { type: "POSITION_CHANGED"; player: PlayerId; cardId: string; position: MonsterPosition; faceDown: boolean }
  | { type: "MONSTER_FLIPPED"; player: PlayerId; cardId: string };

export type ActionResult =
  | { ok: true; state: MatchState; events: GameEvent[] }
  | { ok: false; code: ErrorCode };
