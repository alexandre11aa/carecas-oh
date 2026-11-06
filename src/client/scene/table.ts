// src/client/scene/table.ts
import { Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, Shape, ShapeGeometry, type Texture } from "three";
import { allSlots } from "./layout.js";
import { pickSurface, zoneOpacity } from "./surfaces.js";
import {
  FRAME_COLOR,
  FRAME_TRIM_COLOR,
  TABLE_COLOR,
  TABLE_DEPTH,
  TABLE_WIDTH,
  ZONE_STYLES,
  frameSize,
  trimSize,
  zoneInnerSize,
  zoneOuterSize,
  type ZoneGroup,
} from "./tableDesign.js";

// Geometrias compartilhadas por todas as zonas (todas têm o mesmo tamanho, na proporção da carta).
const plane = (width: number, height: number) => new PlaneGeometry(width, height).rotateX(-Math.PI / 2);
const tableGeometry = plane(TABLE_WIDTH, TABLE_DEPTH);
const frameGeometry = plane(frameSize().width, frameSize().height);
const trimGeometry = plane(trimSize().width, trimSize().height);
const zoneFillGeometry = plane(zoneInnerSize().width, zoneInnerSize().height);

/** Contorno da zona: retângulo externo com furo do tamanho do interior. */
const createOutlineGeometry = (): ShapeGeometry => {
  const outer = zoneOuterSize();
  const inner = zoneInnerSize();
  const shape = new Shape();
  shape.moveTo(-outer.width / 2, -outer.height / 2);
  shape.lineTo(outer.width / 2, -outer.height / 2);
  shape.lineTo(outer.width / 2, outer.height / 2);
  shape.lineTo(-outer.width / 2, outer.height / 2);
  shape.closePath();
  const hole = new Shape();
  hole.moveTo(-inner.width / 2, -inner.height / 2);
  hole.lineTo(-inner.width / 2, inner.height / 2);
  hole.lineTo(inner.width / 2, inner.height / 2);
  hole.lineTo(inner.width / 2, -inner.height / 2);
  hole.closePath();
  shape.holes.push(hole);
  return new ShapeGeometry(shape).rotateX(-Math.PI / 2);
};
const zoneOutlineGeometry = createOutlineGeometry();

const groups = Object.keys(ZONE_STYLES) as ZoneGroup[];

export type Table = {
  group: Group;
  /** Aplica a textura à mesa (e deixa as zonas semi-transparentes); `null` mantém a cor atual. */
  setTexture: (texture: Texture | null) => void;
  /** Libera os materiais da mesa (a geometria é compartilhada e a textura pertence ao cache). */
  dispose: () => void;
};

/** Mesa com moldura e as zonas (monstro, magia/armadilha, deck e cemitério) dos dois jogadores. */
export const createTable = (): Table => {
  const tableMaterial = new MeshLambertMaterial({ color: TABLE_COLOR });
  const frameMaterial = new MeshLambertMaterial({ color: FRAME_COLOR });
  const trimMaterial = new MeshBasicMaterial({ color: FRAME_TRIM_COLOR });
  const fillMaterials = {} as Record<ZoneGroup, MeshLambertMaterial>;
  const outlineMaterials = {} as Record<ZoneGroup, MeshBasicMaterial>;
  for (const g of groups) {
    fillMaterials[g] = new MeshLambertMaterial({ color: ZONE_STYLES[g].fill });
    outlineMaterials[g] = new MeshBasicMaterial({ color: ZONE_STYLES[g].outline });
  }
  const group = new Group();
  const add = (geometry: PlaneGeometry | ShapeGeometry, material: MeshLambertMaterial | MeshBasicMaterial, x: number, y: number, z: number) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  add(frameGeometry, frameMaterial, 0, -0.02, 0);
  add(trimGeometry, trimMaterial, 0, -0.01, 0);
  add(tableGeometry, tableMaterial, 0, 0, 0);
  for (const slot of allSlots()) {
    add(zoneFillGeometry, fillMaterials[slot.kind], slot.x, 0.005, slot.z);
    add(zoneOutlineGeometry, outlineMaterials[slot.kind], slot.x, 0.006, slot.z);
  }
  return {
    group,
    setTexture: (texture) => {
      const surface = pickSurface(texture);
      tableMaterial.map = surface === "texture" ? texture : null;
      tableMaterial.color.set(surface === "texture" ? 0xffffff : TABLE_COLOR); // sem tingir a imagem
      tableMaterial.needsUpdate = true;
      const opacity = zoneOpacity(surface);
      for (const material of Object.values(fillMaterials)) {
        material.transparent = opacity < 1;
        material.opacity = opacity;
        material.needsUpdate = true;
      }
    },
    dispose: () => {
      for (const material of [tableMaterial, frameMaterial, trimMaterial, ...Object.values(fillMaterials), ...Object.values(outlineMaterials)]) {
        material.dispose();
      }
    },
  };
};
