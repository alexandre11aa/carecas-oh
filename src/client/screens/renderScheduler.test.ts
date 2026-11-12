// src/client/screens/renderScheduler.test.ts
import { describe, expect, it, vi } from "vitest";
import { createCommandSlots, createRenderScheduler, createSizeGuard } from "./renderScheduler.js";

const setup = () => {
  const frames = new Map<number, () => void>();
  let next = 0;
  const run = vi.fn();
  const scheduler = createRenderScheduler({
    run,
    requestFrame: (cb) => {
      frames.set(++next, cb);
      return next;
    },
    cancelFrame: (handle) => {
      frames.delete(handle as number);
    },
  });
  const tick = () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const cb of pending) cb();
  };
  return { scheduler, run, frames, tick };
};

describe("renderScheduler", () => {
  it("varios_pedidos_no_mesmo_quadro_geram_um_render", () => {
    const { scheduler, run, frames, tick } = setup();
    scheduler.request();
    scheduler.request();
    scheduler.request();
    expect(frames.size).toBe(1);
    expect(run).not.toHaveBeenCalled();
    tick();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("pedido_depois_do_quadro_agenda_novo_render", () => {
    const { scheduler, run, tick } = setup();
    scheduler.request();
    tick();
    scheduler.request();
    tick();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("pedido_dentro_do_render_vai_para_o_proximo_quadro_sem_reentrar", () => {
    let depth = 0;
    let maxDepth = 0;
    let calls = 0;
    const frames: (() => void)[] = [];
    const scheduler = createRenderScheduler({
      run: () => {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
        calls++;
        if (calls < 3) {
          scheduler.request();
          scheduler.flush();
        }
        depth--;
      },
      requestFrame: (cb) => frames.push(cb),
    });
    scheduler.flush();
    expect(calls).toBe(1);
    expect(frames.length).toBe(1); // pedido e flush internos coalescidos em um quadro
    frames.shift()?.();
    expect(calls).toBe(2);
    frames.shift()?.();
    expect(calls).toBe(3);
    expect(frames.length).toBe(0);
    expect(maxDepth).toBe(1);
  });

  it("flush_executa_na_hora_e_cancela_o_quadro_agendado", () => {
    const { scheduler, run, frames, tick } = setup();
    scheduler.request();
    scheduler.flush();
    expect(run).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    tick();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("cancel_descarta_o_quadro_e_ignora_pedidos_futuros", () => {
    const { scheduler, run, frames, tick } = setup();
    scheduler.request();
    scheduler.cancel();
    expect(frames.size).toBe(0);
    scheduler.request();
    scheduler.flush();
    tick();
    expect(run).not.toHaveBeenCalled();
  });

  it("excecao_no_render_nao_deixa_o_agendador_travado", () => {
    let fail = true;
    const frames: (() => void)[] = [];
    const run = vi.fn(() => {
      if (fail) throw new Error("falha");
    });
    const scheduler = createRenderScheduler({ run, requestFrame: (cb) => frames.push(cb) });
    scheduler.request();
    expect(() => frames.shift()?.()).toThrow("falha");
    expect(scheduler.isRunning()).toBe(false);
    fail = false;
    scheduler.request();
    frames.shift()?.();
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("sizeGuard", () => {
  it("ignora_a_mesma_medida_e_aceita_mudanca_real", () => {
    const guard = createSizeGuard();
    expect(guard.changed(800, 600)).toBe(true);
    expect(guard.changed(800, 600)).toBe(false);
    expect(guard.changed(800, 601)).toBe(true);
    expect(guard.changed(800, 601)).toBe(false);
  });
});

describe("commandSlots", () => {
  it("usa_sempre_os_comandos_mais_recentes_e_ignora_indice_antigo", () => {
    const slots = createCommandSlots<string>();
    expect(slots.set(["a", "b", "c"])).toEqual([0, 1, 2]);
    expect(slots.get(2)).toBe("c");
    for (let i = 0; i < 100; i++) slots.set([`x${i}`]);
    expect(slots.get(0)).toBe("x99");
    expect(slots.get(2)).toBeUndefined();
  });
});
