import * as THREE from "three";

export type RealmTextures = Record<"soil" | "stone" | "wood", THREE.Texture>;
let shared: RealmTextures | null = null;
let owners = 0;

/** One decoded image/GPU texture per material, shared by terrain and all scenery. */
export function acquireRealmTextures(anisotropy: number) {
  if (!shared) {
    const loader = new THREE.TextureLoader();
    const load = (path: string) => {
      const texture = loader.load(path);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = Math.min(4, anisotropy);
      return texture;
    };
    shared = {
      soil: load("/textures/realm-soil-v1.png"),
      stone: load("/textures/realm-basalt-v1.png"),
      wood: load("/textures/realm-oak-v1.png"),
    };
  }
  owners++;
  let released = false;
  return {
    textures: shared,
    release() {
      if (released) return;
      released = true;
      if (--owners === 0 && shared) {
        Object.values(shared).forEach((texture) => texture.dispose());
        shared = null;
      }
    },
  };
}

/** Albedo micro-detail also provides a subtle height approximation, not a baked normal map. */
export function textureSurface(
  material: THREE.MeshStandardMaterial,
  texture: THREE.Texture,
  bumpScale = 0.025,
) {
  material.map = texture;
  material.bumpMap = texture;
  material.bumpScale = bumpScale;
  material.needsUpdate = true;
}
