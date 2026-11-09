// src/client/screens/presentationWatchdog.ts

/** Tempo máximo (ms) que um passo da fila de apresentação pode ficar sem concluir. */
export const STEP_TIMEOUT_MS = 6000;

/** Estado observado da fila de apresentação, com o tempo injetado (ms). */
export type WatchdogInput = {
  /** Instante em que o passo atual começou; null se nenhum passo está em andamento. */
  stepStartedAt: number | null;
  now: number;
  timeoutMs?: number;
};

/** True quando há um passo em andamento há mais tempo que o limite. */
export const isStepStuck = ({ stepStartedAt, now, timeoutMs = STEP_TIMEOUT_MS }: WatchdogInput): boolean =>
  stepStartedAt !== null && now - stepStartedAt > timeoutMs;

/** Contexto registrado em `console.warn` quando o watchdog dispara, para diagnosticar o travamento. */
export type WatchdogContext = {
  reason: "timeout" | "exception";
  elapsedMs: number | null;
  queueLength: number;
  stepKind: string | null;
  effectsDone: boolean;
  noticeDone: boolean;
  turn: number | null;
  phase: string | null;
  hidden: boolean;
  userAgent: string;
  error?: string;
};

/** Monta a mensagem e o contexto do aviso do watchdog. */
export const describeWatchdog = (context: WatchdogContext): [string, WatchdogContext] => [
  context.reason === "timeout"
    ? "[partida] passo de apresentação travado; fila descartada e estado do servidor restaurado"
    : "[partida] exceção na apresentação; fila descartada e estado do servidor restaurado",
  context,
];
