// src/server/services/turnTimer.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoomStore } from "../store/roomStore.js";
import { createRoomService, TURN_TIME_MS, type Delivery, type TurnExpiry } from "./roomService.js";

const START = 1_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

const setup = () => {
  const store = createRoomStore();
  const service = createRoomService(store);
  const expiries: TurnExpiry[] = [];
  service.onTurnExpired((expiry) => expiries.push(expiry));
  const created = service.createRoom({ nickname: "Ana", connectionId: "a" });
  if (!created.ok) throw new Error("falha ao criar sala");
  service.joinRoom({ code: created.room.code, nickname: "Bia", connectionId: "b" });
  service.setReady({ connectionId: "a", ready: true });
  const started = service.setReady({ connectionId: "b", ready: true });
  if (!started.ok) throw new Error("falha ao iniciar");
  const match = () => store.getRoom(created.room.code)!.match!;
  /** conexão do jogador do turno */
  const actor = () => {
    const room = store.getRoom(created.room.code)!;
    const token = room.match!.tokens[room.match!.state.currentPlayer];
    return room.players.find((p) => p.token === token)!.connectionId!;
  };
  return { store, service, expiries, code: created.room.code, tokenA: created.token, started, match, actor };
};

const other = (side: "P1" | "P2") => (side === "P1" ? "P2" : "P1");
const forA = (deliveries: Delivery[]) => deliveries.find((d) => d.connectionId === "a")!;

describe("prazo do turno", () => {
  it("a_partida_comeca_com_prazo_de_30s_e_hora_do_servidor_nas_entregas", () => {
    const { started, match } = setup();
    if (!started.ok) throw new Error();
    expect(match().turnDeadline).toBe(START + TURN_TIME_MS);
    for (const d of started.deliveries) {
      expect(d.turnDeadline).toBe(START + TURN_TIME_MS);
      expect(d.serverNow).toBe(START);
    }
  });

  it("ao_expirar_encerra_o_turno_e_entrega_o_estado_aos_dois_com_novo_prazo", () => {
    const { expiries, match } = setup();
    const first = match().state.currentPlayer;
    expect(match().state.turn).toBe(1);
    vi.advanceTimersByTime(TURN_TIME_MS);
    expect(expiries).toHaveLength(1);
    expect(match().state.currentPlayer).toBe(other(first));
    expect(match().state.turn).toBe(2);
    const { deliveries } = expiries[0]!;
    expect(deliveries.map((d) => d.connectionId).sort()).toEqual(["a", "b"]);
    for (const d of deliveries) {
      expect(d.view?.currentPlayer).toBe(other(first));
      expect(d.turnDeadline).toBe(START + 2 * TURN_TIME_MS);
      expect(d.serverNow).toBe(START + TURN_TIME_MS);
      expect(d.events.some((e) => e.type === "TURN_STARTED")).toBe(true);
    }
  });

  it("nao_expira_antes_do_prazo", () => {
    const { expiries, match } = setup();
    vi.advanceTimersByTime(TURN_TIME_MS - 1);
    expect(expiries).toHaveLength(0);
    expect(match().state.turn).toBe(1);
  });

  it("expirar_varias_vezes_continua_passando_a_vez", () => {
    const { expiries, match } = setup();
    vi.advanceTimersByTime(TURN_TIME_MS * 3);
    expect(expiries).toHaveLength(3);
    expect(match().state.turn).toBe(4);
  });

  it("acao_valida_antes_do_prazo_renova_os_30s", () => {
    const { service, expiries, match, actor } = setup();
    vi.advanceTimersByTime(20_000);
    const result = service.submitAction({ connectionId: actor(), action: { type: "NEXT_PHASE" } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(match().turnDeadline).toBe(START + 20_000 + TURN_TIME_MS);
    expect(forA(result.deliveries).turnDeadline).toBe(START + 20_000 + TURN_TIME_MS);
    expect(forA(result.deliveries).serverNow).toBe(START + 20_000);
    // O prazo original (30 s) passa sem efeito.
    vi.advanceTimersByTime(15_000);
    expect(expiries).toHaveLength(0);
    expect(match().state.turn).toBe(1);
    // O novo prazo vence 30 s depois da ação.
    vi.advanceTimersByTime(15_000);
    expect(expiries).toHaveLength(1);
    expect(match().state.turn).toBe(2);
  });

  it("acao_invalida_nao_renova_o_prazo", () => {
    const { service, match, actor } = setup();
    vi.advanceTimersByTime(10_000);
    const notTurn = actor() === "a" ? "b" : "a";
    const result = service.submitAction({ connectionId: notTurn, action: { type: "NEXT_PHASE" } });
    expect(result).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
    expect(match().turnDeadline).toBe(START + TURN_TIME_MS);
  });

  it("com_resposta_pendente_expira_como_pass_response_e_depois_como_end_turn", () => {
    const { store, service, expiries, match, actor, code } = setup();
    const first = match().state.currentPlayer;
    service.submitAction({ connectionId: actor(), action: { type: "NEXT_PHASE" } });
    const room = store.getRoom(code)!;
    store.saveRoom({
      ...room,
      match: {
        ...room.match!,
        state: { ...room.match!.state, pendingResponse: { trigger: "SUMMON", responder: other(first), action: { type: "NEXT_PHASE" } } },
      },
    });
    expect(match().state.phase).toBe("MAIN_1");
    vi.advanceTimersByTime(TURN_TIME_MS);
    expect(expiries).toHaveLength(1);
    // PASS_RESPONSE retomou a ação interrompida (NEXT_PHASE) e a vez continua com P1.
    expect(match().state.pendingResponse).toBeNull();
    expect(match().state.phase).toBe("BATTLE");
    expect(match().state.currentPlayer).toBe(first);
    expect(expiries[0]!.deliveries[0]!.events.map((e) => e.type)).toContain("RESPONSE_PASSED");
    expect(match().turnDeadline).toBe(START + 2 * TURN_TIME_MS);
    // Expirando de novo, o turno encerra.
    vi.advanceTimersByTime(TURN_TIME_MS);
    expect(expiries).toHaveLength(2);
    expect(match().state.currentPlayer).toBe(other(first));
    expect(match().state.turn).toBe(2);
  });

  it("o_timer_continua_contando_se_o_jogador_do_turno_desconectar", () => {
    const { service, expiries, match, actor } = setup();
    const first = match().state.currentPlayer;
    const gone = actor();
    service.disconnectPlayer({ connectionId: gone });
    vi.advanceTimersByTime(TURN_TIME_MS);
    expect(expiries).toHaveLength(1);
    expect(match().state.currentPlayer).toBe(other(first));
    // Só o jogador conectado recebe o estado.
    expect(expiries[0]!.deliveries.map((d) => d.connectionId)).toEqual([gone === "a" ? "b" : "a"]);
  });

  it("reconexao_devolve_o_prazo_correto_e_a_hora_do_servidor", () => {
    const { service, tokenA } = setup();
    vi.advanceTimersByTime(12_000);
    service.disconnectPlayer({ connectionId: "a" });
    vi.advanceTimersByTime(3_000);
    const rejoined = service.rejoinRoom({ token: tokenA, connectionId: "a2" });
    expect(rejoined.ok && rejoined.view).toBeTruthy();
    expect(rejoined.ok && rejoined.turnDeadline).toBe(START + TURN_TIME_MS);
    expect(rejoined.ok && rejoined.serverNow).toBe(START + 15_000);
  });

  it("timer_cancelado_no_fim_da_partida", () => {
    const { service, expiries, match, actor } = setup();
    expect(vi.getTimerCount()).toBe(1);
    // Um jogador desiste: a partida termina e nenhum prazo sobra.
    const change = service.leaveRoom({ connectionId: actor() });
    expect(change?.deliveries?.every((d) => d.turnDeadline === null)).toBe(true);
    expect(match().turnDeadline).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(TURN_TIME_MS * 2);
    expect(expiries).toHaveLength(0);
  });

  it("timer_cancelado_quando_a_ultima_pessoa_sai_e_a_sala_some", () => {
    const { service, store, code } = setup();
    service.leaveRoom({ connectionId: "a" });
    service.leaveRoom({ connectionId: "b" });
    expect(store.getRoom(code)).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("timer_cancelado_ao_remover_sala_abandonada", () => {
    const { service, store, code, expiries } = setup();
    service.disconnectPlayer({ connectionId: "a" });
    service.disconnectPlayer({ connectionId: "b" });
    expect(service.removeAbandonedRoom({ code })).toBe(true);
    expect(store.getRoom(code)).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(TURN_TIME_MS * 2);
    expect(expiries).toHaveLength(0);
  });

  it("revanche_cancela_o_prazo_antigo_e_abre_um_novo", () => {
    const { service, expiries, match, actor, code, store } = setup();
    // Termina a partida por desistência não permite revanche; encerra direto no store.
    vi.advanceTimersByTime(10_000);
    const room = store.getRoom(code)!;
    store.saveRoom({ ...room, match: { ...room.match!, outcome: { winner: "P1", reason: "LIFE_ZERO" }, state: { ...room.match!.state, winner: "P1" } } });
    // Uma ação após o fim é recusada e não mexe em prazos; a revanche precisa dos dois votos.
    expect(service.requestRematch({ connectionId: "a", accept: true }).ok).toBe(true);
    const rematch = service.requestRematch({ connectionId: "b", accept: true });
    expect(rematch.ok).toBe(true);
    if (!rematch.ok) return;
    expect(vi.getTimerCount()).toBe(1);
    expect(match().turnDeadline).toBe(START + 10_000 + TURN_TIME_MS);
    expect(rematch.deliveries.every((d) => d.turnDeadline === START + 10_000 + TURN_TIME_MS)).toBe(true);
    // O prazo velho (START + 30 s) não dispara; o novo, sim.
    vi.advanceTimersByTime(TURN_TIME_MS - 10_000);
    expect(expiries).toHaveLength(0);
    vi.advanceTimersByTime(10_000);
    expect(expiries).toHaveLength(1);
    expect(match().state.turn).toBe(2);
    expect(actor()).toBeTruthy();
  });

  it("partida_encerrada_pela_expiracao_nao_rearma_o_prazo", () => {
    const { expiries, match } = setup();
    // Decks de 5 cartas: a compra falha em algum turno e a expiração encerra a partida.
    vi.advanceTimersByTime(TURN_TIME_MS * 20);
    const outcome = match().outcome;
    expect(outcome?.reason).toBe("DECK_OUT");
    expect(match().turnDeadline).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    const last = expiries[expiries.length - 1]!;
    expect(last.deliveries.every((d) => d.turnDeadline === null && d.ended?.winner === outcome?.winner)).toBe(true);
  });
});
