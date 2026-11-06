// src/client/scene/layout.test.ts
import { describe, expect, it } from "vitest";
import { createMatch } from "../../engine/createMatch.js";
import { playerView } from "../../engine/playerView.js";
import type { MatchState } from "../../engine/types.js";
import { allSlots, layoutBoard, slotPosition } from "./layout.js";

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
    state.players.P2.spellTraps[0] = { cardId: "mirror_wall", faceDown: true, setOnTurn: 1 };
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
