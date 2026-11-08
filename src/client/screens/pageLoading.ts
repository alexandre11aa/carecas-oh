// src/client/screens/pageLoading.ts
import { preloadTextures } from "../scene/textures.js";
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

let textureSeq = 0;

/**
 * Registra as texturas críticas no rastreador e as pré-carrega. Falha também resolve (`loadTexture`
 * devolve null e a cena usa o visual padrão). Chaves únicas por chamada: a resolução tardia de uma
 * tela antiga nunca resolve a mesma URL pendente na tela atual.
 */
export const trackTextures = (urls: readonly string[]): void => {
  const keys = new Map(urls.map((url) => [url, `tex:${++textureSeq}:${url}`]));
  for (const key of keys.values()) pageLoading.track(key);
  void preloadTextures(urls, (url) => pageLoading.settle(keys.get(url) as string));
};
