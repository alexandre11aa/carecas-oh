// src/engine/applyAction.test.ts
import { describe, expect, it } from "vitest";
import { applyAction } from "./applyAction.js";
import { createMatch } from "./createMatch.js";
import { canAttack, opponentOf } from "./rules/turn.js";
import type { MatchState } from "./types.js";

const next = (state: MatchState): MatchState => {
  const r = applyAction(state, state.currentPlayer, { type: "NEXT_PHASE" });
  if (!r.ok) throw new Error("esperado ok");
  return r.state;
};

const start = (): MatchState => next(createMatch(42));

describe("applyAction - turnos", () => {
  it("compra_automatica_ao_sair_da_fase_de_compra", () => {
    const initial = createMatch(42);
    const p = initial.currentPlayer;
    const result = applyAction(initial, p, { type: "NEXT_PHASE" });
    if (!result.ok) throw new Error("esperado ok");
    expect(result.state.phase).toBe("MAIN_1");
    expect(result.state.players[p].hand).toHaveLength(6);
    expect(result.state.players[p].deck).toHaveLength(4);
    expect(result.state.players[p].hand[5]).toBe(initial.players[p].deck[0]);
    expect(result.events[0]).toEqual({ type: "CARD_DRAWN", player: p, cardId: initial.players[p].deck[0] });
  });

  it("nao_altera_o_estado_recebido", () => {
    const initial = createMatch(42);
    const snapshot = structuredClone(initial);
    applyAction(initial, initial.currentPlayer, { type: "NEXT_PHASE" });
    applyAction(initial, opponentOf(initial.currentPlayer), { type: "END_TURN" });
    expect(initial).toEqual(snapshot);
  });

  it("percorre_as_fases_em_ordem", () => {
    let state = start();
    const phases: string[] = [state.phase];
    for (let i = 0; i < 3; i++) {
      state = next(state);
      phases.push(state.phase);
    }
    expect(phases).toEqual(["MAIN_1", "BATTLE", "MAIN_2", "END"]);
  });

  it("next_phase_na_fase_final_retorna_invalid_phase", () => {
    let state = start();
    for (let i = 0; i < 3; i++) state = next(state);
    expect(applyAction(state, state.currentPlayer, { type: "NEXT_PHASE" })).toEqual({
      ok: false,
      code: "INVALID_PHASE",
    });
  });

  it("end_turn_passa_o_turno_compra_e_vai_para_main_1", () => {
    const state = start();
    const first = state.currentPlayer;
    const other = opponentOf(first);
    const r = applyAction(state, first, { type: "END_TURN" });
    if (!r.ok) throw new Error("esperado ok");
    expect(r.state.currentPlayer).toBe(other);
    expect(r.state.turn).toBe(2);
    expect(r.state.phase).toBe("MAIN_1");
    expect(r.state.players[other].hand).toHaveLength(6);
    expect(r.state.players[other].deck).toHaveLength(4);
    expect(r.events.map((e) => e.type)).toEqual(["TURN_STARTED", "CARD_DRAWN", "PHASE_CHANGED"]);
  });

  it("end_turn_reinicia_a_invocacao_normal_do_novo_jogador", () => {
    const state = start();
    const other = opponentOf(state.currentPlayer);
    const modified: MatchState = {
      ...state,
      players: { ...state.players, [other]: { ...state.players[other], normalSummonUsed: true } },
    };
    const r = applyAction(modified, state.currentPlayer, { type: "END_TURN" });
    if (!r.ok) throw new Error("esperado ok");
    expect(r.state.players[other].normalSummonUsed).toBe(false);
  });

  it("end_turn_na_fase_de_compra_retorna_invalid_phase", () => {
    const initial = createMatch(42);
    expect(applyAction(initial, initial.currentPlayer, { type: "END_TURN" })).toEqual({
      ok: false,
      code: "INVALID_PHASE",
    });
  });

  it("quem_inicia_o_primeiro_turno_nao_ataca", () => {
    const state = start();
    expect(canAttack(state)).toBe(false);
    const r = applyAction(state, state.currentPlayer, { type: "END_TURN" });
    if (!r.ok) throw new Error("esperado ok");
    expect(canAttack(r.state)).toBe(true);
  });

  it("jogador_sem_carta_para_comprar_perde", () => {
    const state = start();
    const first = state.currentPlayer;
    const other = opponentOf(first);
    const emptied: MatchState = {
      ...state,
      players: { ...state.players, [other]: { ...state.players[other], deck: [] } },
    };
    const r = applyAction(emptied, first, { type: "END_TURN" });
    if (!r.ok) throw new Error("esperado ok");
    expect(r.state.winner).toBe(first);
    expect(r.events).toContainEqual({ type: "MATCH_ENDED", winner: first });
    expect(r.state.players[other].hand).toHaveLength(5);
  });

  it("partida_encerrada_rejeita_acoes", () => {
    const state: MatchState = { ...start(), winner: "P1" };
    expect(applyAction(state, state.currentPlayer, { type: "END_TURN" })).toEqual({
      ok: false,
      code: "MATCH_ENDED",
    });
  });

  it("acao_fora_do_turno_retorna_not_your_turn", () => {
    const state = start();
    const other = opponentOf(state.currentPlayer);
    expect(applyAction(state, other, { type: "NEXT_PHASE" })).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
    expect(applyAction(state, other, { type: "END_TURN" })).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
  });

  it("responder_sem_janela_aberta_retorna_no_response_window", () => {
    const state = start();
    expect(applyAction(state, state.currentPlayer, { type: "ACTIVATE_TRAP", cardId: "x" })).toEqual({
      ok: false,
      code: "NO_RESPONSE_WINDOW",
    });
  });
});
