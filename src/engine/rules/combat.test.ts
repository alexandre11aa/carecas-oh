// src/engine/rules/combat.test.ts
import { describe, expect, it } from "vitest";
import { applyAction } from "../applyAction";
import { createMatch } from "../createMatch";
import { opponentOf } from "./turn";
import type { Action, MatchState, MonsterOnField, PlayerId } from "../types";

const field = (cardId: string, extra: Partial<MonsterOnField> = {}): MonsterOnField => ({
  cardId,
  position: "ATTACK",
  faceDown: false,
  summonedOnTurn: 0,
  hasAttacked: false,
  changedPositionOnTurn: null,
  ...extra,
});

type Setup = {
  mine?: (MonsterOnField | null)[];
  theirs?: (MonsterOnField | null)[];
  turn?: number;
  phase?: MatchState["phase"];
  myLife?: number;
  theirLife?: number;
};

const empty = (list: (MonsterOnField | null)[] = []): (MonsterOnField | null)[] => [
  ...list,
  ...Array<null>(5 - list.length).fill(null),
];

/** Fase de batalha do turno 5; `mine` é o campo de quem ataca e `theirs` o do oponente. */
const setup = ({ mine, theirs, turn = 5, phase = "BATTLE", myLife, theirLife }: Setup) => {
  const base = createMatch(42);
  const p = base.currentPlayer;
  const o = opponentOf(p);
  const state: MatchState = {
    ...base,
    turn,
    phase,
    players: {
      ...base.players,
      [p]: { ...base.players[p], monsters: empty(mine), lifePoints: myLife ?? 8000 },
      [o]: { ...base.players[o], monsters: empty(theirs), lifePoints: theirLife ?? 8000 },
    },
  };
  return { state, p, o };
};

const hit = (attackerCardId: string, targetCardId: string | null): Action => ({
  type: "ATTACK",
  attackerCardId,
  targetCardId,
});

const ok = (state: MatchState, p: PlayerId, action: Action) => {
  const r = applyAction(state, p, action);
  if (!r.ok) throw new Error(`esperado ok, veio ${r.code}`);
  return r;
};

describe("ATTACK ataque contra ataque", () => {
  it("destroi_o_defensor_mais_fraco_e_causa_a_diferenca_ao_dono", () => {
    // dune_scout 1700 x bone_knight 1500
    const { state, p, o } = setup({ mine: [field("dune_scout")], theirs: [field("bone_knight")] });
    const r = ok(state, p, hit("dune_scout", "bone_knight"));
    expect(r.state.players[o].lifePoints).toBe(7800);
    expect(r.state.players[o].monsters).toEqual(empty());
    expect(r.state.players[o].graveyard).toEqual(["bone_knight"]);
    expect(r.state.players[p].lifePoints).toBe(8000);
    expect(r.state.players[p].monsters[0]).toEqual(field("dune_scout", { hasAttacked: true }));
    expect(r.events).toEqual([
      { type: "ATTACK_DECLARED", player: p, attackerCardId: "dune_scout", targetCardId: "bone_knight" },
      { type: "CARD_SENT_TO_GRAVEYARD", player: o, cardId: "bone_knight" },
      { type: "DAMAGE_DEALT", player: o, amount: 200 },
    ]);
  });

  it("destroi_o_atacante_mais_fraco_e_causa_a_diferenca_a_ele", () => {
    const { state, p, o } = setup({ mine: [field("bone_knight")], theirs: [field("dune_scout")] });
    const r = ok(state, p, hit("bone_knight", "dune_scout"));
    expect(r.state.players[p].lifePoints).toBe(7800);
    expect(r.state.players[p].monsters).toEqual(empty());
    expect(r.state.players[p].graveyard).toEqual(["bone_knight"]);
    expect(r.state.players[o].lifePoints).toBe(8000);
    expect(r.state.players[o].monsters[0]).toEqual(field("dune_scout"));
  });

  it("empate_destroi_ambos_sem_dano", () => {
    const { state, p, o } = setup({ mine: [field("bone_knight")], theirs: [field("bone_knight")] });
    const r = ok(state, p, hit("bone_knight", "bone_knight"));
    expect(r.state.players[p].lifePoints).toBe(8000);
    expect(r.state.players[o].lifePoints).toBe(8000);
    expect(r.state.players[p].monsters).toEqual(empty());
    expect(r.state.players[o].monsters).toEqual(empty());
    expect(r.state.players[p].graveyard).toEqual(["bone_knight"]);
    expect(r.state.players[o].graveyard).toEqual(["bone_knight"]);
  });
});

describe("ATTACK ataque contra defesa", () => {
  it("ataque_maior_destroi_o_defensor_sem_dano", () => {
    // dune_scout 1700 x moss_golem DEF 1500
    const { state, p, o } = setup({
      mine: [field("dune_scout")],
      theirs: [field("moss_golem", { position: "DEFENSE" })],
    });
    const r = ok(state, p, hit("dune_scout", "moss_golem"));
    expect(r.state.players[o].lifePoints).toBe(8000);
    expect(r.state.players[o].monsters).toEqual(empty());
    expect(r.state.players[o].graveyard).toEqual(["moss_golem"]);
    expect(r.state.players[p].monsters[0]?.hasAttacked).toBe(true);
  });

  it("ataque_menor_causa_dano_de_reflexo_ao_atacante_sem_destruir_ninguem", () => {
    // bone_knight 1500 x frost_witch DEF 2000
    const { state, p, o } = setup({
      mine: [field("bone_knight")],
      theirs: [field("frost_witch", { position: "DEFENSE" })],
    });
    const r = ok(state, p, hit("bone_knight", "frost_witch"));
    expect(r.state.players[p].lifePoints).toBe(7500);
    expect(r.state.players[p].monsters[0]?.cardId).toBe("bone_knight");
    expect(r.state.players[o].monsters[0]?.cardId).toBe("frost_witch");
    expect(r.state.players[o].graveyard).toEqual([]);
    expect(r.events).toContainEqual({ type: "DAMAGE_DEALT", player: p, amount: 500 });
  });

  it("ataque_igual_a_defesa_nao_destroi_nem_causa_dano", () => {
    // crystal_bat ATK 1300 x bone_knight DEF 1300
    const { state, p, o } = setup({
      mine: [field("crystal_bat")],
      theirs: [field("bone_knight", { position: "DEFENSE" })],
    });
    const r = ok(state, p, hit("crystal_bat", "bone_knight"));
    expect(r.state.players[p].lifePoints).toBe(8000);
    expect(r.state.players[o].lifePoints).toBe(8000);
    expect(r.state.players[p].monsters[0]?.cardId).toBe("crystal_bat");
    expect(r.state.players[o].monsters[0]?.cardId).toBe("bone_knight");
    expect(r.events.some((e) => e.type === "DAMAGE_DEALT" || e.type === "CARD_SENT_TO_GRAVEYARD")).toBe(false);
  });

  it("revela_monstro_em_defesa_virada_ao_ser_atacado_e_destruido", () => {
    const { state, p, o } = setup({
      mine: [field("dune_scout")],
      theirs: [field("moss_golem", { position: "DEFENSE", faceDown: true })],
    });
    const r = ok(state, p, hit("dune_scout", "moss_golem"));
    expect(r.events).toContainEqual({ type: "MONSTER_FLIPPED", player: o, cardId: "moss_golem" });
    expect(r.state.players[o].graveyard).toEqual(["moss_golem"]);
  });

  it("revela_monstro_em_defesa_virada_que_sobrevive_ao_ataque", () => {
    const { state, p, o } = setup({
      mine: [field("bone_knight")],
      theirs: [field("frost_witch", { position: "DEFENSE", faceDown: true })],
    });
    const r = ok(state, p, hit("bone_knight", "frost_witch"));
    expect(r.state.players[o].monsters[0]).toEqual(
      field("frost_witch", { position: "DEFENSE", faceDown: false }),
    );
    expect(r.events).toContainEqual({ type: "MONSTER_FLIPPED", player: o, cardId: "frost_witch" });
  });
});

describe("ATTACK direto e vitória", () => {
  it("ataque_direto_com_campo_vazio_tira_o_ataque_dos_pontos_de_vida", () => {
    const { state, p, o } = setup({ mine: [field("dune_scout")] });
    const r = ok(state, p, hit("dune_scout", null));
    expect(r.state.players[o].lifePoints).toBe(6300);
    expect(r.state.winner).toBeNull();
  });

  it("nao_permite_ataque_direto_com_monstro_no_campo_do_oponente", () => {
    const { state, p } = setup({ mine: [field("dune_scout")], theirs: [field("tide_imp")] });
    expect(applyAction(state, p, hit("dune_scout", null))).toEqual({
      ok: false,
      code: "DIRECT_ATTACK_NOT_ALLOWED",
    });
  });

  it("vence_ao_zerar_os_pontos_de_vida_do_oponente", () => {
    const { state, p } = setup({ mine: [field("dune_scout")], theirLife: 1700 });
    const r = ok(state, p, hit("dune_scout", null));
    expect(r.state.players[opponentOf(p)].lifePoints).toBe(0);
    expect(r.state.winner).toBe(p);
    expect(r.events).toContainEqual({ type: "MATCH_ENDED", winner: p });
  });

  it("pontos_de_vida_nao_ficam_negativos", () => {
    const { state, p } = setup({ mine: [field("dune_scout")], theirLife: 100 });
    const r = ok(state, p, hit("dune_scout", null));
    expect(r.state.players[opponentOf(p)].lifePoints).toBe(0);
    expect(r.state.winner).toBe(p);
  });

  it("oponente_vence_quando_o_dano_de_reflexo_zera_os_pontos_do_atacante", () => {
    const { state, p, o } = setup({
      mine: [field("bone_knight")],
      theirs: [field("frost_witch", { position: "DEFENSE" })],
      myLife: 500,
    });
    const r = ok(state, p, hit("bone_knight", "frost_witch"));
    expect(r.state.players[p].lifePoints).toBe(0);
    expect(r.state.winner).toBe(o);
  });

  it("vence_ao_zerar_pontos_em_combate_ataque_contra_ataque", () => {
    const { state, p } = setup({
      mine: [field("dune_scout")],
      theirs: [field("bone_knight")],
      theirLife: 200,
    });
    const r = ok(state, p, hit("dune_scout", "bone_knight"));
    expect(r.state.winner).toBe(p);
    expect(r.state.players[opponentOf(p)].graveyard).toEqual(["bone_knight"]);
  });

  it("nao_permite_agir_depois_do_fim_da_partida", () => {
    const { state, p } = setup({ mine: [field("dune_scout")], theirLife: 100 });
    const r = ok(state, p, hit("dune_scout", null));
    expect(applyAction(r.state, p, { type: "END_TURN" })).toEqual({ ok: false, code: "MATCH_ENDED" });
  });
});

describe("ATTACK erros", () => {
  it("nao_permite_atacar_fora_da_fase_de_batalha", () => {
    for (const phase of ["DRAW", "MAIN_1", "MAIN_2", "END"] as const) {
      const { state, p } = setup({ mine: [field("dune_scout")], phase });
      expect(applyAction(state, p, hit("dune_scout", null))).toEqual({ ok: false, code: "INVALID_PHASE" });
    }
  });

  it("nao_permite_atacar_no_primeiro_turno", () => {
    const { state, p } = setup({ mine: [field("dune_scout")], turn: 1 });
    expect(applyAction(state, p, hit("dune_scout", null))).toEqual({
      ok: false,
      code: "ATTACK_NOT_ALLOWED_ON_FIRST_TURN",
    });
  });

  it("permite_atacar_a_partir_do_segundo_turno", () => {
    const { state, p } = setup({ mine: [field("dune_scout")], turn: 2 });
    expect(applyAction(state, p, hit("dune_scout", null)).ok).toBe(true);
  });

  it("nao_permite_atacar_fora_do_turno", () => {
    const { state, o } = setup({ mine: [field("dune_scout")], theirs: [field("bone_knight")] });
    expect(applyAction(state, o, hit("bone_knight", null))).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
  });

  it("nao_permite_atacar_com_monstro_que_ja_atacou", () => {
    const { state, p } = setup({ mine: [field("dune_scout", { hasAttacked: true })] });
    expect(applyAction(state, p, hit("dune_scout", null))).toEqual({ ok: false, code: "ALREADY_ATTACKED" });
  });

  it("nao_permite_atacar_duas_vezes_com_o_mesmo_monstro_no_turno", () => {
    const { state, p } = setup({ mine: [field("dune_scout")] });
    const r = ok(state, p, hit("dune_scout", null));
    expect(applyAction(r.state, p, hit("dune_scout", null))).toEqual({ ok: false, code: "ALREADY_ATTACKED" });
  });

  it("nao_permite_atacar_com_monstro_em_defesa", () => {
    const { state, p } = setup({ mine: [field("dune_scout", { position: "DEFENSE" })] });
    expect(applyAction(state, p, hit("dune_scout", null))).toEqual({
      ok: false,
      code: "NOT_IN_ATTACK_POSITION",
    });
  });

  it("nao_permite_atacar_com_monstro_que_nao_esta_no_campo", () => {
    const { state, p } = setup({ mine: [field("dune_scout")] });
    expect(applyAction(state, p, hit("bone_knight", null))).toEqual({
      ok: false,
      code: "MONSTER_NOT_ON_FIELD",
    });
  });

  it("nao_permite_atacar_alvo_que_nao_esta_no_campo_do_oponente", () => {
    const { state, p } = setup({ mine: [field("dune_scout"), field("bone_knight")], theirs: [field("tide_imp")] });
    expect(applyAction(state, p, hit("dune_scout", "bone_knight"))).toEqual({
      ok: false,
      code: "INVALID_TARGET",
    });
  });

  it("nao_altera_o_estado_recebido", () => {
    const { state, p } = setup({ mine: [field("dune_scout")], theirs: [field("bone_knight")] });
    const copy = structuredClone(state);
    ok(state, p, hit("dune_scout", "bone_knight"));
    expect(state).toEqual(copy);
  });
});

describe("ATTACK e turnos", () => {
  it("monstro_volta_a_poder_atacar_no_proximo_turno_do_dono", () => {
    const { state, p, o } = setup({
      mine: [field("dune_scout", { hasAttacked: true })],
      phase: "MAIN_2",
    });
    const s1 = ok(state, p, { type: "END_TURN" }).state;
    const s2 = ok(s1, o, { type: "END_TURN" }).state;
    expect(s2.currentPlayer).toBe(p);
    expect(s2.players[p].monsters[0]?.hasAttacked).toBe(false);
  });
});
