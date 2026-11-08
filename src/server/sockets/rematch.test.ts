// src/server/sockets/rematch.test.ts
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PlayerView } from "../../engine/index.js";
import { createApp, type App } from "../app.js";

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
const count = (socket: Socket, event: string) => logs.get(socket)!.filter((l) => l.event === event).length;

type Players = { a: Socket; b: Socket; tokenA: string; tokenB: string; code: string; viewA: PlayerView; viewB: PlayerView };

const startMatch = async (): Promise<Players> => {
  const a = await client();
  const b = await client();
  const created = once(a, "room:created");
  a.emit("room:create", { nickname: "Ana" });
  const { room, token: tokenA } = await created;
  const joined = once(b, "room:joined");
  b.emit("room:join", { code: room.code, nickname: "Bia" });
  const { token: tokenB } = await joined;
  const stateA = once(a, "match:state");
  const stateB = once(b, "match:state");
  a.emit("room:ready", { deckId: "balanced" });
  b.emit("room:ready", { deckId: "strategic" });
  const [{ view: viewA }, { view: viewB }] = await Promise.all([stateA, stateB]);
  return { a, b, tokenA, tokenB, code: room.code, viewA, viewB };
};

/** Envia a ação e espera o próximo `match:state` (nulo se nada chegar). */
const step = async (p: Players, who: Socket, action: object): Promise<any> => {
  const next = Promise.race([once(p.a, "match:state"), sleep(500).then(() => null)]);
  who.emit("match:action", action);
  return next;
};

/** Joga NEXT_PHASE/END_TURN até alguém ficar sem cartas para comprar (deck de 5 cartas). */
const playUntilEnd = async (p: Players): Promise<{ endA: any; endB: any }> => {
  const endA = once(p.a, "match:ended");
  const endB = once(p.b, "match:ended");
  let current = p.viewA.currentPlayer;
  for (let i = 0; i < 40; i++) {
    const actor = current === p.viewA.viewer ? p.a : p.b;
    if ((await step(p, actor, { type: "NEXT_PHASE" }))?.view.winner) break;
    if ((await step(p, actor, { type: "END_TURN" }))?.view.winner) break;
    current = current === "P1" ? "P2" : "P1";
  }
  return { endA: await endA, endB: await endB };
};

describe("fim de partida", () => {
  it("envia_vencedor_e_motivo_aos_dois_quando_um_jogador_fica_sem_cartas", async () => {
    const p = await startMatch();
    const { endA, endB } = await playUntilEnd(p);
    // Quem abriu a partida compra primeiro e fica sem deck primeiro: perde.
    const winner = p.viewA.currentPlayer === "P1" ? "P2" : "P1";
    expect(endA).toEqual({ winner, reason: "DECK_OUT", rematch: { you: false, opponent: false } });
    expect(endB).toEqual({ winner, reason: "DECK_OUT", rematch: { you: false, opponent: false } });
  }, 30000);
});

describe("match:rematch", () => {
  it("com_um_so_voto_nao_cria_partida_e_avisa_os_dois", async () => {
    const p = await startMatch();
    await playUntilEnd(p);
    const youVote = once(p.a, "match:ended");
    const opponentSees = once(p.b, "match:ended");
    const before = count(p.a, "match:state");
    p.a.emit("match:rematch", { deckId: "balanced" });
    expect((await youVote).rematch).toEqual({ you: true, opponent: false });
    expect((await opponentSees).rematch).toEqual({ you: false, opponent: true });
    await sleep(100);
    expect(count(p.a, "match:state")).toBe(before);
  }, 30000);

  it("retirar_o_voto_desfaz_a_intencao", async () => {
    const p = await startMatch();
    await playUntilEnd(p);
    p.a.emit("match:rematch", { deckId: "balanced" });
    await once(p.b, "match:ended");
    const withdrawn = once(p.b, "match:ended");
    p.a.emit("match:rematch", { accept: false });
    expect((await withdrawn).rematch).toEqual({ you: false, opponent: false });
  }, 30000);

  it("com_os_dois_votos_cria_nova_partida_com_novo_sorteio_e_vida_cheia", async () => {
    const p = await startMatch();
    await playUntilEnd(p);
    p.a.emit("match:rematch", { deckId: "balanced" });
    await once(p.b, "match:ended");
    const stateA = once(p.a, "match:state");
    const stateB = once(p.b, "match:state");
    p.b.emit("match:rematch", { deckId: "balanced" });
    const [{ view: newA, events: eventsA }, { view: newB }] = await Promise.all([stateA, stateB]);
    expect(newA.winner).toBeNull();
    expect(newA.turn).toBe(1);
    expect(newA.you.lifePoints).toBe(4000);
    expect(newA.you.hand).toHaveLength(4);
    expect(newA.you.deckCount).toBe(16);
    expect(eventsA).toEqual([]);
    expect(newA.viewer).not.toBe(newB.viewer);
    // Lados trocados: quem era P1 agora é P2.
    expect(newA.viewer).not.toBe(p.viewA.viewer);
    const sameA = [...newA.you.hand].sort().join() === [...p.viewA.you.hand].sort().join();
    const sameB = [...newB.you.hand].sort().join() === [...p.viewB.you.hand].sort().join();
    expect(sameA && sameB).toBe(false);
    // A nova partida aceita ações.
    const first = newA.currentPlayer === newA.viewer ? p.a : p.b;
    const next = once(p.a, "match:state");
    first.emit("match:action", { type: "NEXT_PHASE" });
    expect((await next).view.phase).toBe("MAIN_1");
  }, 30000);

  it("rejeita_revanche_com_a_partida_em_andamento", async () => {
    const p = await startMatch();
    const error = once(p.a, "app:error");
    p.a.emit("match:rematch", { deckId: "balanced" });
    expect(await error).toEqual({ event: "match:rematch", code: "MATCH_NOT_ENDED" });
  });

  it("rejeita_revanche_sem_sala_sem_partida_e_payload_invalido", async () => {
    const a = await client();
    const noRoom = once(a, "app:error");
    a.emit("match:rematch", { deckId: "balanced" });
    expect(await noRoom).toEqual({ event: "match:rematch", code: "NOT_IN_ROOM" });
    a.emit("room:create", { nickname: "Ana" });
    await once(a, "room:created");
    const noMatch = once(a, "app:error");
    a.emit("match:rematch", { deckId: "balanced" });
    expect(await noMatch).toEqual({ event: "match:rematch", code: "MATCH_NOT_STARTED" });
    const invalid = once(a, "app:error");
    a.emit("match:rematch", { accept: "sim" });
    expect(await invalid).toEqual({ event: "match:rematch", code: "INVALID_PAYLOAD" });
  });
});

describe("saida durante a partida e durante o fim", () => {
  it("sair_no_meio_da_partida_da_a_vitoria_ao_outro_e_mantem_a_sala", async () => {
    const p = await startMatch();
    const state = once(p.b, "match:state");
    const ended = once(p.b, "match:ended");
    p.a.emit("room:leave");
    const { view, events } = await state;
    expect(view.winner).toBe(p.viewB.viewer);
    expect(events).toEqual([{ type: "MATCH_ENDED", winner: p.viewB.viewer }]);
    expect(await ended).toEqual({
      winner: p.viewB.viewer,
      reason: "OPPONENT_LEFT",
      rematch: { you: false, opponent: false },
    });
    // Sem oponente não há revanche; só voltar ao lobby.
    const error = once(p.b, "app:error");
    p.b.emit("match:rematch", { deckId: "balanced" });
    expect(await error).toEqual({ event: "match:rematch", code: "REMATCH_UNAVAILABLE" });
  });

  it("sair_no_fim_apaga_votos_e_o_ultimo_a_sair_remove_a_sala", async () => {
    const p = await startMatch();
    await playUntilEnd(p);
    const voteSeenByB = once(p.b, "match:ended");
    p.b.emit("match:rematch", { deckId: "balanced" });
    await Promise.all([once(p.a, "match:ended"), voteSeenByB]);
    const updated = once(p.b, "room:updated");
    const cleared = once(p.b, "match:ended");
    p.a.emit("room:leave");
    expect((await updated).room.players).toEqual([{ nickname: "Bia", connected: true, ready: false }]);
    expect((await cleared).rematch).toEqual({ you: false, opponent: false });
    p.b.emit("room:leave");
    await sleep(100);
    const c = await client();
    const error = once(c, "app:error");
    c.emit("room:join", { code: p.code, nickname: "Caio" });
    expect(await error).toEqual({ event: "room:join", code: "ROOM_NOT_FOUND" });
  }, 30000);

  it("novo_jogador_apos_a_saida_comeca_do_lobby_e_pode_iniciar_outra_partida", async () => {
    const p = await startMatch();
    await playUntilEnd(p);
    p.a.emit("room:leave");
    await sleep(100);
    const c = await client();
    const joined = once(c, "room:joined");
    c.emit("room:join", { code: p.code, nickname: "Caio" });
    expect((await joined).room.players).toHaveLength(2);
    const stateB = once(p.b, "match:state");
    const stateC = once(c, "match:state");
    p.b.emit("room:ready", { deckId: "strategic" });
    c.emit("room:ready", { deckId: "strategic" });
    const [{ view }] = await Promise.all([stateB, stateC]);
    expect(view.winner).toBeNull();
    expect(view.turn).toBe(1);
  }, 30000);

  it("reconectar_com_a_partida_encerrada_restaura_o_resultado_sem_o_voto", async () => {
    const p = await startMatch();
    await playUntilEnd(p);
    p.a.emit("match:rematch", { deckId: "balanced" });
    await once(p.b, "match:ended");
    const closed = once(p.b, "room:updated");
    p.a.close();
    await closed;
    const a2 = await client();
    const state = once(a2, "match:state");
    const ended = once(a2, "match:ended");
    a2.emit("room:rejoin", { token: p.tokenA });
    expect((await state).view.winner).not.toBeNull();
    expect((await ended).rematch).toEqual({ you: false, opponent: false });
  }, 30000);
});
