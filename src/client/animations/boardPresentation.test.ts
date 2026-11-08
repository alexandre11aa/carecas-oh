// src/client/animations/boardPresentation.test.ts
import { describe, expect, it } from "vitest";
import { createMatch } from "../../engine/createMatch.js";
import { playerView } from "../../engine/playerView.js";
import type { MonsterOnField } from "../../engine/types.js";
import { layoutBoard, slotPosition, type CardPlacement } from "../scene/layout.js";
import { arrivePresentationStep, beginPresentationStep, buildPresentationSteps, finishPresentationStep } from "./boardPresentation.js";

const monster = (cardId: string, extra: Partial<MonsterOnField> = {}): MonsterOnField => ({ cardId, faceDown: false, position: "ATTACK", hasAttacked: false, summonedOnTurn: 1, changedPositionOnTurn: null, ...extra });
const initial = () => createMatch(123, { P1: "control", P2: "control" });
const top = (board: readonly CardPlacement[], side = "you") => board.find((card) => card.key === `${side}:graveyard:0`)?.cardId ?? null;

describe("mesa durante envio ao cemitério", () => {
  it("mantem_origem_ate_a_saida_e_topo_anterior_ate_a_chegada", () => {
    const state = initial();
    state.players.P1.monsters[3] = monster("bone_knight", { position: "DEFENSE" });
    state.players.P1.graveyard = ["moss_golem"];
    const before = structuredClone(playerView(state, "P1"));
    state.players.P1.monsters[3] = null;
    state.players.P1.graveyard.push("bone_knight");
    const after = playerView(state, "P1");
    const [step] = buildPresentationSteps(before, after, [{ type: "CARD_SENT_TO_GRAVEYARD", player: "P1", cardId: "bone_knight" }]);
    expect(step!.start).toEqual(layoutBoard(before));
    expect(step!.departures).toEqual(["you:monster:3"]);
    const flight = beginPresentationStep(layoutBoard(before), step!);
    expect(flight.some((card) => card.key === "you:monster:3")).toBe(false);
    expect(top(flight)).toBe("moss_golem");
    expect(step!.feedback.effects).toEqual([{ kind: "graveyard", cardId: "bone_knight", from: slotPosition("you", "monster", 3), to: slotPosition("you", "graveyard"), yaw: Math.PI / 2 }]);
    const arrived = arrivePresentationStep(flight, step!);
    expect(top(arrived)).toBe("bone_knight");
    expect(finishPresentationStep(arrived, step!)).toEqual(layoutBoard(after));
    expect(top(layoutBoard(before))).toBe("moss_golem");
  });

  it("nao_cria_pilha_vazia_antes_da_primeira_chegada", () => {
    const state = initial();
    const before = structuredClone(playerView(state, "P1"));
    state.players.P1.graveyard.push("power_surge");
    const [step] = buildPresentationSteps(before, playerView(state, "P1"), [{ type: "CARD_SENT_TO_GRAVEYARD", player: "P1", cardId: "power_surge" }]);
    const flight = beginPresentationStep(layoutBoard(before), step!);
    expect(top(flight)).toBeNull();
    expect(step!.departures).toEqual([]);
    expect(top(arrivePresentationStep(flight, step!))).toBe("power_surge");
  });

  it("retira_so_a_copia_que_saiu_e_preserva_a_outra_zona", () => {
    const state = initial();
    state.players.P1.monsters[0] = monster("bone_knight");
    state.players.P1.monsters[4] = monster("bone_knight");
    const before = structuredClone(playerView(state, "P1"));
    state.players.P1.monsters[4] = null;
    state.players.P1.graveyard.push("bone_knight");
    const [step] = buildPresentationSteps(before, playerView(state, "P1"), [{ type: "CARD_SENT_TO_GRAVEYARD", player: "P1", cardId: "bone_knight" }]);
    const flight = beginPresentationStep(layoutBoard(before), step!);
    expect(flight.find((card) => card.key === "you:monster:0")?.cardId).toBe("bone_knight");
    expect(flight.some((card) => card.key === "you:monster:4")).toBe(false);
  });

  it("anima_copias_publicas_iguais_juntas_sem_duplicar_o_topo", () => {
    const state = initial();
    state.players.P1.monsters[0] = monster("bone_knight");
    state.players.P1.monsters[4] = monster("bone_knight");
    state.players.P1.graveyard = ["moss_golem"];
    const before = structuredClone(playerView(state, "P1"));
    state.players.P1.monsters.fill(null);
    state.players.P1.graveyard.push("bone_knight", "bone_knight");
    const after = playerView(state, "P1");
    const steps = buildPresentationSteps(before, after, [
      { type: "CARD_SENT_TO_GRAVEYARD", player: "P1", cardId: "bone_knight" },
      { type: "CARD_SENT_TO_GRAVEYARD", player: "P1", cardId: "bone_knight" },
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.departures).toEqual(["you:monster:0", "you:monster:4"]);
    expect(steps[0]!.feedback.effects.map((effect) => "from" in effect ? effect.from : null)).toEqual([slotPosition("you", "monster", 0), slotPosition("you", "monster", 4)]);
    const flight = beginPresentationStep(layoutBoard(before), steps[0]!);
    expect(top(flight)).toBe("moss_golem");
    const arrived = arrivePresentationStep(flight, steps[0]!);
    expect(arrived.filter((card) => card.key === "you:graveyard:0")).toHaveLength(1);
    expect(finishPresentationStep(arrived, steps[0]!)).toEqual(layoutBoard(after));
  });

  it("preserva_informacao_oculta_e_nao_atribui_identidade_a_zona_ambigua", () => {
    const state = initial();
    state.players.P2.monsters[0] = monster("bone_knight", { faceDown: true });
    state.players.P2.monsters[4] = monster("moss_golem", { faceDown: true });
    const before = structuredClone(playerView(state, "P1"));
    state.players.P2.monsters.fill(null);
    state.players.P2.graveyard.push("bone_knight", "moss_golem");
    const steps = buildPresentationSteps(before, playerView(state, "P1"), [
      { type: "CARD_SENT_TO_GRAVEYARD", player: "P2", cardId: "bone_knight" },
      { type: "CARD_SENT_TO_GRAVEYARD", player: "P2", cardId: "moss_golem" },
    ]);
    expect(steps[0]!.start!.filter((card) => card.key.startsWith("opponent:monster:")).map((card) => card.cardId)).toEqual([null, null]);
    expect(steps[0]!.feedback.effects).toEqual([{ kind: "graveyard", cardId: "bone_knight", from: { x: -6.1 * 0.65, z: -1.4 }, to: slotPosition("opponent", "graveyard") }]);
    expect(steps[1]!.departures).toEqual([]);
  });

  it("mantem_os_dois_lados_e_lotes_sequenciais_sem_antecipar_o_topo_seguinte", () => {
    const state = initial();
    state.players.P1.monsters[0] = monster("bone_knight");
    state.players.P2.monsters[4] = monster("moss_golem");
    state.players.P1.graveyard = ["power_surge"];
    state.players.P2.graveyard = ["spike_pit"];
    const before = structuredClone(playerView(state, "P1"));
    state.players.P1.monsters[0] = null;
    state.players.P1.graveyard.push("bone_knight");
    const middle = structuredClone(playerView(state, "P1"));
    const first = buildPresentationSteps(before, middle, [{ type: "CARD_SENT_TO_GRAVEYARD", player: "P1", cardId: "bone_knight" }])[0]!;
    state.players.P2.monsters[4] = null;
    state.players.P2.graveyard.push("moss_golem");
    const after = playerView(state, "P1");
    const second = buildPresentationSteps(middle, after, [{ type: "CARD_SENT_TO_GRAVEYARD", player: "P2", cardId: "moss_golem" }])[0]!;
    let board = beginPresentationStep(layoutBoard(before), first);
    expect(top(board)).toBe("power_surge");
    expect(top(board, "opponent")).toBe("spike_pit");
    expect(board.find((card) => card.key === "opponent:monster:4")?.cardId).toBe("moss_golem");
    board = finishPresentationStep(arrivePresentationStep(board, first), first);
    expect(board).toEqual(layoutBoard(middle));
    board = beginPresentationStep(board, second);
    expect(top(board)).toBe("bone_knight");
    expect(top(board, "opponent")).toBe("spike_pit");
    board = finishPresentationStep(arrivePresentationStep(board, second), second);
    expect(board).toEqual(layoutBoard(after));
  });

  it("nao_repete_historico_sem_visao_anterior", () => {
    const after = playerView(initial(), "P1");
    const [step] = buildPresentationSteps(null, after, [{ type: "CARD_SENT_TO_GRAVEYARD", player: "P1", cardId: "bone_knight" }]);
    expect(step!.feedback).toEqual({ sound: null, effects: [], notice: null });
    expect(step!.start).toEqual(layoutBoard(after));
    expect(step!.finish).toEqual(layoutBoard(after));
  });
});
