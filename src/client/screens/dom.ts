// src/client/screens/dom.ts

/** Cria um elemento com classe e texto opcionais. */
export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Contrato de uma tela: `element` é montado uma vez e `update` reflete o estado novo. */
export type Screen = { element: HTMLElement; update: () => void; /** Libera recursos (por exemplo, o WebGL) ao trocar de tela. */ destroy?: () => void };

/**
 * Link interno com navegação sem recarregar (`history.pushState`).
 * Dispara `popstate` para que o roteador em `main.ts` redesenhe a página.
 */
export const linkTo = (path: string, text: string, className?: string): HTMLAnchorElement => {
  const link = el("a", className, text);
  link.href = path;
  link.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (location.pathname !== path) history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo(0, 0);
  });
  return link;
};
