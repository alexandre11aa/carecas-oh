// src/client/scene/scene.ts
import {
  AmbientLight,
  CanvasTexture,
  Color,
  DirectionalLight,
  SRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  Scene,
  type Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { PlayerView } from "../../engine/playerView.js";
import { createBlackHole } from "./blackHole.js";
import { createCardMesh, createPileBodyMesh, updateCardMesh, updatePileBodyMesh } from "./cardMesh.js";
import { allSlots, layoutBoard, pickSlot, pileBodyYs, type CardPlacement, type Slot } from "./layout.js";
import { backgroundCover, pickSurface } from "./surfaces.js";
import { createTable } from "./table.js";
import { CAMERA_TARGET, cameraDistanceScale, cameraPosition } from "./framing.js";
import { BACKGROUND_GRADIENT, isValidGradient, zoneOuterSize } from "./tableDesign.js";
import { BACKGROUND_PATH, TABLE_MAX_TEXTURE_WIDTH, TABLE_PATH } from "./texturePaths.js";
import { loadTexture } from "./textures.js";
import { createBattleEffects } from "./battleEffects.js";
import type { BoardEffect } from "../animations/matchFeedback.js";

export type MatchScene = {
  playEffects: (effects: readonly BoardEffect[], done?: () => void) => void;
  clearEffects: () => void;
  setPlacements: (placements: readonly CardPlacement[]) => void;
  cardAt: (slot: Slot) => string | null;
  refreshHover: () => void;
  /** Reflete exatamente o estado recebido (cartas ausentes saem da mesa). */
  setView: (view: PlayerView) => void;
  /** Destaca slots (chaves de `slotKey`) sobre a mesa; lista vazia limpa o destaque. */
  setHighlights: (keys: readonly string[]) => void;
  /** Registra o tratador de cliques sobre a mesa: recebe o slot sob o ponteiro. */
  onPick: (handler: (slot: Slot) => void) => void;
  /** Registra o tratador de passagem do ponteiro: recebe o slot sob o ponteiro, ou null fora da mesa. */
  onHover: (handler: (slot: Slot | null) => void) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
};

/** Cena 3D: câmera em perspectiva, duas luzes, sem sombras. Lança erro se não houver WebGL. */
export const createMatchScene = (container: HTMLElement): MatchScene => {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  // Fundo padrão: degradê gerado em canvas (cor lisa se o canvas não estiver disponível). A textura PNG, se existir, o substitui.
  scene.background = new Color(0x14141f);
  let gradientTexture: CanvasTexture | null = null;
  if (isValidGradient(BACKGROUND_GRADIENT)) {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      for (const stop of BACKGROUND_GRADIENT) gradient.addColorStop(stop.offset, stop.color);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      gradientTexture = new CanvasTexture(canvas);
      gradientTexture.colorSpace = SRGBColorSpace;
      scene.background = gradientTexture;
    }
  }
  // Iluminação: ambiente suave e uma luz direcional levemente quente, sem sombras.
  scene.add(new AmbientLight(0xfff2dc, 1.1));
  const light = new DirectionalLight(0xfff6e6, 1.5);
  light.position.set(2, 10, 5);
  scene.add(light);
  // Vórtice decorativo atrás da mesa; se o canvas falhar, vale o fundo atual.
  const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const battleEffects = createBattleEffects(scene, reducedMotion);
  let blackHole: ReturnType<typeof createBlackHole> = null;
  try {
    blackHole = createBlackHole(reducedMotion);
  } catch {
    blackHole = null;
  }
  if (blackHole) scene.add(blackHole.group);
  const startedAt = performance.now();
  const table = createTable();
  scene.add(table.group);

  // Texturas opcionais: enquanto carregam (ou se faltarem) valem as cores acima; a troca ocorre ao terminar.
  // Fundo: `scene.background` com a textura em "cover" (sem esticar). O cache de `loadTexture` é o dono das
  // texturas, então o dispose da cena não as libera; `disposed` impede aplicá-las a uma cena já destruída.
  let disposed = false;
  let backgroundTexture: Texture | null = null;
  let viewAspect = 1;
  const fitBackground = () => {
    const image = backgroundTexture?.image as { width?: number; height?: number } | undefined;
    if (!backgroundTexture || !image?.width || !image?.height) return;
    const cover = backgroundCover(image.width / image.height, viewAspect);
    backgroundTexture.repeat.set(cover.repeatX, cover.repeatY);
    backgroundTexture.offset.set(cover.offsetX, cover.offsetY);
  };
  void loadTexture(BACKGROUND_PATH).then((texture) => {
    if (disposed || !texture || pickSurface(texture) === "color") return;
    backgroundTexture = texture;
    fitBackground();
    scene.background = texture;
  });
  void loadTexture(TABLE_PATH, { maxWidth: TABLE_MAX_TEXTURE_WIDTH, anisotropy: 8 }).then((texture) => {
    if (disposed || pickSurface(texture) === "color") return;
    table.setTexture(texture);
  });

  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  // Enquadramento: recua a câmera a partir do alvo quando o aspecto é estreito (função pura em framing.ts).
  const frameCamera = (aspect: number) => {
    const p = cameraPosition(cameraDistanceScale(aspect));
    camera.position.set(p.x, p.y, p.z);
    camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z);
    camera.updateMatrixWorld(); // o raycaster do clique usa a mesma câmera já atualizada
  };
  frameCamera(1);

  const meshes = new Map<string, Mesh>();
  // Corpo das pilhas (deck e cemitério): placas por chave de slot; geometria e material são compartilhados.
  const pileBodies = new Map<string, Mesh[]>();
  let shownPlacements: readonly CardPlacement[] = [];

  // Marcadores de destaque: um por slot, criados uma vez e só alternados entre visível/oculto.
  const markerGeometry = new PlaneGeometry(zoneOuterSize().width, zoneOuterSize().height).rotateX(-Math.PI / 2);
  const markerMaterial = new MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.45, depthWrite: false });
  const markers = new Map<string, Mesh>();
  for (const slot of allSlots()) {
    const marker = new Mesh(markerGeometry, markerMaterial);
    marker.position.set(slot.x, 0.05, slot.z);
    marker.visible = false;
    markers.set(slot.key, marker);
    scene.add(marker);
  }

  // Clique: raio da câmera até o plano da mesa, convertido em slot por `pickSlot` (lógica pura).
  const raycaster = new Raycaster();
  const tablePlane = new Plane(new Vector3(0, 1, 0), 0);
  let pickHandler: ((slot: Slot) => void) | null = null;
  let hoverHandler: ((slot: Slot | null) => void) | null = null;
  // `getBoundingClientRect` força layout: a medida fica em cache e só é invalidada por resize da cena, da
  // janela ou rolagem (issue #303). Evita leitura de layout a cada movimento do ponteiro e a cada render.
  let cachedRect: DOMRect | null = null;
  const invalidateRect = () => { cachedRect = null; };
  window.addEventListener("resize", invalidateRect);
  window.addEventListener("scroll", invalidateRect, { passive: true, capture: true });
  const slotAt = (event: { clientX: number; clientY: number }): Slot | null => {
    const rect = (cachedRect ??= renderer.domElement.getBoundingClientRect());
    const ndc = new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    // A carta em defesa ultrapassa a largura da zona. Intersecta a malha real antes
    // do plano das zonas; o hover independe do carregamento da textura.
    scene.updateMatrixWorld();
    const hit = raycaster.intersectObjects([...meshes.values(), ...[...pileBodies.values()].flat()], false)[0];
    if (hit) return allSlots().find((slot) => slot.key === hit.object.userData.slotKey) ?? null;
    const point = raycaster.ray.intersectPlane(tablePlane, new Vector3());
    return point ? pickSlot(point.x, point.z) : null;
  };
  const onPointerDown = (event: PointerEvent) => {
    const slot = slotAt(event);
    hoverHandler?.(slot); // toque (sem hover) também mostra o detalhe
    if (slot) pickHandler?.(slot);
  };
  let pointer: { clientX: number; clientY: number } | null = null;
  const onPointerMove = (event: PointerEvent) => {
    pointer = { clientX: event.clientX, clientY: event.clientY };
    hoverHandler?.(slotAt(event));
  };
  const onPointerLeave = () => { pointer = null; hoverHandler?.(null); };
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);
  let frame = 0;
  const loop = () => {
    blackHole?.update((performance.now() - startedAt) / 1000);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  loop();

  const setPlacements = (placements: readonly CardPlacement[]) => {
      shownPlacements = placements;
      const keep = new Set(placements.map((p) => p.key));
      for (const [key, mesh] of meshes) {
        if (!keep.has(key)) {
          scene.remove(mesh);
          meshes.delete(key);
        }
      }
      for (const [key, bodies] of pileBodies) {
        if (!keep.has(key)) {
          for (const body of bodies) scene.remove(body);
          pileBodies.delete(key);
        }
      }
      for (const placement of placements) {
        const ys = pileBodyYs(placement.layers ?? 0);
        if (ys.length > 0) {
          const bodies = pileBodies.get(placement.key) ?? [];
          pileBodies.set(placement.key, bodies);
          while (bodies.length > ys.length) scene.remove(bodies.pop() as Mesh);
          while (bodies.length < ys.length) {
            const body = createPileBodyMesh();
            bodies.push(body);
            scene.add(body);
          }
          bodies.forEach((body, i) => {
            updatePileBodyMesh(body, placement, ys[i] as number);
            body.userData.slotKey = placement.key;
          });
        } else {
          for (const body of pileBodies.get(placement.key) ?? []) scene.remove(body);
          pileBodies.delete(placement.key);
        }
        let mesh = meshes.get(placement.key);
        if (!mesh) {
          mesh = createCardMesh();
          meshes.set(placement.key, mesh);
          scene.add(mesh);
        }
        updateCardMesh(mesh, placement);
        mesh.userData.slotKey = placement.key;
      }
      if (pointer) hoverHandler?.(slotAt(pointer));
  };

  return {
    playEffects: battleEffects.play,
    clearEffects: battleEffects.clear,
    setPlacements,
    cardAt: (slot) => shownPlacements.find((placement) => placement.key === slot.key)?.cardId ?? null,
    refreshHover: () => { if (pointer) hoverHandler?.(slotAt(pointer)); },
    setView: (view) => setPlacements(layoutBoard(view)),
    setHighlights: (keys) => {
      const active = new Set(keys);
      for (const [key, marker] of markers) marker.visible = active.has(key);
    },
    onPick: (handler) => {
      pickHandler = handler;
    },
    onHover: (handler) => {
      hoverHandler = handler;
    },
    resize: (width, height) => {
      invalidateRect();
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height);
      viewAspect = width / height;
      fitBackground();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      frameCamera(width / height);
    },
    dispose: () => {
      disposed = true;
      for (const bodies of pileBodies.values()) for (const body of bodies) scene.remove(body);
      pileBodies.clear();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", invalidateRect);
      window.removeEventListener("scroll", invalidateRect, { capture: true });
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      markerGeometry.dispose();
      markerMaterial.dispose();
      battleEffects.dispose();
      table.dispose();
      if (blackHole) {
        scene.remove(blackHole.group);
        blackHole.dispose();
      }
      gradientTexture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
};
