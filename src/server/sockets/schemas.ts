// src/server/sockets/schemas.ts
import { z } from "zod";

const nickname = z.string().trim().min(1).max(20);

export const createRoomSchema = z.object({ nickname });

export const joinRoomSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{4}$/),
  nickname,
});

export const rejoinRoomSchema = z.object({ token: z.string().min(1).max(100) });

/** `room:ready` sem payload marca pronto; `{ ready: false }` desmarca. */
export const readySchema = z.union([z.undefined().transform(() => ({ ready: true })), z.object({ ready: z.boolean() })]);

/** `match:rematch` sem payload vota por revanche; `{ accept: false }` retira o voto. */
export const rematchSchema = z.union([z.undefined().transform(() => ({ accept: true })), z.object({ accept: z.boolean() }).strict()]);

const cardId = z.string().min(1).max(100);
const cardIds = z.array(cardId).max(10);
const zone = z.number().int().min(0).max(4);

/** Espelha a união `Action` da engine; o jogador nunca vem na mensagem. */
export const matchActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SUMMON_CARD"), cardId, tributeCardIds: cardIds, zone }).strict(),
  z.object({ type: z.literal("SET_MONSTER"), cardId, tributeCardIds: cardIds, zone }).strict(),
  z.object({ type: z.literal("SET_SPELL_TRAP"), cardId }).strict(),
  z.object({ type: z.literal("CHANGE_POSITION"), cardId }).strict(),
  z.object({ type: z.literal("FLIP_SUMMON"), cardId }).strict(),
  z.object({ type: z.literal("ACTIVATE_SPELL"), cardId, targetCardId: cardId.nullish() }).strict(),
  z.object({ type: z.literal("ACTIVATE_TRAP"), cardId }).strict(),
  z.object({ type: z.literal("PASS_RESPONSE") }).strict(),
  z.object({ type: z.literal("ATTACK"), attackerCardId: cardId, targetCardId: cardId.nullable() }).strict(),
  z.object({ type: z.literal("NEXT_PHASE") }).strict(),
  z.object({ type: z.literal("END_TURN") }).strict(),
]);
