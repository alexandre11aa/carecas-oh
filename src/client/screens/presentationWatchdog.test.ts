// src/client/screens/presentationWatchdog.test.ts
import { describe, expect, it } from "vitest";
import { describeWatchdog, isStepStuck, STEP_TIMEOUT_MS } from "./presentationWatchdog.js";

describe("presentationWatchdog", () => {
  it("nao_dispara_sem_passo_em_andamento", () => {
    expect(isStepStuck({ stepStartedAt: null, now: 999999 })).toBe(false);
  });

  it("nao_dispara_dentro_do_limite", () => {
    expect(isStepStuck({ stepStartedAt: 1000, now: 1000 + STEP_TIMEOUT_MS })).toBe(false);
  });

  it("dispara_apos_o_limite", () => {
    expect(isStepStuck({ stepStartedAt: 1000, now: 1000 + STEP_TIMEOUT_MS + 1 })).toBe(true);
  });

  it("respeita_limite_customizado", () => {
    expect(isStepStuck({ stepStartedAt: 0, now: 501, timeoutMs: 500 })).toBe(true);
    expect(isStepStuck({ stepStartedAt: 0, now: 500, timeoutMs: 500 })).toBe(false);
  });

  it("descreve_o_aviso_com_contexto", () => {
    const context = {
      reason: "timeout" as const, elapsedMs: 6100, queueLength: 3, stepKind: "ATTACK", effectsDone: false, noticeDone: true,
      turn: 4, phase: "BATTLE", hidden: false, userAgent: "x",
    };
    const [message, ctx] = describeWatchdog(context);
    expect(message).toContain("travado");
    expect(ctx).toBe(context);
    expect(describeWatchdog({ ...context, reason: "exception" })[0]).toContain("exceção");
  });
});
