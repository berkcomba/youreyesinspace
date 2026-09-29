import { BufferAttribute, BufferGeometry, Color, LineBasicMaterial, LineSegments, Scene, Vector3 } from 'three';
import { OBLIQUITY_J2000, SKY_RADIUS_KM } from '../core/constants';
import { lonLatToScene } from '../math/frames';

const R = SKY_RADIUS_KM * 0.5;

function buildGrid(color: Color, opacity: number, tiltRad: number): LineSegments {
  const verts: number[] = [];
  const v = new Vector3();
  const push = (lon: number, lat: number) => {
    lonLatToScene(lon, lat, v);
    if (tiltRad !== 0) {
      // rotate ecliptic → equatorial about the scene X axis (vernal equinox)
      const y = v.y * Math.cos(tiltRad) - v.z * Math.sin(tiltRad);
      const z = v.y * Math.sin(tiltRad) + v.z * Math.cos(tiltRad);
      v.y = y; v.z = z;
    }
    verts.push(v.x * R, v.y * R, v.z * R);
  };
  // meridians
  for (let lon = 0; lon < 360; lon += 15) {
    for (let lat = -90; lat < 90; lat += 2) {
      push(lon, lat); push(lon, lat + 2);
    }
  }
  // parallels
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lon = 0; lon < 360; lon += 2) {
      push(lon, lat); push(lon + 2, lat);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  const mat = new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const ls = new LineSegments(geo, mat);
  ls.frustumCulled = false;
  ls.renderOrder = -8;
  return ls;
}

function buildPlaneLine(color: Color, opacity: number, tiltRad: number): LineSegments {
  const verts: number[] = [];
  const v = new Vector3();
  for (let lon = 0; lon < 360; lon += 1) {
    for (const l of [lon, lon + 1]) {
      lonLatToScene(l, 0, v);
      if (tiltRad !== 0) {
        const y = v.y * Math.cos(tiltRad) - v.z * Math.sin(tiltRad);
        const z = v.y * Math.sin(tiltRad) + v.z * Math.cos(tiltRad);
        v.y = y; v.z = z;
      }
      verts.push(v.x * R, v.y * R, v.z * R);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  const ls = new LineSegments(geo, new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  ls.frustumCulled = false;
  ls.renderOrder = -8;
  return ls;
}

/** Celestial reference grids drawn on the sky sphere around the camera. */
export class SkyGrid {
  readonly ecliptic: LineSegments;
  readonly eclipticPlane: LineSegments;
  readonly equatorial: LineSegments;
  readonly equatorialPlane: LineSegments;

  constructor(scene: Scene) {
    this.ecliptic = buildGrid(new Color(0.35, 0.65, 0.95), 0.18, 0);
    this.eclipticPlane = buildPlaneLine(new Color(0.45, 0.8, 1.0), 0.5, 0);
    // Equatorial grid: rotate by -ε about the X axis (scene frame) so the pole aligns with Earth's axis
    this.equatorial = buildGrid(new Color(0.95, 0.6, 0.35), 0.18, -OBLIQUITY_J2000);
    this.equatorialPlane = buildPlaneLine(new Color(1.0, 0.7, 0.45), 0.5, -OBLIQUITY_J2000);
    scene.add(this.ecliptic, this.eclipticPlane, this.equatorial, this.equatorialPlane);
    this.setVisible(false, false);
  }

  setVisible(ecliptic: boolean, equatorial: boolean): void {
    this.ecliptic.visible = ecliptic;
    this.eclipticPlane.visible = ecliptic;
    this.equatorial.visible = equatorial;
    this.equatorialPlane.visible = equatorial;
  }
}