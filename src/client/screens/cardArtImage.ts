// src/client/screens/cardArtImage.ts
// Aplica o WebP/PNG de frente a um elemento HTML de carta, com fallback para o visual de texto.
import { faceImageUrl, settleArtPhase, startArtPhase } from "../scene/cardArt.js";
import { el } from "./dom.js";
import { trackImage } from "./pageLoading.js";

/**
 * Se a carta tiver WebP/PNG, tenta carregá-lo: ao terminar, insere a arte (que já traz todo o texto) e marca o
 * elemento com `has-art`, o que esconde visualmente o texto de fallback (ele segue acessível a leitores
 * de tela). Em 404 não faz nada. Carta oculta (`null`) nunca resolve imagem.
 */
export const applyCardArt = (container: HTMLElement, cardId: string | null, alt: string, options: { showLoading?: boolean } = {}): void => {
  const url = faceImageUrl(cardId);
  if (!url) return;
  const img = el("img", "card-art");
  img.alt = alt;
  img.decoding = "async";
  img.draggable = false;
  img.src = url;
  let phase = startArtPhase(url, img.complete && img.naturalWidth > 0);
  let spinner: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const settle = (outcome: "load" | "error" | "timeout") => {
    phase = settleArtPhase(phase, outcome);
    if (timer) clearTimeout(timer);
    spinner?.remove();
    container.classList.remove("art-loading");
    if (phase === "art") show();
  };
  const show = () => {
    container.append(img);
    container.classList.add("has-art");
  };
  if (phase === "art") show();
  else {
    // A imagem pertence ao próprio contêiner: se ele foi substituído antes do fim da carga, a atualização
    // acontece num elemento descartado e não afeta nenhum outro.
    img.addEventListener("load", () => settle("load"));
    img.addEventListener("error", () => settle("error"));
    if (options.showLoading) {
      spinner = el("div", "spinner art-spinner");
      spinner.setAttribute("role", "status");
      spinner.setAttribute("aria-label", "Carregando arte da carta");
      container.classList.add("art-loading");
      container.append(spinner);
      timer = setTimeout(() => settle("timeout"), 10000);
    }
  }
  trackImage(img);
};
