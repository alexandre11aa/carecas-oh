// src/client/screens/matchEnd.test.ts
import { describe, expect, it } from "vitest";
import type { MatchEnded } from "../state.js";
import { canSurrender, endSummary, rematchState } from "./matchEnd.js";

const ended = (reason: MatchEnded["reason"], you = false, opponent = false): MatchEnded => ({
  winner: "P1",
  reason,
  rematch: { you, opponent },
});

describe("endSummary", () => {
  it("vencedor_e_motivo_por_pontos_de_vida", () => {
    expect(endSummary("P1", "P1", ended("LIFE_ZERO"))).toEqual({
      title: "Você venceu!",
      reason: "Os pontos de vida do perdedor chegaram a zero.",
    });
  });

  it("derrota_por_deck_vazio", () => {
    expect(endSummary("P2", "P1", ended("DECK_OUT"))).toEqual({
      title: "Você perdeu.",
      reason: "O perdedor ficou sem cartas para comprar.",
    });
  });

  it("vitoria_por_saida_do_oponente", () => {
    expect(endSummary("P1", "P1", ended("OPPONENT_LEFT")).reason).toBe("O oponente saiu da partida.");
  });

  it("sem_match_ended_mostra_so_o_titulo", () => {
    expect(endSummary("P1", "P2", null)).toEqual({ title: "Você perdeu.", reason: "" });
  });
});

describe("rematchState", () => {
  it("sem_votos_convida_a_jogar_novamente", () => {
    expect(rematchState(ended("LIFE_ZERO"), true)).toEqual({ label: "Jogar novamente", accept: true, disabled: false, status: "" });
  });

  it("mostra_o_voto_do_oponente", () => {
    expect(rematchState(ended("LIFE_ZERO", false, true), true).status).toBe("O oponente quer jogar novamente.");
  });

  it("depois_de_votar_o_botao_retira_o_voto", () => {
    expect(rematchState(ended("LIFE_ZERO", true, false), true)).toEqual({
      label: "Cancelar revanche",
      accept: false,
      disabled: false,
      status: "Aguardando o oponente...",
    });
  });

  it("sem_oponente_na_sala_nao_ha_revanche", () => {
    const state = rematchState(ended("OPPONENT_LEFT"), false);
    expect(state.disabled).toBe(true);
    expect(state.status).toBe("O oponente saiu: não há revanche.");
  });
});

describe("canSurrender", () => {
  it("mostra_o_botao_com_a_partida_em_andamento", () => {
    expect(canSurrender(null, null)).toBe(true);
  });

  it("esconde_o_botao_com_vencedor", () => {
    expect(canSurrender("P1", null)).toBe(false);
  });

  it("esconde_o_botao_com_resultado_recebido", () => {
    expect(canSurrender(null, ended("OPPONENT_LEFT"))).toBe(false);
  });
});
