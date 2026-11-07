// src/server/services/deckChoice.test.ts
import { describe, expect, it } from "vitest";
import { createRoomService } from "./roomService.js";
import { createRoomStore } from "../store/roomStore.js";

const setup = () => {
  const store = createRoomStore();
  const service = createRoomService(store);
  const created = service.createRoom({ nickname: "Ana", connectionId: "a" });
  if (!created.ok) throw new Error("falha ao criar sala");
  service.joinRoom({ code: created.room.code, nickname: "Bia", connectionId: "b" });
  return { store, service, code: created.room.code, tokenA: created.token };
};

const deckIds = (store: ReturnType<typeof setup>["store"], code: string) => store.getRoom(code)!.players.map((p) => p.deckId);

/** Joga NEXT_PHASE/END_TURN até a partida terminar (deck de 5 cartas). */
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

describe("escolha de deck em setReady", () => {
  it("guarda_o_deck_do_jogador_da_conexao_ao_marcar_pronto", () => {
    const { store, service, code } = setup();
    service.setReady({ connectionId: "b", ready: true, deckId: "magic" });
    expect(deckIds(store, code)).toEqual([null, "magic"]);
  });

  it("desmarcar_pronto_descarta_a_escolha", () => {
    const { store, service, code } = setup();
    service.setReady({ connectionId: "a", ready: true, deckId: "magic" });
    service.setReady({ connectionId: "a", ready: false });
    expect(deckIds(store, code)).toEqual([null, null]);
    expect(store.getRoom(code)!.players[0]!.ready).toBe(false);
  });

  it("inicia_a_partida_com_o_deck_de_cada_jogador_e_limpa_a_escolha_do_store", () => {
    const { store, service, code } = setup();
    service.setReady({ connectionId: "a", ready: true, deckId: "aggressive" });
    const started = service.setReady({ connectionId: "b", ready: true, deckId: "defensive" });
    if (!started.ok) throw new Error("não iniciou");
    const state = store.getRoom(code)!.match!.state;
    expect(state.players.P1.deckId).toBe("aggressive");
    expect(state.players.P2.deckId).toBe("defensive");
    expect(deckIds(store, code)).toEqual([null, null]);
    const viewA = started.deliveries.find((d) => d.connectionId === "a")!.view!;
    expect(viewA.you.deckId).toBe("aggressive");
    expect(viewA.opponent.deckId).toBe("defensive");
  });

  it("aceita_decks_iguais_nos_dois_jogadores", () => {
    const { store, service, code } = setup();
    service.setReady({ connectionId: "a", ready: true, deckId: "control" });
    service.setReady({ connectionId: "b", ready: true, deckId: "control" });
    const state = store.getRoom(code)!.match!.state;
    expect([state.players.P1.deckId, state.players.P2.deckId]).toEqual(["control", "control"]);
  });

  it("desconectar_antes_de_iniciar_limpa_a_escolha", () => {
    const { store, service, code } = setup();
    service.setReady({ connectionId: "a", ready: true, deckId: "magic" });
    service.disconnectPlayer({ connectionId: "a" });
    expect(deckIds(store, code)).toEqual([null, null]);
  });

  it("sair_da_sala_limpa_a_escolha_do_jogador_que_ficou", () => {
    const { store, service, code } = setup();
    service.setReady({ connectionId: "b", ready: true, deckId: "magic" });
    service.leaveRoom({ connectionId: "a" });
    expect(deckIds(store, code)).toEqual([null]);
  });

  it("room_rejoined_devolve_o_deck_escolhido_pelo_proprio_jogador_sem_expor_na_sala", () => {
    const ctx = setup();
    ctx.service.setReady({ connectionId: "a", ready: true, deckId: "balanced" });
    const rejoined = ctx.service.rejoinRoom({ token: ctx.tokenA, connectionId: "a2" });
    expect(rejoined.ok && rejoined.deckId).toBe("balanced");
    expect(JSON.stringify(rejoined.ok && rejoined.room)).not.toContain("balanced");
  });
});

describe("escolha de deck em requestRematch", () => {
  const endedMatch = () => {
    const ctx = setup();
    ctx.service.setReady({ connectionId: "a", ready: true, deckId: "aggressive" });
    ctx.service.setReady({ connectionId: "b", ready: true, deckId: "magic" });
    playUntilEnd(ctx);
    return ctx;
  };

  it("guarda_o_deck_do_voto_e_retirar_o_voto_descarta_a_escolha", () => {
    const ctx = endedMatch();
    ctx.service.requestRematch({ connectionId: "a", accept: true, deckId: "control" });
    expect(deckIds(ctx.store, ctx.code)).toEqual(["control", null]);
    ctx.service.requestRematch({ connectionId: "a", accept: false });
    expect(deckIds(ctx.store, ctx.code)).toEqual([null, null]);
  });

  it("revanche_com_decks_diferentes_troca_os_lados_e_o_deck_acompanha_o_jogador", () => {
    const ctx = endedMatch();
    const before = ctx.store.getRoom(ctx.code)!.match!.tokens;
    ctx.service.requestRematch({ connectionId: "a", accept: true, deckId: "defensive" });
    const result = ctx.service.requestRematch({ connectionId: "b", accept: true, deckId: "strategic" });
    expect(result.ok).toBe(true);
    const match = ctx.store.getRoom(ctx.code)!.match!;
    expect(match.tokens).toEqual({ P1: before.P2, P2: before.P1 });
    // O jogador "a" era P1 e agora é P2, levando o deck que escolheu na revanche.
    expect(match.state.players.P1.deckId).toBe("strategic");
    expect(match.state.players.P2.deckId).toBe("defensive");
    expect(match.outcome).toBeNull();
    expect(deckIds(ctx.store, ctx.code)).toEqual([null, null]);
  });

  it("revanche_com_decks_iguais_usa_o_mesmo_deck_nos_dois_lados", () => {
    const ctx = endedMatch();
    ctx.service.requestRematch({ connectionId: "a", accept: true, deckId: "magic" });
    ctx.service.requestRematch({ connectionId: "b", accept: true, deckId: "magic" });
    const state = ctx.store.getRoom(ctx.code)!.match!.state;
    expect([state.players.P1.deckId, state.players.P2.deckId]).toEqual(["magic", "magic"]);
  });

  it("sair_na_tela_de_fim_limpa_a_escolha_do_restante", () => {
    const ctx = endedMatch();
    ctx.service.requestRematch({ connectionId: "b", accept: true, deckId: "magic" });
    ctx.service.leaveRoom({ connectionId: "a" });
    expect(deckIds(ctx.store, ctx.code)).toEqual([null]);
  });

  it("room_rejoined_na_tela_de_fim_devolve_o_deck_do_proprio_voto", () => {
    const ctx = endedMatch();
    ctx.service.requestRematch({ connectionId: "a", accept: true, deckId: "control" });
    const rejoined = ctx.service.rejoinRoom({ token: ctx.tokenA, connectionId: "a2" });
    expect(rejoined.ok && rejoined.deckId).toBe("control");
  });
});
