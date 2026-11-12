// src/client/scene/cardMesh.ts
import { BoxGeometry, CanvasTexture, Mesh, MeshLambertMaterial, PlaneGeometry, SRGBColorSpace } from "three";
import { getCard } from "../../engine/cards.js";
import { chooseFace, faceImageUrl } from "./cardArt.js";
import { loadTexture } from "./textures.js";
import { CARD_BACK_PATH } from "./texturePaths.js";
import { CARD_BASE_Y, CARD_HEIGHT, CARD_WIDTH, PILE_BODY_THICKNESS, type CardPlacement } from "./layout.js";

// Canvas provisório na proporção 1030:1500 (412x600). Desenha-se em coordenadas lógicas de
// 256 de largura (TEX_W) e a altura proporcional (TEX_H); o contexto é escalado para o canvas.
const CANVAS_W = 412;
const CANVAS_H = 600;
const TEX_W = 256;
const TEX_H = (TEX_W * CANVAS_H) / CANVAS_W;

/** Geometria única compartilhada por todas as cartas: plano deitado, com a frente voltada para cima. */
const geometry = new PlaneGeometry(CARD_WIDTH, CARD_HEIGHT).rotateX(-Math.PI / 2);

const materials = new Map<string, MeshLambertMaterial>();

const COLORS = { MONSTER: "#b5803a", SPELL: "#2f8a78", TRAP: "#8a3a6a" } as const;

const makeCanvas = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.scale(CANVAS_W / TEX_W, CANVAS_W / TEX_W);
  return [canvas, ctx];
};

const wrap = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
};

/** Textura provisória gerada em canvas: nome, tipo e ATK/DEF (arte definitiva virá depois). */
const faceTexture = (cardId: string): CanvasTexture => {
  const [canvas, ctx] = makeCanvas();
  const card = getCard(cardId);
  ctx.fillStyle = card ? COLORS[card.type] : "#555";
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.fillStyle = "#f3ead2";
  ctx.fillRect(12, 12, TEX_W - 24, TEX_H - 24);
  ctx.fillStyle = "#222";
  ctx.textAlign = "center";
  ctx.font = "bold 26px sans-serif";
  wrap(ctx, card?.name ?? "?", TEX_W - 40).forEach((line, i) => ctx.fillText(line, TEX_W / 2, 48 + i * 30));
  ctx.font = "18px sans-serif";
  if (card?.type === "MONSTER") {
    ctx.fillText(`Monstro · nível ${card.level}`, TEX_W / 2, 150);
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(`ATK ${card.attack}`, TEX_W / 2, 260);
    ctx.fillText(`DEF ${card.defense}`, TEX_W / 2, 305);
  } else if (card) {
    ctx.fillText(card.type === "SPELL" ? "Magia" : "Armadilha", TEX_W / 2, 150);
  }
  return new CanvasTexture(canvas);
};

const backTexture = (): CanvasTexture => {
  const [canvas, ctx] = makeCanvas();
  ctx.fillStyle = "#3a2a6a";
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.strokeStyle = "#c8a23a";
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, TEX_W - 28, TEX_H - 28);
  ctx.beginPath();
  ctx.arc(TEX_W / 2, TEX_H / 2, 60, 0, Math.PI * 2);
  ctx.stroke();
  return new CanvasTexture(canvas);
};

/**
 * Material compartilhado por identidade de carta; `null` é o verso (WebP/PNG único `CARD_BACK_PATH`, nunca a imagem da frente; canvas enquanto carrega ou sem o arquivo).
 * A frente começa com o canvas provisório; se o WebP/PNG existir, ele substitui o mapa do próprio material
 * ao terminar de carregar (sem texto sobreposto: a arte já é a carta inteira). Como o material é por
 * carta e não por malha, uma imagem tardia nunca atinge a carta errada. Em 404 permanece o canvas.
 */
const materialFor = (cardId: string | null): MeshLambertMaterial => {
  const key = cardId ?? "back";
  let material = materials.get(key);
  if (!material) {
    const map = cardId === null ? backTexture() : faceTexture(cardId);
    map.colorSpace = SRGBColorSpace;
    material = new MeshLambertMaterial({ map });
    materials.set(key, material);
    // Verso: um único material (chave "back") compartilhado por todas as cartas viradas; usa o WebP/PNG do dono.
    const url = cardId === null ? CARD_BACK_PATH : faceImageUrl(cardId);
    if (url) {
      const target = material;
      void loadTexture(url).then((texture) => {
        if (!texture || chooseFace(url, true) !== "image") return;
        const previous = target.map;
        target.map = texture;
        target.needsUpdate = true;
        previous?.dispose();
      });
    }
  }
  return material;
};

export const createCardMesh = (): Mesh => new Mesh(geometry, materialFor(null));

/** Aplica identidade, posição e rotação de um `CardPlacement` à malha. */
export const updateCardMesh = (mesh: Mesh, placement: CardPlacement): void => {
  mesh.material = materialFor(placement.faceDown ? null : placement.cardId);
  mesh.position.set(placement.x, placement.y ?? CARD_BASE_Y, placement.z);
  mesh.rotation.set(0, placement.yaw, 0);
};

/** Corpo de pilha: caixa fina única e material liso únicos, compartilhados por todas as placas (sem textura). */
const pileBodyGeometry = new BoxGeometry(CARD_WIDTH, PILE_BODY_THICKNESS, CARD_HEIGHT);
const pileBodyMaterial = new MeshLambertMaterial({ color: 0xe6dfc8 });

/** Placa do corpo de uma pilha; geometria e material são compartilhados e nunca liberados por placa. */
export const createPileBodyMesh = (): Mesh => new Mesh(pileBodyGeometry, pileBodyMaterial);

/** Posiciona uma placa do corpo na altura `y`, alinhada à posição e ao giro da pilha. */
export const updatePileBodyMesh = (mesh: Mesh, placement: CardPlacement, y: number): void => {
  mesh.position.set(placement.x, y, placement.z);
  mesh.rotation.set(0, placement.yaw, 0);
};
