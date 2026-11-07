// src/client/screens/toasts.ts
// Lógica pura dos toasts de erro: fila, dedup, expiração, limite de empilhamento e dispensa.
import { errorMessage } from "./errorMessages.js";

export type Toast = { id: number; key: string; message: string; expiresAt: number };
export type ToastInput = { key: string; message: string };

/** Quanto tempo (ms) um toast fica visível. */
export const TOAST_DURATION_MS = 5000;
/** Máximo de toasts empilhados; ao passar, o mais antigo sai. */
export const MAX_TOASTS = 4;

/** Entrada de toast para um `code` de erro do servidor (mensagem em português). */
export const errorToast = (code: string): ToastInput => ({ key: `error:${code}`, message: errorMessage(code) });

/** Entrada de toast para um erro local (conexão, cópia, formulário); o texto também serve de chave. */
export const messageToast = (message: string): ToastInput => ({ key: `message:${message}`, message });

/** Acrescenta um toast. Não repete o mesmo `key` (ou mensagem) enquanto o anterior ainda está visível. */
export const pushToast = (toasts: Toast[], input: ToastInput, now: number, id: number): Toast[] => {
  const visible = expireToasts(toasts, now);
  if (visible.some((toast) => toast.key === input.key || toast.message === input.message)) return visible;
  const next = [...visible, { id, key: input.key, message: input.message, expiresAt: now + TOAST_DURATION_MS }];
  return next.slice(-MAX_TOASTS);
};

/** Remove os toasts cujo prazo já passou. */
export const expireToasts = (toasts: Toast[], now: number): Toast[] => {
  const visible = toasts.filter((toast) => toast.expiresAt > now);
  return visible.length === toasts.length ? toasts : visible;
};

/** Remove o toast com o id dado (dispensa manual). */
export const dismissToast = (toasts: Toast[], id: number): Toast[] => toasts.filter((toast) => toast.id !== id);

/** Menor prazo entre os toasts, ou null sem toasts (para agendar a próxima expiração). */
export const nextExpiry = (toasts: Toast[]): number | null =>
  toasts.length ? Math.min(...toasts.map((toast) => toast.expiresAt)) : null;

// Armazém global (um por página): o socket e as telas empurram, a view assina.
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<(toasts: Toast[]) => void>();

const publish = (next: Toast[]): void => {
  if (next === toasts) return;
  toasts = next;
  listeners.forEach((listener) => listener(toasts));
};

export const getToasts = (): Toast[] => toasts;

/** Mostra um toast de erro. */
export const showToast = (input: ToastInput, now: number = Date.now()): void => {
  const next = pushToast(toasts, input, now, nextId);
  if (next.some((toast) => toast.id === nextId)) nextId += 1;
  publish(next);
};

/** Mostra o toast de um `code` de erro do servidor. */
export const showErrorCode = (code: string): void => showToast(errorToast(code));

/** Mostra o toast de uma mensagem local em português. */
export const showErrorMessage = (message: string): void => showToast(messageToast(message));

export const dismissToastById = (id: number): void => publish(dismissToast(toasts, id));

export const expireVisibleToasts = (now: number = Date.now()): void => publish(expireToasts(toasts, now));

export const subscribeToasts = (listener: (toasts: Toast[]) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Limpa tudo (testes). */
export const resetToasts = (): void => {
  toasts = [];
  nextId = 1;
};
