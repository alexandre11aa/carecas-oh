// src/engine/rules/copies.test.ts
// Cópias repetidas da mesma carta na mão, no deck e no cemitério: cada ação consome exatamente uma.
import { describe, expect, it } from "vitest";
import { applyAction } from "../applyAction.js";
import { createMatch } from "../createMatch.js";
import { eventView } from "../eventView.js";
import { playerView } from "../playerView.js";
import { removeOne } from "./hand.js";
import { opponentOf } from "./turn.js";
import type { Action, MatchState, MonsterOnField, PlayerId, PlayerState } from "../types.js";

const field = (cardId: string, extra: Partial<MonsterOnField> = {}): MonsterOnField => ({
  cardId,
  position: "ATTACK",
  faceDown: false,
  summonedOnTurn: 0,
  hasAttacked: false,
  changedPositionOnTurn: null,
  ...extra,
});
const pad = <T,>(list: (T | null)[]): (T | null)[] => [...list, ...Array<null>(5 - list.length).fill(null)];

const setup = (mine: Partial<PlayerState>, theirs: Partial<PlayerState> = {}, phase: MatchState["phase"] = "MAIN_1") => {
  const base = createMatch(42, { P1: "balanced", P2: "strategic" });
  const p = base.currentPlayer;
  const o = opponentOf(p);
  const state: MatchState = {
    ...base,
    turn: 5,
    phase,
    players: {
      ...base.players,
      [p]: { ...base.players[p], monsters: pad([]), spellTraps: pad([]), normalSummonUsed: false, ...mine },
      [o]: { ...base.players[o], monsters: pad([]), spellTraps: pad([]), ...theirs },
    },
  };
  return { state, p, o };
};

const ok = (state: MatchState, p: PlayerId, action: Action) => {
  const r = applyAction(state, p, action);
  if (!r.ok) throw new Error(`esperado ok, veio ${r.code}`);
  return r;
};

describe("removeOne", () => {
  it("remove_apenas_a_primeira_ocorrencia", () => {
    expect(removeOne(["a", "b", "a", "a"], "a")).toEqual(["b", "a", "a"]);
  });
  it("nao_altera_a_lista_quando_a_carta_nao_existe_nem_a_original", () => {
    const list = ["a", "b"];
    expect(removeOne(list, "z")).toEqual(["a", "b"]);
    removeOne(list, "a");
    expect(list).toEqual(["a", "b"]);
  });
});

describe("cópias repetidas na mão", () => {
  it("invocar_remove_uma_copia_e_mantem_as_outras", () => {
    const { state, p } = setup({ hand: ["tide_imp", "tide_imp", "tide_imp", "fire_bolt"] });
    const r = ok(state, p, { type: "SUMMON_CARD", cardId: "tide_imp", tributeZones: [], zone: 0 });
    expect(r.state.players[p].hand).toEqual(["tide_imp", "tide_imp", "fire_bolt"]);
    expect(r.state.players[p].monsters[0]?.cardId).toBe("tide_imp");
  });

  it("baixar_monstro_remove_uma_copia", () => {
    const { state, p } = setup({ hand: ["tide_imp", "tide_imp"] });
    const r = ok(state, p, { type: "SET_MONSTER", cardId: "tide_imp", tributeZones: [], zone: 2 });
    expect(r.state.players[p].hand).toEqual(["tide_imp"]);
    expect(r.state.players[p].monsters[2]?.faceDown).toBe(true);
  });

  it("invocar_sem_a_carta_na_mao_continua_invalido", () => {
    const { state, p } = setup({ hand: ["tide_imp", "tide_imp"] });
    const r = applyAction(state, p, { type: "SUMMON_CARD", cardId: "dune_scout", tributeZones: [], zone: 0 });
    expect(r).toEqual({ ok: false, code: "CARD_NOT_IN_HAND" });
  });

  it("ativar_magia_remove_uma_copia_e_envia_uma_ao_cemiterio", () => {
    const { state, p } = setup({ hand: ["healing_spring", "healing_spring", "healing_spring"], lifePoints: 4000 });
    const r = ok(state, p, { type: "ACTIVATE_SPELL", cardId: "healing_spring" });
    expect(r.state.players[p].hand).toEqual(["healing_spring", "healing_spring"]);
    expect(r.state.players[p].graveyard).toEqual(["healing_spring"]);
    expect(r.state.players[p].lifePoints).toBe(5000);
  });

  it("baixar_armadilha_remove_uma_copia", () => {
    const { state, p } = setup({ hand: ["spike_pit", "spike_pit"] });
    const r = ok(state, p, { type: "SET_SPELL_TRAP", cardId: "spike_pit" });
    expect(r.state.players[p].hand).toEqual(["spike_pit"]);
    expect(r.state.players[p].spellTraps.filter((s) => s !== null)).toHaveLength(1);
  });

  it("magia_negada_remove_so_uma_copia_da_mao_e_mantem_a_baixada_no_campo", () => {
    const { state, p, o } = setup(
      {
        hand: ["fire_bolt", "fire_bolt"],
        spellTraps: pad([{ cardId: "fire_bolt", faceDown: true, setOnTurn: 1 }]),
      },
      { spellTraps: pad([{ cardId: "dark_veil", faceDown: true, setOnTurn: 4 }]) },
    );
    const open = ok(state, p, { type: "ACTIVATE_SPELL", cardId: "fire_bolt" });
    const r = ok(open.state, o, { type: "ACTIVATE_TRAP", zone: 0 });
    expect(r.state.players[p].hand).toEqual(["fire_bolt"]);
    expect(r.state.players[p].spellTraps[0]?.cardId).toBe("fire_bolt");
    expect(r.state.players[p].graveyard).toEqual(["fire_bolt"]);
  });

  it("invocacao_negada_remove_so_uma_copia_da_mao", () => {
    const { state, p, o } = setup(
      { hand: ["tide_imp", "tide_imp"] },
      { spellTraps: pad([{ cardId: "hidden_snare", faceDown: true, setOnTurn: 4 }]) },
    );
    const open = ok(state, p, { type: "SUMMON_CARD", cardId: "tide_imp", tributeZones: [], zone: 0 });
    const r = ok(open.state, o, { type: "ACTIVATE_TRAP", zone: 0 });
    expect(r.state.players[p].hand).toEqual(["tide_imp"]);
    expect(r.state.players[p].graveyard).toEqual(["tide_imp"]);
  });
});

describe("cópias repetidas no deck e no cemitério", () => {
  it("compra_uma_copia_por_vez_do_topo_do_deck", () => {
    const { state, p, o } = setup({}, { deck: ["tide_imp", "tide_imp", "fire_bolt"], hand: [] }, "MAIN_2");
    const r = ok(state, p, { type: "END_TURN" });
    expect(r.state.currentPlayer).toBe(o);
    expect(r.state.players[o].hand).toEqual(["tide_imp"]);
    expect(r.state.players[o].deck).toEqual(["tide_imp", "fire_bolt"]);
  });

  it("reviver_tira_so_uma_copia_do_cemiterio", () => {
    const { state, p } = setup({
      hand: ["call_beyond"],
      graveyard: ["tide_imp", "tide_imp", "tide_imp"],
    });
    const r = ok(state, p, { type: "ACTIVATE_SPELL", cardId: "call_beyond" });
    expect(r.state.players[p].graveyard).toEqual(["tide_imp", "tide_imp", "call_beyond"]);
    expect(r.state.players[p].monsters.filter((m) => m !== null)).toHaveLength(1);
  });
});

describe("visões com cópias repetidas", () => {
  it("playerView_mostra_todas_as_copias_ao_dono_e_so_a_contagem_ao_oponente", () => {
    const { state, p, o } = setup({ hand: ["tide_imp", "tide_imp", "tide_imp"] });
    expect(playerView(state, p).you.hand).toEqual(["tide_imp", "tide_imp", "tide_imp"]);
    const other = playerView(state, o).opponent;
    expect(other.handCount).toBe(3);
    expect(JSON.stringify(other)).not.toContain("tide_imp");
  });

  it("eventView_oculta_o_id_da_carta_baixada_mesmo_com_copias", () => {
    const { state, p, o } = setup({ hand: ["spike_pit", "spike_pit"] });
    const r = ok(state, p, { type: "SET_SPELL_TRAP", cardId: "spike_pit" });
    expect(r.events.map((e) => eventView(e, o))).toEqual([{ type: "SPELL_TRAP_SET", player: p, cardId: null, zone: 0 }]);
  });
});
