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
