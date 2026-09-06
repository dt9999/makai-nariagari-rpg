import * as THREE from 'three';
import {
  DISCOVERY_SITES,
  SCALE,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  terrainHeight,
  worldX,
  worldZ,
  regionAt,
  type DiscoverySite,
  CAMP_ROOMS,
  wallsFor,
} from './world';

const random = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Bounded nearby scenery: instances share geometries/materials and unload outside the active ring. */
export function createLandscape(scene: THREE.Scene) {
  const geometry = {
    box: new THREE.BoxGeometry(1, 1, 1),
    rock: new THREE.DodecahedronGeometry(1, 1),
    trunk: new THREE.CylinderGeometry(0.65, 1, 1, 7),
    cone: new THREE.ConeGeometry(1, 1, 7),
    crystal: new THREE.OctahedronGeometry(1),
    ring: new THREE.TorusGeometry(1, 0.12, 6, 24),
  };
  const material = {
    stone: new THREE.MeshStandardMaterial({ color: 0x615967, roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x40352c, roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x29453b, roughness: 0.88 }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x766d66,
      roughness: 0.3,
      metalness: 0.82,
    }),
    cloth: new THREE.MeshStandardMaterial({
      color: 0x713d4e,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
    magic: new THREE.MeshStandardMaterial({
      color: 0x996ed5,
      emissive: 0x5a2b99,
      emissiveIntensity: 1.3,
      roughness: 0.25,
    }),
    gold: new THREE.MeshStandardMaterial({
      color: 0xc39647,
      roughness: 0.35,
      metalness: 0.7,
    }),
    fire: new THREE.MeshStandardMaterial({
      color: 0xd9853b,
      emissive: 0xff5a17,
      emissiveIntensity: 2,
    }),
  };
  const chunks = new Map<string, THREE.Group>(),
    sites = new Map<string, THREE.Group>(),
    dummy = new THREE.Object3D();
  const put = (
    root: THREE.Object3D,
    shape: keyof typeof geometry,
    mat: keyof typeof material,
    size: [number, number, number],
    at: [number, number, number],
  ) => {
    const mesh = new THREE.Mesh(geometry[shape], material[mat]);
    mesh.scale.set(...size);
    mesh.position.set(...at);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const room = (root: THREE.Group, x: number, z: number) => {
    put(root, 'box', 'wood', [4.5, 0.22, 4.6], [x, 2.9, z]);
    const roof = put(root, 'cone', 'cloth', [3.25, 1.7, 3.25], [x, 3.6, z]);
    roof.rotation.y = Math.PI / 4;
    put(root, 'box', 'wood', [1.4, 0.12, 0.6], [x, 1, z + 0.8]);
  };
  const buildSite = (s: DiscoverySite) => {
    const root = new THREE.Group();
    root.position.set(worldX(s.x), terrainHeight(s.x, s.y), worldZ(s.y));
    if (s.kind === 'camp') {
      for (const wall of wallsFor(s))
        put(
          root,
          'box',
          wall.width > wall.depth ? 'wood' : 'stone',
          [wall.width * SCALE, wall.height, wall.depth * SCALE],
          [(wall.x - s.x) * SCALE, wall.height / 2, (wall.y - s.y) * SCALE],
        );
      for (const [x, z] of CAMP_ROOMS) room(root, x, z);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        put(
          root,
          'rock',
          'stone',
          [0.25, 0.2, 0.25],
          [Math.cos(a), 0.15, Math.sin(a) - 3],
        );
      }
      put(root, 'cone', 'fire', [0.4, 0.8, 0.4], [0, 0.5, -3]);
      put(root, 'trunk', 'metal', [0.08, 4, 0.08], [0, 2, 2]);
      put(root, 'box', 'cloth', [1.3, 0.85, 0.05], [0.65, 3.35, 2]);
    } else if (s.kind === 'cave') {
      for (let z = 0; z <= 14; z += 2) {
        for (let i = 0; i <= 8; i++) {
          const a = (i * Math.PI) / 8;
          put(
            root,
            'rock',
            'stone',
            [0.95, 1.1, 1.5],
            [Math.cos(a) * 3, Math.sin(a) * 3.8 + 0.3, z],
          );
        }
        if (z % 4 === 0)
          put(root, 'crystal', 'magic', [0.3, 0.85, 0.3], [2.1, 0.85, z]);
      }
      put(root, 'box', 'stone', [6, 0.12, 16], [0, 0.02, 7]);
    } else if (s.kind === 'quarry') {
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4,
          rad = 1 + random(i) * 5;
        put(
          root,
          'rock',
          'stone',
          [0.8, 0.7, 0.7],
          [Math.cos(a) * rad, 0.45, Math.sin(a) * rad],
        );
        put(
          root,
          'crystal',
          'magic',
          [0.25 + random(i + 2) * 0.3, 1 + random(i + 4), 0.3],
          [Math.cos(a) * rad, 0.8, Math.sin(a) * rad],
        );
      }
      put(root, 'box', 'wood', [2, 0.2, 1.2], [4, 0.5, 3]);
    } else if (s.kind === 'nest') {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        put(
          root,
          'rock',
          'wood',
          [0.7, 0.45, 0.5],
          [Math.cos(a) * 4, 0.3, Math.sin(a) * 4],
        );
      }
      for (let i = 0; i < 5; i++)
        put(
          root,
          'rock',
          'magic',
          [0.4, 0.7, 0.4],
          [(i % 3) - 1, 0.7, Math.floor(i / 3)],
        );
    } else if (s.kind === 'outpost') {
      for (const x of [-4, 4]) {
        put(root, 'trunk', 'wood', [0.18, 4, 0.18], [x, 2, 0]);
        put(root, 'box', 'cloth', [1.1, 1.3, 0.05], [x + 0.55, 3.2, 0]);
        put(root, 'box', 'wood', [1.2, 0.8, 0.9], [x, 0.4, 2]);
      }
      put(root, 'box', 'stone', [9, 0.1, 8], [0, 0.05, 1]);
    } else if (s.kind === 'ruin') {
      for (let i = 0; i < 6; i++) {
        const x = (i % 2 ? 1 : -1) * 3,
          z = Math.floor(i / 2) * 3;
        put(
          root,
          'trunk',
          'stone',
          [0.5, 3.4 + (i % 3), 0.5],
          [x, 1.7 + (i % 3) / 2, z],
        );
        put(root, 'box', 'stone', [1.3, 0.3, 1.3], [x, 3.5 + (i % 3), z]);
      }
      put(root, 'box', 'stone', [7, 0.6, 1], [0, 4.2, 0]);
      put(root, 'box', 'stone', [7, 0.12, 8], [0, 0.06, 3]);
    } else if (s.kind === 'shrine') {
      put(root, 'trunk', 'stone', [2.5, 0.3, 2.5], [0, 0.15, 0]);
      put(root, 'crystal', 'magic', [0.7, 1.8, 0.7], [0, 2.2, 0]);
      const ring = put(root, 'ring', 'gold', [2, 2, 2], [0, 2.2, 0]);
      ring.rotation.x = 0.5;
      root.userData.ring = ring;
      for (const x of [-3, 3])
        put(root, 'trunk', 'stone', [0.4, 4, 0.4], [x, 2, 0]);
    } else {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI;
        put(
          root,
          'rock',
          s.region === 'forest' ? 'wood' : 'stone',
          [1.3, 3, 1.2],
          [Math.cos(a) * 5, Math.sin(a) * 5 + 1, 0],
        );
      }
      for (let i = 0; i < 10; i++)
        put(
          root,
          'crystal',
          'magic',
          [0.12, 0.3, 0.12],
          [(random(i) - 0.5) * 8, 0.3, (random(i + 60) - 0.5) * 8],
        );
    }
    root.userData.site = s.id;
    return root;
  };
  const buildChunk = (cx: number, cy: number) => {
    const root = new THREE.Group(),
      x0 = cx * 800,
      y0 = cy * 800;
    const r = regionAt(x0 + 400, y0 + 400),
      forest = r.biome === '森',
      cave = r.biome === '洞窟';
    const count = forest ? 42 : 18;
    const rocks = new THREE.InstancedMesh(geometry.rock, material.stone, count);
    const stems = new THREE.InstancedMesh(
      geometry.trunk,
      material.wood,
      forest ? count : 6,
    );
    const crowns = new THREE.InstancedMesh(
      cave ? geometry.rock : geometry.cone,
      cave ? material.magic : material.leaf,
      forest ? count : 6,
    );
    for (let i = 0; i < count; i++) {
      const seed = cx * 937 + cy * 571 + i * 23,
        x = x0 + random(seed) * 800,
        y = y0 + random(seed + 9) * 800,
        h = terrainHeight(x, y);
      const inSite = DISCOVERY_SITES.some(
        (s) => Math.abs(s.x - x) < 260 && Math.abs(s.y - y) < 260,
      );
      const s = inSite ? 0.001 : 0.35 + random(seed + 7) * 1.4;
      dummy.position.set(worldX(x), h + s * 0.35, worldZ(y));
      dummy.scale.set(s, s * 0.65, s * 0.8);
      dummy.rotation.set(0.1, random(seed + 4) * 6, 0.15);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
      if (i < stems.count) {
        const tall = forest ? 5 + random(seed + 19) * 7 : cave ? 2 : 3;
        dummy.position.set(worldX(x + 20), h + tall / 2, worldZ(y));
        dummy.rotation.set(0, random(seed + 5) * 6, 0.03);
        dummy.scale.set(inSite ? 0.001 : 0.25, tall, inSite ? 0.001 : 0.25);
        dummy.updateMatrix();
        stems.setMatrixAt(i, dummy.matrix);
        dummy.position.y = h + tall;
        dummy.scale.set(
          inSite ? 0.001 : tall * 0.3,
          tall * 0.65,
          inSite ? 0.001 : tall * 0.3,
        );
        dummy.updateMatrix();
        crowns.setMatrixAt(i, dummy.matrix);
      }
    }
    for (const inst of [rocks, stems, crowns]) {
      inst.receiveShadow = true;
      inst.castShadow = forest;
      inst.computeBoundingSphere();
      root.add(inst);
    }
    return root;
  };
  let lastCell = '';
  return {
    update(x: number, y: number, time: number, distance = 2200) {
      const cell = `${Math.floor(x / 400)},${Math.floor(y / 400)},${distance}`;
      if (cell !== lastCell) {
        lastCell = cell;
        const keep = new Set<string>();
        const radius = Math.ceil(distance / 800);
        for (
          let cy = Math.floor(y / 800) - radius;
          cy <= Math.floor(y / 800) + radius;
          cy++
        )
          for (
            let cx = Math.floor(x / 800) - radius;
            cx <= Math.floor(x / 800) + radius;
            cx++
          ) {
            if (
              cx < 0 ||
              cy < 0 ||
              cx * 800 >= WORLD_WIDTH ||
              cy * 800 >= WORLD_HEIGHT ||
              Math.hypot(cx * 800 + 400 - x, cy * 800 + 400 - y) >
                distance + 600
            )
              continue;
            const key = `${cx},${cy}`;
            keep.add(key);
            if (!chunks.has(key)) {
              const chunk = buildChunk(cx, cy);
              chunks.set(key, chunk);
              scene.add(chunk);
            }
          }
        for (const [key, root] of chunks)
          if (!keep.has(key)) {
            scene.remove(root);
            root.traverse((o) => {
              if (o instanceof THREE.InstancedMesh) o.dispose();
            });
            chunks.delete(key);
          }
        for (const site of DISCOVERY_SITES) {
          const nearby = Math.hypot(site.x - x, site.y - y) < distance + 500;
          if (nearby && !sites.has(site.id)) {
            const obj = buildSite(site);
            sites.set(site.id, obj);
            scene.add(obj);
          }
          if (!nearby && sites.has(site.id)) {
            scene.remove(sites.get(site.id)!);
            sites.delete(site.id);
          }
        }
      }
      for (const root of sites.values())
        if (root.userData.ring) root.userData.ring.rotation.y = time * 0.3;
    },
    dispose() {
      for (const root of chunks.values()) {
        scene.remove(root);
        root.traverse((o) => {
          if (o instanceof THREE.InstancedMesh) o.dispose();
        });
      }
      for (const root of sites.values()) scene.remove(root);
      Object.values(geometry).forEach((g) => g.dispose());
      Object.values(material).forEach((m) => m.dispose());
      chunks.clear();
      sites.clear();
    },
  };
}
