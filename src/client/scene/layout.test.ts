// src/client/scene/layout.test.ts
import { describe, expect, it } from "vitest";
import { createMatch } from "../../engine/createMatch.js";
import { playerView } from "../../engine/playerView.js";
import type { MatchState } from "../../engine/types.js";
import {
  allSlots,
  CARD_BASE_Y,
  CARD_HEIGHT,
  CARD_WIDTH,
  layoutBoard,
  PILE_LAYER_THICKNESS,
  PILE_MAX_LAYERS,
  pickSlot,
  pileHeight,
  pileLayers,
  pileTopY,
  pileBodyYs,
  PILE_BODY_THICKNESS,
  slotPosition,
} from "./layout.js";
import { zoneOuterSize } from "./tableDesign.js";

const baseState = (): MatchState => createMatch(123, { P1: "balanced", P2: "strategic" });

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

  it("devolve_o_slot_certo_no_centro_e_nas_bordas_e_null_logo_fora", () => {
    const { width, height } = zoneOuterSize();
    const eps = 1e-6;
    for (const slot of allSlots()) {
      // Bordas testadas com 1e-9 de folga para dentro (evita ruído de ponto flutuante).
      const hw = width / 2 - 1e-9;
      const hh = height / 2 - 1e-9;
      const inside = [
        [slot.x, slot.z],
        [slot.x - hw, slot.z - hh],
        [slot.x + hw, slot.z + hh],
        [slot.x - hw, slot.z + hh],
        [slot.x + hw, slot.z - hh],
        [slot.x + hw, slot.z],
        [slot.x - hw, slot.z],
        [slot.x, slot.z + hh],
        [slot.x, slot.z - hh],
      ] as const;
      for (const [x, z] of inside) expect(pickSlot(x, z)?.key).toBe(slot.key);
      expect(pickSlot(slot.x + hw + eps, slot.z)).toBeNull();
      expect(pickSlot(slot.x - hw - eps, slot.z)).toBeNull();
      expect(pickSlot(slot.x, slot.z + hh + eps)).toBeNull();
      expect(pickSlot(slot.x, slot.z - hh - eps)).toBeNull();
    }
  });

  it("area_de_clique_coincide_com_a_zona_desenhada_e_um_ponto_pertence_a_no_maximo_um_slot", () => {
    const { width, height } = zoneOuterSize();
    const slots = allSlots();
    for (const slot of slots) {
      const pos = slotPosition(slot.side, slot.kind, slot.zone);
      expect(pos).toEqual({ x: slot.x, z: slot.z });
    }
    // A varredura roda ~71 mil pontos; expect por ponto custava ~2s (estourava o timeout sob carga).
    // Acumulamos as divergências e afirmamos uma única vez (lista vazia = nenhuma divergência).
    const divergencias: string[] = [];
    for (let x = -8; x <= 8; x += 0.05) {
      for (let z = -5.5; z <= 5.5; z += 0.05) {
        let count = 0;
        let first: string | undefined;
        for (const s of slots) {
          if (Math.abs(x - s.x) <= width / 2 && Math.abs(z - s.z) <= height / 2) {
            if (count === 0) first = s.key;
            count += 1;
          }
        }
        const picked = pickSlot(x, z)?.key;
        if (count > 1 || picked !== first) divergencias.push(`(${x}, ${z}): ${count} slots, esperado ${first}, obtido ${picked}`);
      }
    }
    expect(divergencias).toEqual([]);
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

describe("pilhas de deck e cemiterio", () => {
  it("camadas_crescem_1_a_1_ate_o_teto_do_deck", () => {
    expect(PILE_MAX_LAYERS).toBe(20);
    expect([0, 1, 5, 20, 21, 100].map(pileLayers)).toEqual([0, 1, 5, 20, 20, 20]);
    expect(pileLayers(-3)).toBe(0);
  });

  it("altura_e_y_do_topo_nao_colidem_com_a_mesa", () => {
    expect(PILE_LAYER_THICKNESS).toBe(0.06);
    expect(pileHeight(0)).toBe(0);
    expect(pileHeight(5)).toBeCloseTo(0.3);
    expect(pileTopY(1)).toBe(CARD_BASE_Y);
    expect(pileTopY(5)).toBeCloseTo(0.26);
    expect(pileTopY(20)).toBeCloseTo(1.16);
    expect(pileTopY(0)).toBe(CARD_BASE_Y);
  });

  it("deck_cheio_tem_20_camadas_virado_e_sem_identidade", () => {
    const byKey = new Map(layoutBoard(playerView(baseState(), "P1")).map((p) => [p.key, p]));
    for (const key of ["you:deck:0", "opponent:deck:0"]) {
      expect(byKey.get(key)).toMatchObject({ cardId: null, faceDown: true, layers: 16, y: pileTopY(16) });
    }
  });

  it("deck_vazio_nao_gera_placement", () => {
    const state = baseState();
    state.players.P1.deck = [];
    const keys = layoutBoard(playerView(state, "P1")).map((p) => p.key);
    expect(keys).toEqual(["opponent:deck:0"]);
  });

  it("cemiterio_com_5_cartas_tem_5_camadas_e_topo_e_a_ultima", () => {
    const state = baseState();
    state.players.P1.graveyard = ["a", "b", "c", "d", "fire_bolt"];
    const grave = layoutBoard(playerView(state, "P1")).find((p) => p.key === "you:graveyard:0");
    expect(grave).toMatchObject({ cardId: "fire_bolt", faceDown: false, layers: 5 });
    expect(grave?.y).toBeCloseTo(0.26);
  });

  it("cemiterio_troca_o_topo_e_cresce_1_camada_ao_entrar_carta_e_vazio_nao_desenha", () => {
    const state = baseState();
    const graveOf = () => layoutBoard(playerView(state, "P1")).find((p) => p.key === "you:graveyard:0");
    expect(graveOf()).toBeUndefined();
    state.players.P1.graveyard = ["fire_bolt", "wind_gust"];
    expect(graveOf()).toMatchObject({ cardId: "wind_gust", layers: 2 });
    state.players.P1.graveyard = ["fire_bolt", "wind_gust", "fire_bolt"];
    expect(graveOf()).toMatchObject({ cardId: "fire_bolt", layers: 3 });
  });

  it("cemiterio_acima_do_teto_limita_a_20_camadas", () => {
    const state = baseState();
    state.players.P1.graveyard = Array.from({ length: 25 }, () => "fire_bolt");
    const grave = layoutBoard(playerView(state, "P1")).find((p) => p.key === "you:graveyard:0");
    expect(grave?.layers).toBe(20);
  });

  it("jogador_e_oponente_sao_simetricos", () => {
    const state = baseState();
    state.players.P1.graveyard = ["fire_bolt", "wind_gust", "fire_bolt"];
    state.players.P2.graveyard = ["fire_bolt", "wind_gust", "fire_bolt"];
    const byKey = new Map(layoutBoard(playerView(state, "P1")).map((p) => [p.key, p]));
    for (const kind of ["deck", "graveyard"]) {
      const you = byKey.get(`you:${kind}:0`)!;
      const opp = byKey.get(`opponent:${kind}:0`)!;
      expect(opp.layers).toBe(you.layers);
      expect(opp.y).toBe(you.y);
      expect(opp.x).toBeCloseTo(-you.x);
      expect(opp.z).toBeCloseTo(-you.z);
    }
  });

  it("slots_de_campo_nao_ganham_layers_nem_y", () => {
    const state = baseState();
    state.players.P1.monsters[0] = { cardId: "ash_sprite", position: "ATTACK", faceDown: false, summonedOnTurn: 1, hasAttacked: false, changedPositionOnTurn: null };
    const monster = layoutBoard(playerView(state, "P1")).find((p) => p.key === "you:monster:0")!;
    expect(monster.layers).toBeUndefined();
    expect(monster.y).toBeUndefined();
  });
});

describe("corpo da pilha", () => {
  it("nao_desenha_corpo_com_0_ou_1_camada", () => {
    expect(pileBodyYs(0)).toEqual([]);
    expect(pileBodyYs(1)).toEqual([]);
    expect(pileBodyYs(-3)).toEqual([]);
    expect(pileBodyYs(Number.NaN)).toEqual([]);
  });

  it("tem_uma_placa_por_camada_abaixo_do_topo", () => {
    expect(pileBodyYs(5)).toHaveLength(4);
    expect(pileBodyYs(16)).toHaveLength(15);
    expect(pileBodyYs(20)).toHaveLength(19);
  });

  it("placas_sobem_uma_espessura_e_ficam_abaixo_do_topo", () => {
    const ys = pileBodyYs(16);
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeCloseTo(PILE_LAYER_THICKNESS);
    const topBottom = pileTopY(16);
    expect((ys.at(-1) as number) + PILE_BODY_THICKNESS / 2).toBeLessThan(topBottom);
    expect(ys[0]! - PILE_BODY_THICKNESS / 2).toBeGreaterThan(0);
  });
});
