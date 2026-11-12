// src/client/screens/loadingTracker.test.ts
import { describe, expect, it, vi } from "vitest";
import { createLoadingGate, createLoadingTracker, LOADING_TIMEOUT_MS, shouldShowLoading } from "./loadingTracker.js";

const setup = () => {
  let next = 0;
  const timers = new Map<number, () => void>();
  const tracker = createLoadingTracker({
    setTimer: (cb) => {
      timers.set(++next, cb);
      return next;
    },
    clearTimer: (handle) => {
      timers.delete(handle as number);
    },
  });
  const fire = () => {
    for (const [id, cb] of [...timers]) {
      timers.delete(id);
      cb();
    }
  };
  return { tracker, timers, fire };
};

describe("loadingTracker", () => {
  it("sem_recursos_registrados_esta_pronto", () => {
    const { tracker } = setup();
    expect(tracker.isReady()).toBe(true);
    expect(tracker.pending()).toEqual([]);
  });

  it("conta_pendentes_e_fica_pronto_com_zero", () => {
    const { tracker } = setup();
    tracker.track("a");
    tracker.track("b");
    expect(tracker.pending()).toEqual(["a", "b"]);
    expect(tracker.isReady()).toBe(false);
    tracker.settle("a");
    expect(tracker.pending()).toEqual(["b"]);
    expect(tracker.isReady()).toBe(false);
    tracker.settle("b");
    expect(tracker.pending()).toEqual([]);
    expect(tracker.isReady()).toBe(true);
  });

  it("registrar_a_mesma_chave_nao_duplica", () => {
    const { tracker } = setup();
    tracker.track("a");
    tracker.track("a");
    expect(tracker.pending()).toEqual(["a"]);
    tracker.settle("a");
    expect(tracker.isReady()).toBe(true);
  });

  it("ignora_chave_desconhecida_ou_ja_resolvida_sem_notificar", () => {
    const { tracker } = setup();
    const listener = vi.fn();
    tracker.track("a");
    tracker.subscribe(listener);
    tracker.settle("x");
    expect(listener).not.toHaveBeenCalled();
    tracker.settle("a");
    tracker.settle("a");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(tracker.isReady()).toBe(true);
  });

  it("falha_conta_como_resolvida_pois_usa_o_mesmo_settle", () => {
    const { tracker } = setup();
    tracker.track("img");
    tracker.settle("img");
    expect(tracker.pending()).toEqual([]);
  });

  it("chave_resolvida_nao_volta_a_ser_pendente_no_mesmo_ciclo", () => {
    const { tracker } = setup();
    tracker.track("a");
    tracker.settle("a");
    tracker.track("a");
    expect(tracker.pending()).toEqual([]);
  });

  it("assinatura_notificada_uma_vez_por_mudanca_e_pode_ser_cancelada", () => {
    const { tracker } = setup();
    const listener = vi.fn();
    const unsubscribe = tracker.subscribe(listener);
    tracker.track("a");
    tracker.track("a");
    expect(listener).toHaveBeenCalledTimes(1);
    tracker.settle("a");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    tracker.track("b");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("timeout_libera_mesmo_com_pendentes_e_lista_expirados", () => {
    const { tracker, fire } = setup();
    const listener = vi.fn();
    tracker.track("a");
    tracker.track("b");
    tracker.settle("a");
    tracker.subscribe(listener);
    fire();
    expect(tracker.isReady()).toBe(true);
    expect(tracker.expired()).toEqual(["b"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("recurso_tardio_nao_reabre_o_loading", () => {
    const { tracker, fire } = setup();
    tracker.track("a");
    fire();
    tracker.settle("a");
    tracker.track("novo");
    expect(tracker.isReady()).toBe(true);
    expect(tracker.pending()).toEqual([]);
    expect(tracker.expired()).toEqual(["a"]);
  });

  it("resolver_tudo_cancela_o_timer", () => {
    const { tracker, timers } = setup();
    tracker.track("a");
    expect(timers.size).toBe(1);
    tracker.settle("a");
    expect(timers.size).toBe(0);
  });

  it("usa_o_timeout_padrao_de_10_segundos", () => {
    expect(LOADING_TIMEOUT_MS).toBe(10_000);
    vi.useFakeTimers();
    try {
      const tracker = createLoadingTracker();
      tracker.track("a");
      vi.advanceTimersByTime(9_999);
      expect(tracker.isReady()).toBe(false);
      vi.advanceTimersByTime(1);
      expect(tracker.isReady()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reset_reinicia_o_ciclo", () => {
    const { tracker, fire, timers } = setup();
    const listener = vi.fn();
    tracker.track("a");
    fire();
    tracker.subscribe(listener);
    tracker.reset();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(tracker.expired()).toEqual([]);
    expect(tracker.isReady()).toBe(true);
    tracker.track("a");
    expect(tracker.pending()).toEqual(["a"]);
    expect(tracker.isReady()).toBe(false);
    tracker.reset();
    expect(timers.size).toBe(0);
    expect(tracker.pending()).toEqual([]);
  });
});

describe("shouldShowLoading", () => {
  const base = { booting: false, pending: 0, timedOut: false, initialDone: false };

  it("mostra_enquanto_o_servidor_nao_respondeu", () => {
    expect(shouldShowLoading({ ...base, booting: true })).toBe(true);
    expect(shouldShowLoading({ ...base, booting: true, pending: 3 })).toBe(true);
    expect(shouldShowLoading({ ...base, booting: true, timedOut: true })).toBe(true);
  });

  it("mostra_com_recursos_pendentes_sem_timeout", () => {
    expect(shouldShowLoading({ ...base, pending: 2 })).toBe(true);
  });

  it("libera_com_timeout_estourado_mesmo_com_pendentes", () => {
    expect(shouldShowLoading({ ...base, pending: 2, timedOut: true })).toBe(false);
  });

  it("libera_sem_pendentes_e_sem_boot", () => {
    expect(shouldShowLoading(base)).toBe(false);
  });

  it("nao_reabre_depois_do_primeiro_carregamento", () => {
    expect(shouldShowLoading({ ...base, initialDone: true, pending: 5 })).toBe(false);
    expect(shouldShowLoading({ ...base, initialDone: true, booting: true })).toBe(false);
  });
});

describe("loadingTracker com texturas", () => {
  it("falha_conta_como_resolvida_e_libera", () => {
    const { tracker } = setup();
    tracker.track("tex:1:/cards/a.png");
    tracker.track("tex:2:/cards/b.png");
    tracker.settle("tex:1:/cards/a.png");
    expect(tracker.isReady()).toBe(false);
    tracker.settle("tex:2:/cards/b.png"); // 404: loadTexture devolve null e o wrapper resolve a chave
    expect(tracker.isReady()).toBe(true);
    expect(tracker.expired()).toEqual([]);
  });

  it("textura_travada_nao_prende_alem_do_timeout", () => {
    const { tracker, fire } = setup();
    tracker.track("tex:1:/textures/table.png");
    expect(tracker.isReady()).toBe(false);
    fire();
    expect(tracker.isReady()).toBe(true);
    expect(tracker.expired()).toEqual(["tex:1:/textures/table.png"]);
  });

  it("reset_por_tela_ignora_resolucao_tardia_de_chave_antiga", () => {
    const { tracker } = setup();
    tracker.track("tex:1:/cards/a.png");
    tracker.reset();
    tracker.track("tex:2:/cards/a.png");
    tracker.settle("tex:1:/cards/a.png"); // resolução tardia da tela anterior
    expect(tracker.pending()).toEqual(["tex:2:/cards/a.png"]);
    expect(tracker.isReady()).toBe(false);
  });
});

describe("createLoadingGate (issue #302)", () => {
  // Simula o render: cria uma imagem rastreada e, em seguida, ela falha (404) de forma assíncrona.
  const simulate = (gated: boolean) => {
    const { tracker } = setup();
    const gate = createLoadingGate(tracker);
    let renders = 0;
    let seq = 0;
    const failures: string[] = [];
    const render = () => {
      renders += 1;
      if (renders > 50) throw new Error("laço de render");
      gate.observe();
      const key = `img:${++seq}`;
      tracker.track(key);
      failures.push(key);
    };
    const flushErrors = () => {
      while (failures.length > 0) tracker.settle(failures.shift() as string);
    };
    if (gated) gate.subscribe(render);
    else tracker.subscribe(() => { if (tracker.isReady()) render(); });
    render();
    try {
      flushErrors();
    } catch {
      return renders;
    }
    return renders;
  };

  it("assinatura_ingenua_entra_em_laco_com_imagem_que_falha", () => {
    expect(simulate(false)).toBeGreaterThan(50);
  });

  it("imagem_que_falha_dentro_do_render_nao_pede_outro_render", () => {
    expect(simulate(true)).toBe(1);
  });

  it("render_retido_pelo_loading_renderiza_uma_vez_ao_liberar", () => {
    const { tracker } = setup();
    const gate = createLoadingGate(tracker);
    const onReady = vi.fn();
    gate.subscribe(onReady);
    tracker.track("a");
    tracker.track("b");
    expect(gate.observe()).toBe(false);
    tracker.settle("a");
    expect(onReady).not.toHaveBeenCalled();
    tracker.settle("b");
    expect(onReady).toHaveBeenCalledTimes(1);
    tracker.track("c");
    tracker.settle("c"); // nada retido: sem novo render
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("timeout_libera_o_render_retido", () => {
    const { tracker, fire } = setup();
    const gate = createLoadingGate(tracker);
    const onReady = vi.fn();
    gate.subscribe(onReady);
    tracker.track("a");
    gate.observe();
    fire();
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
