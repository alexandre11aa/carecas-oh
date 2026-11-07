// src/server/sockets/aiRoom.test.ts
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AI_LEVELS } from "../../engine/index.js";
import { createApp, type App } from "../app.js";
import { AI_LEVEL_IDS, createAiRoomSchema } from "./schemas.js";

let app: App;
let url: string;
const open: Socket[] = [];
const logs = new Map<Socket, { event: string; args: unknown[] }[]>();

beforeAll(async () => {
  app = createApp({ clientDir: ".", abandonTimeoutMs: 5000 });
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
  logs.set(socket, []);
  socket.onAny((event, ...args) => logs.get(socket)!.push({ event, args }));
  await new Promise<void>((resolve) => socket.on("connect", () => resolve()));
  return socket;
};

const once = <T = any>(socket: Socket, event: string): Promise<T> =>
  new Promise((resolve) => socket.once(event, resolve));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const names = (socket: Socket) => logs.get(socket)!.map((l) => l.event);

const createAi = async (socket: Socket, payload: unknown = { nickname: "Ana", level: "easy", deckId: "magic" }) => {
  const created = once(socket, "room:created");
  const state = once(socket, "match:state");
  socket.emit("room:createAi", payload);
  const { room, token } = await created;
  const { view, events, turnDeadline } = await state;
  return { room, token, view, events, turnDeadline, code: room.code as string };
};

describe("schemas de room:createAi", () => {
  it("AI_LEVEL_IDS_acompanha_os_niveis_da_engine", () => {
    expect([...AI_LEVEL_IDS].sort()).toEqual([...AI_LEVELS].sort());
  });

  it("aceita_o_payload_valido_e_apara_o_apelido", () => {
    expect(createAiRoomSchema.parse({ nickname: "  Ana ", level: "hard", deckId: "control" })).toEqual({
      nickname: "Ana",
      level: "hard",
      deckId: "control",
    });
  });
});

describe("room:createAi", () => {
  it("responde_room_created_e_o_match_state_inicial_na_hora", async () => {
    const a = await client();
    const { room, token, view, events } = await createAi(a);
    expect(room).toMatchObject({ hasMatch: true, vsAi: true, aiLevel: "easy", players: [{ nickname: "Ana", connected: true, ready: false }] });
    expect(token).toEqual(expect.any(String));
    expect(view.viewer).toBe("P1");
    expect(view.you.hand).toHaveLength(5);
    expect(events).toEqual([]);
    expect(names(a)).toEqual(["room:created", "match:state"]);
  });

  it.each([
    ["sem_nivel", { nickname: "Ana", deckId: "magic" }],
    ["nivel_invalido", { nickname: "Ana", level: "expert", deckId: "magic" }],
    ["sem_deck", { nickname: "Ana", level: "easy" }],
    ["deck_invalido", { nickname: "Ana", level: "easy", deckId: "inexistente" }],
    ["apelido_vazio", { nickname: "  ", level: "easy", deckId: "magic" }],
    ["apelido_longo", { nickname: "x".repeat(21), level: "easy", deckId: "magic" }],
    ["sem_payload", undefined],
  ])("payload_invalido_%s_devolve_INVALID_PAYLOAD", async (_name, payload) => {
    const a = await client();
    const error = once(a, "app:error");
    a.emit("room:createAi", payload);
    expect(await error).toEqual({ event: "room:createAi", code: "INVALID_PAYLOAD" });
    expect(names(a)).toEqual(["app:error"]);
  });

  it("a_sala_fica_fora_de_lobby_rooms_e_room_join_devolve_ROOM_FULL", async () => {
    const watcher = await client();
    const first = once(watcher, "lobby:rooms");
    watcher.emit("lobby:subscribe");
    await first;
    const a = await client();
    const { code } = await createAi(a);
    await sleep(100);
    expect(logs.get(watcher)!.filter((l) => l.event === "lobby:rooms")).toHaveLength(1);
    expect(JSON.stringify(logs.get(watcher))).not.toContain(code);

    const b = await client();
    const error = once(b, "app:error");
    b.emit("room:join", { code, nickname: "Bia" });
    expect(await error).toEqual({ event: "room:join", code: "ROOM_FULL" });
  });

  it("room_ready_devolve_MATCH_ALREADY_STARTED", async () => {
    const a = await client();
    await createAi(a);
    const error = once(a, "app:error");
    a.emit("room:ready", { deckId: "magic" });
    expect(await error).toEqual({ event: "room:ready", code: "MATCH_ALREADY_STARTED" });
  });

  it("room_rejoin_restaura_a_partida_contra_a_IA", async () => {
    const a = await client();
    const { token, view } = await createAi(a);
    a.close();
    const b = await client();
    const rejoined = once(b, "room:rejoined");
    const state = once(b, "match:state");
    b.emit("room:rejoin", { token });
    expect((await rejoined).room).toMatchObject({ hasMatch: true, vsAi: true, aiLevel: "easy" });
    const restored = await state;
    expect(restored.view).toEqual(view);
    expect(restored.events).toEqual([]);
  });

  it("room_leave_remove_a_sala", async () => {
    const a = await client();
    const { token, code } = await createAi(a);
    a.emit("room:leave");
    await sleep(100);
    const b = await client();
    const error = once(b, "app:error");
    b.emit("room:rejoin", { token });
    expect(await error).toEqual({ event: "room:rejoin", code: "INVALID_TOKEN" });
    const c = await client();
    const missing = once(c, "app:error");
    c.emit("room:join", { code, nickname: "Bia" });
    expect(await missing).toEqual({ event: "room:join", code: "ROOM_NOT_FOUND" });
  });

  it("nao_vaza_semente_nem_dados_do_bot_e_o_oponente_so_tem_contagens", async () => {
    const a = await client();
    const { view } = await createAi(a);
    expect(JSON.stringify(logs.get(a))).not.toMatch(/seed|botToken/i);
    expect(view.opponent.handCount).toBe(5);
    expect(view.opponent).not.toHaveProperty("hand");
    expect(view.opponent).not.toHaveProperty("deck");
  });

  it("match_rematch_valida_o_payload_e_recusa_com_a_partida_em_andamento", async () => {
    const a = await client();
    await createAi(a);
    const invalid = once(a, "app:error");
    a.emit("match:rematch", { accept: true });
    expect(await invalid).toEqual({ event: "match:rematch", code: "INVALID_PAYLOAD" });
    const running = once(a, "app:error");
    a.emit("match:rematch", { deckId: "magic" });
    expect(await running).toEqual({ event: "match:rematch", code: "MATCH_NOT_ENDED" });
  });
});
