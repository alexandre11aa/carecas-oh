// src/server/sockets/deckChoice.test.ts
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DECKS } from "../../engine/index.js";
import { createApp, type App } from "../app.js";
import { DECK_IDS, readySchema, rematchSchema } from "./schemas.js";

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
const dump = (socket: Socket) => JSON.stringify(logs.get(socket)!);

/** Dois jogadores na sala, sem ninguém pronto. */
const twoPlayers = async () => {
  const a = await client();
  const b = await client();
  const created = once(a, "room:created");
  a.emit("room:create", { nickname: "Ana" });
  const { room, token: tokenA } = await created;
  const joined = once(b, "room:joined");
  b.emit("room:join", { code: room.code, nickname: "Bia" });
  const { token: tokenB } = await joined;
  return { a, b, tokenA, tokenB, code: room.code as string };
};

describe("schemas de escolha de deck", () => {
  it("DECK_IDS_acompanha_os_decks_da_engine", () => {
    expect([...DECK_IDS].sort()).toEqual(DECKS.map((d) => d.id).sort());
  });

  it("room_ready_exige_deckId_valido_ao_marcar_pronto", () => {
    expect(readySchema.safeParse({ deckId: "magic" })).toMatchObject({ success: true, data: { ready: true, deckId: "magic" } });
    expect(readySchema.safeParse({ ready: false }).success).toBe(true);
    expect(readySchema.safeParse(undefined).success).toBe(false);
    expect(readySchema.safeParse({ ready: true }).success).toBe(false);
    expect(readySchema.safeParse({ deckId: "outro" }).success).toBe(false);
  });

  it("match_rematch_exige_deckId_valido_ao_aceitar", () => {
    expect(rematchSchema.safeParse({ deckId: "control" }).success).toBe(true);
    expect(rematchSchema.safeParse({ accept: false }).success).toBe(true);
    expect(rematchSchema.safeParse(undefined).success).toBe(false);
    expect(rematchSchema.safeParse({ accept: true }).success).toBe(false);
    expect(rematchSchema.safeParse({ deckId: 3 }).success).toBe(false);
  });
});

describe("room:ready com deckId", () => {
  it("recusa_deckId_ausente_ou_invalido_com_INVALID_PAYLOAD_sem_marcar_pronto", async () => {
    const { a } = await twoPlayers();
    for (const payload of [undefined, { ready: true }, { deckId: "inexistente" }, { deckId: 7 }]) {
      const error = once(a, "app:error");
      a.emit("room:ready", payload);
      expect(await error).toEqual({ event: "room:ready", code: "INVALID_PAYLOAD" });
    }
    await sleep(50);
    expect(logs.get(a)!.filter((l) => l.event === "room:updated" && JSON.stringify(l.args).includes('"ready":true'))).toEqual([]);
  });

  it("desmarcar_pronto_dispensa_deckId", async () => {
    const { a } = await twoPlayers();
    const readyState = (value: boolean) =>
      new Promise<void>((resolve) =>
        a.on("room:updated", ({ room }) => {
          if (room.players[0].ready === value) resolve();
        }),
      );
    const marked = readyState(true);
    a.emit("room:ready", { deckId: "magic" });
    await marked;
    const unmarked = readyState(false);
    a.emit("room:ready", { ready: false });
    await unmarked;
  });

  it("jogador_sem_sala_recebe_NOT_IN_ROOM", async () => {
    const stranger = await client();
    const error = once(stranger, "app:error");
    stranger.emit("room:ready", { deckId: "magic" });
    expect(await error).toEqual({ event: "room:ready", code: "NOT_IN_ROOM" });
  });

  it("antes_do_inicio_nenhum_payload_do_oponente_carrega_o_deck_escolhido", async () => {
    const { a, b } = await twoPlayers();
    const updatedForB = once(b, "room:updated");
    a.emit("room:ready", { deckId: "aggressive" });
    await updatedForB;
    await sleep(100);
    expect(dump(b)).not.toContain("aggressive");
    expect(dump(b)).not.toMatch(/deckId/);
    // O próprio jogador também não recebe a escolha em room:updated (broadcast da sala).
    expect(dump(a)).not.toMatch(/deckId/);
  });

  it("ao_iniciar_a_partida_usa_o_deck_de_cada_um_e_ambos_aparecem_no_playerView", async () => {
    const { a, b } = await twoPlayers();
    const stateA = once(a, "match:state");
    const stateB = once(b, "match:state");
    a.emit("room:ready", { deckId: "aggressive" });
    b.emit("room:ready", { deckId: "defensive" });
    const [{ view: viewA }, { view: viewB }] = await Promise.all([stateA, stateB]);
    expect(viewA.you.deckId).toBe("aggressive");
    expect(viewA.opponent.deckId).toBe("defensive");
    expect(viewB.you.deckId).toBe("defensive");
    expect(viewB.opponent.deckId).toBe("aggressive");
  });

  it("reconexao_antes_do_inicio_devolve_ao_proprio_jogador_so_a_sua_escolha", async () => {
    const { a, b, tokenA, tokenB } = await twoPlayers();
    const marked = once(b, "room:updated");
    a.emit("room:ready", { deckId: "magic" });
    await marked;
    // A reconecta por outra conexão (sem a anterior cair): recebe a própria escolha.
    const a2 = await client();
    const rejoinA = once(a2, "room:rejoined");
    a2.emit("room:rejoin", { token: tokenA });
    expect((await rejoinA).deckId).toBe("magic");
    // B reconecta: não recebe o deck de A.
    const b2 = await client();
    const rejoinB = once(b2, "room:rejoined");
    b2.emit("room:rejoin", { token: tokenB });
    expect((await rejoinB).deckId).toBe(null);
    await sleep(100);
    expect(dump(b2)).not.toContain("magic");
    expect(dump(b)).not.toContain("magic");
  });

  it("room_rejoined_na_partida_encerrada_devolve_o_deck_do_proprio_voto", async () => {
    const { a, b, tokenA } = await twoPlayers();
    const ended = once(a, "match:ended");
    a.emit("room:ready", { deckId: "magic" });
    b.emit("room:ready", { deckId: "control" });
    await once(a, "match:state");
    b.emit("room:leave");
    expect((await ended).reason).toBe("OPPONENT_LEFT");
    // Sem oponente não há revanche; a escolha pendente segue vazia e o rejoin devolve null.
    const a2 = await client();
    const rejoin = once(a2, "room:rejoined");
    a2.emit("room:rejoin", { token: tokenA });
    expect((await rejoin).deckId).toBe(null);
  });
});

describe("match:rematch com deckId", () => {
  /** Partida encerrada por desistência não permite revanche; encerra por deck vazio. */
  const endedMatch = async () => {
    const p = await twoPlayers();
    const stateA = once(p.a, "match:state");
    p.a.emit("room:ready", { deckId: "aggressive" });
    p.b.emit("room:ready", { deckId: "defensive" });
    const { view } = await stateA;
    const endA = once(p.a, "match:ended");
    let current: "P1" | "P2" = view.currentPlayer;
    for (let i = 0; i < 40; i++) {
      const actor = current === view.viewer ? p.a : p.b;
      for (const type of ["NEXT_PHASE", "END_TURN"]) {
        const next = Promise.race([once(p.a, "match:state"), sleep(300).then(() => null)]);
        actor.emit("match:action", { type });
        if ((await next)?.view.winner) return { ...p, end: await endA, viewer: view.viewer as "P1" | "P2" };
      }
      current = current === "P1" ? "P2" : "P1";
    }
    throw new Error("a partida não terminou");
  };

  it("recusa_deckId_ausente_ou_invalido_ao_aceitar", async () => {
    const { a } = await endedMatch();
    for (const payload of [undefined, { accept: true }, { deckId: "inexistente" }]) {
      const error = once(a, "app:error");
      a.emit("match:rematch", payload);
      expect(await error).toEqual({ event: "match:rematch", code: "INVALID_PAYLOAD" });
    }
  }, 30000);

  it("jogador_sem_sala_recebe_NOT_IN_ROOM", async () => {
    const stranger = await client();
    const error = once(stranger, "app:error");
    stranger.emit("match:rematch", { deckId: "magic" });
    expect(await error).toEqual({ event: "match:rematch", code: "NOT_IN_ROOM" });
  });

  it("revanche_com_decks_diferentes_nao_vaza_o_deck_antes_do_inicio_e_troca_os_lados", async () => {
    const p = await endedMatch();
    const endForB = once(p.b, "match:ended");
    p.a.emit("match:rematch", { deckId: "control" });
    await endForB;
    await sleep(100);
    // O voto de A chegou a B sem o deck escolhido.
    const afterVote = logs.get(p.b)!.slice(-3);
    expect(JSON.stringify(afterVote)).not.toContain("control");

    const stateA = once(p.a, "match:state");
    const stateB = once(p.b, "match:state");
    p.b.emit("match:rematch", { deckId: "strategic" });
    const [{ view: viewA }, { view: viewB }] = await Promise.all([stateA, stateB]);
    expect(viewA.viewer).not.toBe(p.viewer);
    expect(viewA.you.deckId).toBe("control");
    expect(viewA.opponent.deckId).toBe("strategic");
    expect(viewB.you.deckId).toBe("strategic");
    expect(viewB.opponent.deckId).toBe("control");
  }, 30000);

  it("revanche_com_decks_iguais_e_aceita", async () => {
    const p = await endedMatch();
    const stateA = once(p.a, "match:state");
    p.a.emit("match:rematch", { deckId: "magic" });
    p.b.emit("match:rematch", { deckId: "magic" });
    const { view } = await stateA;
    expect(view.you.deckId).toBe("magic");
    expect(view.opponent.deckId).toBe("magic");
  }, 30000);

  it("retirar_o_voto_descarta_a_escolha_e_exige_novo_deckId_para_votar_de_novo", async () => {
    const p = await endedMatch();
    p.a.emit("match:rematch", { deckId: "control" });
    await once(p.b, "match:ended");
    p.a.emit("match:rematch", { accept: false });
    await once(p.b, "match:ended");
    const stateB = once(p.b, "match:state");
    p.a.emit("match:rematch", { deckId: "magic" });
    p.b.emit("match:rematch", { deckId: "balanced" });
    const { view } = await stateB;
    expect(view.opponent.deckId).toBe("magic");
    expect(view.you.deckId).toBe("balanced");
  }, 30000);

  it("reconexao_na_tela_de_fim_devolve_so_o_deck_do_proprio_voto", async () => {
    const p = await endedMatch();
    p.a.emit("match:rematch", { deckId: "control" });
    await once(p.b, "match:ended");
    const a2 = await client();
    const rejoin = once(a2, "room:rejoined");
    a2.emit("room:rejoin", { token: p.tokenA });
    expect((await rejoin).deckId).toBe("control");
    const b2 = await client();
    const rejoinB = once(b2, "room:rejoined");
    b2.emit("room:rejoin", { token: p.tokenB });
    // B ainda não votou: não recebe o deck de A.
    expect((await rejoinB).deckId).toBe(null);
    await sleep(100);
    expect(dump(b2)).not.toContain("control");
  }, 30000);
});
