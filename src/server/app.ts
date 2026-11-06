// src/server/app.ts
import express from "express";
import { createServer, type Server as HttpServer } from "node:http";
import path from "node:path";
import { Server as SocketServer } from "socket.io";
import { createRoomService } from "./services/roomService.js";
import { registerHandlers } from "./sockets/handlers.js";
import { createRoomStore } from "./store/roomStore.js";

export type AppOptions = {
  /** Pasta com o frontend compilado (contém index.html). */
  clientDir: string;
  /** Tempo até remover salas sem jogadores conectados (padrão: 60 s). */
  abandonTimeoutMs?: number;
};

export type App = {
  httpServer: HttpServer;
  io: SocketServer;
};

/** Cria o Express, o servidor HTTP e o Socket.IO anexado a ele, sem escutar em porta. */
export const createApp = ({ clientDir, abandonTimeoutMs = 60_000 }: AppOptions): App => {
  const app = express();

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(express.static(clientDir));

  // Rotas de sala (/sala/CODIGO) são resolvidas pelo cliente.
  app.get("/sala/:code", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });

  const httpServer = createServer(app);
  const io = new SocketServer(httpServer);

  registerHandlers(io, createRoomService(createRoomStore()), { abandonTimeoutMs });

  return { httpServer, io };
};
