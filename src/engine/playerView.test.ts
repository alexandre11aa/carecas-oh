// src/engine/playerView.test.ts
import { describe, expect, it } from "vitest";
import { applyAction } from "./applyAction.js";
import { createMatch } from "./createMatch.js";
import { playerView } from "./playerView.js";
import type { MatchState, MonsterOnField, PlayerId, SpellTrapOnField } from "./types.js";

const pad = <T,>(list: (T | null)[]): (T | null)[] => [...list, ...Array<null>(5 - list.length).fill(null)];

const monster = (cardId: string, extra: Partial<MonsterOnField> = {}): MonsterOnField => ({
  cardId,
  position: "ATTACK",
  faceDown: false,
  summonedOnTurn: 1,
  hasAttacked: false,
  changedPositionOnTurn: null,
  ...extra,
});

const setCard = (cardId: string, faceDown = true): SpellTrapOnField => ({ cardId, faceDown, setOnTurn: 2 });

/** A é o jogador do turno (turno 5); B tem defesa virada, armadilha baixada e mão própria. */
const scenario = () => {
  const base = createMatch(7, { P1: "balanced", P2: "strategic" });
  const a = base.currentPlayer;
  const b: PlayerId = a === "P1" ? "P2" : "P1";
  const state: MatchState = {
    ...base,
    turn: 5,
    phase: "BATTLE",
    players: {
      ...base.players,
      [a]: {
        ...base.players[a],
        hand: ["healing_spring", "storm_hawk"],
        monsters: pad([
          monster("dune_scout", { attackBonus: 300, hasAttacked: true }),
          monster("tide_imp", { faceDown: true, position: "DEFENSE" }),
        ]),
      },
      [b]: {
        ...base.players[b],
        hand: ["fire_bolt", "wind_gust", "arcane_draw"],
        deck: ["ash_dragon", "frost_witch"],
        graveyard: ["bone_knight"],
        monsters: pad([monster("crystal_bat"), monster("moss_golem", { faceDown: true, position: "DEFENSE" })]),
        spellTraps: pad([setCard("divine_glory_evasion"), setCard("spike_pit", false)]),
      },
    },
  };
  return { state, a, b };
};

describe("playerView", () => {
  it("expoe_o_deckId_de_ambos_os_jogadores", () => {
    const { state, a, b } = scenario();
    const view = playerView(state, a);
    expect(view.you.deckId).toBe(state.players[a].deckId);
    expect(view.opponent.deckId).toBe(state.players[b].deckId);
    expect(view.you.deckId).toBe("balanced");
    expect(view.opponent.deckId).toBe("strategic");
  });

  it("nao_vaza_ids_ocultos_do_oponente_nem_a_semente_no_json", () => {
    const { state, a } = scenario();
    const json = JSON.stringify(playerView(state, a));
    for (const hidden of ["fire_bolt", "wind_gust", "arcane_draw", "ash_dragon", "frost_witch", "moss_golem", "divine_glory_evasion"]) {
      expect(json).not.toContain(hidden);
    }
    expect(json).not.toContain("seed");
    expect(json).not.toContain(String(state.seed));
    expect(json).not.toContain('"deck"');
  });

  it("nao_vaza_ordem_dos_decks_nem_o_proprio_deck", () => {
    const { state, a } = scenario();
    const view = playerView(state, a);
    expect(view.you).not.toHaveProperty("deck");
    expect(view.you.deckCount).toBe(state.players[a].deck.length);
    expect(view.opponent.deckCount).toBe(2);
    expect(view.opponent).not.toHaveProperty("hand");
  });

  it("mostra_mao_e_campo_completos_do_proprio_jogador", () => {
    const { state, a } = scenario();
    const { you } = playerView(state, a);
    expect(you.hand).toEqual(["healing_spring", "storm_hawk"]);
    expect(you.monsters[0]).toEqual(state.players[a].monsters[0]);
    expect(you.monsters[1]).toEqual(state.players[a].monsters[1]);
    expect(you.lifePoints).toBe(4000);
  });

  it("mostra_contagem_da_mao_e_campo_publico_do_oponente", () => {
    const { state, a } = scenario();
    const { opponent } = playerView(state, a);
    expect(opponent.handCount).toBe(3);
    expect(opponent.graveyard).toEqual(["bone_knight"]);
    expect(opponent.monsters[0]).toEqual(monster("crystal_bat"));
    expect(opponent.spellTraps[1]).toEqual(setCard("spike_pit", false));
  });

  it("oculta_defesa_virada_e_armadilha_baixada_do_oponente", () => {
    const { state, a } = scenario();
    const { opponent } = playerView(state, a);
    expect(opponent.monsters[1]).toEqual({ cardId: null, faceDown: true, position: "DEFENSE", summonedOnTurn: 1 });
    expect(opponent.spellTraps[0]).toEqual({ cardId: null, faceDown: true, setOnTurn: 2 });
    expect(opponent.monsters[2]).toBeNull();
  });

  it("nao_expoe_bonus_nem_flags_de_monstro_virado_do_oponente", () => {
    const { state, a, b } = scenario();
    const faceDown = state.players[b].monsters[1] as MonsterOnField;
    const next: MatchState = {
      ...state,
      players: {
        ...state.players,
        [b]: {
          ...state.players[b],
          monsters: pad([monster("crystal_bat"), { ...faceDown, attackBonus: 999, hasAttacked: true, changedPositionOnTurn: 4 }]),
        },
      },
    };
    const hidden = playerView(next, a).opponent.monsters[1] as object;
    expect(Object.keys(hidden).sort()).toEqual(["cardId", "faceDown", "position", "summonedOnTurn"]);
  });

  it("mostra_bonus_e_flags_de_monstro_virado_para_cima_do_oponente", () => {
    const { state, b } = scenario();
    const view = playerView(state, b);
    expect(view.opponent.monsters[0]).toMatchObject({ cardId: "dune_scout", attackBonus: 300, hasAttacked: true });
    expect(view.opponent.monsters[1]).not.toHaveProperty("attackBonus");
  });

  it("nao_altera_o_estado_recebido", () => {
    const { state, a, b } = scenario();
    const copy = structuredClone(state);
    playerView(state, a);
    playerView(state, b);
    expect(state).toEqual(copy);
  });

  it("view_e_serializavel_em_json", () => {
    const { state, a } = scenario();
    const view = playerView(state, a);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it("copias_iguais_viradas_do_oponente_continuam_ocultas_e_a_virada_de_uma_nao_revela_a_outra", () => {
    const { state, a, b } = scenario();
    const down = monster("crystal_bat", { faceDown: true, position: "DEFENSE" });
    const twins: MatchState = {
      ...state,
      players: { ...state.players, [b]: { ...state.players[b], monsters: pad([down, down, { ...down, faceDown: false }]) } },
    };
    const seen = playerView(twins, a).opponent.monsters;
    expect(seen[0]).toEqual({ cardId: null, position: "DEFENSE", faceDown: true, summonedOnTurn: down.summonedOnTurn });
    expect(seen[1]).toEqual(seen[0]);
    expect(seen[2]).toMatchObject({ cardId: "crystal_bat", faceDown: false });
    expect(JSON.stringify([seen[0], seen[1]])).not.toContain("crystal_bat");
  });

  describe("janela_de_resposta", () => {
    it("mostra_acao_interrompida_somente_ao_defensor", () => {
      const { state, a, b } = scenario();
      const pending: MatchState = {
        ...state,
        pendingResponse: {
          trigger: "ATTACK_DECLARED",
          responder: b,
          action: { type: "ATTACK", attackerZone: 0, targetZone: null },
        },
      };
      expect(playerView(pending, b).pendingResponse).toEqual({
        responder: b,
        canRespond: true,
        trigger: "ATTACK_DECLARED",
        action: { type: "ATTACK", attackerZone: 0, targetZone: null },
      });
      expect(playerView(pending, a).pendingResponse).toEqual({ responder: b, canRespond: false });
      expect(JSON.stringify(playerView(pending, a).pendingResponse)).not.toContain("dune_scout");
    });

    it("sem_janela_pendingResponse_e_nulo", () => {
      const { state, a, b } = scenario();
      expect(playerView(state, a).pendingResponse).toBeNull();
      expect(playerView(state, b).pendingResponse).toBeNull();
    });

    it("abre_janela_real_e_oculta_do_jogador_do_turno", () => {
      const { state, a, b } = scenario();
      const attacker = state.players[a].monsters[0] as MonsterOnField;
      const ready: MatchState = {
        ...state,
        players: { ...state.players, [a]: { ...state.players[a], monsters: pad([{ ...attacker, hasAttacked: false }]) } },
      };
      const r = applyAction(ready, a, { type: "ATTACK", attackerZone: 0, targetZone: 0 });
      if (!r.ok) throw new Error(r.code);
      expect(r.state.pendingResponse).not.toBeNull();
      expect(playerView(r.state, b).pendingResponse).toMatchObject({ canRespond: true, trigger: "ATTACK_DECLARED" });
      expect(playerView(r.state, a).pendingResponse).toEqual({ responder: b, canRespond: false });
    });

    it("tributos_e_alvos_por_zona_nao_vazam_id_de_carta_virada_na_acao_vista_pelo_defensor", () => {
      const { state, a, b } = scenario();
      const summon: MatchState = {
        ...state,
        pendingResponse: {
          trigger: "SUMMON",
          responder: b,
          action: { type: "SUMMON_CARD", cardId: "storm_hawk", tributeZones: [0, 1], zone: 2 },
        },
      };
      const seen = playerView(summon, b).pendingResponse;
      expect(seen).toMatchObject({ action: { type: "SUMMON_CARD", cardId: "storm_hawk", tributeZones: [0, 1], zone: 2 } });
      expect(JSON.stringify(seen)).not.toContain("tide_imp");

      const spell: MatchState = {
        ...state,
        pendingResponse: {
          trigger: "SPELL_ACTIVATION",
          responder: b,
          action: { type: "ACTIVATE_SPELL", cardId: "power_surge", targetZone: 0 },
        },
      };
      expect(playerView(spell, b).pendingResponse).toMatchObject({
        action: { type: "ACTIVATE_SPELL", cardId: "power_surge", targetZone: 0 },
      });
      expect(JSON.stringify(playerView(spell, b).pendingResponse)).not.toContain("tide_imp");
      expect(playerView(spell, a).pendingResponse).toEqual({ responder: b, canRespond: false });
    });

    it("mostra_zonas_dos_tributos_na_acao_do_defensor", () => {
      const { state, b } = scenario();
      const summon: MatchState = {
        ...state,
        pendingResponse: {
          trigger: "SUMMON",
          responder: b,
          action: { type: "SUMMON_CARD", cardId: "storm_hawk", tributeZones: [0], zone: 2 },
        },
      };
      expect(playerView(summon, b).pendingResponse).toMatchObject({ action: { tributeZones: [0] } });
    });
  });
});
