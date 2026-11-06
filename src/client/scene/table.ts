// src/client/scene/table.ts
import { Group, Mesh, MeshLambertMaterial, PlaneGeometry } from "three";
import { allSlots, CARD_HEIGHT, CARD_WIDTH } from "./layout.js";

const tableGeometry = new PlaneGeometry(16, 11).rotateX(-Math.PI / 2);
const zoneGeometry = new PlaneGeometry(CARD_WIDTH + 0.2, CARD_HEIGHT + 0.2).rotateX(-Math.PI / 2);

const tableMaterial = new MeshLambertMaterial({ color: 0x1e3a2c });
const zoneMaterials = {
  monster: new MeshLambertMaterial({ color: 0x2f5c46 }),
  spellTrap: new MeshLambertMaterial({ color: 0x2a4a5e }),
  pile: new MeshLambertMaterial({ color: 0x4a3a5e }),
};

/** Mesa com as zonas de monstro, de magia/armadilha, deck e cemitério dos dois jogadores. */
export const createTable = (): Group => {
  const group = new Group();
  group.add(new Mesh(tableGeometry, tableMaterial));
  for (const slot of allSlots()) {
    const material =
      slot.kind === "monster" ? zoneMaterials.monster : slot.kind === "spellTrap" ? zoneMaterials.spellTrap : zoneMaterials.pile;
    const zone = new Mesh(zoneGeometry, material);
    zone.position.set(slot.x, 0.005, slot.z);
    group.add(zone);
  }
  return group;
};
