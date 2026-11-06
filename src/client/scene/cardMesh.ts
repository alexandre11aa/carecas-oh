// src/client/scene/cardMesh.ts
import { CanvasTexture, Mesh, MeshLambertMaterial, PlaneGeometry, SRGBColorSpace } from "three";
import { getCard } from "../../engine/cards.js";
import { CARD_HEIGHT, CARD_WIDTH, type CardPlacement } from "./layout.js";

const TEX_W = 256;
const TEX_H = 366;

/** Geometria única compartilhada por todas as cartas: plano deitado, com a frente voltada para cima. */
const geometry = new PlaneGeometry(CARD_WIDTH, CARD_HEIGHT).rotateX(-Math.PI / 2);

const materials = new Map<string, MeshLambertMaterial>();

const COLORS = { MONSTER: "#b5803a", SPELL: "#2f8a78", TRAP: "#8a3a6a" } as const;

const makeCanvas = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  return [canvas, canvas.getContext("2d") as CanvasRenderingContext2D];
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

/** Material compartilhado por identidade de carta; `null` é o verso. */
const materialFor = (cardId: string | null): MeshLambertMaterial => {
  const key = cardId ?? "back";
  let material = materials.get(key);
  if (!material) {
    const map = cardId === null ? backTexture() : faceTexture(cardId);
    map.colorSpace = SRGBColorSpace;
    material = new MeshLambertMaterial({ map });
    materials.set(key, material);
  }
  return material;
};

export const createCardMesh = (): Mesh => new Mesh(geometry, materialFor(null));

/** Aplica identidade, posição e rotação de um `CardPlacement` à malha. */
export const updateCardMesh = (mesh: Mesh, placement: CardPlacement): void => {
  mesh.material = materialFor(placement.faceDown ? null : placement.cardId);
  mesh.position.set(placement.x, 0.02, placement.z);
  mesh.rotation.set(0, placement.yaw, 0);
};
