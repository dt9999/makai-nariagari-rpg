import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

type Point = [number, number, number];
type Station = { at: Point; width: number; depth: number };
export type ArmMaterials = Record<
  'skin' | 'cloth' | 'leather' | 'metal' | 'keratin' | 'rune',
  THREE.Material
>;

/** The local handle centre is fixed to the same anatomical grip in every pose. */
export function mountAtHandGrip(
  object: THREE.Group,
  handleCenterY: number,
  side: -1 | 1 = 1,
) {
  object.children.forEach((child) => {
    child.position.y -= handleCenterY;
  });
  object.position.set(side * 0.022, 0.218, -0.263);
}

/** An elliptical loft follows the limb, including changes in muscle and wrist volume. */
export function anatomicalLoft(stations: Station[], radial = 16) {
  const vertices: number[] = [],
    uv: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const centers = stations.map((station) => new THREE.Vector3(...station.at));
  // Transport the ring frame along the surface. Re-projecting world X at each
  // station flips a curled finger's rings when its tangent crosses that axis.
  const firstTangent = centers[1].clone().sub(centers[0]).normalize();
  const across =
    Math.abs(firstTangent.y) < 0.4
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
  stations.forEach((station, ring) => {
    const tangent = centers[Math.min(ring + 1, centers.length - 1)]
      .clone()
      .sub(centers[Math.max(0, ring - 1)])
      .normalize();
    const normal = across
      .clone()
      .addScaledVector(tangent, -across.dot(tangent))
      .normalize();
    // A finger can point along X. Pick another perpendicular for that case.
    if (normal.lengthSq() < 0.1)
      normal.set(0, 1, 0).addScaledVector(tangent, -tangent.y).normalize();
    across.copy(normal);
    const depth = tangent.clone().cross(normal).normalize();
    for (let side = 0; side <= radial; side++) {
      const angle = (side / radial) * Math.PI * 2;
      const p = centers[ring]
        .clone()
        .addScaledVector(normal, Math.cos(angle) * station.width)
        .addScaledVector(depth, Math.sin(angle) * station.depth);
      vertices.push(p.x, p.y, p.z);
      uv.push(side / radial, ring / (stations.length - 1));
      const detail =
        1 - 0.045 * Math.sin(ring * 1.7 + Math.cos(angle) * 1.4) ** 2;
      colors.push(detail, detail * 0.984, detail * 0.967);
      if (ring < stations.length - 1 && side < radial) {
        const a = ring * (radial + 1) + side,
          b = a + radial + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  });
  // End caps avoid hollow wrists/finger tips from steep first-person angles.
  for (const ring of [0, stations.length - 1]) {
    const center = vertices.length / 3;
    vertices.push(...stations[ring].at);
    uv.push(0.5, ring ? 1 : 0);
    colors.push(1, 0.984, 0.967);
    for (let side = 0; side < radial; side++) {
      const a = ring * (radial + 1) + side;
      if (ring === 0) indices.push(center, a + 1, a);
      else indices.push(center, a, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Keep end-ring lighting radial: cap normals otherwise create a dark band
  // where the separately modelled palm meets the forearm.
  const normals = geometry.getAttribute('normal');
  for (const ring of [0, stations.length - 1]) {
    for (let side = 0; side <= radial; side++) {
      const index = ring * (radial + 1) + side;
      const outward = new THREE.Vector3(
        vertices[index * 3] - centers[ring].x,
        vertices[index * 3 + 1] - centers[ring].y,
        vertices[index * 3 + 2] - centers[ring].z,
      ).normalize();
      normals.setXYZ(index, outward.x, outward.y, outward.z);
    }
  }
  geometry.computeBoundingSphere();
  return geometry;
}

function fleshCurve(
  points: Point[],
  radius: number,
  tipRadius: number,
  count = 16,
): Station[] {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
  );
  return Array.from({ length: count + 1 }, (_, index) => {
    const t = index / count;
    const taper = THREE.MathUtils.lerp(radius, tipRadius, t);
    // Small knuckle bulges and flexion creases are part of the same surface.
    const joint = 1 + 0.025 * Math.cos(t * Math.PI * 6);
    return {
      at: curve.getPoint(t).toArray() as Point,
      width: taper * joint,
      depth: taper * joint * 0.9,
    };
  });
}

function morphSurface(
  open: Station[],
  closed: Station[],
  material: THREE.Material,
) {
  const geometry = anatomicalLoft(open, 12),
    pose = anatomicalLoft(closed, 12);
  geometry.morphAttributes.position = [pose.getAttribute('position')];
  geometry.morphAttributes.normal = [pose.getAttribute('normal')];
  geometry.computeBoundingSphere();
  pose.dispose();
  return new THREE.Mesh(geometry, material);
}

export function createDemonArm(
  side: -1 | 1,
  rank: number,
  materials: ArmMaterials,
): THREE.Group {
  const root = new THREE.Group();
  root.name = side === 1 ? '右腕・関節のある握り手' : '左腕・詠唱する手';
  const mirror = (point: Point): Point => [point[0] * side, point[1], point[2]];
  const loft = (stations: Station[], material: THREE.Material) => {
    const mesh = new THREE.Mesh(
      anatomicalLoft(
        stations.map((station) => ({ ...station, at: mirror(station.at) })),
      ),
      material,
    );
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const arm: Station[] = [
    { at: [0.18, -2, 0.4], width: 0.115, depth: 0.095 },
    { at: [0.13, -0.45, 0.14], width: 0.095, depth: 0.078 },
    { at: [0.115, -0.39, 0.12], width: 0.102, depth: 0.084 },
    { at: [0.085, -0.3, 0.073], width: 0.108, depth: 0.08 },
    { at: [0.057, -0.21, 0.017], width: 0.096, depth: 0.072 },
    { at: [0.035, -0.12, -0.042], width: 0.079, depth: 0.061 },
    { at: [0.023, -0.035, -0.102], width: 0.061, depth: 0.051 },
    { at: [0.014, 0.037, -0.15], width: 0.047, depth: 0.041 },
    { at: [0.007, 0.1, -0.186], width: 0.04, depth: 0.034 },
    { at: [0.008, 0.108, -0.19], width: 0.04, depth: 0.034 },
  ];
  loft(arm, materials.skin).name = '肘から手首へ続く前腕';
  // A short, wrinkled sleeve leaves the narrowing forearm and wrist visible.
  loft(
    arm.slice(0, 6).map((station, i) => ({
      ...station,
      width: station.width + 0.007 + (i % 2) * 0.005,
      depth: station.depth + 0.008,
    })),
    materials.cloth,
  ).name = '厚みのある袖';
  loft(
    [
      { at: [0.036, -0.14, -0.03], width: 0.086, depth: 0.068 },
      { at: [0.033, -0.118, -0.044], width: 0.089, depth: 0.071 },
      { at: [0.029, -0.099, -0.057], width: 0.082, depth: 0.064 },
    ],
    materials.leather,
  ).name = '袖口の革巻き';
  loft(
    [
      { at: [0.008, 0.108, -0.19], width: 0.04, depth: 0.034 },
      { at: [0.008, 0.145, -0.212], width: 0.049, depth: 0.034 },
      { at: [0.009, 0.181, -0.217], width: 0.056, depth: 0.035 },
      { at: [0.01, 0.217, -0.22], width: 0.057, depth: 0.031 },
      { at: [0.012, 0.25, -0.221], width: 0.054, depth: 0.029 },
      { at: [0.016, 0.272, -0.223], width: 0.048, depth: 0.027 },
      { at: [0.017, 0.278, -0.223], width: 0.04, depth: 0.018 },
    ],
    materials.skin,
  ).name = '掌・母指球・手根';

  const flex: THREE.Mesh[] = [];
  for (let finger = 0; finger < 4; finger++) {
    const y = 0.269 - finger * 0.033,
      size = [1, 1.06, 0.99, 0.84][finger];
    const closed: Point[] = [
      [0.046, y, -0.219],
      [0.065, y + 0.002, -0.249],
      [0.05, y, -0.287],
      [0.017, y - 0.002, -0.291],
      [-0.006, y - 0.004, -0.273],
    ];
    const open: Point[] = [
      [0.046, y, -0.219],
      [0.074, y + 0.001, -0.263],
      [0.076, y, -0.305 - 0.025 * size],
      [0.064, y - 0.003, -0.346 - 0.027 * size],
      [0.05, y - 0.005, -0.36 - 0.029 * size],
    ];
    const mesh = morphSurface(
      fleshCurve(open.map(mirror), 0.017 * size, 0.0085 * size),
      fleshCurve(closed.map(mirror), 0.017 * size, 0.0085 * size),
      materials.skin,
    );
    mesh.name = ['人差し指', '中指', '薬指', '小指'][finger];
    root.add(mesh);
    flex.push(mesh);
    const nail = morphSurface(
      fleshCurve(open.slice(-2).map(mirror), 0.009 * size, 0.0028, 5).map(
        (s) => ({ ...s, depth: 0.002 }),
      ),
      fleshCurve(closed.slice(-2).map(mirror), 0.009 * size, 0.0028, 5).map(
        (s) => ({ ...s, depth: 0.002 }),
      ),
      materials.keratin,
    );
    nail.name = '短い角質の爪';
    root.add(nail);
    flex.push(nail);
  }
  const thumbOpen: Point[] = [
    [-0.035, 0.161, -0.207],
    [-0.071, 0.183, -0.221],
    [-0.107, 0.214, -0.247],
    [-0.108, 0.241, -0.282],
  ];
  const thumbClosed: Point[] = [
    [-0.035, 0.161, -0.207],
    [-0.067, 0.194, -0.242],
    [-0.057, 0.219, -0.282],
    [-0.015, 0.23, -0.309],
  ];
  const thumb = morphSurface(
    fleshCurve(thumbOpen.map(mirror), 0.026, 0.013),
    fleshCurve(thumbClosed.map(mirror), 0.026, 0.013),
    materials.skin,
  );
  thumb.name = '対向する二関節の親指';
  root.add(thumb);
  flex.push(thumb);
  const thumbNail = morphSurface(
    fleshCurve(thumbOpen.slice(-2).map(mirror), 0.012, 0.004, 5),
    fleshCurve(thumbClosed.slice(-2).map(mirror), 0.012, 0.004, 5),
    materials.keratin,
  );
  root.add(thumbNail);
  flex.push(thumbNail);

  // Wrist detail belongs to the continuous skin surface; separate thin tubes
  // intersected it and produced dotted self-shadow seams in first person.
  if (rank >= 1) {
    // A low keratin ridge follows the ulna: bodily evolution separate from armour.
    loft(
      fleshCurve(
        [
          [0.076, -0.12, -0.025],
          [0.059, -0.01, -0.091],
          [0.047, 0.075, -0.145],
        ],
        0.011 + rank * 0.001,
        0.004,
        10,
      ),
      materials.keratin,
    );
  }
  if (rank >= 2)
    for (let rune = 0; rune < 2; rune++) {
      const x = -0.019 + rune * 0.036;
      loft(
        fleshCurve(
          [
            [x, 0.03, -0.111],
            [x + 0.007, 0.095, -0.148],
            [x, 0.158, -0.172],
          ],
          0.0025,
          0.0017,
          9,
        ),
        materials.rune,
      );
    }
  if (rank >= 3) {
    loft(
      arm.slice(3, 7).map((station) => ({
        ...station,
        width: station.width + 0.008,
        depth: station.depth + 0.009,
      })),
      materials.metal,
    ).name = '身体とは別の金属製前腕甲';
  }
  const buckle = new THREE.Mesh(
    new RoundedBoxGeometry(0.032, 0.027, 0.012, 2, 0.004),
    materials.metal,
  );
  buckle.position.set(side * 0.064, -0.105, -0.002);
  buckle.rotation.x = -0.6;
  root.add(buckle);
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Close-up anatomy keeps direct lighting, without coarse world shadow-map
      // texels producing dotted seams on the fingers and wrist.
      child.castShadow = child.receiveShadow = false;
      child.renderOrder = 20;
    }
  });
  root.userData.flex = flex;
  root.userData.grip = side === 1 ? 1 : 0.38;
  for (const part of flex) part.morphTargetInfluences![0] = root.userData.grip;
  return root;
}

/** Continuous finger flexion preserves joint connections while casting or guarding. */
export function poseDemonArm(arm: THREE.Group, closure: number, dt: number) {
  const target = THREE.MathUtils.clamp(
    Number.isFinite(closure) ? closure : 0.5,
    0,
    1,
  );
  arm.userData.grip = THREE.MathUtils.damp(
    arm.userData.grip ?? target,
    target,
    14,
    Math.max(0, Number.isFinite(dt) ? dt : 0),
  );
  for (const mesh of (arm.userData.flex || []) as THREE.Mesh[])
    mesh.morphTargetInfluences![0] = arm.userData.grip;
}
