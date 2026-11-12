// src/client/screens/renderScheduler.ts
// Lógica pura: agenda renders por quadro com coalescência e proteção contra reentrância (issue #303).

export type RenderSchedulerOptions = {
  /** Executa o render. Pedidos feitos de dentro dele são adiados para o próximo quadro. */
  run: () => void;
  /** Agenda o callback para o próximo quadro (`requestAnimationFrame` no navegador). */
  requestFrame: (callback: () => void) => unknown;
  /** Cancela um quadro agendado (`cancelAnimationFrame`). */
  cancelFrame?: (handle: unknown) => void;
};

export type RenderScheduler = {
  /** Pede um render no próximo quadro; vários pedidos no mesmo quadro geram um só render. */
  request: () => void;
  /** Executa já (cancelando o quadro agendado). Dentro de um render, vira pedido para o próximo quadro. */
  flush: () => void;
  /** Cancela o quadro agendado e ignora pedidos futuros. */
  cancel: () => void;
  /** Verdadeiro enquanto o render está executando. */
  isRunning: () => boolean;
};

export const createRenderScheduler = ({ run, requestFrame, cancelFrame }: RenderSchedulerOptions): RenderScheduler => {
  let handle: unknown = null;
  let scheduled = false;
  let running = false;
  let cancelled = false;

  const dropFrame = (): void => {
    scheduled = false;
    if (handle !== null) cancelFrame?.(handle);
    handle = null;
  };

  const execute = (): void => {
    if (cancelled) return;
    if (running) {
      schedule();
      return;
    }
    running = true;
    try {
      run();
    } finally {
      running = false;
    }
  };

  function schedule(): void {
    if (scheduled || cancelled) return;
    scheduled = true;
    handle = requestFrame(() => {
      scheduled = false;
      handle = null;
      execute();
    });
  }

  return {
    request: schedule,
    flush: () => {
      if (cancelled) return;
      if (running) {
        schedule();
        return;
      }
      dropFrame();
      execute();
    },
    cancel: () => {
      cancelled = true;
      dropFrame();
    },
    isRunning: () => running,
  };
};

export type SizeGuard = {
  /** Devolve `true` (e memoriza) só se a medida mudou; notificações repetidas da mesma medida não refazem o trabalho. */
  changed: (width: number, height: number) => boolean;
};

/** Evita reaplicar o redimensionamento quando o `ResizeObserver` notifica a mesma medida (laço render -> resize -> render). */
export const createSizeGuard = (): SizeGuard => {
  let lastWidth = -1;
  let lastHeight = -1;
  return {
    changed: (width, height) => {
      if (width === lastWidth && height === lastHeight) return false;
      lastWidth = width;
      lastHeight = height;
      return true;
    },
  };
};

export type CommandSlots<T> = {
  /** Substitui os comandos atuais e devolve os índices (para o `data-index` dos botões). */
  set: (commands: readonly T[]) => number[];
  /** Comando atual do índice, ou `undefined` se o índice não existe mais. */
  get: (index: number) => T | undefined;
};

/** Delegação de eventos: um único listener no contêiner lê o comando mais recente pelo índice do botão. */
export const createCommandSlots = <T>(): CommandSlots<T> => {
  let current: readonly T[] = [];
  return {
    set: (commands) => {
      current = commands;
      return commands.map((_, index) => index);
    },
    get: (index) => current[index],
  };
};
