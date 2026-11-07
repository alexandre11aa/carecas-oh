// src/server/services/aiRoom.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DECKS } from "../../engine/index.js";
import { createRoomStore, type Room } from "../store/roomStore.js";
import { createRoomService, TURN_TIME_MS, type RoomResult, type TurnExpiry } from "./roomService.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

type Ok = Extract<RoomResult, { ok: true }>;

const setup = () => {
  const store = createRoomStore();
  const service = createRoomService(store);
  const expiries: TurnExpiry[] = [];
  service.onTurnExpired((expiry) => expiries.push(expiry));
  const create = (level: "easy" | "medium" | "hard" = "medium", deckId: "aggressive" | "magic" = "aggressive"): Ok => {
    const result = service.createAiRoom({ nickname: "Ana", level, deckId, connectionId: "a" });
    if (!result.ok) throw new Error("falha ao criar sala contra a IA");
    return result;
  };
  const roomOf = (result: Ok): Room => store.getRoom(result.room.code)!;
  return { store, service, expiries, create, roomOf };
};

/** Cria salas até uma em que o lado inicial (sorteado pela semente) seja o pedido. */
const createStartedBy = (ctx: ReturnType<typeof setup>, who: "human" | "bot") => {
  for (let i = 0; i < 100; i++) {
    const result = ctx.create();
    const room = ctx.roomOf(result);
    const starter = room.match!.state.currentPlayer === "P1" ? "human" : "bot";
    if (starter === who) return { result, room };
    ctx.service.leaveRoom({ connectionId: "a" });
  }
  throw new Error("sorteio não variou");
};

describe("createAiRoom", () => {
  it("cria_sala_e_partida_na_hora_com_humano_como_P1_e_bot_fora_de_players", () => {
    const { create, roomOf } = setup();
    const result = create("hard", "magic");
    const room = roomOf(result);
    expect(room.players).toHaveLength(1);
    expect(room.players[0]).toMatchObject({ nickname: "Ana", connectionId: "a", token: result.token, ready: false, deckId: null });
    expect(room.ai).toEqual({ level: "hard", botToken: expect.any(String) });
    expect(room.ai!.botToken).not.toBe(result.token);
    expect(room.match!.tokens).toEqual({ P1: result.token, P2: room.ai!.botToken });
    expect(room.match!.state.players.P1.deckId).toBe("magic");
    expect(DECKS.map((d) => d.id)).toContain(room.match!.state.players.P2.deckId);
    expect(result.room).toEqual({
      code: room.code,
      hasMatch: true,
      players: [{ nickname: "Ana", connected: true, ready: false }],
      vsAi: true,
      aiLevel: "hard",
    });
  });

  it("devolve_o_playerView_inicial_do_humano_sem_vazar_semente_nem_token_da_IA", () => {
    const { create, roomOf } = setup();
    const result = create();
    const room = roomOf(result);
    if (!result.view) throw new Error("sem view");
    expect(result.view.viewer).toBe("P1");
    expect(result.view.you.hand).toEqual(room.match!.state.players.P1.hand);
    expect(result.view.opponent.handCount).toBe(5);
    expect(result.view.opponent).not.toHaveProperty("hand");
    expect(room.players[0]!.deckId).toBeNull();
    const dump = JSON.stringify(result);
    expect(dump).not.toMatch(/seed/i);
    expect(dump).not.toContain(room.ai!.botToken);
    // Os decks podem coincidir; só vale para cartas que o humano não tem na mão.
    const botOnly = room.match!.state.players.P2.hand.filter((id) => !result.view!.you.hand.includes(id));
    for (const id of botOnly) expect(dump).not.toContain(`"${id}"`);
  });

  it("sorteia_o_deck_da_IA_entre_os_6_decks", () => {
    const ctx = setup();
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) {
      seen.add(ctx.roomOf(ctx.create()).match!.state.players.P2.deckId);
      ctx.service.leaveRoom({ connectionId: "a" });
    }
    expect(seen.size).toBeGreaterThan(1);
    for (const id of seen) expect(DECKS.map((d) => d.id)).toContain(id);
  });

  it("sorteia_quem_comeca_pela_semente_do_servidor", () => {
    const ctx = setup();
    const starters = new Set<string>();
    for (let i = 0; i < 60; i++) {
      starters.add(ctx.roomOf(ctx.create()).match!.state.currentPlayer);
      ctx.service.leaveRoom({ connectionId: "a" });
    }
    expect([...starters].sort()).toEqual(["P1", "P2"]);
  });

  it("nao_aparece_em_listOpenRooms", () => {
    const { create, service } = setup();
    create();
    expect(service.listOpenRooms()).toEqual([]);
  });

  it("joinRoom_devolve_ROOM_FULL", () => {
    const { create, service, roomOf } = setup();
    const result = create();
    expect(service.joinRoom({ code: result.room.code, nickname: "Bia", connectionId: "b" })).toEqual({ ok: false, code: "ROOM_FULL" });
    expect(roomOf(result).players).toHaveLength(1);
  });

  it("setReady_devolve_MATCH_ALREADY_STARTED", () => {
    const { create, service } = setup();
    create();
    expect(service.setReady({ connectionId: "a", ready: true, deckId: "magic" })).toEqual({ ok: false, code: "MATCH_ALREADY_STARTED" });
  });

  it("rejoinRoom_restaura_a_partida_do_humano_sem_vazar_o_bot", () => {
    const { create, service, roomOf } = setup();
    const created = create();
    const botToken = roomOf(created).ai!.botToken;
    service.disconnectPlayer({ connectionId: "a" });
    const rejoined = service.rejoinRoom({ token: created.token, connectionId: "a2" });
    if (!rejoined.ok) throw new Error("falhou");
    expect(rejoined.view).toEqual(created.view);
    expect(rejoined.room.vsAi).toBe(true);
    expect(JSON.stringify(rejoined)).not.toContain(botToken);
    expect(service.rejoinRoom({ token: botToken, connectionId: "x" })).toEqual({ ok: false, code: "INVALID_TOKEN" });
  });

  it("leaveRoom_remove_a_sala_e_removeAbandonedRoom_remove_apos_desconexao", () => {
    const { create, service, store } = setup();
    const first = create();
    expect(service.leaveRoom({ connectionId: "a" })).toMatchObject({ room: null });
    expect(store.getRoom(first.room.code)).toBeUndefined();
    const second = create();
    service.disconnectPlayer({ connectionId: "a" });
    expect(service.removeAbandonedRoom({ code: second.room.code })).toBe(true);
    expect(store.getRoom(second.room.code)).toBeUndefined();
  });
});

describe("prazo do turno contra a IA (transitório até a IA jogar)", () => {
  it("com_o_humano_no_turno_o_prazo_corre_e_expira_normalmente", () => {
    const ctx = setup();
    const { result, room } = createStartedBy(ctx, "human");
    expect(result.turnDeadline).toBe(1_000_000 + TURN_TIME_MS);
    vi.advanceTimersByTime(TURN_TIME_MS);
    expect(ctx.expiries).toHaveLength(1);
    const after = ctx.store.getRoom(room.code)!.match!;
    expect(after.state.currentPlayer).toBe("P2");
    // O turno passou à IA: sem prazo e sem nova expiração.
    expect(after.turnDeadline).toBeNull();
    vi.advanceTimersByTime(TURN_TIME_MS * 3);
    expect(ctx.expiries).toHaveLength(1);
  });

  it("com_a_IA_no_turno_nao_ha_prazo_nem_expiracao", () => {
    const ctx = setup();
    const { result, room } = createStartedBy(ctx, "bot");
    expect(result.turnDeadline).toBeNull();
    expect(room.match!.turnDeadline).toBeNull();
    vi.advanceTimersByTime(TURN_TIME_MS * 3);
    expect(ctx.expiries).toEqual([]);
    const after = ctx.store.getRoom(room.code)!.match!;
    expect(after.state.currentPlayer).toBe("P2");
    expect(after.state.phase).toBe("DRAW");
  });
});
