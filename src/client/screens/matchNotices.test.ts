// src/client/screens/matchNotices.test.ts
import { describe, expect, it } from "vitest";
import type { EventView } from "../../engine/eventView.js";
import { buildNotices, deltaText, lifePercent, lifeSides } from "./matchNotices.js";

const ev = (event: EventView): EventView => event;

describe("buildNotices", () => {
  it("magia_ativada_mostra_nome_e_jogador", () => {
    const [notice] = buildNotices([ev({ type: "SPELL_ACTIVATED", player: "P1", cardId: "ash_sprite", targetZone: null })], "P1");
    expect(notice).toEqual({ kind: "CARD", side: "you", text: "Você ativou a magia Fagulha de Cinzas", cardId: "ash_sprite" });
  });

  it("armadilha_ativada_do_oponente_e_publica", () => {
    const [notice] = buildNotices([ev({ type: "TRAP_ACTIVATED", player: "P2", cardId: "moss_golem", trigger: "SUMMON" })], "P1");
    expect(notice.side).toBe("opponent");
    expect(notice.text).toBe("Oponente ativou a armadilha Peido Fatal");
  });

  it("carta_baixada_oculta_vira_carta_virada", () => {
    const [notice] = buildNotices([ev({ type: "SPELL_TRAP_SET", player: "P2", cardId: null, zone: 1 })], "P1");
    expect(notice).toEqual({ kind: "CARD", side: "opponent", text: "Oponente baixou uma carta virada", cardId: null });
  });

  it("carta_baixada_propria_mostra_nome", () => {
    const [notice] = buildNotices([ev({ type: "SPELL_TRAP_SET", player: "P1", cardId: "moss_golem", zone: 0 })], "P1");
    expect(notice.text).toBe("Você baixou Peido Fatal");
  });

  it("invocacao_aberta_mostra_nome_e_posicao", () => {
    const [attack, defense] = buildNotices(
      [
        ev({ type: "MONSTER_SUMMONED", player: "P2", cardId: "dune_scout", zone: 0, position: "ATTACK", faceDown: false }),
        ev({ type: "MONSTER_SUMMONED", player: "P1", cardId: "dune_scout", zone: 1, position: "DEFENSE", faceDown: false }),
      ],
      "P1",
    );
    expect(attack.text).toBe("Oponente invocou Batedor das Dunas em ataque");
    expect(attack.cardId).toBe("dune_scout");
    expect(defense.text).toBe("Você invocou Batedor das Dunas em defesa");
  });

  it("invocacao_virada_nao_revela_a_carta", () => {
    const [hidden, own] = buildNotices(
      [
        ev({ type: "MONSTER_SUMMONED", player: "P2", cardId: null, zone: 0, position: "DEFENSE", faceDown: true }),
        ev({ type: "MONSTER_SUMMONED", player: "P1", cardId: "dune_scout", zone: 0, position: "DEFENSE", faceDown: true }),
      ],
      "P1",
    );
    expect(hidden).toEqual({ kind: "SUMMON", side: "opponent", text: "Oponente: Monstro baixado", cardId: null });
    expect(own.text).toBe("Você: Monstro baixado");
    expect(own.cardId).toBeNull();
  });

  it("cemiterio_gera_aviso_do_lado_certo", () => {
    const [notice] = buildNotices([ev({ type: "CARD_SENT_TO_GRAVEYARD", player: "P2", cardId: "ash_sprite" })], "P1");
    expect(notice).toEqual({ kind: "GRAVEYARD", side: "opponent", text: "Fagulha de Cinzas foi ao cemitério (Oponente)", cardId: "ash_sprite" });
  });

  it("dano_e_cura_trazem_valor", () => {
    const [damage, heal] = buildNotices(
      [ev({ type: "DAMAGE_DEALT", player: "P1", amount: 800 }), ev({ type: "LIFE_RESTORED", player: "P2", amount: 1000 })],
      "P1",
    );
    expect(damage).toMatchObject({ kind: "DAMAGE", side: "you", amount: 800 });
    expect(heal).toMatchObject({ kind: "HEAL", side: "opponent", amount: 1000 });
    expect(deltaText(damage)).toBe("-800");
    expect(deltaText(heal)).toBe("+1000");
  });

  it("fim_de_jogo_destaca_vitoria_ou_derrota", () => {
    const events = [ev({ type: "MATCH_ENDED", winner: "P1" })];
    expect(buildNotices(events, "P1")[0]).toMatchObject({ kind: "END", text: "Vitória!", victory: true });
    expect(buildNotices(events, "P2")[0]).toMatchObject({ kind: "END", text: "Derrota", victory: false });
  });

  it("mantem_a_ordem_e_ignora_eventos_sem_feedback", () => {
    const notices = buildNotices(
      [
        ev({ type: "PHASE_CHANGED", phase: "BATTLE" }),
        ev({ type: "ATTACK_DECLARED", player: "P1", attackerCardId: "dune_scout", targetZone: null }),
        ev({ type: "DAMAGE_DEALT", player: "P2", amount: 500 }),
        ev({ type: "CARD_DRAWN", player: "P2", cardId: null }),
        ev({ type: "CARD_SENT_TO_GRAVEYARD", player: "P1", cardId: "ash_sprite" }),
        ev({ type: "MATCH_ENDED", winner: "P1" }),
      ],
      "P1",
    );
    expect(notices.map((n) => n.kind)).toEqual(["DAMAGE", "GRAVEYARD", "END"]);
  });

  it("reconexao_sem_eventos_nao_gera_avisos", () => {
    expect(buildNotices([], "P1")).toEqual([]);
  });
});

describe("vida", () => {
  it("lifePercent_limita_entre_0_e_100", () => {
    expect(lifePercent(4000)).toBe(100);
    expect(lifePercent(2000)).toBe(50);
    expect(lifePercent(-100)).toBe(0);
    expect(lifePercent(9000)).toBe(100);
  });

  it("lifeSides_lista_so_lados_com_variacao", () => {
    const notices = buildNotices([ev({ type: "DAMAGE_DEALT", player: "P2", amount: 100 })], "P1");
    expect([...lifeSides(notices)]).toEqual(["opponent"]);
  });
});
