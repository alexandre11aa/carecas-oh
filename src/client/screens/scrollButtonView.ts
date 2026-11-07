// src/client/screens/scrollButtonView.ts
import { el } from "./dom.js";
import { pickScrollTarget, scrollLabel, type ScrollTarget } from "./scrollButton.js";

export interface ScrollButtonView {
  element: HTMLButtonElement;
  destroy: () => void;
}

/** Botão fixo único que desce ao fim ou sobe ao topo da página; oculto quando a página não rola. */
export const createScrollButton = (): ScrollButtonView => {
  const button = el("button", "scroll-button");
  button.type = "button";
  let target: ScrollTarget | null = null;

  const refresh = () => {
    target = pickScrollTarget({
      scrollTop: window.scrollY,
      viewportHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
    });
    button.hidden = target === null;
    if (target === null) return;
    button.dataset.target = target;
    button.setAttribute("aria-label", scrollLabel(target));
    button.title = scrollLabel(target);
  };

  button.addEventListener("click", () => {
    if (!target) return;
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    window.scrollTo({ top: target === "bottom" ? document.documentElement.scrollHeight : 0, behavior });
  });

  window.addEventListener("scroll", refresh, { passive: true });
  window.addEventListener("resize", refresh, { passive: true });
  // O conteúdo muda de altura sem rolagem (imagens carregando); a página inicia vazia ao montar.
  const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(refresh) : null;
  resizeObserver?.observe(document.documentElement);
  button.hidden = true;
  requestAnimationFrame(refresh);

  return {
    element: button,
    destroy: () => {
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
      resizeObserver?.disconnect();
    },
  };
};
