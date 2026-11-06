// src/client/screens/turnTimer.test.ts
import { describe, expect, it } from "vitest";
import {
  actingPlayer,
  createTurnClock,
  expiredByTimeout,
  opponentNickname,
  secondsRemaining,
  timerLevel,
  turnNotice,
  turnBannerText,
} from "./turnTimer.js";

describe("createTurnClock", () => {
  it("retorna_null_sem_prazo", () => {
    expect(createTurnClock(null, 1000, 5)).toBeNull();
    expect(createTurnClock(undefined, undefined, 5)).toBeNull();
  });

  it("calcula_o_desvio_entre_servidor_e_relogio_local", () => {
    expect(createTurnClock(31_000, 1_000, 400)).toEqual({ deadline: 31_000, offset: 600 });
  });
});

describe("secondsRemaining", () => {
  it("usa_o_relogio_do_servidor_e_ignora_relogio_local_adiantado", () => {
    // Relógio local 1 hora adiantado: o desvio compensa.
    const local = 3_600_000;
    const clock = createTurnClock(31_000, 1_000, local)!;
    expect(secondsRemaining(clock, local)).toBe(30);
    expect(secondsRemaining(clock, local + 12_500)).toBe(18);
  });

  it("arredonda_para_cima_e_nunca_fica_negativo", () => {
    const clock = createTurnClock(1_000, 0, 0)!;
    expect(secondsRemaining(clock, 1)).toBe(1);
    expect(secondsRemaining(clock, 1_000)).toBe(0);
    expect(secondsRemaining(clock, 5_000)).toBe(0);
  });
});

describe("timerLevel", () => {
  it("define_os_niveis_nos_limites", () => {
    expect(timerLevel(30)).toBe("normal");
    expect(timerLevel(11)).toBe("normal");
    expect(timerLevel(10)).toBe("warning");
    expect(timerLevel(6)).toBe("warning");
    expect(timerLevel(5)).toBe("critical");
    expect(timerLevel(0)).toBe("critical");
  });
});

describe("actingPlayer", () => {
  it("e_o_jogador_do_turno_sem_janela_de_resposta", () => {
    expect(actingPlayer({ currentPlayer: "P1", pendingResponse: null })).toBe("P1");
  });

  it("e_o_defensor_com_janela_de_resposta_aberta", () => {
    expect(actingPlayer({ currentPlayer: "P1", pendingResponse: { responder: "P2", canRespond: false } })).toBe("P2");
  });
});

describe("expiredByTimeout", () => {
  const clock = { deadline: 31_000, offset: 0 };
  it("e_verdadeiro_quando_o_novo_estado_nasce_apos_o_prazo", () => {
    expect(expiredByTimeout(clock, 31_000)).toBe(true);
    expect(expiredByTimeout(clock, 31_050)).toBe(true);
  });

  it("e_falso_para_acao_dentro_do_prazo_ou_sem_prazo_anterior", () => {
    expect(expiredByTimeout(clock, 20_000)).toBe(false);
    expect(expiredByTimeout(null, 99_000)).toBe(false);
    expect(expiredByTimeout(clock, undefined)).toBe(false);
  });
});

describe("opponentNickname", () => {
  it("devolve_o_apelido_do_outro_jogador", () => {
    expect(opponentNickname([{ nickname: "Ana" }, { nickname: "Beto" }], "Ana")).toBe("Beto");
  });

  it("devolve_null_quando_ambiguo_ou_sozinho", () => {
    expect(opponentNickname([{ nickname: "Ana" }, { nickname: "Ana" }], "Ana")).toBeNull();
    expect(opponentNickname([{ nickname: "Ana" }], "Ana")).toBeNull();
  });
});

describe("turnBannerText", () => {
  it("indica_a_vez_do_jogador_ou_do_oponente", () => {
    expect(turnBannerText("P1", "P1", "Beto")).toBe("Sua vez");
    expect(turnBannerText("P1", "P2", "Beto")).toBe("Vez de Beto");
    expect(turnBannerText("P1", "P2", null)).toBe("Vez de oponente");
  });
});

describe("turnNotice", () => {
  const clock = { deadline: 31_000, offset: 0 };
  const started = (player: "P1" | "P2") => [{ type: "TURN_STARTED", player }];

  it("avisa_sua_vez_quando_o_turno_e_do_jogador", () => {
    expect(turnNotice(started("P1"), "P1", clock, 20_000)).toBe("Sua vez!");
  });

  it("nao_avisa_quando_o_turno_e_do_oponente_sem_timeout", () => {
    expect(turnNotice(started("P2"), "P1", clock, 20_000)).toBeNull();
  });

  it("avisa_tempo_esgotado_quando_o_turno_virou_por_timeout", () => {
    expect(turnNotice(started("P2"), "P1", clock, 31_000)).toBe("Tempo esgotado");
    expect(turnNotice(started("P1"), "P1", clock, 31_000)).toBe("Tempo esgotado! Sua vez!");
  });

  it("nao_avisa_na_reconexao_sem_eventos", () => {
    expect(turnNotice([], "P1", clock, 99_000)).toBeNull();
  });
});
