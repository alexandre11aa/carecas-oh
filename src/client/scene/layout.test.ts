// src/client/scene/layout.test.ts
import { describe, expect, it } from "vitest";
import { createMatch } from "../../engine/createMatch.js";
import { playerView } from "../../engine/playerView.js";
import type { MatchState } from "../../engine/types.js";
import { allSlots, CARD_HEIGHT, CARD_WIDTH, layoutBoard, pickSlot, slotPosition } from "./layout.js";

const baseState = (): MatchState => createMatch(123);

describe("layout da mesa", () => {
  it("tem_5_zonas_de_monstro_5_de_magia_deck_e_cemiterio_por_jogador", () => {
    const slots = allSlots();
    for (const side of ["you", "opponent"] as const) {
      const own = slots.filter((s) => s.side === side);
      expect(own.filter((s) => s.kind === "monster")).toHaveLength(5);
      expect(own.filter((s) => s.kind === "spellTrap")).toHaveLength(5);
      expect(own.filter((s) => s.kind === "deck")).toHaveLength(1);
      expect(own.filter((s) => s.kind === "graveyard")).toHaveLength(1);
    }
    expect(new Set(slots.map((s) => s.key)).size).toBe(slots.length);
  });

  it("espelha_o_lado_do_oponente_girando_a_mesa_180_graus", () => {
    const you = slotPosition("you", "monster", 0);
    const opponent = slotPosition("opponent", "monster", 0);
    expect(opponent.x).toBeCloseTo(-you.x);
    expect(opponent.z).toBeCloseTo(-you.z);
  });

  it("no_inicio_so_ha_os_decks_na_mesa", () => {
    const placements = layoutBoard(playerView(baseState(), "P1"));
    expect(placements.map((p) => p.key).sort()).toEqual(["opponent:deck:0", "you:deck:0"]);
    expect(placements.every((p) => p.faceDown && p.cardId === null)).toBe(true);
  });

  it("representa_posicoes_de_ataque_defesa_e_virada", () => {
    const state = baseState();
    state.players.P1.monsters[0] = { cardId: "ash_sprite", position: "ATTACK", faceDown: false, summonedOnTurn: 1, hasAttacked: false, changedPositionOnTurn: null };
    state.players.P1.monsters[1] = { cardId: "moss_golem", position: "DEFENSE", faceDown: false, summonedOnTurn: 1, hasAttacked: false, changedPositionOnTurn: null };
    state.players.P1.monsters[2] = { cardId: "tide_imp", position: "DEFENSE", faceDown: true, summonedOnTurn: 1, hasAttacked: false, changedPositionOnTurn: null };
    const byKey = new Map(layoutBoard(playerView(state, "P1")).map((p) => [p.key, p]));
    expect(byKey.get("you:monster:0")).toMatchObject({ cardId: "ash_sprite", faceDown: false, yaw: 0 });
    expect(byKey.get("you:monster:1")).toMatchObject({ cardId: "moss_golem", faceDown: false, yaw: Math.PI / 2 });
    expect(byKey.get("you:monster:2")).toMatchObject({ faceDown: true, yaw: Math.PI / 2 });
  });

  it("monstro_virado_do_oponente_vira_carta_de_costas_sem_identidade", () => {
    const state = baseState();
    state.players.P2.monsters[3] = { cardId: "tide_imp", position: "DEFENSE", faceDown: true, summonedOnTurn: 1, hasAttacked: false, changedPositionOnTurn: null };
    state.players.P2.spellTraps[0] = { cardId: "divine_glory_evasion", faceDown: true, setOnTurn: 1 };
    const byKey = new Map(layoutBoard(playerView(state, "P1")).map((p) => [p.key, p]));
    expect(byKey.get("opponent:monster:3")).toMatchObject({ cardId: null, faceDown: true, yaw: Math.PI + Math.PI / 2 });
    expect(byKey.get("opponent:spellTrap:0")).toMatchObject({ cardId: null, faceDown: true });
  });

  it("mostra_o_topo_do_cemiterio_virado_para_cima", () => {
    const state = baseState();
    state.players.P2.graveyard = ["fire_bolt", "wind_gust"];
    const byKey = new Map(layoutBoard(playerView(state, "P1")).map((p) => [p.key, p]));
    expect(byKey.get("opponent:graveyard:0")).toMatchObject({ cardId: "wind_gust", faceDown: false });
    expect(byKey.has("you:graveyard:0")).toBe(false);
  });

  it("some_o_deck_quando_vazio", () => {
    const state = baseState();
    state.players.P1.deck = [];
    const keys = layoutBoard(playerView(state, "P1")).map((p) => p.key);
    expect(keys).not.toContain("you:deck:0");
    expect(keys).toContain("opponent:deck:0");
  });
});

describe("pickSlot", () => {
  it("devolve_o_slot_cujo_centro_foi_clicado_para_todos_os_slots", () => {
    for (const slot of allSlots()) expect(pickSlot(slot.x, slot.z)?.key).toBe(slot.key);
  });

  it("devolve_o_slot_para_pontos_dentro_da_zona_fora_do_centro", () => {
    const { x, z } = slotPosition("opponent", "monster", 2);
    expect(pickSlot(x + 0.5, z - 0.8)?.key).toBe("opponent:monster:2");
  });

  it("devolve_null_fora_de_qualquer_slot", () => {
    expect(pickSlot(0, 0)).toBeNull();
    expect(pickSlot(20, 20)).toBeNull();
  });
});

describe("proporcao_da_carta", () => {
  it("usa_a_proporcao_1030_por_1500", () => {
    expect(CARD_WIDTH / CARD_HEIGHT).toBeCloseTo(1030 / 1500, 10);
  });
});
