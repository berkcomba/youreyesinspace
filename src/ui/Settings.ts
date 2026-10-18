export interface Settings {
  orbits: boolean;
  moonOrbits: boolean;
  labels: boolean;
  markers: boolean;
  /** the Sun marked on the sky with its distance (and a compass when off-screen) once we have left the planets */
  sunMarker: boolean;
  starNames: boolean;
  galaxyNames: boolean;
  /** camera distance appended to labels ("Mars · 1.2 AU", "Sirius · 8.6 ly") */
  distances: boolean;
  galaxies: boolean;
  eclipticGrid: boolean;
  equatorialGrid: boolean;
  atmospheres: boolean;
  clouds: boolean;
  rings: boolean;
  shadows: boolean;
  /** NASA satellite imagery on Earth / Moon / Mars (streamed) */
  imagery: boolean;
  belts: boolean;
  milkyWay: boolean;
  /** generated content beyond the catalogues: procedural stars, galaxies and the far cosmic web */
  procedural: boolean;
  /** labels on generated stars ("YE 6LCRMG"); the dots stay clickable without them */
  proceduralNames: boolean;
  /** tint procedurally generated stars / galaxies green so they can be told from catalogue objects */
  highlightProcedural: boolean;
  bloom: boolean;
  /** render resolution relative to the (capped) device pixel ratio */
  renderScale: number;
  fov: number;
  exposure: number;
  mouseSensitivity: number;
  invertY: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  orbits: true,
  moonOrbits: true,
  labels: true,
  markers: true,
  sunMarker: true,
  starNames: false,
  galaxyNames: true,
  distances: false,
  galaxies: true,
  eclipticGrid: false,
  equatorialGrid: false,
  atmospheres: true,
  clouds: true,
  rings: true,
  shadows: true,
  imagery: true,
  belts: true,
  milkyWay: true,
  procedural: true,
  proceduralNames: false,
  highlightProcedural: true,
  bloom: true,
  renderScale: 1,
  fov: 50,
  exposure: 1.0,
  mouseSensitivity: 1.0,
  invertY: false,
};

const KEY = 'yeits.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
