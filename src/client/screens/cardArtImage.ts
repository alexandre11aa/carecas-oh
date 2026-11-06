// src/client/screens/cardArtImage.ts
// Aplica o PNG de frente a um elemento HTML de carta, com fallback para o visual de texto.
import { faceImageUrl } from "../scene/cardArt.js";
import { el } from "./dom.js";

/**
 * Se a carta tiver PNG, tenta carregá-lo: ao terminar, insere a arte (que já traz todo o texto) e marca o
 * elemento com `has-art`, o que esconde visualmente o texto de fallback (ele segue acessível a leitores
 * de tela). Em 404 não faz nada. Carta oculta (`null`) nunca resolve imagem.
 */
export const applyCardArt = (container: HTMLElement, cardId: string | null, alt: string): void => {
  const url = faceImageUrl(cardId);
  if (!url) return;
  const img = el("img", "card-art");
  img.alt = alt;
  img.decoding = "async";
  img.draggable = false;
  // A imagem pertence ao próprio contêiner: se ele foi substituído antes do fim da carga, a atualização
  // acontece num elemento descartado e não afeta nenhum outro.
  img.addEventListener("load", () => {
    container.append(img);
    container.classList.add("has-art");
  });
  img.src = url;
};
