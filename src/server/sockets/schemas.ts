// src/server/sockets/schemas.ts
import { z } from "zod";
import type { DeckId } from "../../engine/index.js";

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

/** `lobby:subscribe` e `lobby:unsubscribe` não levam payload. */
export const lobbySchema = z.undefined();

export const rejoinRoomSchema = z.object({ token: z.string().min(1).max(100) });

/** Ids dos 6 decks fixos da engine (um teste confere que acompanha `DECKS`). */
export const DECK_IDS = ["aggressive", "defensive", "magic", "control", "balanced", "strategic"] as const satisfies readonly DeckId[];
const deckId = z.enum(DECK_IDS);

/** `room:ready`: `{ deckId }` marca pronto com o deck escolhido; `{ ready: false }` desmarca (deck dispensável). */
export const readySchema = z
  .object({ ready: z.boolean().default(true), deckId: deckId.optional() })
  .refine((data) => !data.ready || data.deckId !== undefined);

/** `match:rematch`: `{ deckId }` vota por revanche com o deck escolhido; `{ accept: false }` retira o voto. */
export const rematchSchema = z
  .object({ accept: z.boolean().default(true), deckId: deckId.optional() })
  .strict()
  .refine((data) => !data.accept || data.deckId !== undefined);

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
  z.object({ type: z.literal("ACTIVATE_SPELL"), cardId, targetZone: zone.nullish() }).strict(),
  z.object({ type: z.literal("ACTIVATE_TRAP"), cardId }).strict(),
  z.object({ type: z.literal("PASS_RESPONSE") }).strict(),
  z.object({ type: z.literal("ATTACK"), attackerCardId: cardId, targetZone: zone.nullable() }).strict(),
  z.object({ type: z.literal("NEXT_PHASE") }).strict(),
  z.object({ type: z.literal("END_TURN") }).strict(),
]);
