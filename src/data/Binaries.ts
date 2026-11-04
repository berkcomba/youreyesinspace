import { isPair, semiMajorAU, type NodeSpec } from '../gen/Multiplicity';
import type { StarInfo } from './StarCatalog';

/**
 * Measured multiple stars keyed by Hipparcos number (public/data/binaries.json, written by
 * scripts/build-binaries.mjs): the hierarchies of Tokovinin's Multiple Star Catalogue and the
 * visual orbits of the USNO Sixth Orbit Catalogue.
 */

/** ORB6 binary: period (days), e, V2 − V1 (null: unknown), a (arcsec, 0: unknown), preliminary */
type Orb6Entry = { orb: [number, number, number | null, number, 0 | 1] };
type BinaryEntry = NodeSpec | Orb6Entry;

export interface BinaryData {
  sources: Record<string, string>;
  systems: Record<string, BinaryEntry>;
}

export async function loadBinaries(baseUrl: string): Promise<BinaryData> {
  const res = await fetch(`${baseUrl}data/binaries.json?v=${__BUILD_ID__}`);
  if (!res.ok) throw new Error(`binaries.json: ${res.status}`);
  return res.json() as Promise<BinaryData>;
}

const isOrb6 = (e: BinaryEntry): e is Orb6Entry => typeof e === 'object' && 'orb' in e;

function treeMass(n: NodeSpec, primaryMass: number): number {
  if (n === 'primary') return primaryMass;
  if (isPair(n)) return treeMass(n.pair[0], primaryMass) + treeMass(n.pair[1], primaryMass);
  return n.massSolar;
}

function holdsPrimary(n: NodeSpec): boolean {
  return n === 'primary' || (isPair(n) && (holdsPrimary(n.pair[0]) || holdsPrimary(n.pair[1])));
}

/**
 * The measured hierarchy of a catalogue star, or null. Levels wider than a third of the distance to
 * the nearest other catalogue star are dropped: that neighbour is the companion, listed on its own.
 */
export function measuredMultiple(entry: BinaryEntry, star: StarInfo, neighbourPc: number | null): NodeSpec | null {
  let tree: NodeSpec;
  if (isOrb6(entry)) {
    const [periodDays, e, dv, aArcsec, preliminary] = entry.orb;
    const m1 = star.massSolar;
    let m2: number;
    // main sequence: L ∝ M⁴ → ΔV ≈ 10 log q; else the dynamical mass from a, P and the distance
    if (dv !== null) m2 = m1 * Math.pow(10, -0.1 * Math.max(0, dv));
    else if (aArcsec > 0) {
      const aAU = aArcsec * star.distancePc, pYr = periodDays / 365.25;
      m2 = (aAU * aAU * aAU) / (pYr * pYr) - m1;
    } else m2 = 0.5 * m1;
    m2 = Math.min(Math.max(m2, 0.08), m1);
    tree = { pair: ['primary', { kind: 'ms', massSolar: m2 }], periodDays, e, uncertain: preliminary === 1 };
  } else tree = entry;

  if (neighbourPc !== null) {
    while (isPair(tree)) {
      const aPc = semiMajorAU(tree.periodDays, treeMass(tree, star.massSolar)) / 206_265;
      if (aPc * 3 < neighbourPc) break;
      tree = holdsPrimary(tree.pair[0]) ? tree.pair[0] : tree.pair[1];
    }
  }
  return isPair(tree) ? tree : null;
}
