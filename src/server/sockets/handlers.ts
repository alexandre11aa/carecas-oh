// src/server/sockets/handlers.ts
import type { Server, Socket } from "socket.io";
import type { Delivery, MatchResult, RoomChange, RoomResult, RoomService } from "../services/roomService.js";
import { createRoomSchema, lobbySchema, joinRoomSchema, matchActionSchema, readySchema, rejoinRoomSchema, rematchSchema } from "./schemas.js";

export type HandlerOptions = {
  /** Tempo até remover uma sala em que todos os jogadores estão desconectados. */
  abandonTimeoutMs: number;
};

const channel = (code: string) => `room:${code}`;
const LOBBY = "lobby";

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
      if (service.removeAbandonedRoom({ code })) broadcastLobby();
    }, abandonTimeoutMs);
    timer.unref();
    timers.set(code, timer);
  };

  // Última lista enviada ao lobby; só há broadcast quando ela muda.
  let lastLobby = "[]";

  /** Emite `lobby:rooms` aos assinantes se a lista de salas abertas mudou. */
  const broadcastLobby = () => {
    const rooms = service.listOpenRooms();
    const serialized = JSON.stringify(rooms);
    if (serialized === lastLobby) return;
    lastLobby = serialized;
    io.to(LOBBY).emit("lobby:rooms", { rooms });
  };

  /** Envia a cada jogador seu estado (se houver) e o fim de partida (se houver). */
  const sendDeliveries = (deliveries: Delivery[]) => {
    for (const { connectionId, view, events, ended, turnDeadline, serverNow } of deliveries) {
      if (view) io.to(connectionId).emit("match:state", { view, events, turnDeadline, serverNow });
      if (ended) io.to(connectionId).emit("match:ended", ended);
    }
  };

  const broadcastChange = (change: RoomChange) => {
    if (change.room) io.to(channel(change.code)).emit("room:updated", { room: change.room });
    else cancelTimer(change.code);
    sendDeliveries(change.deliveries ?? []);
    broadcastLobby();
  };

  // O prazo do turno vence no servidor: ele joga por conta própria e entrega o novo estado aos jogadores.
  service.onTurnExpired(({ deliveries }) => sendDeliveries(deliveries));

  io.on("connection", (socket: Socket) => {
    const fail = (event: string, code: string) => {
      socket.emit("app:error", { event, code });
    };

    const succeed = (reply: string, result: Extract<RoomResult, { ok: true }>) => {
      const { room, token, deckId, view, ended, turnDeadline = null, serverNow = Date.now() } = result;
      cancelTimer(room.code);
      void socket.leave(LOBBY);
      void socket.join(channel(room.code));
      // `deckId` (a escolha do próprio jogador) só vai na reconexão; o do oponente nunca sai.
      socket.emit(reply, deckId === undefined ? { room, token } : { room, token, deckId });
      // Reconexão no meio da partida: restaura o estado atual (sem eventos para animar).
      if (view) socket.emit("match:state", { view, events: [], turnDeadline, serverNow });
      if (ended) socket.emit("match:ended", ended);
      socket.to(channel(room.code)).emit("room:updated", { room });
      broadcastLobby();
    };

    socket.on("lobby:subscribe", (payload: unknown) => {
      if (!lobbySchema.safeParse(payload).success) return fail("lobby:subscribe", "INVALID_PAYLOAD");
      void socket.join(LOBBY);
      socket.emit("lobby:rooms", { rooms: service.listOpenRooms() });
    });

    socket.on("lobby:unsubscribe", (payload: unknown) => {
      if (!lobbySchema.safeParse(payload).success) return fail("lobby:unsubscribe", "INVALID_PAYLOAD");
      void socket.leave(LOBBY);
    });

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

    const deliver = (result: Extract<MatchResult, { ok: true }>) => sendDeliveries(result.deliveries);

    socket.on("room:ready", (payload: unknown) => {
      const parsed = readySchema.safeParse(payload);
      if (!parsed.success) return fail("room:ready", "INVALID_PAYLOAD");
      const { ready, deckId } = parsed.data;
      const result =
        ready && deckId
          ? service.setReady({ connectionId: socket.id, ready: true, deckId })
          : service.setReady({ connectionId: socket.id, ready: false });
      if (!result.ok) return fail("room:ready", result.code);
      io.to(channel(result.room.code)).emit("room:updated", { room: result.room });
      deliver(result);
      broadcastLobby();
    });

    socket.on("match:action", (payload: unknown) => {
      const parsed = matchActionSchema.safeParse(payload);
      if (!parsed.success) return fail("match:action", "INVALID_PAYLOAD");
      const result = service.submitAction({ connectionId: socket.id, action: parsed.data });
      if (!result.ok) return fail("match:action", result.code);
      deliver(result);
    });

    socket.on("match:rematch", (payload: unknown) => {
      const parsed = rematchSchema.safeParse(payload);
      if (!parsed.success) return fail("match:rematch", "INVALID_PAYLOAD");
      const { accept, deckId } = parsed.data;
      const result =
        accept && deckId
          ? service.requestRematch({ connectionId: socket.id, accept: true, deckId })
          : service.requestRematch({ connectionId: socket.id, accept: false });
      if (!result.ok) return fail("match:rematch", result.code);
      deliver(result);
      broadcastLobby();
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
