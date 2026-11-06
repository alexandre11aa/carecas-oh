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

  it("rejeita_apelido_so_com_espacos", async () => {
    const a = await client();
    const error = once(a, "app:error");
    a.emit("room:create", { nickname: "   " });
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

  it("rejeita_apelido_so_com_espacos", async () => {
    const a = await client();
    const b = await client();
    const { room } = await createRoom(a);
    const error = once(b, "app:error");
    b.emit("room:join", { code: room.code, nickname: "   " });
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

describe("lobby", () => {
  const subscribe = async (socket: Socket) => {
    const reply = once(socket, "lobby:rooms");
    socket.emit("lobby:subscribe");
    return reply;
  };

  it("lista_vazia_ao_assinar_sem_salas_abertas", async () => {
    const watcher = await client();
    const { rooms } = await subscribe(watcher);
    expect(rooms.filter((r: any) => r.hostNickname === "Zeca")).toEqual([]);
  });

  it("lista_sala_aberta_apenas_com_codigo_e_apelido_do_host", async () => {
    const a = await client();
    const { room } = await createRoom(a, "Lia");
    const watcher = await client();
    const { rooms } = await subscribe(watcher);
    expect(rooms.filter((r: any) => r.code === room.code)).toEqual([{ code: room.code, hostNickname: "Lia" }]);
    expect(JSON.stringify(rooms)).not.toContain(a.id);
    expect(JSON.stringify(rooms)).not.toContain("token");
  });

  it("emite_aos_assinantes_quando_sala_e_criada_e_quando_enche", async () => {
    const watcher = await client();
    await subscribe(watcher);
    const a = await client();
    const created = once<{ rooms: any[] }>(watcher, "lobby:rooms");
    const { room } = await createRoom(a, "Mia");
    expect((await created).rooms).toContainEqual({ code: room.code, hostNickname: "Mia" });

    const b = await client();
    const filled = once<{ rooms: any[] }>(watcher, "lobby:rooms");
    b.emit("room:join", { code: room.code, nickname: "Noe" });
    expect((await filled).rooms.some((r) => r.code === room.code)).toBe(false);
  });

  it("sala_com_host_desconectado_some_e_volta_ao_reconectar", async () => {
    const a = await client();
    const { room, token } = await createRoom(a, "Ola");
    const watcher = await client();
    await subscribe(watcher);
    const gone = once<{ rooms: any[] }>(watcher, "lobby:rooms");
    a.close();
    expect((await gone).rooms.some((r) => r.code === room.code)).toBe(false);
    const back = once<{ rooms: any[] }>(watcher, "lobby:rooms");
    const a2 = await client();
    a2.emit("room:rejoin", { token });
    expect((await back).rooms).toContainEqual({ code: room.code, hostNickname: "Ola" });
  });

  it("sala_removida_ao_host_sair_some_da_lista", async () => {
    const a = await client();
    const { room } = await createRoom(a, "Pia");
    const watcher = await client();
    await subscribe(watcher);
    const gone = once<{ rooms: any[] }>(watcher, "lobby:rooms");
    a.emit("room:leave");
    expect((await gone).rooms.some((r) => r.code === room.code)).toBe(false);
  });

  it("sala_com_partida_nao_aparece", async () => {
    const a = await client();
    const b = await client();
    const { room } = await createRoom(a, "Rui");
    b.emit("room:join", { code: room.code, nickname: "Sol" });
    await once(b, "room:joined");
    a.emit("room:ready");
    b.emit("room:ready");
    await once(a, "match:state");
    // O oponente desiste: sobra 1 jogador conectado, mas a sala guarda a partida encerrada.
    b.emit("room:leave");
    await once(a, "match:ended");
    const watcher = await client();
    const { rooms } = await subscribe(watcher);
    expect(rooms.some((r: any) => r.code === room.code)).toBe(false);
  });

  it("unsubscribe_cancela_os_broadcasts", async () => {
    const watcher = await client();
    await subscribe(watcher);
    watcher.emit("lobby:unsubscribe");
    const spy = new Promise<boolean>((resolve) => {
      watcher.once("lobby:rooms", () => resolve(true));
      setTimeout(() => resolve(false), 150);
    });
    const a = await client();
    await createRoom(a, "Tai");
    expect(await spy).toBe(false);
  });

  it("quem_cria_sala_sai_do_lobby", async () => {
    const a = await client();
    await subscribe(a);
    await createRoom(a, "Uma");
    const spy = new Promise<boolean>((resolve) => {
      a.once("lobby:rooms", () => resolve(true));
      setTimeout(() => resolve(false), 150);
    });
    const b = await client();
    await createRoom(b, "Vic");
    expect(await spy).toBe(false);
  });

  it("rejeita_payload_em_subscribe_e_unsubscribe", async () => {
    const a = await client();
    const first = once(a, "app:error");
    a.emit("lobby:subscribe", { x: 1 });
    expect(await first).toEqual({ event: "lobby:subscribe", code: "INVALID_PAYLOAD" });
    const second = once(a, "app:error");
    a.emit("lobby:unsubscribe", "oi");
    expect(await second).toEqual({ event: "lobby:unsubscribe", code: "INVALID_PAYLOAD" });
  });
});
