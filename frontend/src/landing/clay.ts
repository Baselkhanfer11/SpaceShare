import * as THREE from 'three';

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** 0 → 1 as t goes from a to b. */
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const smooth = (x: number) => x * x * (3 - 2 * x);
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** Overshoots a little, then settles: things "pop" into place. */
export const easeBack = (x: number) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
export function bounce(x: number) {
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
}

/** Seeded random numbers, so the scene looks the same on every visit. */
export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A matte, soft material: the look of everything in the scene. */
export const clay = (hex: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: hex, roughness: 0.82, metalness: 0, ...extra });

/**
 * A box with rounded edges and smooth normals. Segments are packed into the rounded band (m per edge),
 * with one flat segment across the middle of each face.
 */
export function roundedBox(w: number, h: number, d: number, r: number, m = 3) {
  const n = 2 * m + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
  const P = g.attributes.position.array as Float32Array;
  const N = g.attributes.normal.array as Float32Array;
  const half = [w / 2, h / 2, d / 2];
  const R = Math.min(r, ...half);
  const v = [0, 0, 0], inner = [0, 0, 0];
  for (let i = 0; i < P.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const j = Math.round((P[i + a] + 0.5) * n), H = half[a];
      v[a] = j <= m ? -H + R * (j / m) : H - R * ((n - j) / m);
      inner[a] = clamp(v[a], -(H - R), H - R);
    }
    let ox = v[0] - inner[0], oy = v[1] - inner[1], oz = v[2] - inner[2];
    const len = Math.hypot(ox, oy, oz) || 1;
    ox /= len; oy /= len; oz /= len;
    P[i] = inner[0] + ox * R; P[i + 1] = inner[1] + oy * R; P[i + 2] = inner[2] + oz * R;
    N[i] = ox; N[i + 1] = oy; N[i + 2] = oz;
  }
  g.attributes.position.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
}

/** Points on the surface of a box: what a camera view must keep on screen. */
export function boxPoints(xa: number, xb: number, ya: number, yb: number, za: number, zb: number, n = 4) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++) {
    if (i % n && j % n && k % n) continue;
    pts.push(new THREE.Vector3(xa + ((xb - xa) * i) / n, ya + ((yb - ya) * j) / n, za + ((zb - za) * k) / n));
  }
  return pts;
}
