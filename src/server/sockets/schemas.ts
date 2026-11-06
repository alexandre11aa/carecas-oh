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
