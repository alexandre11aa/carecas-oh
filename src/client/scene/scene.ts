// src/client/scene/scene.ts
import { AmbientLight, Color, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { Mesh } from "three";
import type { PlayerView } from "../../engine/playerView.js";
import { createCardMesh, updateCardMesh } from "./cardMesh.js";
import { layoutBoard } from "./layout.js";
import { createTable } from "./table.js";

export type MatchScene = {
  /** Reflete exatamente o estado recebido (cartas ausentes saem da mesa). */
  setView: (view: PlayerView) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
};

/** Cena 3D: câmera em perspectiva, duas luzes, sem sombras. Lança erro se não houver WebGL. */
export const createMatchScene = (container: HTMLElement): MatchScene => {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0x14141f);
  scene.add(new AmbientLight(0xffffff, 1.4));
  const light = new DirectionalLight(0xffffff, 1.2);
  light.position.set(3, 10, 6);
  scene.add(light);
  scene.add(createTable());

  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 11, 9);
  camera.lookAt(0, 0, 0.8);

  const meshes = new Map<string, Mesh>();
  let frame = 0;
  const loop = () => {
    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  loop();

  return {
    setView: (view) => {
      const placements = layoutBoard(view);
      const keep = new Set(placements.map((p) => p.key));
      for (const [key, mesh] of meshes) {
        if (!keep.has(key)) {
          scene.remove(mesh);
          meshes.delete(key);
        }
      }
      for (const placement of placements) {
        let mesh = meshes.get(placement.key);
        if (!mesh) {
          mesh = createCardMesh();
          meshes.set(placement.key, mesh);
          scene.add(mesh);
        }
        updateCardMesh(mesh, placement);
      }
    },
    resize: (width, height) => {
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
};
