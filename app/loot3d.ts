import * as THREE from 'three';
import { itemOf, RARITY_COLORS, type WorldLoot } from './items';
import { worldX, worldZ, terrainHeight } from './world';

/** Shared geometry/materials; create only nearby loot and release scene references on exit. */
export function createLootRenderer(scene: THREE.Scene) {
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 12, 8),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    crystal: new THREE.OctahedronGeometry(1, 0),
    ring: new THREE.TorusGeometry(1, 0.025, 5, 28),
  };
  const materials = {
    wood: new THREE.MeshStandardMaterial({ color: 0x56392d, roughness: 0.92 }),
    iron: new THREE.MeshStandardMaterial({
      color: 0x78838a,
      metalness: 0.85,
      roughness: 0.3,
    }),
    gold: new THREE.MeshStandardMaterial({
      color: 0xcfa45e,
      metalness: 0.75,
      roughness: 0.28,
    }),
    leather: new THREE.MeshStandardMaterial({
      color: 0x513b33,
      roughness: 0.86,
    }),
    red: new THREE.MeshStandardMaterial({
      color: 0x9c243d,
      roughness: 0.3,
      metalness: 0.1,
      emissive: 0x751326,
      emissiveIntensity: 0.3,
    }),
    blue: new THREE.MeshStandardMaterial({
      color: 0x3e83b1,
      roughness: 0.3,
      emissive: 0x276b9b,
      emissiveIntensity: 0.3,
    }),
    crystal: new THREE.MeshStandardMaterial({
      color: 0xaeb6ff,
      metalness: 0.3,
      roughness: 0.15,
      emissive: 0x6467b1,
      emissiveIntensity: 0.55,
    }),
  };
  const glows = new Map(
    Object.entries(RARITY_COLORS).map(([rarity, color]) => [
      rarity,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    ]),
  );
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(24 * 3);
  for (let i = 0; i < 24; i++) {
    const a = i * 2.39996;
    positions[i * 3] = Math.cos(a) * (0.3 + (i % 4) * 0.05);
    positions[i * 3 + 1] = (i % 8) * 0.14;
    positions[i * 3 + 2] = Math.sin(a) * (0.3 + (i % 4) * 0.05);
  }
  particleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3),
  );
  const particleMaterials = new Map(
    Object.entries(RARITY_COLORS).map(([rarity, color]) => [
      rarity,
      new THREE.PointsMaterial({
        color,
        size: 0.025,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    ]),
  );
  type Visual = {
    root: THREE.Group;
    body: THREE.Group;
    lid: THREE.Group | null;
    ring: THREE.Mesh;
    particles: THREE.Points;
  };
  const visuals = new Map<number, Visual>();
  const mesh = (
    parent: THREE.Group,
    geo: keyof typeof geometries,
    mat: keyof typeof materials,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) => {
    const m = new THREE.Mesh(geometries[geo], materials[mat]);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const build = (loot: WorldLoot): Visual => {
    const item = itemOf(loot.item),
      root = new THREE.Group(),
      body = new THREE.Group();
    root.add(body);
    let lid: THREE.Group | null = null;
    if (loot.chest) {
      mesh(body, 'box', 'wood', 0, 0.22, 0, 0.8, 0.4, 0.5);
      for (const x of [-0.3, 0.3])
        mesh(body, 'box', 'iron', x, 0.23, 0, 0.055, 0.43, 0.53);
      mesh(body, 'box', 'gold', 0, 0.36, 0.27, 0.1, 0.15, 0.04);
      for (const x of [-0.36, 0.36])
        for (const z of [-0.22, 0.22])
          mesh(body, 'sphere', 'gold', x, 0.34, z, 0.025, 0.025, 0.025);
      lid = new THREE.Group();
      lid.position.set(0, 0.43, -0.25);
      body.add(lid);
      mesh(lid, 'box', 'wood', 0, 0.045, 0.25, 0.83, 0.09, 0.53);
      for (const x of [-0.3, 0.3])
        mesh(lid, 'box', 'iron', x, 0.095, 0.25, 0.055, 0.02, 0.54);
    } else if (item.kind === 'weapon') {
      if (loot.item.startsWith('staff') || loot.item.startsWith('sigil')) {
        mesh(body, 'cylinder', 'wood', 0, 0.48, 0, 0.03, 0.85, 0.03);
        mesh(body, 'crystal', 'crystal', 0, 0.97, 0, 0.14, 0.2, 0.14);
        mesh(body, 'cylinder', 'gold', 0, 0.82, 0, 0.06, 0.08, 0.06);
      } else if (loot.item.startsWith('axe')) {
        mesh(body, 'cylinder', 'wood', 0, 0.48, 0, 0.04, 0.9, 0.04);
        mesh(body, 'sphere', 'iron', 0.12, 0.82, 0, 0.28, 0.19, 0.035);
        mesh(body, 'box', 'gold', 0, 0.8, 0, 0.065, 0.3, 0.08);
      } else {
        mesh(body, 'cylinder', 'leather', 0, 0.2, 0, 0.035, 0.25, 0.035);
        mesh(body, 'box', 'gold', 0, 0.33, 0, 0.3, 0.045, 0.06);
        mesh(body, 'box', 'iron', 0, 0.64, 0, 0.07, 0.56, 0.027);
        mesh(body, 'crystal', 'iron', 0, 0.95, 0, 0.05, 0.09, 0.025);
      }
      body.rotation.z = -0.3;
    } else if (item.kind === 'armor') {
      mesh(body, 'sphere', 'iron', 0, 0.45, 0, 0.27, 0.32, 0.12);
      for (const x of [-0.29, 0.29])
        mesh(body, 'sphere', 'iron', x, 0.63, 0, 0.12, 0.1, 0.15);
      mesh(body, 'box', 'leather', 0, 0.24, 0.035, 0.4, 0.07, 0.24);
      mesh(body, 'box', 'gold', 0, 0.25, 0.165, 0.1, 0.08, 0.035);
    } else if (item.kind === 'consumable') {
      mesh(
        body,
        'sphere',
        loot.item === 'potion' ? 'red' : 'blue',
        0,
        0.25,
        0,
        0.17,
        0.22,
        0.17,
      );
      mesh(body, 'cylinder', 'gold', 0, 0.46, 0, 0.067, 0.06, 0.067);
      mesh(body, 'cylinder', 'wood', 0, 0.51, 0, 0.052, 0.055, 0.052);
      mesh(body, 'box', 'leather', 0, 0.25, 0.16, 0.14, 0.11, 0.015);
    } else if (item.kind === 'relic') {
      mesh(body, 'cylinder', 'gold', 0, 0.4, 0, 0.21, 0.07, 0.21);
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        mesh(
          body,
          'crystal',
          'gold',
          Math.cos(a) * 0.18,
          0.54,
          Math.sin(a) * 0.18,
          0.05,
          0.16,
          0.05,
        );
      }
      mesh(body, 'crystal', 'crystal', 0, 0.6, 0, 0.07, 0.1, 0.07);
    } else if (item.kind === 'gem' || loot.item === 'crystal') {
      mesh(body, 'crystal', 'crystal', 0, 0.4, 0, 0.18, 0.33, 0.18);
      mesh(body, 'cylinder', 'gold', 0, 0.18, 0, 0.2, 0.05, 0.2);
    } else {
      mesh(body, 'sphere', 'leather', 0, 0.25, 0, 0.23, 0.27, 0.18);
      mesh(body, 'cylinder', 'gold', 0, 0.45, 0, 0.06, 0.08, 0.06);
    }
    const ring = new THREE.Mesh(geometries.ring, glows.get(item.rarity));
    ring.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(loot.chest ? 0.6 : 0.4);
    ring.position.y = 0.035;
    root.add(ring);
    const particles = new THREE.Points(
      particleGeometry,
      particleMaterials.get(item.rarity),
    );
    root.add(particles);
    scene.add(root);
    return { root, body, lid, ring, particles };
  };
  return {
    update(
      lootList: WorldLoot[],
      x: number,
      y: number,
      time: number,
      distance = 1200,
    ) {
      const wanted = new Set<number>();
      for (const loot of lootList) {
        if (
          (loot.claimed && !loot.chest) ||
          Math.hypot(x - loot.x, y - loot.y) > distance
        )
          continue;
        wanted.add(loot.id);
        let v = visuals.get(loot.id);
        if (!v) {
          v = build(loot);
          visuals.set(loot.id, v);
        }
        v.root.position.set(
          worldX(loot.x),
          terrainHeight(loot.x, loot.y) + 0.015,
          worldZ(loot.y),
        );
        if (v.lid) v.lid.rotation.x = loot.claimed ? -1.9 : 0;
        else {
          v.body.position.y = 0.1 + Math.sin(time * 1.7 + loot.id) * 0.06;
          v.body.rotation.y = time * 0.4;
        }
        v.ring.visible = v.particles.visible = !loot.claimed;
        v.particles.rotation.y = time * 0.35;
        v.particles.position.y = (Math.sin(time * 1.4) + 1) * 0.08;
      }
      for (const [id, v] of visuals)
        if (!wanted.has(id)) {
          scene.remove(v.root);
          visuals.delete(id);
        }
    },
    dispose() {
      for (const v of visuals.values()) scene.remove(v.root);
      visuals.clear();
      Object.values(geometries).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
      glows.forEach((m) => m.dispose());
      particleMaterials.forEach((m) => m.dispose());
      particleGeometry.dispose();
    },
  };
}
