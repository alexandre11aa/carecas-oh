// src/client/screens/matchActions.test.ts
import { describe, expect, it } from "vitest";
import { createMatch } from "../../engine/createMatch.js";
import { playerView, type PlayerView } from "../../engine/playerView.js";
import type { MatchState, MonsterOnField, PlayerId, PlayerState } from "../../engine/types.js";
import { slotPosition, type Side, type Slot, type SlotKind } from "../scene/layout.js";
import {
  connectionNotice,
  handClick,
  highlightKeys,
  opponentInRoom,
  phaseCommands,
  responseCommands,
  selectionCommands,
  selectionHint,
  slotClick,
  summonZones,
} from "./matchActions.js";

const monster = (cardId: string, extra: Partial<MonsterOnField> = {}): MonsterOnField => ({
  cardId,
  position: "ATTACK",
  faceDown: false,
  summonedOnTurn: 1,
  hasAttacked: false,
  changedPositionOnTurn: null,
  ...extra,
});

type Setup = {
  phase?: MatchState["phase"];
  turn?: number;
  mine?: Partial<PlayerState>;
  theirs?: Partial<PlayerState>;
  pendingResponse?: MatchState["pendingResponse"];
  winner?: PlayerId | null;
};

/** Visão de P1 em que P1 é o jogador do turno. */
const viewOf = ({ phase = "MAIN_1", turn = 3, mine = {}, theirs = {}, pendingResponse = null, winner = null }: Setup): PlayerView => {
  const base = createMatch(123, { P1: "balanced", P2: "strategic" });
  const state: MatchState = {
    ...base,
    turn,
    phase,
    currentPlayer: "P1",
    winner,
    pendingResponse,
    players: { P1: { ...base.players.P1, ...mine }, P2: { ...base.players.P2, ...theirs } },
  };
  return playerView(state, "P1");
};

const slot = (side: Side, kind: SlotKind, zone = 0): Slot => ({
  key: `${side}:${kind}:${zone}`,
  side,
  kind,
  zone,
  ...slotPosition(side, kind, zone),
});

const field = (...cells: (MonsterOnField | null)[]): (MonsterOnField | null)[] =>
  Array.from({ length: 5 }, (_, i) => cells[i] ?? null);
const labels = (commands: { label: string }[]) => commands.map((c) => c.label);

describe("comandos da carta da mao", () => {
  const view = viewOf({ mine: { hand: ["ash_sprite", "healing_spring", "wind_gust", "spike_pit"] } });

  it("monstro_oferece_invocar_e_baixar_em_defesa_que_pedem_a_zona", () => {
    const commands = selectionCommands(view, { kind: "hand", cardId: "ash_sprite" });
    expect(labels(commands)).toEqual(["Invocar", "Baixar em defesa", "Cancelar"]);
    expect(commands[0].select).toEqual({ kind: "summon", cardId: "ash_sprite", set: false, tributes: [] });
    expect(commands[1].select).toEqual({ kind: "summon", cardId: "ash_sprite", set: true, tributes: [] });
  });

  it("magia_sem_alvo_ativa_direto_e_pode_ser_baixada", () => {
    const commands = selectionCommands(view, { kind: "hand", cardId: "healing_spring" });
    expect(commands[0].action).toEqual({ type: "ACTIVATE_SPELL", cardId: "healing_spring" });
    expect(commands[1].action).toEqual({ type: "SET_SPELL_TRAP", cardId: "healing_spring" });
  });

  it("magia_que_destroi_monstro_pede_alvo_do_oponente", () => {
    const commands = selectionCommands(view, { kind: "hand", cardId: "wind_gust" });
    expect(commands[0].select).toEqual({ kind: "spellTarget", cardId: "wind_gust", side: "opponent" });
  });

  it("armadilha_so_pode_ser_baixada", () => {
    const commands = selectionCommands(view, { kind: "hand", cardId: "spike_pit" });
    expect(commands[0]).toEqual({ label: "Baixar armadilha", action: { type: "SET_SPELL_TRAP", cardId: "spike_pit" } });
  });

  it("fora_das_fases_principais_so_resta_cancelar", () => {
    const battle = viewOf({ phase: "BATTLE", mine: { hand: ["ash_sprite"] } });
    expect(labels(selectionCommands(battle, { kind: "hand", cardId: "ash_sprite" }))).toEqual(["Cancelar"]);
  });

  it("sem_comandos_com_janela_de_resposta_aberta", () => {
    const pending = viewOf({
      pendingResponse: { trigger: "SUMMON", responder: "P2", action: { type: "END_TURN" } },
      mine: { hand: ["ash_sprite"] },
    });
    expect(selectionCommands(pending, { kind: "hand", cardId: "ash_sprite" })).toEqual([]);
    expect(phaseCommands(pending)).toEqual([]);
    expect(handClick(pending, null, "ash_sprite")).toBeNull();
  });

  it("clicar_na_mesma_carta_da_mao_limpa_a_selecao", () => {
    expect(handClick(view, null, "ash_sprite")).toEqual({ kind: "hand", cardId: "ash_sprite" });
    expect(handClick(view, { kind: "hand", cardId: "ash_sprite" }, "ash_sprite")).toBeNull();
  });
});

describe("invocacao por clique", () => {
  it("monstro_sem_tributo_envia_SUMMON_CARD_ao_clicar_numa_zona_livre", () => {
    const view = viewOf({ mine: { hand: ["ash_sprite"] } });
    const out = slotClick(view, { kind: "summon", cardId: "ash_sprite", set: false, tributes: [] }, slot("you", "monster", 2));
    expect(out).toEqual({
      selection: null,
      action: { type: "SUMMON_CARD", cardId: "ash_sprite", tributeCardIds: [], zone: 2 },
    });
  });

  it("baixar_em_defesa_envia_SET_MONSTER", () => {
    const view = viewOf({ mine: { hand: ["ash_sprite"] } });
    const out = slotClick(view, { kind: "summon", cardId: "ash_sprite", set: true, tributes: [] }, slot("you", "monster", 0));
    expect(out.action).toEqual({ type: "SET_MONSTER", cardId: "ash_sprite", tributeCardIds: [], zone: 0 });
  });

  it("nao_envia_nada_ao_clicar_fora_das_zonas_de_monstro_proprias", () => {
    const view = viewOf({ mine: { hand: ["ash_sprite"] } });
    const sel = { kind: "summon", cardId: "ash_sprite", set: false, tributes: [] } as const;
    expect(slotClick(view, sel, slot("opponent", "monster", 0))).toEqual({ selection: sel });
    expect(slotClick(view, sel, slot("you", "spellTrap", 0))).toEqual({ selection: sel });
  });

  it("nivel_5_exige_escolher_o_tributo_antes_da_zona", () => {
    const view = viewOf({ mine: { hand: ["storm_hawk"], monsters: field(monster("tide_imp"), monster("ash_sprite")) } });
    const start = { kind: "summon", cardId: "storm_hawk", set: false, tributes: [] } as const;
    expect(selectionHint(view, start)).toBe("Clique em 1 monstro(s) seu(s) para tributar.");

    const picked = slotClick(view, start, slot("you", "monster", 1));
    expect(picked).toEqual({ selection: { ...start, tributes: ["ash_sprite"] } });

    const zone = slotClick(view, picked.selection, slot("you", "monster", 1));
    expect(zone.action).toEqual({ type: "SUMMON_CARD", cardId: "storm_hawk", tributeCardIds: ["ash_sprite"], zone: 1 });
  });

  it("clicar_em_zona_vazia_antes_de_escolher_tributos_nao_faz_nada", () => {
    const view = viewOf({ mine: { hand: ["storm_hawk"], monsters: field(monster("tide_imp")) } });
    const start = { kind: "summon", cardId: "storm_hawk", set: false, tributes: [] } as const;
    expect(slotClick(view, start, slot("you", "monster", 3))).toEqual({ selection: start });
  });

  it("nao_permite_escolher_zona_ocupada_que_nao_e_tributo", () => {
    const view = viewOf({ mine: { hand: ["storm_hawk"], monsters: field(monster("tide_imp"), monster("ash_sprite")) } });
    const sel = { kind: "summon", cardId: "storm_hawk", set: false, tributes: ["ash_sprite"] } as const;
    expect(slotClick(view, sel, slot("you", "monster", 0))).toEqual({ selection: sel });
    expect(summonZones(view, ["ash_sprite"])).toEqual([1, 2, 3, 4]);
  });

  it("nivel_8_exige_dois_tributos", () => {
    const view = viewOf({ mine: { hand: ["ash_dragon"], monsters: field(monster("tide_imp"), monster("ash_sprite")) } });
    const start = { kind: "summon", cardId: "ash_dragon", set: false, tributes: [] } as const;
    const one = slotClick(view, start, slot("you", "monster", 0));
    expect(one.action).toBeUndefined();
    const two = slotClick(view, one.selection, slot("you", "monster", 1));
    expect(two.action).toBeUndefined();
    expect(two.selection).toEqual({ ...start, tributes: ["tide_imp", "ash_sprite"] });
    expect(highlightKeys(view, two.selection)).toEqual([0, 1, 2, 3, 4].map((z) => `you:monster:${z}`));
  });
});

describe("monstro em campo", () => {
  it("clicar_no_proprio_monstro_seleciona_e_oferece_mudar_de_posicao", () => {
    const view = viewOf({ mine: { monsters: field(monster("ash_sprite")) } });
    const out = slotClick(view, null, slot("you", "monster", 0));
    expect(out.selection).toEqual({ kind: "monster", zone: 0 });
    const commands = selectionCommands(view, out.selection);
    expect(labels(commands)).toEqual(["Mudar para defesa", "Cancelar"]);
    expect(commands[0].action).toEqual({ type: "CHANGE_POSITION", cardId: "ash_sprite" });
  });

  it("monstro_virado_oferece_virar_para_ataque", () => {
    const view = viewOf({ mine: { monsters: field(monster("ash_sprite", { faceDown: true, position: "DEFENSE" })) } });
    expect(selectionCommands(view, { kind: "monster", zone: 0 })[0].action).toEqual({ type: "FLIP_SUMMON", cardId: "ash_sprite" });
  });

  it("monstro_invocado_neste_turno_nao_oferece_mudar_de_posicao", () => {
    const view = viewOf({ turn: 3, mine: { monsters: field(monster("ash_sprite", { summonedOnTurn: 3 })) } });
    expect(labels(selectionCommands(view, { kind: "monster", zone: 0 }))).toEqual(["Cancelar"]);
  });

  it("na_batalha_oferece_atacar_so_para_monstro_em_ataque_que_nao_atacou", () => {
    const ready = viewOf({ phase: "BATTLE", mine: { monsters: field(monster("ash_sprite")) } });
    expect(selectionCommands(ready, { kind: "monster", zone: 0 })[0]).toEqual({
      label: "Atacar",
      select: { kind: "attack", attackerCardId: "ash_sprite" },
    });
    const done = viewOf({ phase: "BATTLE", mine: { monsters: field(monster("ash_sprite", { hasAttacked: true })) } });
    expect(labels(selectionCommands(done, { kind: "monster", zone: 0 }))).toEqual(["Cancelar"]);
  });
});

describe("ataque com selecao de alvo por zona", () => {
  const attack = { kind: "attack", attackerCardId: "ash_sprite" } as const;
  const withTarget = () =>
    viewOf({
      phase: "BATTLE",
      mine: { monsters: field(monster("ash_sprite")) },
      theirs: { monsters: field(null, null, monster("moss_golem")) },
    });

  it("clicar_no_monstro_do_oponente_envia_ATTACK_com_a_zona", () => {
    const view = withTarget();
    expect(slotClick(view, attack, slot("opponent", "monster", 2))).toEqual({
      selection: null,
      action: { type: "ATTACK", attackerCardId: "ash_sprite", targetZone: 2 },
    });
    expect(highlightKeys(view, attack)).toEqual(["opponent:monster:2"]);
  });

  it("zona_vazia_do_oponente_nao_envia_nada", () => {
    expect(slotClick(withTarget(), attack, slot("opponent", "monster", 0))).toEqual({ selection: attack });
  });

  it("sem_monstros_do_oponente_oferece_ataque_direto_com_targetZone_null", () => {
    const view = viewOf({ phase: "BATTLE", mine: { monsters: field(monster("ash_sprite")) } });
    expect(selectionCommands(view, attack)[0]).toEqual({
      label: "Ataque direto",
      action: { type: "ATTACK", attackerCardId: "ash_sprite", targetZone: null },
    });
  });

  it("com_monstros_do_oponente_nao_oferece_ataque_direto", () => {
    expect(labels(selectionCommands(withTarget(), attack))).toEqual(["Cancelar"]);
  });
});

describe("magia com alvo", () => {
  it("reforco_de_ataque_mira_monstro_proprio_por_zona", () => {
    const view = viewOf({ mine: { hand: ["power_surge"], monsters: field(null, monster("ash_sprite")) } });
    const sel = selectionCommands(view, { kind: "hand", cardId: "power_surge" })[0].select ?? null;
    expect(sel).toEqual({ kind: "spellTarget", cardId: "power_surge", side: "you" });
    expect(slotClick(view, sel, slot("you", "monster", 1))).toEqual({
      selection: null,
      action: { type: "ACTIVATE_SPELL", cardId: "power_surge", targetZone: 1 },
    });
    expect(slotClick(view, sel, slot("opponent", "monster", 1)).action).toBeUndefined();
  });

  it("destruir_monstro_mira_a_zona_do_oponente_mesmo_virado", () => {
    const view = viewOf({
      mine: { hand: ["wind_gust"] },
      theirs: { monsters: field(null, null, null, monster("moss_golem", { faceDown: true, position: "DEFENSE" })) },
    });
    expect(view.opponent.monsters[3]?.cardId).toBeNull();
    const sel = { kind: "spellTarget", cardId: "wind_gust", side: "opponent" } as const;
    expect(slotClick(view, sel, slot("opponent", "monster", 3)).action).toEqual({
      type: "ACTIVATE_SPELL",
      cardId: "wind_gust",
      targetZone: 3,
    });
  });

  it("selecao_de_alvo_por_zona_de_magia_armadilha_do_oponente", () => {
    const view = viewOf({
      theirs: { spellTraps: [null, { cardId: "mirror_wall", faceDown: true, setOnTurn: 1 }, null, null, null] },
    });
    const sel = { kind: "spellTarget", cardId: "t", side: "opponent", slotKind: "spellTrap" } as const;
    expect(highlightKeys(view, sel)).toEqual(["opponent:spellTrap:1"]);
    expect(slotClick(view, sel, slot("opponent", "spellTrap", 1)).action).toEqual({
      type: "ACTIVATE_SPELL",
      cardId: "t",
      targetZone: 1,
    });
    expect(slotClick(view, sel, slot("opponent", "spellTrap", 0))).toEqual({ selection: sel });
    expect(slotClick(view, sel, slot("opponent", "monster", 0)).action).toBeUndefined();
  });

  it("magia_baixada_no_campo_pode_ser_ativada", () => {
    const view = viewOf({
      mine: { spellTraps: [{ cardId: "healing_spring", faceDown: true, setOnTurn: 1 }, null, null, null, null] },
    });
    const out = slotClick(view, null, slot("you", "spellTrap", 0));
    expect(out.selection).toEqual({ kind: "field", cardId: "healing_spring" });
    expect(selectionCommands(view, out.selection)[0].action).toEqual({ type: "ACTIVATE_SPELL", cardId: "healing_spring" });
  });
});

describe("fase e turno", () => {
  it("jogador_do_turno_avanca_fase_e_encerra_turno", () => {
    const commands = phaseCommands(viewOf({ phase: "MAIN_1" }));
    expect(labels(commands)).toEqual(["Avançar fase (Batalha)", "Encerrar turno"]);
    expect(commands.map((c) => c.action)).toEqual([{ type: "NEXT_PHASE" }, { type: "END_TURN" }]);
  });

  it.each([
    ["DRAW", "Principal 1"],
    ["MAIN_1", "Batalha"],
    ["BATTLE", "Principal 2"],
    ["MAIN_2", "Fim"],
  ] as const)("fase_%s_oferece_avancar_e_encerrar", (phase, next) => {
    expect(phaseCommands(viewOf({ phase }))).toEqual([
      { label: `Avançar fase (${next})`, action: { type: "NEXT_PHASE" } },
      { label: "Encerrar turno", action: { type: "END_TURN" } },
    ]);
  });

  it("fase_END_oferece_so_encerrar_turno", () => {
    expect(phaseCommands(viewOf({ phase: "END" }))).toEqual([{ label: "Encerrar turno", action: { type: "END_TURN" } }]);
  });

  it("sem_botoes_na_fase_END_fora_do_turno", () => {
    const opponentView: PlayerView = { ...viewOf({ phase: "END" }), viewer: "P2" };
    expect(phaseCommands(opponentView)).toEqual([]);
  });

  it("sem_botoes_quando_a_partida_acabou", () => {
    expect(phaseCommands(viewOf({ winner: "P2" }))).toEqual([]);
  });
});

describe("janela de resposta", () => {
  /** P1 é o defensor: o jogador do turno é P2. */
  const defender = (trigger: "ATTACK_DECLARED" | "SUMMON", setOnTurn = 1): PlayerView => {
    const base = createMatch(123, { P1: "balanced", P2: "strategic" });
    const state: MatchState = {
      ...base,
      turn: 4,
      currentPlayer: "P2",
      pendingResponse: { trigger, responder: "P1", action: { type: "END_TURN" } },
      players: {
        ...base.players,
        P1: {
          ...base.players.P1,
          spellTraps: [
            { cardId: "divine_glory_evasion", faceDown: true, setOnTurn },
            { cardId: "hidden_snare", faceDown: true, setOnTurn },
            null,
            null,
            null,
          ],
        },
      },
    };
    return playerView(state, "P1");
  };

  it("oferece_so_as_armadilhas_do_gatilho_e_passar", () => {
    expect(responseCommands(defender("ATTACK_DECLARED"))).toEqual([
      { label: "Ativar Esquiva da Glória Divina", action: { type: "ACTIVATE_TRAP", cardId: "divine_glory_evasion" } },
      { label: "Passar", action: { type: "PASS_RESPONSE" } },
    ]);
    expect(labels(responseCommands(defender("SUMMON")))).toEqual(["Ativar Laço Escondido", "Passar"]);
  });

  it("nao_oferece_armadilha_baixada_neste_turno", () => {
    expect(labels(responseCommands(defender("ATTACK_DECLARED", 4)))).toEqual(["Passar"]);
  });

  it("quem_nao_pode_responder_nao_ve_comandos_e_aguarda", () => {
    const view = viewOf({ pendingResponse: { trigger: "SUMMON", responder: "P2", action: { type: "END_TURN" } } });
    expect(responseCommands(view)).toEqual([]);
    expect(selectionHint(view, null)).toBe("Aguardando a resposta do oponente...");
  });

  it("o_defensor_nao_ve_os_comandos_normais_de_turno", () => {
    const view = defender("ATTACK_DECLARED");
    expect(phaseCommands(view)).toEqual([]);
    expect(selectionHint(view, null)).toBe("O oponente declarou um ataque.");
  });
});

describe("connectionNotice e opponentInRoom", () => {
  it("avisa só quando não está online", () => {
    expect(connectionNotice("online")).toBe("");
    expect(connectionNotice("offline")).toBe("Reconectando ao servidor...");
    expect(connectionNotice("connecting")).toBe("Reconectando ao servidor...");
  });
  it("revanche exige dois jogadores na sala", () => {
    expect(opponentInRoom([{}])).toBe(false);
    expect(opponentInRoom([{}, {}])).toBe(true);
  });
});
