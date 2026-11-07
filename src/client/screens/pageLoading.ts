// src/client/screens/pageLoading.ts
import { createLoadingTracker } from "./loadingTracker.js";

/** Rastreador único dos recursos HTML da tela aberta; `main.ts` o reinicia a cada tela nova. */
export const pageLoading = createLoadingTracker();

let imageSeq = 0;

/**
 * Registra a imagem no rastreador (chame depois de definir `src`). Cada imagem tem chave própria e
 * única, então um `load`/`error` tardio de uma tela antiga nunca resolve a chave de outra. Carga ou
 * falha resolvem; imagem já pronta (cache ou erro imediato) resolve na hora.
 */
export const trackImage = (image: HTMLImageElement): void => {
  const key = `img:${++imageSeq}`;
  pageLoading.track(key);
  if (image.complete) {
    pageLoading.settle(key);
    return;
  }
  const done = () => pageLoading.settle(key);
  image.addEventListener("load", done, { once: true });
  image.addEventListener("error", done, { once: true });
};
