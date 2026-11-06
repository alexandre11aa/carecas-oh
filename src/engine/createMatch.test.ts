// src/engine/createMatch.test.ts
import { describe, expect, it } from "vitest";
import { createMatch } from "./createMatch";

describe("createMatch", () => {
  it("cria_jogadores_com_8000_lp_5_cartas_na_mao_e_5_no_deck", () => {
    const state = createMatch(42);
    for (const id of ["P1", "P2"] as const) {
      expect(state.players[id].lifePoints).toBe(8000);
      expect(state.players[id].hand).toHaveLength(5);
      expect(state.players[id].deck).toHaveLength(5);
    }
    expect(state.turn).toBe(1);
    expect(state.phase).toBe("DRAW");
    expect(state.winner).toBeNull();
  });

  it("mesma_semente_gera_mesmo_estado", () => {
    expect(createMatch(7)).toEqual(createMatch(7));
  });

  it("define_quem_comeca_pela_semente_e_ambos_os_jogadores_podem_comecar", () => {
    const starters = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) starters.add(createMatch(seed).currentPlayer);
    expect(starters).toEqual(new Set(["P1", "P2"]));
  });

  it("estado_e_serializavel_em_json", () => {
    const state = createMatch(5);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
