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

/** Efeito de magia como dado: o motor interpreta, sem código por carta. */
export type SpellEffect =
  | { kind: "BOOST_ATTACK"; amount: number } // alvo: monstro próprio; vale até o fim do turno
  | { kind: "HEAL"; amount: number } // cura o conjurador
  | { kind: "DAMAGE"; amount: number } // dano direto ao oponente
  | { kind: "DESTROY_MONSTER" } // alvo: monstro do oponente
  | { kind: "DRAW"; count: number }; // o conjurador compra cartas

export type SpellCard = {
  id: string;
  name: string;
  type: "SPELL";
  effect: SpellEffect;
  image: string;
  description: string;
};

/** Momento da ação do jogador do turno que abre a janela de resposta. */
export type TrapTrigger = "ATTACK_DECLARED" | "SUMMON" | "SPELL_ACTIVATION";

/** Efeito de armadilha como dado: o motor interpreta, sem código por carta. */
export type TrapEffect =
  | { kind: "NEGATE_ATTACK" } // o ataque não acontece
  | { kind: "DESTROY_ATTACKER" } // destrói o monstro atacante antes do combate
  | { kind: "NEGATE_SUMMON" } // a invocação é anulada e o monstro vai ao cemitério
  | { kind: "NEGATE_SPELL" } // a ativação é anulada e a magia vai ao cemitério
  | { kind: "DAMAGE"; amount: number }; // dano direto ao dono da ação interrompida

export type TrapCard = {
  id: string;
  name: string;
  type: "TRAP";
  trigger: TrapTrigger;
  effect: TrapEffect;
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
  /** Bônus de ATK temporário (magias); zerado ao fim do turno. Ausente equivale a 0. */
  attackBonus?: number;
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

/** Janela em que o defensor decide ativar uma armadilha antes de a ação do jogador do turno resolver. */
export type PendingResponse = {
  trigger: TrapTrigger;
  responder: PlayerId;
  /** Ação interrompida, do jogador do turno; só é aplicada depois da resposta. */
  action: Action;
};

export type MatchState = {
  seed: number;
  turn: number;
  currentPlayer: PlayerId;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
  winner: PlayerId | null;
  pendingResponse: PendingResponse | null;
};

export type Action =
  | { type: "SUMMON_CARD"; cardId: string; tributeCardIds: string[]; zone: number }
  | { type: "SET_MONSTER"; cardId: string; tributeCardIds: string[]; zone: number }
  | { type: "SET_SPELL_TRAP"; cardId: string }
  | { type: "CHANGE_POSITION"; cardId: string }
  | { type: "FLIP_SUMMON"; cardId: string }
  | { type: "ACTIVATE_SPELL"; cardId: string; targetCardId?: string | null }
  | { type: "ACTIVATE_TRAP"; cardId: string }
  | { type: "PASS_RESPONSE" }
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
  | "NOT_FACE_DOWN"
  | "ATTACK_NOT_ALLOWED_ON_FIRST_TURN"
  | "NOT_IN_ATTACK_POSITION"
  | "ALREADY_ATTACKED"
  | "INVALID_TARGET"
  | "DIRECT_ATTACK_NOT_ALLOWED"
  | "NOT_A_SPELL_OR_TRAP"
  | "NOT_A_SPELL"
  | "SPELL_NOT_AVAILABLE"
  | "SPELL_TRAP_ZONES_FULL"
  | "RESPONSE_PENDING"
  | "NO_RESPONSE_WINDOW"
  | "TRAP_NOT_AVAILABLE"
  | "NOT_A_TRAP"
  | "TRAP_NOT_ACTIVE_YET"
  | "TRAP_TRIGGER_MISMATCH";

export type GameEvent =
  | { type: "CARD_DRAWN"; player: PlayerId; cardId: string }
  | { type: "PHASE_CHANGED"; phase: Phase }
  | { type: "TURN_STARTED"; player: PlayerId; turn: number }
  | { type: "MATCH_ENDED"; winner: PlayerId }
  | { type: "MONSTER_SUMMONED"; player: PlayerId; cardId: string; zone: number; position: MonsterPosition; faceDown: boolean }
  | { type: "CARD_SENT_TO_GRAVEYARD"; player: PlayerId; cardId: string }
  | { type: "POSITION_CHANGED"; player: PlayerId; cardId: string; position: MonsterPosition; faceDown: boolean }
  | { type: "MONSTER_FLIPPED"; player: PlayerId; cardId: string }
  | { type: "ATTACK_DECLARED"; player: PlayerId; attackerCardId: string; targetCardId: string | null }
  | { type: "DAMAGE_DEALT"; player: PlayerId; amount: number }
  | { type: "SPELL_TRAP_SET"; player: PlayerId; cardId: string; zone: number }
  | { type: "SPELL_ACTIVATED"; player: PlayerId; cardId: string; targetCardId: string | null }
  | { type: "LIFE_RESTORED"; player: PlayerId; amount: number }
  | { type: "ATTACK_BOOSTED"; player: PlayerId; cardId: string; amount: number }
  | { type: "RESPONSE_WINDOW_OPENED"; responder: PlayerId; trigger: TrapTrigger }
  | { type: "RESPONSE_PASSED"; player: PlayerId }
  | { type: "TRAP_ACTIVATED"; player: PlayerId; cardId: string; trigger: TrapTrigger }
  | { type: "ATTACK_NEGATED"; player: PlayerId; attackerCardId: string }
  | { type: "SUMMON_NEGATED"; player: PlayerId; cardId: string }
  | { type: "SPELL_NEGATED"; player: PlayerId; cardId: string };

export type ActionResult =
  | { ok: true; state: MatchState; events: GameEvent[] }
  | { ok: false; code: ErrorCode };
