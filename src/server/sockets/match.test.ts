// src/server/sockets/match.test.ts
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getCard, type Action, type PlayerView } from "../../engine/index.js";
import { createApp, type App } from "../app.js";

let app: App;
let url: string;
const open: Socket[] = [];
/** Tudo o que cada socket recebeu, na ordem. */
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

type Players = { a: Socket; b: Socket; tokenA: string; tokenB: string };
type Step = { view: PlayerView; events: any[] };
type Round = { a: Step; b: Step };

const twoPlayers = async (): Promise<Players> => {
  const a = await client();
  const b = await client();
  const created = once(a, "room:created");
  a.emit("room:create", { nickname: "Ana" });
  const { room, token: tokenA } = await created;
  const joined = once(b, "room:joined");
  b.emit("room:join", { code: room.code, nickname: "Bia" });
  const { token: tokenB } = await joined;
  return { a, b, tokenA, tokenB };
};

const startMatch = async (): Promise<Players & { viewA: PlayerView; viewB: PlayerView }> => {
  const players = await twoPlayers();
  const stateA = once(players.a, "match:state");
  const stateB = once(players.b, "match:state");
  players.a.emit("room:ready", { deckId: "balanced" });
  players.b.emit("room:ready", { deckId: "strategic" });
  const [{ view: viewA }, { view: viewB }] = await Promise.all([stateA, stateB]);
  return { ...players, viewA, viewB };
};

/** Envia a ação e espera o `match:state` seguinte nos dois jogadores. */
const act = async (players: Players, who: Socket, action: Action): Promise<Round> => {
  const next = Promise.all([once(players.a, "match:state"), once(players.b, "match:state")]);
  who.emit("match:action", action);
  const [a, b] = await next;
  return { a, b };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("room:ready", () => {
  it("notifica_a_sala_ao_marcar_e_desmarcar_pronto", async () => {
    const { a, b } = await twoPlayers();
    const marked = once(b, "room:updated");
    a.emit("room:ready", { deckId: "balanced" });
    expect((await marked).room.players.map((p: any) => p.ready)).toEqual([true, false]);
    const unmarked = once(b, "room:updated");
    a.emit("room:ready", { ready: false });
    expect((await unmarked).room.players.map((p: any) => p.ready)).toEqual([false, false]);
  });

  it("rejeita_payload_invalido", async () => {
    const { a } = await twoPlayers();
    const error = once(a, "app:error");
    a.emit("room:ready", { ready: "sim" });
    expect(await error).toEqual({ event: "room:ready", code: "INVALID_PAYLOAD" });
  });

  it("jogador_sem_sala_nao_marca_pronto", async () => {
    const a = await client();
    const error = once(a, "app:error");
    a.emit("room:ready", { deckId: "balanced" });
    expect(await error).toEqual({ event: "room:ready", code: "NOT_IN_ROOM" });
  });

  it("nao_inicia_com_apenas_um_jogador_pronto", async () => {
    const { a } = await twoPlayers();
    a.emit("room:ready", { deckId: "balanced" });
    await sleep(100);
    expect(logs.get(a)!.some((l) => l.event === "match:state")).toBe(false);
  });

  it("inicia_a_partida_com_os_dois_prontos_e_envia_a_view_de_cada_jogador", async () => {
    const { viewA, viewB } = await startMatch();
    expect([viewA.viewer, viewB.viewer].sort()).toEqual(["P1", "P2"]);
    expect(viewA.viewer).not.toBe(viewB.viewer);
    for (const view of [viewA, viewB]) {
      expect(view.turn).toBe(1);
      expect(view.phase).toBe("DRAW");
      expect(view.you.lifePoints).toBe(8000);
      expect(view.you.hand).toHaveLength(5);
      expect(view.you.deckCount).toBe(5);
      expect(view.opponent.handCount).toBe(5);
    }
    expect(viewA.you.hand.filter((id) => viewB.you.hand.includes(id))).toEqual([]);
  });

  it("nao_permite_marcar_pronto_com_a_partida_em_andamento", async () => {
    const { a } = await startMatch();
    const error = once(a, "app:error");
    a.emit("room:ready", { ready: false });
    expect(await error).toEqual({ event: "room:ready", code: "MATCH_ALREADY_STARTED" });
  });
});

describe("match:action", () => {
  it("aplica_acao_valida_do_jogador_do_turno_e_envia_o_novo_estado_aos_dois", async () => {
    const m = await startMatch();
    const firstIsA = m.viewA.currentPlayer === m.viewA.viewer;
    const round = await act(m, firstIsA ? m.a : m.b, { type: "NEXT_PHASE" });
    const seenByFirst = firstIsA ? round.a : round.b;
    const seenBySecond = firstIsA ? round.b : round.a;
    expect(seenByFirst.view.phase).toBe("MAIN_1");
    expect(seenBySecond.view.phase).toBe("MAIN_1");
    expect(seenByFirst.view.you.hand).toHaveLength(6);
    expect(seenBySecond.view.opponent.handCount).toBe(6);
    const drawn = seenByFirst.events.find((e) => e.type === "CARD_DRAWN");
    expect(drawn.cardId).toBe(seenByFirst.view.you.hand[5]);
    expect(seenBySecond.events.find((e) => e.type === "CARD_DRAWN")).toEqual({
      type: "CARD_DRAWN",
      player: seenByFirst.view.viewer,
      cardId: null,
    });
  });

  it("rejeita_acao_fora_do_turno", async () => {
    const m = await startMatch();
    const second = m.viewA.currentPlayer === m.viewA.viewer ? m.b : m.a;
    const error = once(second, "app:error");
    second.emit("match:action", { type: "NEXT_PHASE" });
    expect(await error).toEqual({ event: "match:action", code: "NOT_YOUR_TURN" });
  });

  it("rejeita_acao_invalida_da_engine_com_codigo", async () => {
    const m = await startMatch();
    const first = m.viewA.currentPlayer === m.viewA.viewer ? m.a : m.b;
    const error = once(first, "app:error");
    first.emit("match:action", { type: "END_TURN" });
    expect(await error).toEqual({ event: "match:action", code: "INVALID_PHASE" });
  });

  it("rejeita_payload_invalido_e_campo_de_jogador_enviado_pelo_cliente", async () => {
    const m = await startMatch();
    const payloads = [undefined, { type: "VOAR" }, { type: "NEXT_PHASE", player: "P1" }, { type: "SUMMON_CARD", cardId: "x" },
      { type: "ATTACK", attackerCardId: "x", targetCardId: "y" },
      { type: "ATTACK", attackerCardId: "x", targetZone: 5 },
      { type: "ATTACK", attackerCardId: "x", targetZone: -1 },
      { type: "ATTACK", attackerCardId: "x", targetZone: 1.5 },
      { type: "ACTIVATE_SPELL", cardId: "x", targetZone: 9 },
    ];
    for (const payload of payloads) {
      const error = once(m.a, "app:error");
      m.a.emit("match:action", payload);
      expect(await error).toEqual({ event: "match:action", code: "INVALID_PAYLOAD" });
    }
  });

  it("rejeita_acao_sem_partida_iniciada", async () => {
    const { a } = await twoPlayers();
    const error = once(a, "app:error");
    a.emit("match:action", { type: "NEXT_PHASE" });
    expect(await error).toEqual({ event: "match:action", code: "MATCH_NOT_STARTED" });
  });

  it("rejeita_jogador_fora_da_sala", async () => {
    const m = await startMatch();
    const stranger = await client();
    const error = once(stranger, "app:error");
    stranger.emit("match:action", { type: "NEXT_PHASE" });
    expect(await error).toEqual({ event: "match:action", code: "NOT_IN_ROOM" });
    expect(logs.get(m.a)!.filter((l) => l.event === "match:state")).toHaveLength(1);
  });
});

describe("reconexao no meio da partida", () => {
  it("restaura_a_view_atual_do_jogador_ao_reconectar_com_o_token", async () => {
    const m = await startMatch();
    const firstIsA = m.viewA.currentPlayer === m.viewA.viewer;
    await act(m, firstIsA ? m.a : m.b, { type: "NEXT_PHASE" });
    const disconnected = once(m.b, "room:updated");
    m.a.close();
    await disconnected;
    const a2 = await client();
    const state = once(a2, "match:state");
    a2.emit("room:rejoin", { token: m.tokenA });
    const { view, events } = await state;
    expect(view.viewer).toBe(m.viewA.viewer);
    expect(view.phase).toBe("MAIN_1");
    expect(events).toEqual([]);
    // Continua jogando com a nova conexão: A (se for do turno) avança a fase.
    if (firstIsA) {
      const next = once(a2, "match:state");
      a2.emit("match:action", { type: "NEXT_PHASE" });
      expect((await next).view.phase).toBe("BATTLE");
    }
  });
});

describe("informacao oculta", () => {
  it("nada_enviado_ao_jogador_vaza_cartas_ocultas_do_oponente_nem_a_semente", async () => {
    const m = await startMatch();
    const bySide = (side: "P1" | "P2") => (m.viewA.viewer === side ? m.a : m.b);
    const first = bySide(m.viewA.currentPlayer);
    const second = bySide(m.viewA.currentPlayer === "P1" ? "P2" : "P1");
    const handOf = (round: Round, socket: Socket): string[] => (socket === m.a ? round.a : round.b).view.you.hand;
    const lowMonster = (hand: string[]) =>
      hand.find((id) => {
        const card = getCard(id);
        return card?.type === "MONSTER" && card.level <= 4;
      });

    // Turno do primeiro: compra, baixa um monstro virado e uma magia/armadilha, encerra.
    let round = await act(m, first, { type: "NEXT_PHASE" });
    const monster = lowMonster(handOf(round, first));
    if (monster) round = await act(m, first, { type: "SET_MONSTER", cardId: monster, tributeCardIds: [], zone: 0 });
    const spellTrap = handOf(round, first).find((id) => getCard(id)?.type !== "MONSTER");
    if (spellTrap) round = await act(m, first, { type: "SET_SPELL_TRAP", cardId: spellTrap });
    round = await act(m, first, { type: "END_TURN" });
    // Turno do segundo: a compra é automática ao começar; baixa um monstro virado.
    const monster2 = lowMonster(handOf(round, second));
    if (monster2) round = await act(m, second, { type: "SET_MONSTER", cardId: monster2, tributeCardIds: [], zone: 0 });

    // Ids que cada jogador guarda em segredo: a própria mão e as cartas viradas no campo.
    const secretsOf = (socket: Socket): string[] => {
      const view = (socket === m.a ? round.a : round.b).view;
      const faceDown = [...view.you.monsters, ...view.you.spellTraps].filter((c) => c?.faceDown).map((c) => c!.cardId);
      return [...view.you.hand, ...faceDown];
    };
    const secrets = { a: secretsOf(m.a), b: secretsOf(m.b) };
    expect(secrets.a.length).toBeGreaterThan(0);
    expect(secrets.b.length).toBeGreaterThan(0);

    for (const [viewer, other] of [
      [m.a, "b"],
      [m.b, "a"],
    ] as const) {
      const dump = JSON.stringify(logs.get(viewer)!);
      for (const id of secrets[other]) expect(dump).not.toContain(`"${id}"`);
      expect(dump).not.toMatch(/seed/i);
    }
  });
});

describe("prazo do turno no match:state", () => {
  it("inclui_turnDeadline_e_serverNow_no_inicio_apos_a_acao_e_na_reconexao", async () => {
    const p = await startMatch();
    const first = p.viewA.currentPlayer === p.viewA.viewer ? p.a : p.b;
    const round = await act(p, first, { type: "NEXT_PHASE" });
    for (const step of [round.a, round.b] as any[]) {
      // Prazo e hora do servidor vêm de leituras distintas do relógio: tolera alguns ms de diferença.
      expect(step.turnDeadline - step.serverNow).toBeGreaterThanOrEqual(29_000);
      expect(step.turnDeadline - step.serverNow).toBeLessThanOrEqual(30_000);
    }
    p.a.close();
    await sleep(100);
    const a2 = await client();
    const state = once(a2, "match:state");
    a2.emit("room:rejoin", { token: p.tokenA });
    const { turnDeadline, serverNow } = await state;
    expect(turnDeadline).toBeGreaterThan(serverNow);
    expect(turnDeadline - serverNow).toBeLessThanOrEqual(30_000);
  });
});
