// src/client/scene/blackHole.ts
// Vórtice decorativo atrás da mesa: planos com textura gerada em canvas, girando devagar. Não participa de cliques.
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from "three";
import {
  SPIRAL_ARMS,
  SPIRAL_TEXTURE_SIZE,
  VORTEX_CORE_SIZE,
  VORTEX_LAYERS,
  VORTEX_POSITION,
  VORTEX_TILT,
  spiralAngle,
  vortexAngle,
} from "./blackHoleDesign.js";

export type BlackHole = {
  group: Group;
  /** Atualiza a rotação pelo tempo (segundos). */
  update: (seconds: number) => void;
  dispose: () => void;
};

const makeCanvas = (): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null => {
  const canvas = document.createElement("canvas");
  canvas.width = SPIRAL_TEXTURE_SIZE;
  canvas.height = SPIRAL_TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  return ctx ? { canvas, ctx } : null;
};

/** Cria o vórtice; devolve null se o canvas não estiver disponível (a cena mantém o fundo atual). */
export const createBlackHole = (reducedMotion: boolean): BlackHole | null => {
  const spiral = makeCanvas();
  const core = makeCanvas();
  if (!spiral || !core) return null;

  const half = SPIRAL_TEXTURE_SIZE / 2;
  spiral.ctx.translate(half, half);
  spiral.ctx.lineCap = "round";
  for (let arm = 0; arm < SPIRAL_ARMS; arm++) {
    spiral.ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const r = i / 60;
      const a = spiralAngle(arm, r);
      const x = Math.cos(a) * r * half * 0.95;
      const y = Math.sin(a) * r * half * 0.95;
      if (i === 0) spiral.ctx.moveTo(x, y);
      else spiral.ctx.lineTo(x, y);
    }
    spiral.ctx.strokeStyle = "rgba(255,255,255,0.75)";
    spiral.ctx.lineWidth = 10;
    spiral.ctx.stroke();
  }
  // Esmaece as bordas do disco para não aparecer um corte.
  spiral.ctx.globalCompositeOperation = "destination-in";
  const fade = spiral.ctx.createRadialGradient(0, 0, half * 0.1, 0, 0, half);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  spiral.ctx.fillStyle = fade;
  spiral.ctx.fillRect(-half, -half, SPIRAL_TEXTURE_SIZE, SPIRAL_TEXTURE_SIZE);

  const coreGradient = core.ctx.createRadialGradient(half, half, 0, half, half, half);
  coreGradient.addColorStop(0, "rgba(0,0,0,1)");
  coreGradient.addColorStop(0.55, "rgba(5,0,12,0.9)");
  coreGradient.addColorStop(1, "rgba(5,0,12,0)");
  core.ctx.fillStyle = coreGradient;
  core.ctx.fillRect(0, 0, SPIRAL_TEXTURE_SIZE, SPIRAL_TEXTURE_SIZE);

  const spiralTexture = new CanvasTexture(spiral.canvas);
  const coreTexture = new CanvasTexture(core.canvas);
  spiralTexture.colorSpace = SRGBColorSpace;
  coreTexture.colorSpace = SRGBColorSpace;

  // Uma geometria por camada (tamanhos distintos) e um material por camada; a textura da espiral é compartilhada.
  const geometries = [...VORTEX_LAYERS.map((l) => l.size), VORTEX_CORE_SIZE].map((s) => new PlaneGeometry(s, s));
  const materials = VORTEX_LAYERS.map(
    (l) => new MeshBasicMaterial({ map: spiralTexture, color: l.tint, transparent: true, opacity: l.opacity, depthWrite: false }),
  );
  const coreMaterial = new MeshBasicMaterial({ map: coreTexture, transparent: true, depthWrite: false });

  const group = new Group();
  group.position.set(VORTEX_POSITION.x, VORTEX_POSITION.y, VORTEX_POSITION.z);
  group.rotation.x = VORTEX_TILT;
  const layers = VORTEX_LAYERS.map((_, i) => {
    const mesh = new Mesh(geometries[i], materials[i]);
    mesh.position.z = i * 0.01;
    mesh.raycast = () => {}; // puramente decorativo
    group.add(mesh);
    return mesh;
  });
  const coreMesh = new Mesh(geometries[VORTEX_LAYERS.length], coreMaterial);
  coreMesh.position.z = 0.1;
  coreMesh.raycast = () => {};
  group.add(coreMesh);

  const update = (seconds: number) => {
    layers.forEach((mesh, i) => {
      mesh.rotation.z = vortexAngle(VORTEX_LAYERS[i], seconds, reducedMotion);
    });
  };
  update(0);

  return {
    group,
    update,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      coreMaterial.dispose();
      spiralTexture.dispose();
      coreTexture.dispose();
    },
  };
};
