// src/client/screens/toastView.ts
// DOM dos toasts de erro: contêiner flutuante montado uma vez e que persiste na troca de telas.
import { playToastIn, playToastOut } from "../animations/hudEffects.js";
import { el } from "./dom.js";
import { dismissToastById, expireVisibleToasts, getToasts, nextExpiry, subscribeToasts, type Toast } from "./toasts.js";

/** Cria o contêiner e o liga ao armazém de toasts. Chamar uma única vez (em `main.ts`). */
export const mountToasts = (parent: HTMLElement): void => {
  const container = el("div", "toasts");
  container.setAttribute("role", "region");
  container.setAttribute("aria-label", "Avisos de erro");
  parent.append(container);

  const nodes = new Map<number, HTMLElement>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const createNode = (toast: Toast): HTMLElement => {
    const node = el("div", "toast");
    node.setAttribute("role", "alert");
    node.setAttribute("aria-live", "assertive");
    const close = el("button", "toast-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Dispensar aviso");
    close.addEventListener("click", () => dismissToastById(toast.id));
    node.append(el("span", "toast-message", toast.message), close);
    playToastIn(node);
    return node;
  };

  const render = (toasts: Toast[]) => {
    const ids = new Set(toasts.map((toast) => toast.id));
    for (const [id, node] of nodes) {
      if (ids.has(id)) continue;
      nodes.delete(id);
      playToastOut(node, () => node.remove());
    }
    for (const toast of toasts) {
      if (nodes.has(toast.id)) continue;
      const node = createNode(toast);
      nodes.set(toast.id, node);
      container.append(node);
    }
    clearTimeout(timer);
    const expiry = nextExpiry(toasts);
    if (expiry !== null) timer = setTimeout(() => expireVisibleToasts(), Math.max(0, expiry - Date.now()) + 20);
  };

  subscribeToasts(render);
  render(getToasts());
};
