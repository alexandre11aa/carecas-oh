// src/client/scene/textures.ts
// Carregador de texturas PNG com cache por URL e fallback: devolve null (sem lançar)
// se o arquivo não existir ou falhar. A imagem é reduzida na carga antes de ir à GPU.
import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace, Texture, TextureLoader } from "three";
import { fitTextureSize, MAX_TEXTURE_WIDTH, textureOptionsFor } from "./texturePaths.js";

export type LoadTextureOptions = {
  /** Largura máxima em pixels; padrão `MAX_TEXTURE_WIDTH`. A proporção é mantida. */
  maxWidth?: number;
  /** Anisotropia do filtro; padrão 4 (bom para cartas vistas em ângulo). */
  anisotropy?: number;
};

const loader = new TextureLoader();
/** Cache por URL (e limite): guarda a promessa, inclusive falhas (null), para não repetir requisições. */
const cache = new Map<string, Promise<Texture | null>>();

const resize = (image: HTMLImageElement, maxWidth: number): HTMLImageElement | HTMLCanvasElement => {
  const { width, height } = fitTextureSize(image.naturalWidth || image.width, image.naturalHeight || image.height, maxWidth);
  if (width === (image.naturalWidth || image.width)) return image;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return image;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
};

const load = (url: string, options: LoadTextureOptions): Promise<Texture | null> =>
  new Promise((resolve) => {
    loader.load(
      url,
      (raw) => {
        try {
          const source = resize(raw.image as HTMLImageElement, options.maxWidth ?? MAX_TEXTURE_WIDTH);
          const texture = source === raw.image ? raw : new CanvasTexture(source);
          if (texture !== raw) raw.dispose();
          texture.colorSpace = SRGBColorSpace;
          texture.generateMipmaps = true;
          texture.minFilter = LinearMipmapLinearFilter;
          texture.anisotropy = options.anisotropy ?? 4;
          texture.needsUpdate = true;
          resolve(texture);
        } catch {
          resolve(null);
        }
      },
      undefined,
      () => resolve(null),
    );
  });

/** Carrega uma textura (com cache por URL). Nunca lança: `null` significa "use o visual padrão". */
export const loadTexture = (url: string, options: LoadTextureOptions = textureOptionsFor(url)): Promise<Texture | null> => {
  let pending = cache.get(url);
  if (!pending) {
    pending = load(url, options).catch(() => null);
    cache.set(url, pending);
  }
  return pending;
};

/**
 * Pré-carrega as URLs com as opções padrão de cada uma (o cache serve depois a cena). `onSettled` roda a
 * cada URL que termina, com sucesso ou falha (null = resolvida); a promessa devolvida nunca rejeita.
 */
export const preloadTextures = (urls: readonly string[], onSettled: (url: string) => void): Promise<void> =>
  Promise.all(urls.map((url) => loadTexture(url).then(() => onSettled(url)))).then(() => undefined);
