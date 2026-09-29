export interface Settings {
  orbits: boolean;
  moonOrbits: boolean;
  labels: boolean;
  markers: boolean;
  starNames: boolean;
  galaxyNames: boolean;
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
  bloom: boolean;
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
  starNames: false,
  galaxyNames: true,
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
  bloom: true,
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
