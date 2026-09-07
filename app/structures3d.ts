import * as THREE from 'three';
import {
  structurePlan,
  type StructureSite,
  type StructurePart,
} from './structures.ts';

export function createStructureModel(
  site: StructureSite,
  materials: Record<StructurePart['material'], THREE.Material>,
  geometry: {
    box: THREE.BufferGeometry;
    cylinder: THREE.BufferGeometry;
    cone: THREE.BufferGeometry;
  },
  ghost = false,
) {
  const root = new THREE.Group();
  const ghostMaterial = ghost
    ? new THREE.MeshStandardMaterial({
        color: 0x69dcb2,
        emissive: 0x164c40,
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.32,
        roughness: 0.8,
        depthWrite: false,
      })
    : null;
  for (const part of structurePlan(site.kind).parts) {
    const mesh = new THREE.Mesh(
      geometry[part.shape],
      ghostMaterial || materials[part.material],
    );
    const radiusScale = part.shape === 'box' ? 1 : 0.5;
    mesh.scale.set(
      part.size[0] * radiusScale,
      part.size[1],
      part.size[2] * radiusScale,
    );
    mesh.position.set(...part.at);
    mesh.rotation.z = part.tilt || 0;
    mesh.castShadow = mesh.receiveShadow = !ghost;
    root.add(mesh);
  }
  root.userData.kind = site.kind;
  root.userData.ghostMaterial = ghostMaterial;
  return root;
}
