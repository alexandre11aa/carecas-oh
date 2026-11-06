// src/client/scene/table.ts
import { Group, Mesh, MeshLambertMaterial, PlaneGeometry, type Texture } from "three";
import { allSlots, CARD_HEIGHT, CARD_WIDTH } from "./layout.js";
import { pickSurface, zoneOpacity } from "./surfaces.js";

const tableGeometry = new PlaneGeometry(16, 11).rotateX(-Math.PI / 2);
const zoneGeometry = new PlaneGeometry(CARD_WIDTH + 0.2, CARD_HEIGHT + 0.2).rotateX(-Math.PI / 2);

const TABLE_COLOR = 0x1e3a2c;

export type Table = {
  group: Group;
  /** Aplica a textura à mesa (e deixa as zonas semi-transparentes); `null` mantém a cor atual. */
  setTexture: (texture: Texture | null) => void;
  /** Libera os materiais da mesa (a geometria é compartilhada e a textura pertence ao cache). */
  dispose: () => void;
};

/** Mesa com as zonas de monstro, de magia/armadilha, deck e cemitério dos dois jogadores. */
export const createTable = (): Table => {
  const tableMaterial = new MeshLambertMaterial({ color: TABLE_COLOR });
  const zoneMaterials = {
    monster: new MeshLambertMaterial({ color: 0x2f5c46 }),
    spellTrap: new MeshLambertMaterial({ color: 0x2a4a5e }),
    pile: new MeshLambertMaterial({ color: 0x4a3a5e }),
  };
  const group = new Group();
  group.add(new Mesh(tableGeometry, tableMaterial));
  for (const slot of allSlots()) {
    const material =
      slot.kind === "monster" ? zoneMaterials.monster : slot.kind === "spellTrap" ? zoneMaterials.spellTrap : zoneMaterials.pile;
    const zone = new Mesh(zoneGeometry, material);
    zone.position.set(slot.x, 0.005, slot.z);
    group.add(zone);
  }
  return {
    group,
    setTexture: (texture) => {
      const surface = pickSurface(texture);
      tableMaterial.map = surface === "texture" ? texture : null;
      tableMaterial.color.set(surface === "texture" ? 0xffffff : TABLE_COLOR); // sem tingir a imagem
      tableMaterial.needsUpdate = true;
      const opacity = zoneOpacity(surface);
      for (const material of Object.values(zoneMaterials)) {
        material.transparent = opacity < 1;
        material.opacity = opacity;
        material.needsUpdate = true;
      }
    },
    dispose: () => {
      tableMaterial.dispose();
      for (const material of Object.values(zoneMaterials)) material.dispose();
    },
  };
};
