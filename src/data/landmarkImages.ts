/**
 * Real photographs for the deep-sky landmarks (public/nebulae/<file>.jpg, 512 px, square).
 * Fetched and cropped by scripts/fetch-nebulae.mjs from Wikimedia Commons; all public domain
 * (NASA/ESA/STScI) or CC BY 4.0 (ESO, ESA/Hubble). `source` is shown as the imagery credit.
 */
export interface LandmarkImage {
  /** file stem under public/nebulae */
  file: string;
  /** half-width of the photograph in units of the landmark's `radiusPc` */
  span: number;
  /** credit line (not translated: names/institutions) */
  source: string;
}

export const LANDMARK_IMAGES: Record<string, LandmarkImage> = {
  'l-m42': { file: 'm42', span: 1.25, source: 'NASA, ESA, M. Robberto (STScI/ESA), HST Orion Treasury Project' },
  'l-carina': { file: 'carina', span: 1.4, source: 'ESO (CC BY 4.0)' },
  'l-m16': { file: 'm16', span: 1.5, source: 'ESO (CC BY 4.0)' },
  'l-m8': { file: 'm8', span: 1.3, source: 'ESO / S. Guisard (CC BY 4.0)' },
  'l-m1': { file: 'm1', span: 1.35, source: 'NASA, ESA, J. Hester & A. Loll (ASU)' },
  'l-m57': { file: 'm57', span: 1.45, source: 'Hubble Heritage Team (AURA/STScI/NASA)' },
  'l-m27': { file: 'm27', span: 1.5, source: 'ESO (CC BY 4.0)' },
  'l-helix': { file: 'helix', span: 1.3, source: 'NASA, ESA, C.R. O\'Dell (Vanderbilt), NOAO/CTIO' },
  'l-casa': { file: 'casa', span: 1.5, source: 'NASA/JPL-Caltech/STScI/CXC/SAO (Hubble + Spitzer + Chandra)' },
  'l-30dor': { file: '30dor', span: 1.4, source: 'TRAPPIST / E. Jehin / ESO (CC BY 4.0)' },
  'l-sn1987a': { file: 'sn1987a', span: 1.6, source: 'ESA/Hubble & NASA (CC BY 4.0)' },
  'l-ngc346': { file: 'ngc346', span: 1.4, source: 'ESA/Hubble & NASA, A. Nota, P. Massey, E. Sabbi, C. Murray, M. Zamani (CC BY 4.0)' },
  'l-ngc604': { file: 'ngc604', span: 1.4, source: 'NASA, Hubble Space Telescope' },
  'l-pleiades': { file: 'pleiades', span: 1.5, source: 'NASA, ESA, AURA/Caltech, Palomar Observatory' },
  'l-omegacen': { file: 'omegacen', span: 1.3, source: 'ESO (CC BY 4.0)' },
};

/** atlas layout: N×N slots of SLOT px */
export const LANDMARK_ATLAS_GRID = 4;
export const LANDMARK_ATLAS_SLOT = 512;
