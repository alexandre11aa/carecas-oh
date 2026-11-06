// src/engine/eventView.test.ts
import { describe, expect, it } from "vitest";
import { eventView } from "./eventView.js";
import type { GameEvent } from "./types.js";

describe("eventView", () => {
  it("remove_o_id_da_carta_comprada_pelo_oponente", () => {
    const event: GameEvent = { type: "CARD_DRAWN", player: "P2", cardId: "ash_dragon" };
    expect(eventView(event, "P1")).toEqual({ type: "CARD_DRAWN", player: "P2", cardId: null });
  });

  it("mantem_a_carta_comprada_pelo_proprio_jogador", () => {
    const event: GameEvent = { type: "CARD_DRAWN", player: "P1", cardId: "ash_dragon" };
    expect(eventView(event, "P1")).toEqual(event);
  });

  it("oculta_monstro_baixado_virado_do_oponente", () => {
    const event: GameEvent = { type: "MONSTER_SUMMONED", player: "P2", cardId: "x", zone: 1, position: "DEFENSE", faceDown: true };
    expect(eventView(event, "P1")).toEqual({ ...event, cardId: null });
    expect(eventView(event, "P2")).toEqual(event);
  });

  it("mantem_monstro_invocado_virado_para_cima", () => {
    const event: GameEvent = { type: "MONSTER_SUMMONED", player: "P2", cardId: "x", zone: 1, position: "ATTACK", faceDown: false };
    expect(eventView(event, "P1")).toEqual(event);
  });

  it("oculta_mudanca_de_posicao_virada_e_magia_ou_armadilha_baixada_do_oponente", () => {
    const change: GameEvent = { type: "POSITION_CHANGED", player: "P2", cardId: "x", position: "DEFENSE", faceDown: true };
    const set: GameEvent = { type: "SPELL_TRAP_SET", player: "P2", cardId: "t", zone: 0 };
    expect(eventView(change, "P1")).toEqual({ ...change, cardId: null });
    expect(eventView(set, "P1")).toEqual({ ...set, cardId: null });
    expect(eventView(set, "P2")).toEqual(set);
  });

  it("oculta_id_do_reforco_do_oponente_e_mantem_alvos_por_zona_publicos", () => {
    const spell: GameEvent = { type: "SPELL_ACTIVATED", player: "P2", cardId: "s", targetZone: 2 };
    const attack: GameEvent = { type: "ATTACK_DECLARED", player: "P2", attackerCardId: "a", targetZone: 1 };
    const boost: GameEvent = { type: "ATTACK_BOOSTED", player: "P2", cardId: "m", zone: 2, amount: 500 };
    expect(eventView(spell, "P1")).toEqual(spell);
    expect(eventView(attack, "P1")).toEqual(attack);
    expect(eventView(boost, "P1")).toEqual({ ...boost, cardId: null });
    expect(eventView(boost, "P2")).toEqual(boost);
  });

  it("nao_altera_eventos_publicos_nem_o_evento_original", () => {
    const grave: GameEvent = { type: "CARD_SENT_TO_GRAVEYARD", player: "P2", cardId: "x" };
    const trap: GameEvent = { type: "TRAP_ACTIVATED", player: "P2", cardId: "t", trigger: "SUMMON" };
    const drawn: GameEvent = { type: "CARD_DRAWN", player: "P2", cardId: "c" };
    expect(eventView(grave, "P1")).toEqual(grave);
    expect(eventView(trap, "P1")).toEqual(trap);
    eventView(drawn, "P1");
    expect(drawn).toEqual({ type: "CARD_DRAWN", player: "P2", cardId: "c" });
  });
});
