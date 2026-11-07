// src/server/app.ts
import express from "express";
import { createServer, type Server as HttpServer } from "node:http";
import path from "node:path";
import { Server as SocketServer } from "socket.io";
import { createRoomService } from "./services/roomService.js";
import { registerHandlers } from "./sockets/handlers.js";
import { createRoomStore } from "./store/roomStore.js";

const HOME_PATH = "/";
const ROOM_CODE_PATTERN = /^[A-Za-z0-9]{4}$/;

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

  // Rotas de sala: /sala/CODIGO (4 alfanuméricos, como em joinRoomSchema) devolve o index.html e o
  // cliente resolve a sala. Qualquer outra forma (/sala, /sala/, /sala/ab, /sala/ABCDE) redireciona
  // para o menu principal. O destino é sempre a constante "/", nunca derivado da requisição.
  app.get(/^\/sala\/?$/, (_req, res) => {
    res.redirect(302, HOME_PATH);
  });

  app.get("/sala/:code", (req, res) => {
    if (!ROOM_CODE_PATTERN.test(req.params.code)) {
      res.redirect(302, HOME_PATH);
      return;
    }
    res.sendFile(path.join(clientDir, "index.html"));
  });

  // Páginas do site (/guia e /cartas, com ou sem barra final) devolvem o index.html e o cliente
  // escolhe a tela pela URL. Rotas desconhecidas seguem sem fallback (404 do Express).
  app.get(/^\/(guia|cartas)\/?$/, (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });

  const httpServer = createServer(app);
  const io = new SocketServer(httpServer);

  registerHandlers(io, createRoomService(createRoomStore()), { abandonTimeoutMs });

  return { httpServer, io };
};
