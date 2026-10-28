export interface Settings {
  /** clean view: every marker, label and name off the screen at once (N); the bodies stay clickable */
  cleanView: boolean;
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
  /** dwarf planets (with their moons) in the planetary system */
  dwarfs: boolean;
  /** asteroids and comets */
  minorBodies: boolean;
  /** human-made objects: probes, rovers, telescopes, stations */
  spacecraft: boolean;
  eclipticGrid: boolean;
  equatorialGrid: boolean;
  atmospheres: boolean;
  clouds: boolean;
  rings: boolean;
  /** boulder layer when flying through a ring system */
  ringParticles: boolean;
  shadows: boolean;
  /** close to a body, a soft lamp from the camera lifts the night side (0 = physical darkness, 1 = lit as in tours) */
  nightLight: number;
  /** lens flare and glare of the star in view */
  lensFlare: boolean;
  /** NASA satellite imagery on Earth / Moon / Mars (streamed) */
  imagery: boolean;
  belts: boolean;
  milkyWay: boolean;
  /** raymarched galaxies and nebulae (dust lanes, glowing gas); off: point clouds only */
  volumetrics: boolean;
  /** generated content beyond the catalogues: procedural stars, galaxies and the far cosmic web */
  procedural: boolean;
  /** labels on generated stars ("YE 6LCRMG"); the dots stay clickable without them */
  proceduralNames: boolean;
  /** tint procedurally generated stars / galaxies green so they can be told from catalogue objects */
  highlightProcedural: boolean;
  bloom: boolean;
  /** render resolution relative to the (capped) device pixel ratio */
  renderScale: number;
  /** drop the render resolution on its own while the frame rate is low, and bring it back when it recovers */
  autoResolution: boolean;
  fov: number;
  exposure: number;
  mouseSensitivity: number;
  invertY: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  cleanView: false,
  orbits: true,
  moonOrbits: true,
  labels: true,
  markers: true,
  sunMarker: true,
  starNames: false,
  galaxyNames: true,
  distances: false,
  galaxies: true,
  dwarfs: true,
  minorBodies: true,
  spacecraft: true,
  eclipticGrid: false,
  equatorialGrid: false,
  atmospheres: true,
  clouds: true,
  rings: true,
  ringParticles: true,
  shadows: true,
  nightLight: 0.12,
  lensFlare: true,
  imagery: true,
  belts: true,
  milkyWay: true,
  volumetrics: true,
  procedural: true,
  proceduralNames: false,
  highlightProcedural: true,
  bloom: true,
  renderScale: 1,
  autoResolution: true,
  fov: 50,
  exposure: 1.0,
  mouseSensitivity: 1.0,
  invertY: false,
};

export type GraphicsPreset = 'low' | 'medium' | 'high';
export const GRAPHICS_PRESET_ORDER: GraphicsPreset[] = ['low', 'medium', 'high'];

/** what is on screen is the same at every level; the levels differ in rendering cost */
const PRESET_DISPLAY: Partial<Settings> = {
  cleanView: false,
  orbits: false,
  moonOrbits: false,
  labels: true,
  markers: false,
  sunMarker: false,
  starNames: true,
  galaxyNames: true,
  distances: false,
  eclipticGrid: false,
  equatorialGrid: false,
  dwarfs: true,
  minorBodies: true,
  spacecraft: true,
  belts: true,
  milkyWay: true,
  volumetrics: true,
  galaxies: true,
  procedural: true,
  proceduralNames: false,
  highlightProcedural: true,
};

const PRESET_RENDER: Partial<Settings> = {
  atmospheres: true,
  clouds: true,
  rings: true,
  ringParticles: true,
  shadows: true,
  nightLight: 1,
  lensFlare: true,
  imagery: true,
  bloom: true,
  exposure: 1,
  renderScale: 1,
  autoResolution: true,
};

export const GRAPHICS_PRESETS: Record<GraphicsPreset, Partial<Settings>> = {
  high: { ...PRESET_DISPLAY, ...PRESET_RENDER },
  medium: { ...PRESET_DISPLAY, ...PRESET_RENDER, ringParticles: false, renderScale: 0.75 },
  low: {
    ...PRESET_DISPLAY, ...PRESET_RENDER,
    volumetrics: false, ringParticles: false, shadows: false, lensFlare: false, bloom: false, imagery: false,
    renderScale: 0.6,
  },
};

/** the preset the settings currently match, if any */
export function matchPreset(s: Settings): GraphicsPreset | null {
  return GRAPHICS_PRESET_ORDER.find((p) => Object.entries(GRAPHICS_PRESETS[p]).every(([k, v]) => s[k as keyof Settings] === v)) ?? null;
}

const KEY = 'yeits.settings.v1';

/** first visit: the lowest level on phones and tablets, the highest on desktops */
function firstVisit(): Settings {
  const mobile = window.matchMedia('(pointer: coarse)').matches;
  return { ...DEFAULT_SETTINGS, ...GRAPHICS_PRESETS[mobile ? 'low' : 'high'] };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return firstVisit();
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return firstVisit();
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
