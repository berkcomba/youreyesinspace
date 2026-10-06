import {
  BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry,
} from 'three';
import type { ProceduralShip } from '../data/ships';

/**
 * Original, primitive-built stand-ins for fictional vehicles (no third-party meshes).
 * Models are built with +Y as the direction of flight (the renderer points +Y along velocity)
 * and roughly unit size; the caller rescales them to the body's bounding radius.
 */
const hull = (c: number, metal = 0.55, rough = 0.5) => new MeshStandardMaterial({ color: c, metalness: metal, roughness: rough });
const glow = (rgb: [number, number, number], k = 2.5) => new MeshStandardMaterial({
  color: 0x000000, emissive: new Color(rgb[0], rgb[1], rgb[2]), emissiveIntensity: k, metalness: 0, roughness: 1,
});

function add(g: Group, m: Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): Mesh {
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  g.add(m);
  return m;
}

function saucer(glowRgb: [number, number, number]): Group {
  const g = new Group();
  const light = hull(0xcfd4dc, 0.6, 0.45);
  const dark = hull(0x8d939c, 0.7, 0.4);
  // primary hull (saucer), forward (+Y)
  add(g, new Mesh(new CylinderGeometry(1.0, 1.0, 0.16, 48), light), 0, 0.9, 0, Math.PI / 2, 0, 0).scale.set(1, 1, 0.8);
  add(g, new Mesh(new SphereGeometry(0.42, 32, 16), light), 0, 0.9, 0.06).scale.set(1, 1, 0.45);
  add(g, new Mesh(new CylinderGeometry(0.22, 0.22, 0.1, 24), dark), 0, 0.9, 0.15, Math.PI / 2, 0, 0);
  // neck
  add(g, new Mesh(new BoxGeometry(0.22, 0.7, 0.5), dark), 0, 0.15, -0.45, 0.6, 0, 0);
  // secondary (engineering) hull
  add(g, new Mesh(new CylinderGeometry(0.28, 0.34, 1.7, 32), light), 0, -0.55, -0.85);
  add(g, new Mesh(new SphereGeometry(0.28, 24, 12), light), 0, 0.3, -0.85);
  add(g, new Mesh(new SphereGeometry(0.33, 24, 12), glow([0.3, 0.7, 1.0], 1.6)), 0, 0.3, -0.85).scale.set(0.75, 0.75, 0.75);
  // pylons + nacelles
  for (const side of [-1, 1]) {
    add(g, new Mesh(new BoxGeometry(0.08, 0.5, 0.9), dark), side * 0.55, -0.7, -0.5, 0.75, 0, side * 0.55);
    const nac = add(g, new Mesh(new CylinderGeometry(0.17, 0.2, 1.9, 24), light), side * 1.05, -0.35, -0.1);
    nac.rotation.set(0, 0, 0);
    add(g, new Mesh(new CylinderGeometry(0.19, 0.19, 1.1, 24), glow(glowRgb, 2.2)), side * 1.05 + side * 0.03, -0.35, -0.1).scale.set(0.5, 1, 0.5);
    add(g, new Mesh(new SphereGeometry(0.18, 20, 10), glow([1.0, 0.25, 0.15], 2.5)), side * 1.05, 0.6, -0.1).scale.set(0.9, 0.6, 0.9);
  }
  return g;
}

function freighter(glowRgb: [number, number, number]): Group {
  const g = new Group();
  const grey = hull(0xb6b9bd, 0.5, 0.6);
  const dark = hull(0x6b6f74, 0.6, 0.5);
  const disc = add(g, new Mesh(new CylinderGeometry(1.0, 1.0, 0.28, 40), grey), 0, 0, 0, Math.PI / 2, 0, 0);
  disc.scale.set(1, 1, 0.9);
  // mandibles (forward)
  for (const side of [-1, 1]) add(g, new Mesh(new BoxGeometry(0.34, 0.9, 0.24), grey), side * 0.3, 1.1, 0);
  // cockpit tube (starboard)
  add(g, new Mesh(new CylinderGeometry(0.16, 0.2, 0.7, 20), dark), 0.78, 0.55, 0.05, 0, 0, 0);
  add(g, new Mesh(new SphereGeometry(0.17, 20, 12), hull(0x202830, 0.2, 0.3)), 0.78, 0.92, 0.05);
  // radar dish
  add(g, new Mesh(new CylinderGeometry(0.22, 0.05, 0.1, 20), dark), 0.1, 0.05, 0.3, 0.3, 0, 0);
  // engine strip (aft)
  add(g, new Mesh(new BoxGeometry(1.4, 0.08, 0.12), glow(glowRgb, 2.4)), 0, -0.98, 0);
  // greebles
  add(g, new Mesh(new TorusGeometry(0.5, 0.03, 8, 40), dark), 0, 0, 0.14, 0, 0, 0);
  return g;
}

function xwing(glowRgb: [number, number, number]): Group {
  const g = new Group();
  const white = hull(0xdcdcdc, 0.3, 0.6);
  const red = hull(0xb0302a, 0.3, 0.6);
  const dark = hull(0x50555c, 0.6, 0.5);
  add(g, new Mesh(new CylinderGeometry(0.18, 0.1, 2.0, 16), white), 0, 0.1, 0);
  add(g, new Mesh(new ConeGeometry(0.1, 0.5, 16), white), 0, 1.35, 0);
  add(g, new Mesh(new SphereGeometry(0.17, 16, 10), hull(0x202830, 0.2, 0.3)), 0, 0.35, 0.1);
  add(g, new Mesh(new SphereGeometry(0.1, 12, 8), dark), 0, -0.1, 0.17); // astromech
  const spread = 0.42; // half opening of the X (rad)
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    // outward direction of this wing in the XZ plane (Y = forward)
    const dx = sx * Math.cos(spread), dz = sz * Math.sin(spread);
    const phi = -Math.atan2(dz, dx); // rotation about Y that maps +X onto (dx, 0, dz)
    add(g, new Mesh(new BoxGeometry(1.1, 0.5, 0.03), white), dx * 0.62, -0.4, dz * 0.62, 0, phi, 0);
    add(g, new Mesh(new CylinderGeometry(0.09, 0.09, 0.7, 12), dark), dx * 0.3, -0.4, dz * 0.3);
    add(g, new Mesh(new CylinderGeometry(0.08, 0.08, 0.08, 12), glow(glowRgb, 2.4)), dx * 0.3, -0.78, dz * 0.3);
    add(g, new Mesh(new CylinderGeometry(0.025, 0.025, 1.4, 8), red), dx * 1.12, 0.0, dz * 1.12);
  }
  return g;
}

function corvette(glowRgb: [number, number, number]): Group {
  const g = new Group();
  const plate = hull(0x6f7a86, 0.65, 0.45);
  const dark = hull(0x3b434c, 0.7, 0.45);
  add(g, new Mesh(new CylinderGeometry(0.42, 0.5, 2.2, 6), plate), 0, 0.1, 0);
  add(g, new Mesh(new ConeGeometry(0.42, 0.6, 6), plate), 0, 1.5, 0);
  add(g, new Mesh(new CylinderGeometry(0.35, 0.55, 0.5, 6), dark), 0, -1.25, 0);
  add(g, new Mesh(new CylinderGeometry(0.3, 0.3, 0.12, 24), glow(glowRgb, 3)), 0, -1.55, 0);
  // PDC turrets & railgun
  for (const [x, z] of [[0.45, 0.2], [-0.45, 0.2], [0.45, -0.3], [-0.45, -0.3]]) add(g, new Mesh(new SphereGeometry(0.08, 10, 8), dark), x, 0.3, z);
  add(g, new Mesh(new BoxGeometry(0.1, 1.4, 0.1), dark), 0, 0.5, 0.45);
  return g;
}

function capsule(glowRgb: [number, number, number]): Group {
  const g = new Group();
  const white = hull(0xe8e8e8, 0.3, 0.55);
  const dark = hull(0x2f353c, 0.6, 0.5);
  const panel = hull(0x1d2f66, 0.4, 0.4);
  add(g, new Mesh(new ConeGeometry(0.55, 0.9, 32), white), 0, 0.85, 0); // crew module
  add(g, new Mesh(new CylinderGeometry(0.55, 0.55, 0.12, 32), dark), 0, 0.34, 0); // heat shield ring
  add(g, new Mesh(new CylinderGeometry(0.45, 0.45, 0.9, 32), white), 0, -0.2, 0); // service module
  add(g, new Mesh(new ConeGeometry(0.2, 0.3, 24), dark), 0, -0.8, 0, Math.PI, 0, 0); // engine
  add(g, new Mesh(new CylinderGeometry(0.12, 0.12, 0.06, 16), glow(glowRgb, 1.5)), 0, -0.95, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const p = add(g, new Mesh(new BoxGeometry(1.3, 0.3, 0.02), panel), Math.cos(a) * 1.1, -0.25, Math.sin(a) * 1.1);
    p.rotation.set(0, -a, 0);
  }
  return g;
}

function rocket(glowRgb: [number, number, number]): Group {
  const g = new Group();
  const steel = hull(0xc9cbd0, 0.9, 0.3);
  const tile = hull(0x23272c, 0.4, 0.7);
  const body = add(g, new Mesh(new CylinderGeometry(0.3, 0.3, 2.4, 32), steel), 0, 0, 0);
  void body;
  add(g, new Mesh(new ConeGeometry(0.3, 0.9, 32), steel), 0, 1.65, 0);
  add(g, new Mesh(new BoxGeometry(0.62, 2.2, 0.08), tile), 0, 0.1, 0.27); // belly heat shield (one side)
  for (const side of [-1, 1]) {
    add(g, new Mesh(new BoxGeometry(0.5, 0.5, 0.06), steel), side * 0.45, -0.95, 0.1, 0, 0, side * 0.5);
    add(g, new Mesh(new BoxGeometry(0.35, 0.35, 0.05), steel), side * 0.38, 1.55, 0.1, 0, 0, side * 0.4);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(g, new Mesh(new ConeGeometry(0.09, 0.2, 16), tile), Math.cos(a) * 0.14, -1.28, Math.sin(a) * 0.14, Math.PI, 0, 0);
    add(g, new Mesh(new CylinderGeometry(0.07, 0.07, 0.04, 12), glow(glowRgb, 2)), Math.cos(a) * 0.14, -1.39, Math.sin(a) * 0.14);
  }
  return g;
}

export function buildProceduralShip(shape: ProceduralShip, glowRgb: [number, number, number] = [0.4, 0.75, 1]): Group {
  switch (shape) {
    case 'saucer': return saucer(glowRgb);
    case 'freighter': return freighter(glowRgb);
    case 'xwing': return xwing(glowRgb);
    case 'corvette': return corvette(glowRgb);
    case 'capsule': return capsule(glowRgb);
    case 'rocket': return rocket(glowRgb);
  }
}

export function disposeGroup(g: Group): void {
  g.traverse((o) => {
    const m = o as Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
