// src/client/screens/loadingTracker.ts

/** Tempo máximo (ms) de espera pelos recursos antes de liberar a tela mesmo com pendentes. */
export const LOADING_TIMEOUT_MS = 10_000;

export type LoadingTimerHandle = unknown;

export type LoadingTrackerOptions = {
  timeoutMs?: number;
  setTimer?: (callback: () => void, ms: number) => LoadingTimerHandle;
  clearTimer?: (handle: LoadingTimerHandle) => void;
};

export type LoadingTracker = {
  /** Registra um recurso pendente; chave repetida é ignorada. */
  track: (key: string) => void;
  /** Marca o recurso como resolvido (sucesso ou falha); chave desconhecida ou já resolvida é ignorada. */
  settle: (key: string) => void;
  /** Chaves ainda pendentes (vazio após o timeout, que as move para `expired`). */
  pending: () => string[];
  /** Verdadeiro sem pendentes ou depois do timeout de segurança. */
  isReady: () => boolean;
  /** Chaves que ainda estavam pendentes quando o timeout estourou. */
  expired: () => string[];
  /** Assina mudanças de estado; devolve a função que cancela a assinatura. */
  subscribe: (listener: () => void) => () => void;
  /** Reinicia o ciclo (nova tela). */
  reset: () => void;
};

export const createLoadingTracker = (options: LoadingTrackerOptions = {}): LoadingTracker => {
  const timeoutMs = options.timeoutMs ?? LOADING_TIMEOUT_MS;
  const setTimer = options.setTimer ?? ((cb, ms) => setTimeout(cb, ms));
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let pendingKeys = new Set<string>();
  let seenKeys = new Set<string>();
  let expiredKeys: string[] = [];
  let timedOut = false;
  let timer: LoadingTimerHandle | null = null;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  const stopTimer = (): void => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };

  const onTimeout = (): void => {
    timer = null;
    if (pendingKeys.size === 0) return;
    expiredKeys = [...pendingKeys];
    pendingKeys = new Set();
    timedOut = true;
    notify();
  };

  return {
    track: (key) => {
      if (timedOut || seenKeys.has(key)) return;
      seenKeys.add(key);
      pendingKeys.add(key);
      if (timer === null) timer = setTimer(onTimeout, timeoutMs);
      notify();
    },
    settle: (key) => {
      if (!pendingKeys.delete(key)) return;
      if (pendingKeys.size === 0) stopTimer();
      notify();
    },
    pending: () => [...pendingKeys],
    isReady: () => timedOut || pendingKeys.size === 0,
    expired: () => [...expiredKeys],
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset: () => {
      stopTimer();
      pendingKeys = new Set();
      seenKeys = new Set();
      expiredKeys = [];
      timedOut = false;
      notify();
    },
  };
};
