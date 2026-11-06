// src/server/sockets/handlers.test.ts
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp, type App } from "../app.js";

let app: App;
let url: string;
const open: Socket[] = [];

beforeAll(async () => {
  app = createApp({ clientDir: ".", abandonTimeoutMs: 50 });
  await new Promise<void>((resolve) => app.httpServer.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(app.httpServer.address() as AddressInfo).port}`;
});

afterEach(() => {
  open.splice(0).forEach((s) => s.close());
});

afterAll(async () => {
  await app.io.close();
});

const client = async (): Promise<Socket> => {
  const socket = connect(url, { transports: ["websocket"], forceNew: true });
  open.push(socket);
  await new Promise<void>((resolve) => socket.on("connect", () => resolve()));
  return socket;
};

const once = <T = any>(socket: Socket, event: string): Promise<T> =>
  new Promise((resolve) => socket.once(event, resolve));

const createRoom = async (socket: Socket, nickname = "Ana") => {
  const reply = once(socket, "room:created");
  socket.emit("room:create", { nickname });
  return reply;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("room:create", () => {
  it("cria_sala_com_codigo_curto_e_token", async () => {
    const a = await client();
    const { room, token } = await createRoom(a);
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    expect(room.players).toEqual([{ nickname: "Ana", connected: true, ready: false }]);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThanOrEqual(16);
  });

  it("gera_tokens_diferentes_por_jogador", async () => {
    const a = await client();
    const b = await client();
    const created = await createRoom(a);
    const reply = once(b, "room:joined");
    b.emit("room:join", { code: created.room.code, nickname: "Bia" });
    const joined = await reply;
    expect(joined.token).not.toBe(created.token);
  });

  it("rejeita_payload_invalido", async () => {
    const a = await client();
    const error = once(a, "app:error");
    a.emit("room:create", { nickname: "" });
    expect(await error).toEqual({ event: "room:create", code: "INVALID_PAYLOAD" });
  });

  it("rejeita_payload_ausente", async () => {
    const a = await client();
    const error = once(a, "app:error");
    a.emit("room:create");
    expect(await error).toEqual({ event: "room:create", code: "INVALID_PAYLOAD" });
  });
});

describe("room:join", () => {
  it("entra_na_sala_e_notifica_os_dois_jogadores", async () => {
    const a = await client();
    const b = await client();
    const { room } = await createRoom(a);
    const updatedA = once(a, "room:updated");
    const joinedB = once(b, "room:joined");
    b.emit("room:join", { code: room.code.toLowerCase(), nickname: "Bia" });
    const joined = await joinedB;
    const expected = [
      { nickname: "Ana", connected: true, ready: false },
      { nickname: "Bia", connected: true, ready: false },
    ];
    expect(joined.room.players).toEqual(expected);
    expect((await updatedA).room.players).toEqual(expected);
  });

  it("retorna_ROOM_NOT_FOUND_para_sala_inexistente", async () => {
    const a = await client();
    const error = once(a, "app:error");
    a.emit("room:join", { code: "ZZZZ", nickname: "Bia" });
    expect(await error).toEqual({ event: "room:join", code: "ROOM_NOT_FOUND" });
  });

  it("retorna_ROOM_FULL_quando_a_sala_esta_cheia", async () => {
    const a = await client();
    const b = await client();
    const c = await client();
    const { room } = await createRoom(a);
    const joined = once(b, "room:joined");
    b.emit("room:join", { code: room.code, nickname: "Bia" });
    await joined;
    const error = once(c, "app:error");
    c.emit("room:join", { code: room.code, nickname: "Caio" });
    expect(await error).toEqual({ event: "room:join", code: "ROOM_FULL" });
  });

  it("rejeita_payload_invalido", async () => {
    const a = await client();
    const error = once(a, "app:error");
    a.emit("room:join", { code: "x", nickname: "Bia" });
    expect(await error).toEqual({ event: "room:join", code: "INVALID_PAYLOAD" });
  });
});

describe("room:rejoin", () => {
  it("restaura_a_conexao_por_token", async () => {
    const a = await client();
    const b = await client();
    const created = await createRoom(a);
    const joined = once(b, "room:joined");
    b.emit("room:join", { code: created.room.code, nickname: "Bia" });
    await joined;

    const offline = once(b, "room:updated");
    a.close();
    expect((await offline).room.players[0]).toEqual({ nickname: "Ana", connected: false, ready: false });

    const a2 = await client();
    const rejoined = once(a2, "room:rejoined");
    const online = once(b, "room:updated");
    a2.emit("room:rejoin", { token: created.token });
    const reply = await rejoined;
    expect(reply.token).toBe(created.token);
    expect(reply.room.code).toBe(created.room.code);
    expect(reply.room.players).toEqual([
      { nickname: "Ana", connected: true, ready: false },
      { nickname: "Bia", connected: true, ready: false },
    ]);
    expect((await online).room.players[0].connected).toBe(true);
  });

  it("retorna_INVALID_TOKEN_para_token_desconhecido", async () => {
    const a = await client();
    const error = once(a, "app:error");
    a.emit("room:rejoin", { token: "inexistente" });
    expect(await error).toEqual({ event: "room:rejoin", code: "INVALID_TOKEN" });
  });

  it("rejeita_payload_invalido", async () => {
    const a = await client();
    const error = once(a, "app:error");
    a.emit("room:rejoin", {});
    expect(await error).toEqual({ event: "room:rejoin", code: "INVALID_PAYLOAD" });
  });
});

describe("limpeza de salas", () => {
  it("remove_sala_abandonada_apos_o_tempo_limite", async () => {
    const a = await client();
    const created = await createRoom(a);
    a.close();
    await sleep(200);
    const b = await client();
    const error = once(b, "app:error");
    b.emit("room:rejoin", { token: created.token });
    expect(await error).toEqual({ event: "room:rejoin", code: "INVALID_TOKEN" });
  });

  it("mantem_sala_se_o_jogador_reconectar_antes_do_limite", async () => {
    const a = await client();
    const created = await createRoom(a);
    a.close();
    await sleep(10);
    const a2 = await client();
    const rejoined = once(a2, "room:rejoined");
    a2.emit("room:rejoin", { token: created.token });
    await rejoined;
    await sleep(200);
    const b = await client();
    const joined = once(b, "room:joined");
    b.emit("room:join", { code: created.room.code, nickname: "Bia" });
    expect((await joined).room.players).toHaveLength(2);
  });

  it("remove_sala_vazia_quando_o_ultimo_jogador_sai", async () => {
    const a = await client();
    const b = await client();
    const { room } = await createRoom(a);
    a.emit("room:leave");
    await sleep(50);
    const error = once(b, "app:error");
    b.emit("room:join", { code: room.code, nickname: "Bia" });
    expect(await error).toEqual({ event: "room:join", code: "ROOM_NOT_FOUND" });
  });

  it("remove_sala_quando_o_ultimo_conectado_sai_e_sobra_so_desconectado", async () => {
    const a = await client();
    const b = await client();
    const created = await createRoom(a);
    const joined = once(b, "room:joined");
    b.emit("room:join", { code: created.room.code, nickname: "Bia" });
    const { token } = await joined;
    const offline = once(a, "room:updated");
    b.close();
    await offline;
    await sleep(150); // timer dispara, mas A ainda está conectado
    a.emit("room:leave");
    await sleep(150);
    const b2 = await client();
    const error = once(b2, "app:error");
    b2.emit("room:rejoin", { token });
    expect(await error).toEqual({ event: "room:rejoin", code: "INVALID_TOKEN" });
  });

  it("libera_vaga_quando_um_jogador_sai", async () => {
    const a = await client();
    const b = await client();
    const c = await client();
    const created = await createRoom(a);
    const joined = once(b, "room:joined");
    b.emit("room:join", { code: created.room.code, nickname: "Bia" });
    await joined;
    const updated = once(b, "room:updated");
    a.emit("room:leave");
    expect((await updated).room.players).toEqual([{ nickname: "Bia", connected: true, ready: false }]);
    const joinedC = once(c, "room:joined");
    c.emit("room:join", { code: created.room.code, nickname: "Caio" });
    expect((await joinedC).room.players).toHaveLength(2);
  });
});
