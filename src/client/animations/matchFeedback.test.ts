// src/client/animations/matchFeedback.test.ts
import { describe, expect, it } from "vitest";
import { createMatch } from "../../engine/createMatch.js";
import { playerView } from "../../engine/playerView.js";
import type { MonsterOnField } from "../../engine/types.js";
import { slotPosition } from "../scene/layout.js";
import { buildFeedback } from "./matchFeedback.js";

const monster = (cardId: string, extra: Partial<MonsterOnField> = {}): MonsterOnField => ({ cardId, faceDown: false, position: "ATTACK", hasAttacked: false, summonedOnTurn: 1, changedPositionOnTurn: null, ...extra });
const initial = () => createMatch(123, { P1: "control", P2: "balanced" });

describe("apresentação dos eventos da partida", () => {
  it("nao_reproduz_efeitos_na_reconexao_sem_eventos", () => {
    const view = playerView(initial(), "P1");
    expect(buildFeedback(view, view, [])).toEqual([]);
  });

  it("identifica_a_copia_que_atacou_por_mudanca_na_zona_e_mostra_escudo_no_defensor", () => {
    const state = initial();
    state.players.P1.monsters[0] = monster("bone_knight");
    state.players.P1.monsters[3] = monster("bone_knight");
    state.players.P2.monsters[2] = monster("ash_sprite", { position: "DEFENSE", faceDown: true });
    const before = structuredClone(playerView(state, "P1"));
    state.players.P1.monsters[3]!.hasAttacked = true;
    const after = playerView(state, "P1");
    const steps = buildFeedback(before, after, [{ type: "ATTACK_DECLARED", player: "P1", attackerCardId: "bone_knight", targetZone: 2 }]);
    expect(steps).toEqual([
      { sound: "attack", notice: null, effects: [{ kind: "attack", from: slotPosition("you", "monster", 3), to: slotPosition("opponent", "monster", 2) }] },
      { sound: "damage", notice: null, effects: [{ kind: "defend", at: slotPosition("opponent", "monster", 2) }] },
    ]);
    expect(JSON.stringify(steps)).not.toContain("ash_sprite");
  });

  it("ataque_direto_usa_o_lado_correto_sem_inventar_dano_em_monstro", () => {
    const state = initial();
    state.players.P2.monsters[4] = monster("ash_sprite");
    const before = structuredClone(playerView(state, "P1"));
    state.players.P2.monsters[4]!.hasAttacked = true;
    const steps = buildFeedback(before, playerView(state, "P1"), [{ type: "ATTACK_DECLARED", player: "P2", attackerCardId: "ash_sprite", targetZone: null }]);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.effects).toEqual([{ kind: "attack", from: slotPosition("opponent", "monster", 4), to: { x: 0, z: 5 } }]);
  });

  it("envia_ao_cemiterio_a_copia_removida_sem_escolher_a_que_continua_em_campo", () => {
    const state = initial();
    state.players.P1.monsters[0] = monster("bone_knight");
    state.players.P1.monsters[4] = monster("bone_knight");
    const before = structuredClone(playerView(state, "P1"));
    state.players.P1.monsters[4] = null;
    const [step] = buildFeedback(before, playerView(state, "P1"), [{ type: "CARD_SENT_TO_GRAVEYARD", player: "P1", cardId: "bone_knight" }]);
    expect(step!.sound).toBe("destroyed");
    expect(step!.effects).toEqual([{ kind: "graveyard", cardId: "bone_knight", from: slotPosition("you", "monster", 4), to: slotPosition("you", "graveyard") }]);
  });

  it("nao_inventa_zona_quando_duas_copias_saem_juntas", () => {
    const state = initial();
    state.players.P1.monsters[0] = monster("bone_knight");
    state.players.P1.monsters[4] = monster("bone_knight");
    const before = structuredClone(playerView(state, "P1"));
    state.players.P1.monsters.fill(null);
    const steps = buildFeedback(before, playerView(state, "P1"), [
      { type: "CARD_SENT_TO_GRAVEYARD", player: "P1", cardId: "bone_knight" },
      { type: "CARD_SENT_TO_GRAVEYARD", player: "P1", cardId: "bone_knight" },
    ]);
    expect(steps.map((step) => step.effects[0])).toEqual(Array(2).fill({ kind: "graveyard", cardId: "bone_knight", from: { x: 6.1 * 0.65, z: 1.4 }, to: slotPosition("you", "graveyard") }));
  });

  it("mantem_ordem_de_cemiterio_dano_cura_e_fim_com_lados_corretos", () => {
    const after = playerView(initial(), "P2");
    const steps = buildFeedback(null, after, [
      { type: "CARD_SENT_TO_GRAVEYARD", player: "P1", cardId: "bone_knight" },
      { type: "DAMAGE_DEALT", player: "P1", amount: 800 },
      { type: "LIFE_RESTORED", player: "P2", amount: 400 },
      { type: "MATCH_ENDED", winner: "P2" },
    ]);
    expect(steps.map((step) => [step.sound, step.notice?.kind, step.notice?.side])).toEqual([
      ["destroyed", "GRAVEYARD", "opponent"], ["damage", "DAMAGE", "opponent"], ["gainlp", "HEAL", "you"], [null, "END", "you"],
    ]);
    expect(steps[1]!.effects).toEqual([{ kind: "damage", side: "opponent" }]);
    expect(steps[2]!.effects).toEqual([{ kind: "heal", side: "you" }]);
  });

  it("compra_oculta_tem_som_sem_buscar_identidade_ou_imagem", () => {
    const after = playerView(initial(), "P1");
    expect(buildFeedback(null, after, [{ type: "CARD_DRAWN", player: "P2", cardId: null }])).toEqual([{ sound: "draw", notice: null, effects: [], drewSide: "opponent" }]);
  });

  it("mapeia_invocacao_baixa_ativacao_reforco_virada_turno_e_fase", () => {
    const after = playerView(initial(), "P1");
    const steps = buildFeedback(null, after, [
      { type: "MONSTER_SUMMONED", player: "P2", cardId: null, zone: 0, faceDown: true, position: "DEFENSE" },
      { type: "MONSTER_SUMMONED", player: "P1", cardId: "bone_knight", zone: 0, faceDown: false, position: "ATTACK" },
      { type: "SPELL_TRAP_SET", player: "P2", cardId: null, zone: 0 },
      { type: "SPELL_ACTIVATED", player: "P1", cardId: "power_surge", targetZone: 0 },
      { type: "TRAP_ACTIVATED", player: "P2", cardId: "spike_pit", trigger: "ATTACK_DECLARED" },
      { type: "ATTACK_BOOSTED", player: "P1", cardId: "bone_knight", zone: 0, amount: 700 },
      { type: "MONSTER_FLIPPED", player: "P2", cardId: "ash_sprite" },
      { type: "TURN_STARTED", player: "P1", turn: 2 },
      { type: "PHASE_CHANGED", phase: "MAIN_1" },
    ]);
    expect(steps.map((step) => step.sound)).toEqual(["set", "summon", "set", "activate", "activate", "equip", "flip", "nextturn", "phase"]);
    expect(steps[0]!.notice!.cardId).toBeNull();
  });
});
