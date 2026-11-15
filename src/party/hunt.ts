import type { Vector3 } from 'three';
import { PARSEC_KM } from '../core/constants';
import type { CelestialBody } from '../core/CelestialBody';
import type { Universe } from '../core/Universe';
import type { HuntTarget } from './protocol';

export const HUNT_LABELS: Record<HuntTarget, string> = {
  ringed: 'Halkalı bir dev gezegen',
  life: 'Güneş Sistemi dışında canlılık barındıran bir dünya',
  ocean: 'Güneş Sistemi dışında okyanuslu bir dünya',
  lava: 'Lav ya da volkan dünyası',
  geyser: 'Buz gayzerleri fışkıran bir dünya',
  'moon-land': 'Bir uydunun yüzeyine in',
  'exo-land': 'Güneş Sistemi dışında bir gezegene in',
  'red-dwarf': 'Bir kırmızı cüce sistemi',
  'blue-star': 'Sıcak, mavi bir yıldız',
  'white-dwarf': 'Bir beyaz cüce',
  'giant-star': 'Dev bir yıldız',
  binary: 'Çift (ya da çoklu) yıldız sistemi',
  blackhole: 'Bir kara delik',
  pulsar: 'Bir pulsar',
  nebula: 'Bir bulutsunun içi',
  cluster: 'Bir yıldız kümesinin içi',
  far: 'Güneş’ten 1000 ışık yılı öteye git',
  galaxy: 'Başka bir galaksi',
  comet: 'Bir kuyruklu yıldız',
  saturn: 'Satürn’ün halkaları',
};

/** what a round needs to know about where the player is */
export interface HuntWorld {
  universe: Universe;
  /** camera position, current frame (km) */
  cam: Vector3;
  /** camera position, parsecs from the Sun */
  pc: Vector3;
  landed: CelestialBody | null;
  landmark: { kind: string; name: string } | null;
}

const AU_KM = 1.495978707e8;
const SUN_RADIUS_KM = 695_700;

const near = (w: HuntWorld, b: CelestialBody, radii: number, minKm = 0): boolean =>
  w.cam.distanceTo(b.position) < Math.max(b.radius * radii, minKm);

const temperature = (b: CelestialBody): number => (b.data.appearance.kind === 'star' ? b.data.appearance.temperature : NaN);

/** the name of what the player has found for the round's target, or null while they have not */
export function huntCheck(t: HuntTarget, w: HuntWorld): string | null {
  const u = w.universe;
  const sys = u.current;
  const home = sys.starId === 'c0';
  const bodies = sys.bodies;
  const stars = bodies.filter((b) => b.data.type === 'star');
  const first = (ok: (b: CelestialBody) => boolean): string | null => bodies.find(ok)?.name ?? null;
  // "in" a star's system: within ~100 AU of one of its stars
  const starNear = (ok: (b: CelestialBody) => boolean): string | null =>
    stars.find((s) => ok(s) && w.cam.distanceTo(s.position) < 100 * AU_KM)?.name ?? null;
  switch (t) {
    case 'ringed':
      return first((b) => !!b.data.rings && b.data.appearance.kind === 'gas' && near(w, b, 40));
    case 'life':
      return home ? null : first((b) => b.data.appearance.kind === 'terrestrial' && !!(b.data.appearance.life || b.data.appearance.cityLights) && near(w, b, 40));
    case 'ocean':
      return home ? null : first((b) => b.data.appearance.kind === 'terrestrial' && b.data.appearance.seaLevel !== undefined && near(w, b, 40));
    case 'lava':
      return first((b) => b.data.appearance.kind === 'terrestrial' && (b.data.appearance.style === 'lava' || !!b.data.appearance.volcanic || b.data.activity?.kind === 'volcanic') && near(w, b, 40));
    case 'geyser':
      return first((b) => b.data.activity?.kind === 'cryo' && near(w, b, 40));
    case 'moon-land':
      return w.landed?.data.type === 'moon' ? w.landed.name : null;
    case 'exo-land':
      return !home && w.landed && w.landed.data.type !== 'moon' ? w.landed.name : null;
    case 'red-dwarf':
      return starNear((s) => temperature(s) < 3900 && s.radius < 0.7 * SUN_RADIUS_KM);
    case 'blue-star':
      return starNear((s) => temperature(s) > 10_000 && s.radius > 30_000);
    case 'white-dwarf':
      return starNear((s) => s.radius < 30_000 && temperature(s) > 4000);
    case 'giant-star':
      return starNear((s) => s.radius > 10 * SUN_RADIUS_KM);
    case 'binary':
      return stars.length >= 2 ? starNear(() => true) : null;
    case 'blackhole':
      return first((b) => b.data.type === 'blackhole' && near(w, b, 1e6, 1e8));
    case 'pulsar':
      return first((b) => b.data.type === 'pulsar' && near(w, b, 1e6, 1e8));
    case 'comet':
      return first((b) => b.data.type === 'comet' && near(w, b, 1e4, 1e6));
    case 'saturn':
      return home ? first((b) => b.id === 'saturn' && near(w, b, 5)) : null;
    case 'nebula':
      return w.landmark && (w.landmark.kind === 'nebula' || w.landmark.kind === 'remnant' || w.landmark.kind === 'planetary') ? w.landmark.name : null;
    case 'cluster':
      return w.landmark && (w.landmark.kind === 'cluster' || w.landmark.kind === 'globular') ? w.landmark.name : null;
    case 'far': {
      const ly = (w.pc.length() * PARSEC_KM) / 9.4607304725808e12;
      return ly > 1000 ? `${Math.round(ly).toLocaleString()} ly` : null;
    }
    case 'galaxy':
      return u.currentGalaxy !== null && u.currentGalaxy !== 0 ? u.galaxies.name(u.currentGalaxy) : null;
  }
}
