// src/client/scene/blackHole.ts
// Buraco negro decorativo sob a mesa: planos com textura gerada em canvas, girando devagar. Não participa de cliques.
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from "three";
import {
  DISC_STOPS,
  SPIRAL_ARMS,
  SPIRAL_STROKES,
  SPIRAL_TEXTURE_SIZE,
  VORTEX_DISC_SIZE,
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

/** Cria o buraco negro; devolve null se o canvas não estiver disponível (a cena mantém o fundo atual). */
export const createBlackHole = (reducedMotion: boolean): BlackHole | null => {
  const spiral = makeCanvas();
  const disc = makeCanvas();
  if (!spiral || !disc) return null;

  const half = SPIRAL_TEXTURE_SIZE / 2;
  // Disco base: centro preto, anel de acreção brilhante e halo escuro e denso.
  const discGradient = disc.ctx.createRadialGradient(half, half, 0, half, half, half);
  for (const stop of DISC_STOPS) discGradient.addColorStop(stop.offset, stop.color);
  disc.ctx.fillStyle = discGradient;
  disc.ctx.fillRect(0, 0, SPIRAL_TEXTURE_SIZE, SPIRAL_TEXTURE_SIZE);

  // Braços espessos e suaves (várias passadas), em vez de linhas finas.
  spiral.ctx.translate(half, half);
  spiral.ctx.lineCap = "round";
  for (let arm = 0; arm < SPIRAL_ARMS; arm++) {
    for (const stroke of SPIRAL_STROKES) {
      spiral.ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const r = 0.3 + (i / 80) * 0.7;
        const a = spiralAngle(arm, r);
        const x = Math.cos(a) * r * half * 0.97;
        const y = Math.sin(a) * r * half * 0.97;
        if (i === 0) spiral.ctx.moveTo(x, y);
        else spiral.ctx.lineTo(x, y);
      }
      spiral.ctx.strokeStyle = `rgba(255,255,255,${stroke.alpha})`;
      spiral.ctx.lineWidth = stroke.width * half;
      spiral.ctx.stroke();
    }
  }
  // Esmaece o miolo (fica o centro preto) e a borda externa, sem cortes.
  spiral.ctx.globalCompositeOperation = "destination-in";
  const fade = spiral.ctx.createRadialGradient(0, 0, 0, 0, 0, half);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.32, "rgba(0,0,0,0)");
  fade.addColorStop(0.5, "rgba(0,0,0,1)");
  fade.addColorStop(0.8, "rgba(0,0,0,0.8)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  spiral.ctx.fillStyle = fade;
  spiral.ctx.fillRect(-half, -half, SPIRAL_TEXTURE_SIZE, SPIRAL_TEXTURE_SIZE);

  const spiralTexture = new CanvasTexture(spiral.canvas);
  const discTexture = new CanvasTexture(disc.canvas);
  spiralTexture.colorSpace = SRGBColorSpace;
  discTexture.colorSpace = SRGBColorSpace;

  // Uma geometria por tamanho e um material por camada; a textura da espiral é compartilhada.
  const geometries = [VORTEX_DISC_SIZE, ...VORTEX_LAYERS.map((l) => l.size)].map((s) => new PlaneGeometry(s, s));
  const discMaterial = new MeshBasicMaterial({ map: discTexture, transparent: true, depthWrite: false });
  const materials = VORTEX_LAYERS.map(
    (l) => new MeshBasicMaterial({ map: spiralTexture, color: l.tint, transparent: true, opacity: l.opacity, depthWrite: false }),
  );

  const group = new Group();
  group.position.set(VORTEX_POSITION.x, VORTEX_POSITION.y, VORTEX_POSITION.z);
  group.rotation.x = VORTEX_TILT;
  const discMesh = new Mesh(geometries[0], discMaterial);
  discMesh.raycast = () => {}; // puramente decorativo
  group.add(discMesh);
  const layers = VORTEX_LAYERS.map((_, i) => {
    const mesh = new Mesh(geometries[i + 1], materials[i]);
    mesh.position.z = (i + 1) * 0.01;
    mesh.raycast = () => {};
    group.add(mesh);
    return mesh;
  });

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
      discMaterial.dispose();
      spiralTexture.dispose();
      discTexture.dispose();
    },
  };
};
