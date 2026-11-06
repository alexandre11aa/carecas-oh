// src/server/sockets/handlers.ts
import type { Server, Socket } from "socket.io";
import type { MatchResult, RoomChange, RoomResult, RoomService } from "../services/roomService.js";
import { createRoomSchema, joinRoomSchema, matchActionSchema, readySchema, rejoinRoomSchema } from "./schemas.js";

export type HandlerOptions = {
  /** Tempo até remover uma sala em que todos os jogadores estão desconectados. */
  abandonTimeoutMs: number;
};

const channel = (code: string) => `room:${code}`;

/** Registra os eventos de sala em cada nova conexão. */
export const registerHandlers = (io: Server, service: RoomService, { abandonTimeoutMs }: HandlerOptions) => {
  const timers = new Map<string, NodeJS.Timeout>();

  const cancelTimer = (code: string) => {
    const timer = timers.get(code);
    if (timer) clearTimeout(timer);
    timers.delete(code);
  };

  const scheduleAbandonCheck = (code: string) => {
    cancelTimer(code);
    const timer = setTimeout(() => {
      timers.delete(code);
      service.removeAbandonedRoom({ code });
    }, abandonTimeoutMs);
    timer.unref();
    timers.set(code, timer);
  };

  const broadcastChange = (change: RoomChange) => {
    if (change.room) io.to(channel(change.code)).emit("room:updated", { room: change.room });
    else cancelTimer(change.code);
  };

  io.on("connection", (socket: Socket) => {
    const fail = (event: string, code: string) => {
      socket.emit("app:error", { event, code });
    };

    const succeed = (reply: string, result: Extract<RoomResult, { ok: true }>) => {
      const { room, token, view } = result;
      cancelTimer(room.code);
      void socket.join(channel(room.code));
      socket.emit(reply, { room, token });
      // Reconexão no meio da partida: restaura o estado atual (sem eventos para animar).
      if (view) socket.emit("match:state", { view, events: [] });
      socket.to(channel(room.code)).emit("room:updated", { room });
    };

    socket.on("room:create", (payload: unknown) => {
      const parsed = createRoomSchema.safeParse(payload);
      if (!parsed.success) return fail("room:create", "INVALID_PAYLOAD");
      const result = service.createRoom({ ...parsed.data, connectionId: socket.id });
      if (!result.ok) return fail("room:create", result.code);
      succeed("room:created", result);
    });

    socket.on("room:join", (payload: unknown) => {
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) return fail("room:join", "INVALID_PAYLOAD");
      const result = service.joinRoom({ ...parsed.data, connectionId: socket.id });
      if (!result.ok) return fail("room:join", result.code);
      succeed("room:joined", result);
    });

    socket.on("room:rejoin", (payload: unknown) => {
      const parsed = rejoinRoomSchema.safeParse(payload);
      if (!parsed.success) return fail("room:rejoin", "INVALID_PAYLOAD");
      const result = service.rejoinRoom({ ...parsed.data, connectionId: socket.id });
      if (!result.ok) return fail("room:rejoin", result.code);
      succeed("room:rejoined", result);
    });

    const deliver = (result: Extract<MatchResult, { ok: true }>) => {
      for (const { connectionId, view, events } of result.deliveries) {
        io.to(connectionId).emit("match:state", { view, events });
      }
    };

    socket.on("room:ready", (payload: unknown) => {
      const parsed = readySchema.safeParse(payload);
      if (!parsed.success) return fail("room:ready", "INVALID_PAYLOAD");
      const result = service.setReady({ connectionId: socket.id, ready: parsed.data.ready });
      if (!result.ok) return fail("room:ready", result.code);
      io.to(channel(result.room.code)).emit("room:updated", { room: result.room });
      deliver(result);
    });

    socket.on("match:action", (payload: unknown) => {
      const parsed = matchActionSchema.safeParse(payload);
      if (!parsed.success) return fail("match:action", "INVALID_PAYLOAD");
      const result = service.submitAction({ connectionId: socket.id, action: parsed.data });
      if (!result.ok) return fail("match:action", result.code);
      deliver(result);
    });

    socket.on("room:leave", () => {
      const change = service.leaveRoom({ connectionId: socket.id });
      if (!change) return;
      void socket.leave(channel(change.code));
      broadcastChange(change);
      // Sobrou só gente desconectada: agenda a remoção para a sala não vazar.
      if (change.room && !change.room.players.some((p) => p.connected)) scheduleAbandonCheck(change.code);
    });

    socket.on("disconnect", () => {
      const change = service.disconnectPlayer({ connectionId: socket.id });
      if (!change) return;
      broadcastChange(change);
      scheduleAbandonCheck(change.code);
    });
  });
};
