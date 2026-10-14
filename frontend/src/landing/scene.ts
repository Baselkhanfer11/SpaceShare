import * as THREE from 'three';
import {
  bounce, boxPoints, clamp, clay, easeBack, easeInOut, easeOut, prog, roundedBox, seeded, smooth,
} from './clay';
import { BORDER, CITIES, DEAD_SEA, DEAD_SEA_LABEL, MAX_FREE, ROADS, toKm, type LonLat } from './jordan';

/*
 * The landing page's 3D story: a clay warehouse that opens, fills, ships and gets paid,
 * and a clay map of Jordan it shrinks into. Scroll position is the clock (chapter k is
 * reached when its section's top crosses the middle of the screen), so everything plays
 * forward and backward with the page. React owns the DOM; this module only positions it.
 */

export type GroupKey = 'owner' | 'teal' | 'violet' | 'sun';

export interface SceneElements {
  /** The landing page root: receives the sky colours as CSS variables. */
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  /** Story sections in order (hero first). */
  chapters: HTMLElement[];
  /** A chapter text panel: the column the scene must stay clear of. */
  panel: HTMLElement;
  /** The opening headline and text, kept clear on wide screens. */
  heroText: HTMLElement[];
  hud: HTMLElement;
  tags: { freeA: HTMLElement; freeB: HTMLElement; track: HTMLElement; ship: HTMLElement; paid: HTMLElement };
  cityTags: Record<string, HTMLElement>;
  seaTag: HTMLElement;
  hover: { root: HTMLElement; dot: HTMLElement; name: HTMLElement; where: HTMLElement };
}

export interface SceneCallbacks {
  /** The chapter now in view changed (for the chapter rail). */
  onChapter: (index: number) => void;
  /** How many booked pallets are on the racks (for the readout). */
  onBooked: (count: number) => void;
  /** Text for the "whose pallet is this" label. */
  describe: (group: GroupKey, slot: { row: number; bay: number; level: number }) => { name: string; where: string };
}

export interface LandingScene {
  /** Light up one city's tower (from the city list in the text). */
  setHotCity: (id: string | null) => void;
  /** Re-measure after a layout change (language direction, fonts). */
  relayout: () => void;
  dispose: () => void;
}

// Kept in step with LandingPage.tsx (its legend colours and pallet counts).
const GROUP_COLORS: Record<GroupKey, string> = { owner: '#c3ccd1', teal: '#2bb39b', violet: '#8b78e6', sun: '#f2c14e' };
const OWNER_PALLETS = 48;

/** Returns null when the device can't draw WebGL; the page then shows without the 3D scene. */
export function createLandingScene(el: SceneElements, cb: SceneCallbacks): LandingScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: el.canvas, antialias: true, alpha: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  } catch {
    return null;
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = seeded(11);
  const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const dummy = new THREE.Object3D();
  const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(0xeef3ef, 0.008);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 6000);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xd8c6a6, 1.6);
  const sun = new THREE.DirectionalLight(0xfff3e2, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(hemi, sun, sun.target);
  const SUN_DIR = v3(0.55, 1, 0.42).normalize();

  // ===================================================================================
  //  Jordan: a thick clay tile whose top is the ground the warehouse stands on.
  // ===================================================================================
  const GROUND_Y = -0.4;
  const geo = (p: LonLat, y = 0) => { const k = toKm(p); return v3(k.x, y, k.z); };
  const shapeOf = (pts: LonLat[]) => new THREE.Shape(pts.map((p) => { const k = toKm(p); return new THREE.Vector2(k.x, -k.z); }));
  const tileGeo = new THREE.ExtrudeGeometry(shapeOf(BORDER), { depth: 8, bevelEnabled: true, bevelThickness: 3, bevelSize: 4, bevelSegments: 5, curveSegments: 4 }).rotateX(-Math.PI / 2);
  tileGeo.computeBoundingBox();
  tileGeo.translate(0, GROUND_Y - tileGeo.boundingBox!.max.y, 0);
  const sandMat = clay('#e8cc98', { roughness: 0.95 }), sandSideMat = clay('#d2b07c', { roughness: 0.95 });
  const tile = new THREE.Mesh(tileGeo, [sandMat, sandSideMat]);
  tile.receiveShadow = tile.castShadow = true;
  scene.add(tile);
  const groundMat = clay('#e2e8e6', { roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND_Y - 15; ground.receiveShadow = true;
  scene.add(ground);
  const seaGeo = new THREE.ExtrudeGeometry(shapeOf(DEAD_SEA), { depth: 0.6, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 1.2, bevelSegments: 3 }).rotateX(-Math.PI / 2);
  seaGeo.translate(0, GROUND_Y - 0.5, 0);
  const sea = new THREE.Mesh(seaGeo, clay('#8fd0e4', { roughness: 0.35 }));
  sea.receiveShadow = true;
  scene.add(sea);

  // ===================================================================================
  //  The warehouse world. It shrinks into Amman for the map chapter.
  // ===================================================================================
  const wh = new THREE.Group(); scene.add(wh);
  const lamps = [-5, 0, 5].map((x) => { const l = new THREE.PointLight(0xffc98a, 0, 24, 2); l.position.set(x, 6, 0); wh.add(l); return l; });
  const BW = 18.4, BD = 19, BH = 7, BZ = 0.25, z0 = BZ - BD / 2, z1 = BZ + BD / 2, x1 = BW / 2;
  const LOT = { x0: -15, x1: 29, z0: -14, z1: 14.5 };
  const lotMat = clay('#d9e0e0', { roughness: 0.9 });
  const lot = new THREE.Mesh(roundedBox(LOT.x1 - LOT.x0, 0.8, LOT.z1 - LOT.z0, 0.35), lotMat);
  lot.position.set((LOT.x0 + LOT.x1) / 2, -0.4, (LOT.z0 + LOT.z1) / 2); lot.receiveShadow = true;
  wh.add(lot);
  const floorMat = clay('#eef1f1');
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(BW, BD), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.006, BZ); floor.receiveShadow = true; wh.add(floor);
  // Yellow aisle lines inside, parking bays by the dock.
  const lineMat = clay('#f2c14e', { roughness: 0.6 });
  const stripeGeo = new THREE.PlaneGeometry(13, 0.14);
  for (const z of [-4, 0, 4, 8]) { const s = new THREE.Mesh(stripeGeo, lineMat); s.rotation.x = -Math.PI / 2; s.position.set(0, 0.012, z); s.receiveShadow = true; wh.add(s); }
  const bayGeo = new THREE.PlaneGeometry(0.16, 3.2);
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(bayGeo, lineMat); s.rotation.x = -Math.PI / 2; s.position.set(12 + i * 2.6, 0.012, 7); wh.add(s); }
  const roadMat = clay('#cfd5d2', { roughness: 0.9 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(110, 5), roadMat);
  road.rotation.x = -Math.PI / 2; road.position.set(LOT.x1 + 55, GROUND_Y + 0.03, 0); road.receiveShadow = true; wh.add(road);

  // Walls: back and left stay; front and right fold down like an opened box; the roof lifts off.
  const wallMat = clay('#f8f8f5');
  const accentMat = clay('#2bb39b');
  const T_W = 0.36;
  const wall = (w: number, h: number, d: number) => { const m = new THREE.Mesh(roundedBox(w, h, d, 0.14), wallMat); m.castShadow = m.receiveShadow = true; return m; };
  const back = wall(BW, BH, T_W); back.position.set(0, BH / 2, z0 + T_W / 2); wh.add(back);
  const left = wall(T_W, BH, BD); left.position.set(-BW / 2 + T_W / 2, BH / 2, BZ); wh.add(left);
  const frontPivot = new THREE.Group(); frontPivot.position.set(0, 0, z1); wh.add(frontPivot);
  const front = wall(BW, BH, T_W); front.position.set(0, BH / 2, -T_W / 2); frontPivot.add(front);
  const band = new THREE.Mesh(roundedBox(BW + 0.02, 0.9, T_W + 0.04, 0.12), accentMat); band.position.set(0, BH - 0.6, -T_W / 2); frontPivot.add(band);
  const door = new THREE.Mesh(roundedBox(2.2, 3.2, 0.2, 0.1), clay('#24423d')); door.position.set(-5.5, 1.6, 0.05); frontPivot.add(door);
  const signCanvas = document.createElement('canvas'); signCanvas.width = 1024; signCanvas.height = 256;
  const signTex = new THREE.CanvasTexture(signCanvas); signTex.colorSpace = THREE.SRGBColorSpace; signTex.anisotropy = 4;
  const drawSign = () => {
    const g = signCanvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, 1024, 256);
    g.fillStyle = '#15262b'; g.beginPath(); g.roundRect(8, 8, 1008, 240, 110); g.fill();
    g.fillStyle = '#ffffff'; g.font = '800 120px "Bricolage Grotesque", "Segoe UI", sans-serif'; g.textBaseline = 'middle';
    g.fillText('SpaceShare', 90, 132);
    g.fillStyle = '#9fe3d3'; g.font = '500 64px "DM Mono", monospace'; g.fillText('WH-07', 760, 136);
    signTex.needsUpdate = true;
  };
  drawSign();
  let disposed = false;
  document.fonts?.ready.then(() => { if (!disposed) { drawSign(); measure(); } });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshStandardMaterial({ map: signTex, transparent: true, roughness: 0.6 }));
  sign.position.set(2, 3.6, 0.02); frontPivot.add(sign);

  const rightPivot = new THREE.Group(); rightPivot.position.set(x1, 0, 0); wh.add(rightPivot);
  const DOOR_Z = 2.4, DOOR_H = 4.8;
  const r1 = wall(T_W, BH, -DOOR_Z - z0); r1.position.set(-T_W / 2, BH / 2, (z0 - DOOR_Z) / 2); rightPivot.add(r1);
  const r2 = wall(T_W, BH, z1 - DOOR_Z); r2.position.set(-T_W / 2, BH / 2, (DOOR_Z + z1) / 2); rightPivot.add(r2);
  const r3 = wall(T_W, BH - DOOR_H, DOOR_Z * 2); r3.position.set(-T_W / 2, DOOR_H + (BH - DOOR_H) / 2, 0); rightPivot.add(r3);
  const roll = new THREE.Mesh(roundedBox(0.5, 0.7, DOOR_Z * 2, 0.25), clay('#f29d52')); roll.position.set(-0.1, DOOR_H - 0.3, 0); rightPivot.add(roll);
  const bandR = new THREE.Mesh(roundedBox(T_W + 0.04, 0.9, BD + 0.02, 0.12), accentMat); bandR.position.set(-T_W / 2, BH - 0.6, BZ); rightPivot.add(bandR);

  const roof = new THREE.Group(); wh.add(roof);
  const roofMat = clay('#dfe8ea', { transparent: true });
  const skyMat = clay('#9fd6e6', { transparent: true, roughness: 0.3 });
  const RISE = 1.6, slopeLen = Math.hypot(BD / 2, RISE) + 0.6, tilt = Math.atan2(RISE, BD / 2);
  const slabGeo = roundedBox(BW + 1.2, 0.4, slopeLen, 0.16), skylightGeo = roundedBox(3, 0.2, 2.6, 0.08);
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(slabGeo, roofMat);
    slab.position.set(0, BH + RISE / 2 + 0.2, BZ + (s * BD) / 4); slab.rotation.x = s * tilt; slab.castShadow = true; roof.add(slab);
    for (let i = -1; i <= 1; i++) {
      const sk = new THREE.Mesh(skylightGeo, skyMat);
      sk.position.set(i * 5.5, BH + RISE / 2 + 0.45, BZ + (s * BD) / 4); sk.rotation.x = s * tilt; roof.add(sk);
    }
  }

  // ---- racks: 4 rows × 5 bays × 2 pallets × 3 levels = 120 slots; blue uprights, orange beams ----
  const ROWS = [-6, -2, 2, 6], BAYS = 5, LEVELS = 3, BAY_W = 2.6, X0 = -6.5, LEVEL_H = 1.5, RACK_H = 4.6;
  const uprights = new THREE.InstancedMesh(roundedBox(0.12, RACK_H, 0.12, 0.05, 1).translate(0, RACK_H / 2, 0), clay('#6f8fd8', { roughness: 0.55 }), ROWS.length * (BAYS + 1) * 2);
  const beams = new THREE.InstancedMesh(roundedBox(BAYS * BAY_W, 0.14, 0.1, 0.05, 1), clay('#f29d52', { roughness: 0.55 }), ROWS.length * 3 * 2);
  uprights.castShadow = beams.castShadow = uprights.receiveShadow = beams.receiveShadow = true;
  wh.add(uprights, beams);
  function placeRacks(now: number) {
    let u = 0, b = 0;
    ROWS.forEach((rz, r) => {
      const k = easeBack(prog(now, 0.5 + r * 0.1, 1.2 + r * 0.1));
      for (let i = 0; i <= BAYS; i++) for (const side of [-0.55, 0.55]) {
        dummy.position.set(X0 + i * BAY_W, 0, rz + side); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, Math.max(k, 1e-4), 1); dummy.updateMatrix();
        uprights.setMatrixAt(u++, dummy.matrix);
      }
      const kb = easeBack(prog(now, 0.9 + r * 0.1, 1.5 + r * 0.1));
      for (let l = 1; l <= 3; l++) for (const side of [-0.55, 0.55]) {
        dummy.position.set(0, l * LEVEL_H, rz + side); dummy.scale.set(Math.max(kb, 1e-4), 1, 1); dummy.updateMatrix();
        beams.setMatrixAt(b++, dummy.matrix);
      }
    });
    uprights.instanceMatrix.needsUpdate = beams.instanceMatrix.needsUpdate = true;
  }

  interface Slot { r: number; b: number; l: number; pos: THREE.Vector3 }
  const slots: Slot[] = [];
  ROWS.forEach((rz, r) => {
    for (let b = 0; b < BAYS; b++) for (let s = 0; s < 2; s++) for (let l = 0; l < LEVELS; l++) {
      slots.push({ r, b, l, pos: v3(X0 + b * BAY_W + 0.65 + s * 1.3, l === 0 ? 0.02 : l * LEVEL_H + 0.08, rz) });
    }
  });
  // 48 owner pallets (40%), 60 booked across three businesses, 12 stay free.
  const order = shuffle([...slots.keys()]);
  let free = order.slice(OWNER_PALLETS);
  const shipIdx = free.filter((i) => slots[i].l === 0).slice(0, 4);
  free = free.filter((i) => !shipIdx.includes(i));
  const plan: Record<GroupKey, number[]> = {
    owner: order.slice(0, OWNER_PALLETS), teal: [...shipIdx, ...free.slice(0, 18)], violet: free.slice(18, 38), sun: free.slice(38, 56),
  };
  // Slots that stay free; the two price labels go on the pair farthest apart so they never overlap.
  const openIdx = free.slice(56);
  const farthest = openIdx.slice(1).sort((a, b) => slots[b].pos.distanceTo(slots[openIdx[0]].pos) - slots[a].pos.distanceTo(slots[openIdx[0]].pos))[0];
  const labelSlots = [openIdx[0], farthest];

  interface Pallet {
    key: GroupKey; gi: number; bi: number; slot: Slot; ship: number; hov: number;
    delay: number; start: number; dur: number; jx: number; spin: number;
  }
  const baseGeo = roundedBox(1.2, 0.16, 1.0, 0.05, 1).translate(0, 0.08, 0);
  const cargoGeo = roundedBox(1.06, 0.84, 0.9, 0.16).translate(0, 0.16 + 0.42, 0);
  const WAVE: Record<GroupKey, number> = { owner: 0, teal: 0, violet: 0.1, sun: 0.2 };
  const keys = Object.keys(plan) as GroupKey[];
  const bases = new THREE.InstancedMesh(baseGeo, clay('#d9b48c'), keys.reduce((n, k) => n + plan[k].length, 0));
  bases.castShadow = bases.receiveShadow = true; bases.instanceMatrix.setUsage(THREE.DynamicDrawUsage); wh.add(bases);
  const groups = {} as Record<GroupKey, { mat: THREE.MeshStandardMaterial; mesh: THREE.InstancedMesh; byInstance: Pallet[] }>;
  const pallets: Pallet[] = [];
  const bySlot = new Map<number, Pallet>();
  let bi = 0;
  for (const key of keys) {
    const mat = clay(GROUP_COLORS[key], { roughness: 0.62, transparent: true });
    const mesh = new THREE.InstancedMesh(cargoGeo, mat, plan[key].length);
    mesh.castShadow = mesh.receiveShadow = true; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.userData.key = key;
    wh.add(mesh);
    const byInstance: Pallet[] = [];
    plan[key].forEach((si, k) => {
      const p: Pallet = {
        key, gi: k, bi: bi++, slot: slots[si], ship: key === 'teal' && k < 4 ? k : -1, hov: 0,
        delay: 1.1 + rand() * 0.9,
        start: 3.05 + WAVE[key] + (k / plan[key].length) * 0.4 + rand() * 0.04, dur: 0.22,
        jx: (rand() - 0.5) * 0.6, spin: (rand() - 0.5) * 2.4,
      };
      if (key !== 'owner') bySlot.set(si, p);
      byInstance[k] = p;
      pallets.push(p);
    });
    groups[key] = { mat, mesh, byInstance };
  }

  // Free slots: translucent boxes that breathe until someone books them.
  const ghostGeo = roundedBox(1.08, 0.98, 0.92, 0.18);
  const ghosts = order.slice(OWNER_PALLETS).map((si, i) => {
    const m = new THREE.Mesh(ghostGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#2bb39b', emissiveIntensity: 0.25, transparent: true, opacity: 0, depthWrite: false, roughness: 0.4 }));
    m.position.copy(slots[si].pos).add(v3(0, 0.52, 0)); m.visible = false; wh.add(m);
    return { m, i, p: bySlot.get(si) };
  });

  // ---- flatbed truck ----
  const truck = new THREE.Group();
  const cab = new THREE.Mesh(roundedBox(2.2, 2.5, 2.5, 0.45), clay('#2bb39b', { roughness: 0.5 })); cab.position.set(8.4, 1.9, 0); cab.castShadow = true;
  const glass = new THREE.Mesh(roundedBox(0.2, 1.0, 2.1, 0.08), clay('#bfe9f2', { roughness: 0.15 })); glass.position.set(9.45, 2.45, 0);
  const deck = new THREE.Mesh(roundedBox(7.2, 0.35, 2.6, 0.12), clay('#f8f8f5')); deck.position.set(3.6, 0.8, 0); deck.castShadow = deck.receiveShadow = true;
  const stripe = new THREE.Mesh(roundedBox(7.22, 0.16, 2.64, 0.06), clay('#f29d52')); stripe.position.set(3.6, 0.72, 0);
  const headlights = new THREE.Mesh(roundedBox(0.12, 0.25, 2.0, 0.06), clay('#fff3c4', { emissive: '#fff3c4', emissiveIntensity: 0.6 })); headlights.position.set(9.5, 1.2, 0);
  truck.add(cab, glass, deck, stripe, headlights);
  const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.38, 24).rotateX(Math.PI / 2);
  const wheelMat = clay('#33414a', { roughness: 0.9 });
  const wheels: THREE.Mesh[] = [];
  for (const x of [1.0, 2.2, 7.8, 9.0]) for (const z of [-1.15, 1.15]) { const w = new THREE.Mesh(wheelGeo, wheelMat); w.position.set(x, 0.48, z); w.castShadow = true; truck.add(w); wheels.push(w); }
  wh.add(truck);
  const DOCK_X = x1 + BH + 0.9; // past the folded-down right wall
  const truckSlot = (a: number) => v3(0.9 + a * 1.75, 0.97, 0);
  const groundAt = (x: number) => -0.4 * clamp((x - (LOT.x1 - 1.5)) / 2.5); // rolls off the lot onto the road
  const truckX = (T: number) => {
    if (T < 5.0) return 95;
    if (T < 5.7) return DOCK_X + (95 - DOCK_X) * (1 - easeOut(prog(T, 5.0, 5.22)));
    return DOCK_X + (95 - DOCK_X) * easeInOut(prog(T, 5.7, 5.96));
  };

  // ---- coins for "get paid", stacking up beside the warehouse ----
  const COINS = 36, STACK = v3(-12, 0.02, 11.6);
  const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.5, 0.15, 28), clay('#f2c14e', { metalness: 0.35, roughness: 0.35 }), COINS);
  coins.castShadow = true; coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage); wh.add(coins);
  const coinSrc = pallets.filter((p) => p.key !== 'owner' && p.ship < 0);
  const coinJit = Array.from({ length: COINS }, () => [(rand() - 0.5) * 0.08, (rand() - 0.5) * 0.08, rand() * 6]);

  // ---- landscape: trees and rocks on the sand, kept off the road and the cameras' side ----
  const treeSpots: [number, number, number][] = [];
  while (treeSpots.length < 14) {
    const a = rand() * Math.PI * 2, d = 24 + rand() * 14, x = 7 + Math.cos(a) * d, z = Math.sin(a) * d * 0.9;
    if (x > LOT.x0 - 2 && x < LOT.x1 + 2 && z > LOT.z0 - 2 && z < LOT.z1 + 2) continue;
    if (x > LOT.x1 - 2 && Math.abs(z) < 5) continue;
    if (z > 6 && x > -20) continue;
    treeSpots.push([x, z, 0.8 + rand() * 0.7]);
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 10).translate(0, 0.8, 0), clay('#b08560'), treeSpots.length);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.4, 2), clay('#8cc79a'), treeSpots.length);
  treeSpots.forEach(([x, z, s], i) => {
    dummy.position.set(x, GROUND_Y, z); dummy.scale.setScalar(s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, GROUND_Y + 2.4 * s, z); dummy.scale.set(s, s * 0.9, s); dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
  });
  trunks.castShadow = crowns.castShadow = true;
  wh.add(trunks, crowns);
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.6, 1), clay('#d6bf98'), 26);
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, d = 20 + rand() * 24;
    dummy.position.set(7 + Math.cos(a) * d, GROUND_Y, Math.sin(a) * d); dummy.scale.set(0.6 + rand(), 0.35 + rand() * 0.4, 0.6 + rand()); dummy.rotation.set(0, rand() * 3, 0); dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.castShadow = true; wh.add(rocks);

  // ---- clouds whose shadows drift over the scene ----
  const cloudMat = clay('#ffffff', { roughness: 1, transparent: true, depthWrite: false });
  const clouds = new THREE.Group(); scene.add(clouds);
  const puff = new THREE.IcosahedronGeometry(1, 3);
  for (let c = 0; c < 6; c++) {
    const g = new THREE.Group();
    const n = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(puff, cloudMat);
      const s = 1.4 + rand() * 1.4;
      m.scale.set(s, s * 0.8, s); m.position.set((i - n / 2) * 1.6 + rand(), rand() * 0.6, (rand() - 0.5) * 1.6);
      m.castShadow = true; g.add(m);
    }
    g.userData = { x: -40 + rand() * 80, z: -30 + rand() * 50, y: 22 + rand() * 6, v: 0.6 + rand() * 0.6 };
    clouds.add(g);
  }

  // ---- map details: towns, towers of free space, roads with trucks ----
  const mapFx = new THREE.Group(); mapFx.visible = false; scene.add(mapFx);
  const towerGeo = new THREE.CylinderGeometry(4.6, 4.6, 1, 40).translate(0, 0.5, 0);
  const capGeo = new THREE.SphereGeometry(4.6, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(5.6, 7, 48).rotateX(-Math.PI / 2);
  const houseMat = clay('#fbfbf8');
  const towers = CITIES.map((c, i) => {
    const pos = geo(c.at).add(v3(c.offset?.[0] ?? 0, 0, c.offset?.[1] ?? 0));
    const mat = clay('#2bb39b', { roughness: 0.5, emissive: '#2bb39b', emissiveIntensity: 0 });
    const col = new THREE.Mesh(towerGeo, mat); col.position.copy(pos).setY(GROUND_Y); col.castShadow = true;
    const cap = new THREE.Mesh(capGeo, mat); cap.castShadow = true;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }));
    ring.position.copy(pos).setY(GROUND_Y + 0.15);
    mapFx.add(col, cap, ring);
    return { city: c, pos, h: 10 + (c.free / MAX_FREE) * 80, delay: i * 0.035, grow: 0, mat, col, cap, ring };
  });
  const houseSpots = towers.flatMap((t) => {
    const n = 6 + Math.round((t.city.free / MAX_FREE) * 10);
    return Array.from({ length: n }, () => {
      const a = rand() * Math.PI * 2, d = 8 + rand() * (6 + n);
      return { t, x: t.pos.x + Math.cos(a) * d, z: t.pos.z + Math.sin(a) * d, w: 2.4 + rand() * 2.4, h: 1.6 + rand() * 4.5, d: 2.4 + rand() * 2.4, ry: rand() * Math.PI };
    });
  });
  const houses = new THREE.InstancedMesh(roundedBox(1, 1, 1, 0.22).translate(0, 0.5, 0), houseMat, houseSpots.length);
  houses.castShadow = houses.receiveShadow = true; mapFx.add(houses);
  const roadMapMat = clay('#fbf7ee', { roughness: 0.9 });
  const routes = ROADS.map((pts) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => geo(p, GROUND_Y + 0.25)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 1.3, 8), roadMapMat);
    tube.scale.y = 0.3; tube.position.y = (GROUND_Y + 0.25) * 0.7; tube.receiveShadow = true;
    mapFx.add(tube);
    return curve;
  });
  const mapTruckGeo = roundedBox(6, 2.6, 2.8, 0.7);
  const mapTrucks = ['#f29d52', '#2bb39b', '#8b78e6', '#f29d52', '#2bb39b', '#f2c14e', '#8b78e6', '#2bb39b'].map((hex, i) => {
    const m = new THREE.Mesh(mapTruckGeo, clay(hex, { roughness: 0.5 })); m.castShadow = true; mapFx.add(m);
    return { m, curve: routes[i % routes.length], off: rand(), speed: 0.025 + rand() * 0.02, dir: i % 2 ? -1 : 1 };
  });

  // How much the scene is at country scale (0 = warehouse, 1 = map).
  const mapAmount = (T: number) => smooth(prog(T, 1.8, 2.3)) * (1 - smooth(prog(T, 2.75, 3.2)));
  let hotCity: string | null = null;
  const tangent = v3();
  const towerIdle = new THREE.Color('#2bb39b'), towerDim = new THREE.Color('#a9d9cf');
  function placeMap(T: number, now: number, m: number) {
    mapFx.visible = m > 0.01;
    for (const t of towers) {
      t.grow = easeBack(prog(T, 2.0 + t.delay, 2.32 + t.delay)) * (1 - smooth(prog(T, 2.78, 3.0)));
      if (!mapFx.visible) continue;
      const h = Math.max(t.grow * t.h, 0.01);
      t.col.scale.set(1, h, 1);
      t.cap.position.copy(t.pos).setY(GROUND_Y + h);
      t.cap.visible = t.grow > 0.02;
      const hot = hotCity === t.city.id;
      t.mat.emissiveIntensity = hot ? 0.45 : 0;
      t.mat.color.copy(hotCity && !hot ? towerDim : towerIdle);
      const pulse = reduce ? 0 : (now * 0.5 + t.delay * 4) % 1;
      t.ring.scale.setScalar(1 + pulse * 1.4);
      (t.ring.material as THREE.MeshBasicMaterial).opacity = 0.75 * m * (1 - pulse);
      el.cityTags[t.city.id]?.classList.toggle('hot', hot);
    }
    if (!mapFx.visible) return;
    houseSpots.forEach((s, i) => {
      const k = Math.max(easeBack(prog(T, 2.04 + s.t.delay, 2.3 + s.t.delay)) * (1 - smooth(prog(T, 2.78, 3.0))), 1e-4);
      dummy.position.set(s.x, GROUND_Y, s.z); dummy.rotation.set(0, s.ry, 0); dummy.scale.set(s.w, s.h * k, s.d); dummy.updateMatrix();
      houses.setMatrixAt(i, dummy.matrix);
    });
    houses.instanceMatrix.needsUpdate = true;
    for (const t of mapTrucks) {
      const u = (((reduce ? t.off : t.off + now * t.speed * t.dir) % 1) + 1) % 1;
      t.curve.getPointAt(u, t.m.position); t.m.position.y = GROUND_Y + 1.5;
      t.curve.getTangentAt(u, tangent);
      t.m.rotation.set(0, Math.atan2(-tangent.z, tangent.x), 0);
    }
  }

  // ===================================================================================
  //  Camera: each chapter's view names its subject (point sets that must stay on screen,
  //  with room for labels) and the angle; fitView picks the distance for this screen.
  // ===================================================================================
  const tealC = v3();
  plan.teal.forEach((si) => tealC.add(slots[si].pos)); tealC.divideScalar(plan.teal.length);
  const tealBox = new THREE.Box3().setFromPoints(plan.teal.map((si) => slots[si].pos));
  type Roi = [THREE.Vector3[], number, number][]; // [points, room on the right, room on top]
  const ROI: Record<string, Roi> = {
    building: [[boxPoints(-BW / 2, BW / 2, 0, BH + 2, z0, z1), 0, 0]],
    open: [[boxPoints(-BW / 2, x1 + BH * 0.6, 0, BH, z0, z1 + BH * 0.4), 0, 0]],
    teal: [[boxPoints(tealBox.min.x - 0.7, tealBox.max.x + 0.7, 0, 6.5, tealBox.min.z - 0.6, tealBox.max.z + 0.6), 0, 0]],
    ship: [[boxPoints(4, DOCK_X + 9.6, 0, 3.4, -3.5, 3.5), 0, 0], [[v3(DOCK_X + 3.5, 4.2, 0)], 0, 70]],
    paid: [[boxPoints(-BW / 2 - 4, BW / 2, 0, BH, z0, z1 + 3), 0, 0], [[STACK.clone().setY(6.5)], 0, 70]],
    jordan: [[BORDER.map((p) => geo(p)), 0, 0], [towers.map((t) => t.pos.clone().setY(t.h + 2)), 130, 80]],
  };
  // ox/oy: where on screen the view aims (pixels from the centre), set by fitView.
  interface View { pos: THREE.Vector3; target: THREE.Vector3; dir: THREE.Vector3; minD: number; roi: Roi; hud: boolean; hero?: boolean; ox: number; oy: number }
  const view = (p: [number, number, number], t: [number, number, number], roi: Roi, hud = true): View => {
    const pos = v3(...p), target = v3(...t);
    return { pos: pos.clone(), target, dir: pos.clone().sub(target).normalize(), minD: pos.distanceTo(target), roi, hud, ox: 0, oy: 0 };
  };
  const jordanC = new THREE.Box3().setFromPoints(ROI.jordan[0][0]).getCenter(v3()).setY(0);
  const VIEWS: View[] = [
    view([24, 15, 30], [1, 2.4, 0], ROI.building, false),
    view([16, 15, 24], [2, 1.5, 2], ROI.open),
    view([jordanC.x - 40, 620, jordanC.z + 560], [jordanC.x, 0, jordanC.z], ROI.jordan, false),
    view([3, 24, 27], [0, 1.5, 1], ROI.building),
    view([tealC.x + 6, 9, 15], [tealC.x, 1.8, tealC.z], ROI.teal),
    view([24, 8, 16], [12, 1.4, 0], ROI.ship),
    view([2, 30, 26], [-2, 0, 2], ROI.paid),
    view([27, 17, 21], [2, 2, 1], ROI.open, false),
  ];
  VIEWS[0].hero = true;
  VIEWS[2].minD = 0;

  interface Rect { l: number; r: number; t: number; b: number }
  let W = 1, H = 1, rtl = false, beside = true;
  let area: Rect = { l: 0, r: 0, t: 0, b: 0 }, fit: Rect = area, heroEdge = 0, heroTop = 0;
  let hudRect: DOMRect | null = null, hudOnRight = true;
  const fp = v3();
  function onScreen(pt: THREE.Vector3, padR: number, padT: number, avoidHud: boolean) {
    fp.copy(pt).project(camera);
    if (fp.z < -1 || fp.z > 1) return false;
    const x = (fp.x * 0.5 + 0.5) * W, y = (-fp.y * 0.5 + 0.5) * H;
    if (x < fit.l || x > fit.r - padR || y < fit.t + padT || y > fit.b) return false;
    if (!avoidHud || !hudRect || y < hudRect.top - 14) return true;
    return hudOnRight ? x < hudRect.left - 14 : x > hudRect.right + 14;
  }
  // The opening view keeps clear of the headline: beside it on wide screens, above the text card on phones.
  // On phones every other view lives in the top half, while the text cards scroll through the lower half.
  function rectFor(v: View): Rect {
    const r = { ...area };
    if (v.hero && W >= 1100) { if (rtl) r.r = Math.min(r.r, heroEdge - 24); else r.l = Math.max(r.l, heroEdge + 24); }
    if (!beside) r.b = v.hero ? Math.max(r.t + 140, heroTop - 16) : H * 0.5;
    return r;
  }
  const aim = (ox: number, oy: number) => camera.setViewOffset(W, H, -ox, -oy, W, H);
  // Aim at the centre of the view's free space, then find the nearest distance along its angle where
  // its whole subject fits (never closer than designed).
  function fitView(v: View) {
    fit = rectFor(v);
    v.ox = (fit.l + fit.r) / 2 - W / 2; v.oy = (fit.t + fit.b) / 2 - H / 2;
    aim(v.ox, v.oy);
    const fits = (D: number) => {
      camera.position.copy(v.target).addScaledVector(v.dir, D);
      camera.lookAt(v.target); camera.updateMatrixWorld();
      return v.roi.every(([pts, padR, padT]) => pts.every((pt) => onScreen(pt, padR, padT, v.hud)));
    };
    let lo = Math.max(1, v.minD * 0.5), hi = 5000;
    for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    v.pos.copy(v.target).addScaledVector(v.dir, Math.max(hi, v.minD));
  }
  const camTarget = v3(), camPos = v3(), tmp = v3();
  function placeCamera(T: number, now: number, mx: number, my: number) {
    const c = clamp(Math.floor(T + 0.2), 0, VIEWS.length - 1);
    const w = c === 0 ? 1 : smooth(prog(T, c - 0.2, c + 0.3));
    const from = VIEWS[Math.max(c - 1, 0)], to = VIEWS[c];
    camTarget.lerpVectors(from.target, to.target, w);
    aim(from.ox + (to.ox - from.ox) * w, from.oy + (to.oy - from.oy) * w);
    // Travel by distance ratio, so the zoom between warehouse and country feels even.
    const dFrom = from.pos.distanceTo(from.target), dTo = to.pos.distanceTo(to.target);
    const d = dFrom * Math.pow(dTo / dFrom, w);
    tmp.lerpVectors(from.dir, to.dir, w).normalize();
    camPos.copy(camTarget).addScaledVector(tmp, d);
    const a = (reduce ? 0 : Math.sin(now * 0.1) * 0.06) + mx * 0.12;
    tmp.subVectors(camPos, camTarget);
    const cos = Math.cos(a), sin = Math.sin(a);
    camPos.set(camTarget.x + tmp.x * cos - tmp.z * sin, camPos.y + my * d * 0.05, camTarget.z + tmp.x * sin + tmp.z * cos);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    return d;
  }

  // ---- pallets ----
  const out = v3(), ctrl = v3();
  function along(pts: THREE.Vector3[], u: number, o: THREE.Vector3) {
    const seg: number[] = [];
    let len = 0;
    for (let i = 1; i < pts.length; i++) { const d = pts[i].distanceTo(pts[i - 1]); seg.push(d); len += d; }
    let d = u * len;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) return o.lerpVectors(pts[i], pts[i + 1], clamp(d / (seg[i] || 1)));
      d -= seg[i];
    }
    return o.copy(pts[pts.length - 1]);
  }
  let booked = 0, hovered: Pallet | null = null;
  function placePallets(T: number, now: number) {
    booked = 0;
    const tx = truckX(T), ty = groundAt(tx);
    for (const p of pallets) {
      const s = p.slot.pos;
      let sx = 1, sy = 1, rotY = 0, hidden = false;
      p.hov += ((hovered === p ? 1 : 0) - p.hov) * 0.2;
      if (p.key === 'owner') {
        const k = reduce ? 1 : prog(now, p.delay, p.delay + 0.7);
        out.set(s.x, s.y + (1 - bounce(k)) * 2.5, s.z);
        hidden = k <= 0;
      } else {
        const f = prog(T, p.start, p.start + p.dur);
        const aisleZ = s.z + 2.0;
        if (f <= 0) hidden = true;
        else if (f < 0.5) { // drop into the aisle with a bounce, squashing on landing
          const land = f / 0.5, e = bounce(land);
          out.set(s.x + p.jx * (1 - e), 18 * (1 - e), aisleZ);
          rotY = p.spin * (1 - e);
          if (land > 0.35) { const q = Math.sin(Math.PI * clamp((land - 0.35) / 0.3)) * 0.22; sy = 1 - q; sx = 1 + q * 0.6; }
        } else if (f < 0.75) out.set(s.x, s.y * easeInOut((f - 0.5) / 0.25), aisleZ); // lift to its level
        else out.set(s.x, s.y, aisleZ + (s.z - aisleZ) * easeOut((f - 0.75) / 0.25)); // slide into the rack
        if (f >= 1) { out.copy(s); booked++; }
        if (p.ship >= 0 && f >= 1) {
          const u = prog(T, 5.2 + p.ship * 0.06, 5.52 + p.ship * 0.06);
          if (u > 0) {
            const aisle = ROWS[p.slot.r] + 1.95;
            const end = truckSlot(p.ship).add(v3(tx, ty, 0));
            along([s, v3(s.x, 0.02, aisle), v3(8.4, 0.02, aisle), v3(8.4, 0.02, 0), v3(x1 + 1, 0.45, 0), v3(DOCK_X - 0.5, 0.45, 0), end], u, out);
            if (u >= 1) out.copy(end);
            if (u > 0.4) booked--;
          }
        }
      }
      out.y += p.hov * 0.45;
      dummy.position.copy(out); dummy.rotation.set(0, rotY + p.hov * 0.15, 0);
      dummy.scale.set(hidden ? 1e-4 : sx, hidden ? 1e-4 : sy, hidden ? 1e-4 : sx);
      dummy.updateMatrix();
      groups[p.key].mesh.setMatrixAt(p.gi, dummy.matrix);
      bases.setMatrixAt(p.bi, dummy.matrix);
    }
    for (const k of keys) groups[k].mesh.instanceMatrix.needsUpdate = true;
    bases.instanceMatrix.needsUpdate = true;
    truck.position.set(tx, ty, 0);
    truck.visible = tx < 85;
    for (const w of wheels) w.rotation.z = -tx / 0.48;
  }

  function placeGhosts(T: number, now: number) {
    const appear = smooth(prog(T, 1.25, 1.6));
    for (const g of ghosts) {
      let o = appear;
      if (g.p) {
        o *= 1 - prog(T, g.p.start + g.p.dur * 0.75, g.p.start + g.p.dur);
        if (g.p.ship >= 0) o = Math.max(o, smooth(prog(T, 5.72, 5.92))); // shipped: the spot is free again
      }
      const breathe = reduce ? 1 : 0.75 + 0.25 * Math.sin(now * 2 + g.i * 0.8);
      (g.m.material as THREE.MeshStandardMaterial).opacity = o * 0.55 * breathe;
      g.m.scale.setScalar(0.9 + 0.1 * breathe);
      g.m.visible = o > 0.01;
    }
  }

  // Track chapter: everyone else fades so one business's stock stands out.
  function focusTeal(T: number, now: number) {
    const k = smooth(prog(T, 4.05, 4.3)) * (1 - smooth(prog(T, 4.85, 5.05)));
    for (const key of ['owner', 'violet', 'sun'] as const) groups[key].mat.opacity = 1 - 0.78 * k;
    const teal = groups.teal.mat;
    teal.emissive.copy(teal.color);
    teal.emissiveIntensity = k * (0.25 + (reduce ? 0 : 0.12 * Math.sin(now * 4)));
  }

  function placeCoins(T: number, now: number) {
    for (let i = 0; i < COINS; i++) {
      const st = 6.05 + i * 0.016, f = prog(T, st, st + 0.17);
      const src = coinSrc[(i * 7) % coinSrc.length].slot.pos;
      const [jx, jz, spin] = coinJit[i];
      const end = tmp.set(STACK.x + jx, STACK.y + 0.075 + i * 0.15, STACK.z + jz);
      if (f <= 0) { dummy.scale.setScalar(1e-4); dummy.position.copy(src); }
      else {
        const e = easeInOut(f), q = 1 - e;
        ctrl.set((src.x + end.x) / 2, Math.max(src.y, end.y) + 9, (src.z + end.z) / 2);
        dummy.position.set(q * q * src.x + 2 * q * e * ctrl.x + e * e * end.x, q * q * (src.y + 1.2) + 2 * q * e * ctrl.y + e * e * end.y, q * q * src.z + 2 * q * e * ctrl.z + e * e * end.z);
        dummy.scale.setScalar(1);
        dummy.rotation.set(q * (spin + now * 2), 0, q * 1.2);
      }
      dummy.updateMatrix(); coins.setMatrixAt(i, dummy.matrix);
    }
    coins.instanceMatrix.needsUpdate = true;
  }

  // Walls rise and the roof drops on when the page loads; in chapter 1 the roof lifts off and the walls fold open.
  const risers = [back, left, front, r1, r2, r3, band, bandR, sign, door, roll];
  function placeBuilding(T: number, now: number) {
    const intro = reduce ? 1 : easeBack(prog(now, 0.1, 0.8));
    const lotIn = reduce ? 1 : easeBack(prog(now, 0, 0.6));
    lot.scale.set(0.6 + 0.4 * lotIn, 1, 0.6 + 0.4 * lotIn);
    for (const m of risers) m.visible = intro > 0.02;
    for (const m of [back, left]) { m.scale.y = Math.max(intro, 1e-3); m.position.y = (BH / 2) * intro; }
    frontPivot.scale.y = rightPivot.scale.y = Math.max(intro, 1e-3);
    const roofIn = reduce ? 1 : bounce(prog(now, 0.6, 1.4));
    const lift = smooth(prog(T, 0.95, 1.4));
    roof.position.set(lift * -6, (1 - roofIn) * 14 + lift * 16, 0);
    roof.rotation.z = lift * 0.35;
    roofMat.opacity = skyMat.opacity = 1 - prog(T, 1.15, 1.45);
    roof.visible = roofMat.opacity > 0.01 && (reduce || now > 0.6);
    const fold = easeBack(prog(T, 1.05, 1.5));
    frontPivot.rotation.x = fold * (Math.PI / 2);
    rightPivot.rotation.z = -fold * (Math.PI / 2);
  }

  function placeClouds(now: number, m: number) {
    // Looking steeply down, clouds would sit between the camera and the scene: fade them, keep their shadows.
    const steep = (camera.position.y - camTarget.y) / Math.max(1e-3, camera.position.distanceTo(camTarget));
    cloudMat.opacity = 1 - smooth(prog(steep, 0.5, 0.68)) * (1 - m);
    const k = 1 + m * 16;
    for (const g of clouds.children) {
      const u = g.userData as { x: number; y: number; z: number; v: number };
      const x = ((u.x + (reduce ? 0 : now * u.v) + 60) % 120) - 60;
      g.position.set(x * k, u.y * (1 + m * 5), u.z * k);
      g.scale.setScalar(1 + m * 7);
    }
  }

  // ---- labels pinned to points in the scene ----
  interface Tag { el: HTMLElement; at: () => THREE.Vector3; win: [number, number]; space: 'wh' | 'world'; kind: 'pin' | 'city' | 'place'; h?: number; w?: number; shown?: boolean }
  const labelTop = (si: number) => slots[si].pos.clone().add(v3(0, 1.1, 0));
  const tags: Tag[] = [
    { el: el.tags.freeA, at: () => labelTop(labelSlots[0]), win: [1.38, 1.95], space: 'wh', kind: 'pin' },
    { el: el.tags.freeB, at: () => labelTop(labelSlots[1]), win: [1.45, 1.95], space: 'wh', kind: 'pin' },
    { el: el.tags.track, at: () => tealC.clone().setY(5.3), win: [4.15, 4.85], space: 'wh', kind: 'pin' },
    { el: el.tags.ship, at: () => v3(truck.position.x + 3.5, 3.4, 0), win: [5.22, 5.72], space: 'wh', kind: 'pin' },
    { el: el.tags.paid, at: () => STACK.clone().setY(STACK.y + 6), win: [6.45, 6.98], space: 'wh', kind: 'pin' },
    { el: el.seaTag, at: () => geo(DEAD_SEA_LABEL, GROUND_Y), win: [2.2, 2.85], space: 'world', kind: 'place' },
    ...towers.flatMap((t, i): Tag[] => {
      const tagEl = el.cityTags[t.city.id];
      return tagEl ? [{ el: tagEl, at: () => t.pos.clone().setY(GROUND_Y + t.grow * t.h + 5), win: [2.2 + i * 0.03, 2.85], space: 'world', kind: 'city' }] : [];
    }),
  ];
  const proj = v3();
  function placeTags(T: number) {
    const cityTags: { t: Tag; x: number; y: number }[] = [];
    for (const t of tags) {
      const [a, b] = t.win;
      const o = smooth(prog(T, a, a + 0.08)) * (1 - smooth(prog(T, b - 0.08, b)));
      if (o <= 0.01) { if (t.shown) { t.el.style.opacity = '0'; t.shown = false; } continue; }
      proj.copy(t.at());
      if (t.space === 'wh') proj.applyMatrix4(wh.matrixWorld);
      proj.project(camera);
      if (proj.z > 1) { t.el.style.opacity = '0'; continue; }
      const x = (proj.x * 0.5 + 0.5) * W, y = (-proj.y * 0.5 + 0.5) * H;
      if (!t.h) { t.h = t.el.offsetHeight; t.w = t.el.offsetWidth; }
      t.el.style.opacity = String(o); t.shown = true;
      if (t.kind === 'city') { cityTags.push({ t, x, y }); continue; }
      if (t.kind === 'place') { t.el.style.transform = `translate(${Math.round(x - t.w! / 2)}px, ${Math.round(y - t.h / 2)}px)`; continue; }
      const leftX = clamp(x - 18, 8, W - t.w! - 8);
      t.el.style.transform = `translate(${Math.round(leftX)}px, ${Math.round(y - t.h - 28)}px)`;
    }
    // City labels sit close together around Amman: stack any that would overlap, from the bottom up.
    cityTags.sort((p, q) => q.y - p.y);
    const placed: { l: number; r: number; t: number; b: number }[] = [];
    for (const { t, x, y } of cityTags) {
      const leftX = clamp(x - 18, 8, W - t.w! - 8);
      let top = y - t.h! - 16;
      for (let n = 0; n < 12; n++) {
        const hit = placed.find((r) => leftX < r.r + 6 && leftX + t.w! > r.l - 6 && top < r.b + 4 && top + t.h! > r.t - 4);
        if (!hit) break;
        top = hit.t - t.h! - 4;
      }
      placed.push({ l: leftX, r: leftX + t.w!, t: top, b: top + t.h! });
      t.el.style.setProperty('--lift', `${Math.max(0, y - top - t.h!)}px`);
      t.el.style.transform = `translate(${Math.round(leftX)}px, ${Math.round(top)}px)`;
    }
  }

  // ---- point at a pallet to see whose it is ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pickables = keys.map((k) => groups[k].mesh);
  let pointer: { x: number; y: number } | null = null;
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    targetMouse.x = e.clientX / W - 0.5; targetMouse.y = e.clientY / H - 0.5;
    const over = e.target instanceof Element && e.target.closest('[data-scene-ignore]');
    pointer = over ? null : { x: e.clientX, y: e.clientY };
  };
  const onLeave = () => { pointer = null; };
  function pick(m: number) {
    hovered = null;
    const hide = () => { el.hover.root.style.opacity = '0'; };
    if (!pointer || m > 0.05) return hide();
    ndc.set((pointer.x / W) * 2 - 1, -(pointer.y / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (!hit || hit.instanceId == null) return hide();
    const key = hit.object.userData.key as GroupKey;
    const p = groups[key].byInstance[hit.instanceId];
    if (!p) return hide();
    hovered = p;
    const text = cb.describe(key, { row: p.slot.r, bay: p.slot.b, level: p.slot.l });
    el.hover.name.textContent = text.name;
    el.hover.where.textContent = text.where;
    el.hover.dot.style.background = GROUP_COLORS[key];
    const w = el.hover.root.offsetWidth, h = el.hover.root.offsetHeight;
    el.hover.root.style.transform = `translate(${Math.round(clamp(pointer.x - 18, 8, W - w - 8))}px, ${Math.round(pointer.y - h - 34)}px)`;
    el.hover.root.style.opacity = '1';
  }

  // ===================================================================================
  //  Light and sky: morning → golden hour → dusk as the story goes on; a night version for dark mode.
  // ===================================================================================
  type Key3 = [number, string, string];
  type SunKey = [number, string, number];
  interface Theme {
    sky: Key3[]; sun: SunKey[]; hemi: [string, string, number];
    ground: string; sand: string; side: string; lot: string; floor: string; wall: string; roof: string; cloud: string; house: string; owner: string; lamp: number;
  }
  const THEMES: Record<'light' | 'dark', Theme> = {
    light: {
      sky: [[0, '#dcecf1', '#eef3ef'], [2, '#d2e6ef', '#eaf1ee'], [4, '#dfecef', '#f1f2ec'], [6, '#f5e1cc', '#f8eee3'], [7, '#e6dcf0', '#f6e6db']],
      sun: [[0, '#fff1de', 3.4], [4, '#fff6ea', 3.4], [6, '#ffd2a3', 3.1], [7, '#f7c0b6', 2.8]],
      hemi: ['#f4f8ff', '#cdb38a', 1.6], ground: '#e2e8e6', sand: '#e8cc98', side: '#d2b07c', lot: '#d9e0e0', floor: '#eef1f1', wall: '#f8f8f5',
      roof: '#dfe8ea', cloud: '#ffffff', house: '#fbfbf8', owner: '#c3ccd1', lamp: 0,
    },
    dark: {
      sky: [[0, '#0e1522', '#1a2232'], [4, '#101827', '#1c2436'], [7, '#17162c', '#2a2237']],
      sun: [[0, '#b7c4ff', 1.5], [7, '#d2b0ff', 1.3]],
      hemi: ['#8ea2c9', '#2a2a33', 1.3], ground: '#121a26', sand: '#5a5042', side: '#463e33', lot: '#353d47', floor: '#3c4550', wall: '#4a535e',
      roof: '#3a434e', cloud: '#4a5468', house: '#5b6572', owner: '#7d8b96', lamp: 60,
    },
  };
  let theme = THEMES.light;
  let lastSky = '';
  function applyTheme() {
    theme = document.documentElement.dataset.theme === 'dark' ? THEMES.dark : THEMES.light;
    groundMat.color.set(theme.ground); sandMat.color.set(theme.sand); sandSideMat.color.set(theme.side);
    lotMat.color.set(theme.lot); floorMat.color.set(theme.floor); wallMat.color.set(theme.wall);
    roofMat.color.set(theme.roof); cloudMat.color.set(theme.cloud); houseMat.color.set(theme.house);
    groups.owner.mat.color.set(theme.owner);
    hemi.color.set(theme.hemi[0]); hemi.groundColor.set(theme.hemi[1]); hemi.intensity = theme.hemi[2];
    for (const l of lamps) l.intensity = theme.lamp;
    lastSky = '';
  }
  const themeWatch = new MutationObserver(applyTheme);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  applyTheme();
  const cA = new THREE.Color(), cB = new THREE.Color(), cOut = new THREE.Color();
  function sampleColor(keysIn: (Key3 | SunKey)[], T: number, idx: 1 | 2) {
    let i = 0; while (i < keysIn.length - 1 && T > keysIn[i + 1][0]) i++;
    const k0 = keysIn[i], k1 = keysIn[Math.min(i + 1, keysIn.length - 1)];
    const w = k1 === k0 ? 0 : clamp((T - k0[0]) / (k1[0] - k0[0]));
    return cOut.copy(cA.set(k0[idx] as string)).lerp(cB.set(k1[idx] as string), w);
  }
  function sampleNumber(keysIn: SunKey[], T: number) {
    let i = 0; while (i < keysIn.length - 1 && T > keysIn[i + 1][0]) i++;
    const k0 = keysIn[i], k1 = keysIn[Math.min(i + 1, keysIn.length - 1)];
    const w = k1 === k0 ? 0 : clamp((T - k0[0]) / (k1[0] - k0[0]));
    return k0[2] + (k1[2] - k0[2]) * w;
  }
  function placeSky(T: number) {
    const top = '#' + sampleColor(theme.sky, T, 1).getHexString();
    const bot = sampleColor(theme.sky, T, 2);
    const botHex = '#' + bot.getHexString();
    fog.color.copy(bot);
    if (top + botHex !== lastSky) {
      lastSky = top + botHex;
      el.root.style.setProperty('--ld-sky-top', top);
      el.root.style.setProperty('--ld-sky-bot', botHex);
    }
    sun.color.copy(sampleColor(theme.sun, T, 1));
    sun.intensity = sampleNumber(theme.sun, T);
  }

  // ===================================================================================
  //  Story clock, layout, and the frame loop.
  // ===================================================================================
  let marks: number[] = [];
  function measure() {
    marks = el.chapters.map((c, i) => (i === 0 ? 0 : c.getBoundingClientRect().top + scrollY - innerHeight * 0.5));
  }
  function storyT() {
    const y = scrollY, n = marks.length;
    for (let i = n - 1; i >= 0; i--) {
      if (y >= marks[i]) {
        const next = i < n - 1 ? marks[i + 1] : marks[i] + innerHeight * 0.5;
        return Math.min(n - 0.001, i + (y - marks[i]) / Math.max(1, next - marks[i]));
      }
    }
    return 0;
  }

  function relayout() {
    W = innerWidth; H = innerHeight;
    rtl = document.documentElement.dir === 'rtl';
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = W < H ? 54 : 36;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    measure();
    // Free space: beside the text column (left of it in Arabic), below the top bar.
    const panel = el.panel.getBoundingClientRect();
    beside = W >= 700;
    area = beside ? (rtl ? { l: 20, r: panel.left - 28, t: 84, b: H - 24 } : { l: panel.right + 28, r: W - 20, t: 84, b: H - 24 }) : { l: 16, r: W - 16, t: 84, b: H - 24 };
    const hud = el.hud.getBoundingClientRect();
    hudRect = hud.width > 0 ? hud : null; // hidden on phones
    hudOnRight = hud.left + hud.width / 2 > W / 2;
    const heroRects = el.heroText.map((e) => e.getBoundingClientRect());
    heroEdge = rtl ? Math.min(...heroRects.map((r) => r.left)) : Math.max(...heroRects.map((r) => r.right));
    heroTop = Math.min(...heroRects.map((r) => r.top + scrollY)) - 22; // the text card's padding on phones
    wh.scale.setScalar(1); wh.updateMatrixWorld();
    VIEWS.forEach(fitView);
    for (const t of tags) t.h = 0;
  }

  const targetMouse = { x: 0, y: 0 }, mouse = { x: 0, y: 0 };
  addEventListener('resize', relayout);
  addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  relayout();

  let Ts = storyT(), last = performance.now(), racksDone = false, chapter = -1, lastBooked = -1, raf = 0;
  const t0 = last;
  function frame(nowMs: number) {
    const dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs;
    const now = (nowMs - t0) / 1000;
    const Tt = storyT();
    Ts = reduce ? Tt : Ts + (Tt - Ts) * (1 - Math.exp(-dt * 6));
    if (Math.abs(Tt - Ts) < 1e-4) Ts = Tt;
    if (!reduce) { mouse.x += (targetMouse.x - mouse.x) * 0.05; mouse.y += (targetMouse.y - mouse.y) * 0.05; }

    const m = mapAmount(Ts);
    wh.scale.setScalar(1 - 0.82 * m);
    wh.updateMatrixWorld();
    if (!racksDone) { placeRacks(reduce ? 99 : now); racksDone = reduce || now > 2; }
    placeBuilding(Ts, now);
    placePallets(Ts, now);
    placeGhosts(Ts, now);
    focusTeal(Ts, now);
    placeCoins(Ts, now);
    placeMap(Ts, now, m);
    placeClouds(now, m);
    placeSky(Ts);
    const dist = placeCamera(Ts, now, mouse.x, mouse.y);
    fog.density = 0.3 / Math.max(dist, 20);
    // The sun's shadow follows what the camera looks at, sized to the view.
    const span = clamp(dist * 0.8, 30, 1100);
    sun.position.copy(camTarget).addScaledVector(SUN_DIR, span * 2);
    sun.target.position.copy(camTarget); sun.target.updateMatrixWorld();
    const sc = sun.shadow.camera;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = span * 5; sc.updateProjectionMatrix();

    pick(m);
    placeTags(Ts);
    // The readout appears once the warehouse opens; it steps aside for the map and the closing section.
    el.hud.classList.toggle('away', Ts < 0.75 || (Ts > 1.8 && Ts < 3.15) || Ts > 6.85);
    if (booked !== lastBooked) { lastBooked = booked; cb.onBooked(booked); }
    const ch = Math.floor(Ts + 0.3);
    if (ch !== chapter) { chapter = ch; cb.onChapter(ch); }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    setHotCity: (id) => { hotCity = id; },
    relayout,
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      removeEventListener('resize', relayout);
      removeEventListener('pointermove', onPointer);
      document.removeEventListener('pointerleave', onLeave);
      themeWatch.disconnect();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const mat of mats) mat.dispose();
      });
      signTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
