// src/server/services/roomService.test.ts
import { describe, expect, it } from "vitest";
import { createRoomService } from "./roomService.js";
import { createRoomStore } from "../store/roomStore.js";

const setup = () => {
  const store = createRoomStore();
  const service = createRoomService(store);
  const created = service.createRoom({ nickname: "Ana", connectionId: "a" });
  if (!created.ok) throw new Error("falha ao criar sala");
  return { store, service, code: created.room.code, created };
};

const joinAndStart = () => {
  const ctx = setup();
  const joined = ctx.service.joinRoom({ code: ctx.code, nickname: "Bia", connectionId: "b" });
  ctx.service.setReady({ connectionId: "a", ready: true, deckId: "balanced" });
  const started = ctx.service.setReady({ connectionId: "b", ready: true, deckId: "balanced" });
  return { ...ctx, joined, started };
};

/** Joga NEXT_PHASE/END_TURN até alguém ficar sem deck e a partida terminar. */
const playUntilEnd = (ctx: ReturnType<typeof setup>) => {
  for (let i = 0; i < 100; i++) {
    const room = ctx.store.getRoom(ctx.code)!;
    if (room.match!.outcome) return;
    const token = room.match!.tokens[room.match!.state.currentPlayer];
    const connectionId = room.players.find((p) => p.token === token)!.connectionId!;
    ctx.service.submitAction({ connectionId, action: { type: "NEXT_PHASE" } });
    ctx.service.submitAction({ connectionId, action: { type: "END_TURN" } });
  }
  throw new Error("a partida não terminou");
};

describe("PublicRoom.hasMatch", () => {
  it("e_false_sem_partida", () => {
    const { created, joined } = joinAndStart();
    expect(created.ok && created.room.hasMatch).toBe(false);
    expect(joined.ok && joined.room.hasMatch).toBe(false);
  });

  it("e_false_com_um_jogador_pronto_e_true_quando_a_partida_comeca", () => {
    const ctx = setup();
    ctx.service.joinRoom({ code: ctx.code, nickname: "Bia", connectionId: "b" });
    const first = ctx.service.setReady({ connectionId: "a", ready: true, deckId: "balanced" });
    expect(first.ok && first.room.hasMatch).toBe(false);
    const second = ctx.service.setReady({ connectionId: "b", ready: true, deckId: "balanced" });
    expect(second.ok && second.room.hasMatch).toBe(true);
  });

  it("e_true_com_a_partida_em_andamento_ao_reconectar", () => {
    const ctx = joinAndStart();
    const token = ctx.created.ok ? ctx.created.token : "";
    const rejoined = ctx.service.rejoinRoom({ token, connectionId: "a2" });
    expect(rejoined.ok && rejoined.room.hasMatch).toBe(true);
  });

  it("continua_true_com_a_partida_encerrada", () => {
    const ctx = joinAndStart();
    playUntilEnd(ctx);
    const change = ctx.service.disconnectPlayer({ connectionId: "a" });
    expect(change?.room?.hasMatch).toBe(true);
  });

  it("continua_true_para_quem_fica_apos_desistencia_do_oponente", () => {
    const ctx = joinAndStart();
    const change = ctx.service.leaveRoom({ connectionId: "a" });
    expect(change?.room?.players.some((p) => p.ready)).toBe(false);
    expect(change?.room?.hasMatch).toBe(true);
  });

  it("continua_true_para_quem_fica_apos_o_oponente_sair_com_a_partida_encerrada", () => {
    const ctx = joinAndStart();
    playUntilEnd(ctx);
    const change = ctx.service.leaveRoom({ connectionId: "a" });
    expect(change?.room?.hasMatch).toBe(true);
  });

  it("volta_a_false_quando_um_novo_jogador_entra_depois_do_fim", () => {
    const ctx = joinAndStart();
    ctx.service.leaveRoom({ connectionId: "a" });
    const joined = ctx.service.joinRoom({ code: ctx.code, nickname: "Cadu", connectionId: "c" });
    expect(joined.ok && joined.room.hasMatch).toBe(false);
  });
});
