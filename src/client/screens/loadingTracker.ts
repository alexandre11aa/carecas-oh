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

export type LoadingGate = {
  /** Chamada pelo render: devolve se os recursos estão prontos e, se não estiverem, passa a esperar a liberação. */
  observe: () => boolean;
  /** Chama `onReady` só na liberação esperada (render que ficou retido pelo loading); devolve o cancelamento. */
  subscribe: (onReady: () => void) => () => void;
};

/**
 * Faz o novo render depender de uma mudança real: só uma transição de pendente para pronto que o render
 * anterior observou (e reteve avisos por causa dela) pede outro render. Imagem criada e resolvida durante
 * o próprio render (inclusive em 404) não retém nada e, por isso, não dispara render em laço (issue #302).
 */
export const createLoadingGate = (tracker: LoadingTracker): LoadingGate => {
  let waiting = false;
  return {
    observe: () => {
      const ready = tracker.isReady();
      waiting = !ready;
      return ready;
    },
    subscribe: (onReady) =>
      tracker.subscribe(() => {
        if (!waiting || !tracker.isReady()) return;
        waiting = false;
        onReady();
      }),
  };
};

export type LoadingDecisionInput = {
  /** Servidor ainda não respondeu à primeira conexão. */
  booting: boolean;
  /** Quantidade de recursos ainda pendentes. */
  pending: number;
  /** O timeout de segurança já estourou. */
  timedOut: boolean;
  /** O primeiro carregamento da sessão já terminou (depois dele o loading em tela cheia não reabre). */
  initialDone: boolean;
};

/**
 * Decide se o loading em tela cheia aparece: só no primeiro carregamento, enquanto o servidor não
 * respondeu ou há recursos pendentes sem timeout estourado. Navegar depois entre telas não o reabre.
 */
export const shouldShowLoading = ({ booting, pending, timedOut, initialDone }: LoadingDecisionInput): boolean => {
  if (initialDone) return false;
  return booting || (pending > 0 && !timedOut);
};
