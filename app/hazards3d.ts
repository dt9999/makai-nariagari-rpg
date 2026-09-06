import * as THREE from 'three';
import {
  HAZARDS,
  hazardPhase,
  terrainHeight,
  worldX,
  worldZ,
  SCALE,
  type Hazard,
} from './world';

export function createHazardRenderer(scene: THREE.Scene) {
  const colors = { poison: 0x92c65a, fire: 0xf08539, arcane: 0xa388f0 };
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  for (const [kind, color] of Object.entries(colors))
    for (const phase of ['quiet', 'warning', 'active']) {
      materials.set(
        `${kind}-${phase}`,
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity:
            phase === 'active' ? 2 : phase === 'warning' ? 0.8 : 0.12,
          roughness: 0.75,
          transparent: true,
          opacity: phase === 'active' ? 0.8 : phase === 'warning' ? 0.55 : 0.2,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
    }
  const particleGeo = new THREE.BufferGeometry(),
    coords = new Float32Array(36 * 3);
  for (let i = 0; i < 36; i++) {
    const a = i * 2.4,
      r = 0.2 + (i % 5) * 0.13;
    coords[i * 3] = Math.cos(a) * r;
    coords[i * 3 + 1] = (i % 9) * 0.11;
    coords[i * 3 + 2] = Math.sin(a) * r;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(coords, 3));
  const particleMats = Object.fromEntries(
    Object.entries(colors).map(([kind, color]) => [
      kind,
      new THREE.PointsMaterial({
        color,
        size: 0.04,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    ]),
  );
  const rock = new THREE.OctahedronGeometry(1, 0),
    rim = new THREE.MeshStandardMaterial({ color: 0x2c2630, roughness: 1 });
  const visuals = new Map<
    string,
    { root: THREE.Group; surface: THREE.Mesh; particles: THREE.Points }
  >();
  const build = (h: Hazard) => {
    const root = new THREE.Group(),
      height = terrainHeight(h.x, h.y),
      radius = h.radius * SCALE;
    root.position.set(worldX(h.x), height, worldZ(h.y));
    const ground = new THREE.CircleGeometry(radius, 32);
    ground.rotateX(-Math.PI / 2);
    const pos = ground.getAttribute('position');
    for (let i = 0; i < pos.count; i++)
      pos.setY(
        i,
        terrainHeight(h.x + pos.getX(i) / SCALE, h.y + pos.getZ(i) / SCALE) -
          height +
          0.04,
      );
    ground.computeVertexNormals();
    const surface = new THREE.Mesh(ground, materials.get(`${h.kind}-quiet`));
    root.add(surface);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        x = Math.cos(a) * radius,
        z = Math.sin(a) * radius;
      const stone = new THREE.Mesh(rock, rim);
      stone.scale.set(0.18, 0.12, 0.14);
      stone.position.set(
        x,
        terrainHeight(h.x + x / SCALE, h.y + z / SCALE) - height + 0.07,
        z,
      );
      root.add(stone);
    }
    const particles = new THREE.Points(particleGeo, particleMats[h.kind]);
    particles.scale.set(radius, 1, radius);
    root.add(particles);
    scene.add(root);
    return { root, surface, particles };
  };
  return {
    update(x: number, y: number, time: number, distance = 1400) {
      for (const h of HAZARDS) {
        const near = Math.hypot(h.x - x, h.y - y) < distance;
        let v = visuals.get(h.id);
        if (!near) {
          if (v) {
            scene.remove(v.root);
            v.surface.geometry.dispose();
            visuals.delete(h.id);
          }
          continue;
        }
        if (!v) {
          v = build(h);
          visuals.set(h.id, v);
        }
        const phase = hazardPhase(h, time);
        v.surface.material = materials.get(`${h.kind}-${phase}`)!;
        v.particles.visible = phase !== 'quiet';
        v.particles.position.y = ((time + h.phase) * 0.6) % 1;
        v.particles.rotation.y = time * 0.3;
      }
    },
    dispose() {
      for (const v of visuals.values()) {
        scene.remove(v.root);
        v.surface.geometry.dispose();
      }
      visuals.clear();
      rock.dispose();
      rim.dispose();
      particleGeo.dispose();
      materials.forEach((m) => m.dispose());
      Object.values(particleMats).forEach((m) => m.dispose());
    },
  };
}
