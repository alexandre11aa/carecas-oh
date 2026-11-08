// src/engine/createMatch.test.ts
import { describe, expect, it } from "vitest";
import { createMatch } from "./createMatch.js";
import { getDeck } from "./decks.js";

const DECKS_IN_USE = { P1: "aggressive", P2: "defensive" } as const;

describe("createMatch", () => {
  it("cria_jogadores_com_4000_lp_4_cartas_na_mao_e_6_no_deck", () => {
    const state = createMatch(42, { P1: "balanced", P2: "strategic" });
    for (const id of ["P1", "P2"] as const) {
      expect(state.players[id].lifePoints).toBe(4000);
      expect(state.players[id].hand).toHaveLength(4);
      expect(state.players[id].deck).toHaveLength(6);
    }
    expect(state.turn).toBe(1);
    expect(state.phase).toBe("DRAW");
    expect(state.winner).toBeNull();
  });

  it("mesma_semente_gera_mesmo_estado", () => {
    expect(createMatch(7, { P1: "balanced", P2: "strategic" })).toEqual(createMatch(7, { P1: "balanced", P2: "strategic" }));
  });

  it("define_quem_comeca_pela_semente_e_ambos_os_jogadores_podem_comecar", () => {
    const starters = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) starters.add(createMatch(seed, { P1: "balanced", P2: "strategic" }).currentPlayer);
    expect(starters).toEqual(new Set(["P1", "P2"]));
  });

  it("estado_e_serializavel_em_json", () => {
    const state = createMatch(5, { P1: "balanced", P2: "strategic" });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("cada_jogador_recebe_as_cartas_do_proprio_deck_e_guarda_o_deckId", () => {
    const state = createMatch(42, DECKS_IN_USE);
    expect(state.players.P1.deckId).toBe("aggressive");
    expect(state.players.P2.deckId).toBe("defensive");
    const p1 = [...state.players.P1.hand, ...state.players.P1.deck];
    expect([...p1].sort()).toEqual([...getDeck("aggressive").cardIds].sort());
    const p2 = [...state.players.P2.hand, ...state.players.P2.deck];
    expect([...p2].sort()).toEqual([...getDeck("defensive").cardIds].sort());
  });

  it("mesma_semente_gera_mesma_mao_e_sementes_diferentes_geram_ordens_diferentes", () => {
    expect(createMatch(9, DECKS_IN_USE).players.P1.hand).toEqual(createMatch(9, DECKS_IN_USE).players.P1.hand);
    const orders = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const p = createMatch(seed, DECKS_IN_USE).players.P1;
      orders.add([...p.hand, ...p.deck].join(","));
    }
    expect(orders.size).toBeGreaterThan(15);
  });

  it("permite_que_os_dois_jogadores_usem_o_mesmo_deck", () => {
    const state = createMatch(3, { P1: "magic", P2: "magic" });
    expect(state.players.P1.hand).toHaveLength(4);
    expect([...state.players.P1.hand, ...state.players.P1.deck].sort()).toEqual(
      [...state.players.P2.hand, ...state.players.P2.deck].sort(),
    );
    expect([...state.players.P1.hand, ...state.players.P1.deck]).not.toEqual([
      ...state.players.P2.hand,
      ...state.players.P2.deck,
    ]);
  });
});
