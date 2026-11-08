// src/client/scene/battleEffects.ts
// Efeitos transitórios sobre a mesa. Não movem as malhas que representam o estado.
import gsap from "gsap";
import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry, Vector3, type Scene } from "three";
import type { BoardEffect } from "../animations/matchFeedback.js";
import { createCardMesh, updateCardMesh } from "./cardMesh.js";

export const createBattleEffects = (scene: Scene, reducedMotion: boolean) => {
  const ringGeometry = new RingGeometry(0.7, 1, 40).rotateX(-Math.PI / 2);
  const sphereGeometry = new SphereGeometry(1, 16, 10);
  const active = new Set<{ timeline: gsap.core.Timeline; clean: () => void }>();

  const play = (effects: readonly BoardEffect[], done: () => void = () => {}) => {
    if (effects.length === 0) { done(); return; }
    let remaining = effects.length;
    for (const effect of effects) {
      const group = new Group();
      const ownedMaterials: MeshBasicMaterial[] = [];
      const material = (color: number, opacity = 0.8) => {
        const result = new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: DoubleSide, blending: AdditiveBlending });
        ownedMaterials.push(result);
        return result;
      };
      let record: { timeline: gsap.core.Timeline; clean: () => void };
      const clean = () => {
        scene.remove(group);
        ownedMaterials.forEach((value) => value.dispose());
        active.delete(record);
      };
      const timeline = gsap.timeline({ onComplete: () => { clean(); remaining--; if (remaining === 0) done(); } });
      record = { timeline, clean };
      active.add(record);
      scene.add(group);
      const duration = reducedMotion ? 0.18 : 0.45;
      if (effect.kind === "graveyard" && !reducedMotion) {
        const card = createCardMesh();
        updateCardMesh(card, { key: "effect", cardId: effect.cardId, faceDown: false, yaw: effect.yaw ?? 0, ...effect.from });
        group.add(card);
        timeline.to(card.position, { y: 0.9, duration: 0.15, ease: "power2.out" }, 0);
        timeline.to(card.position, { x: effect.to.x, z: effect.to.z, duration: 0.45, ease: "power2.inOut" }, 0);
        timeline.to(card.rotation, { y: (effect.yaw ?? 0) + Math.PI, duration: 0.45 }, 0);
        timeline.to(card.position, { y: 0.05, duration: 0.3 }, 0.15);
        timeline.to(card.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 0.2 }, 0.25);
        const glow = new Mesh(ringGeometry, material(0xb87bff));
        glow.position.set(effect.to.x, 0.06, effect.to.z);
        group.add(glow);
        timeline.to(glow.scale, { x: 1.7, y: 1.7, z: 1.7, duration: 0.45 }, 0);
        timeline.to(glow.material, { opacity: 0, duration: 0.25 }, 0.2);
      } else if (effect.kind === "attack" && !reducedMotion) {
        const start = new Vector3(effect.from.x, 0.3, effect.from.z);
        const end = new Vector3(effect.to.x, 0.3, effect.to.z);
        const bolt = new Mesh(sphereGeometry, material(0xffce68));
        bolt.scale.set(0.14, 0.14, 0.6);
        bolt.position.copy(start);
        bolt.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), end.clone().sub(start).normalize());
        group.add(bolt);
        for (let i = 1; i <= 4; i++) {
          const trail = new Mesh(sphereGeometry, material(0xff943d, 0.6 / i));
          trail.scale.copy(bolt.scale).multiplyScalar(1 - i * 0.12);
          trail.position.copy(start);
          trail.quaternion.copy(bolt.quaternion);
          group.add(trail);
          timeline.to(trail.position, { x: end.x, z: end.z, duration: 0.3, ease: "power2.in" }, i * 0.025);
          timeline.to(trail.material, { opacity: 0, duration: 0.1 }, 0.3 + i * 0.025);
        }
        timeline.to(bolt.position, { x: end.x, z: end.z, duration: 0.3, ease: "power2.in" }, 0);
        timeline.to(bolt.material, { opacity: 0, duration: 0.1 }, 0.3);
      } else {
        const at = "at" in effect ? effect.at : effect.kind === "attack" || effect.kind === "graveyard" ? effect.to : { x: 0, z: effect.side === "you" ? 4.8 : -4.8 };
        const color = effect.kind === "defend" ? 0x60cfff : effect.kind === "heal" ? 0x68ffb4 : effect.kind === "graveyard" ? 0xb87bff : 0xff7250;
        const ring = new Mesh(ringGeometry, material(color));
        ring.position.set(at.x, 0.1, at.z);
        group.add(ring);
        if (effect.kind === "defend") {
          const shield = new Mesh(sphereGeometry, material(color, 0.28));
          shield.position.set(at.x, 0.35, at.z);
          shield.scale.set(1, 0.65, 0.9);
          group.add(shield);
          timeline.to(shield.material, { opacity: 0, duration }, 0);
        }
        if (!reducedMotion) timeline.fromTo(ring.scale, { x: 0.4, y: 0.4, z: 0.4 }, { x: 1.8, y: 1.8, z: 1.8, duration }, 0);
        timeline.to(ring.material, { opacity: 0, duration }, 0);
      }
    }
  };
  const clear = () => {
    for (const record of [...active]) { record.timeline.kill(); record.clean(); }
  };
  return { play, clear, dispose: () => { clear(); ringGeometry.dispose(); sphereGeometry.dispose(); } };
};
