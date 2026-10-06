# Third-party notices

The source code of Your Eyes In Space is MIT-licensed (see `LICENSE`). The project bundles or
streams the following third-party material, each under its own terms.

## Data

| Item | Files | Source | Licence |
|---|---|---|---|
| Star catalogue (derived) | `public/data/stars.bin`, `public/data/star-names.json` | [HYG Database v3](https://github.com/astronexus/HYG-Database) by David Nash (Astronexus), compiled from Hipparcos, Yale BSC and Gliese | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — the derived binary is redistributed under the same licence; build with `scripts/build-stars.mjs` |
| Planetary orbital elements | `src/data/solarSystem.ts` | NASA/JPL, E. M. Standish, *Keplerian Elements for Approximate Positions of the Major Planets* | Public domain (US Government work) |
| Spacecraft state vectors | `src/data/spacecraft.ts` | [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) (approximate, early 2025) | Public domain |
| Galaxy catalogue | `src/galaxy/galaxies.ts` | NED / literature values | Facts; no copyright claimed |
| Deep-sky landmarks (positions, distances, sizes, magnitudes) | `src/data/landmarks.ts` | Literature / SIMBAD / NED values | Facts; no copyright claimed |
| Pulsars (periods, distances, ages, fields, companions) | `src/data/pulsars.ts` | ATNF Pulsar Catalogue (Manchester et al. 2005) / literature | Facts; no copyright claimed |
| Black holes (masses, distances, S-star and binary orbital elements) | `src/data/blackholes.ts` | Literature values: GRAVITY Collaboration (S2), Gillessen et al. (S-stars), EHT Collaboration (Sgr A*, M87*), Miller-Jones et al. (Cygnus X-1), El-Badry et al. (Gaia BH1), Miller-Jones et al. (V404 Cygni), Cantrell et al. (A0620-00) | Facts; no copyright claimed |

Procedural stars, galaxies and the cosmic web are generated deterministically and are not real
catalogue objects.

## 3D models

`public/models/*.glb` (Voyager, Pioneer, Parker Solar Probe, Hubble, ISS, JWST, Perseverance,
Juno, Dawn, Galileo) come from [NASA 3D Resources](https://science.nasa.gov/3d-resources/) and
are Draco-compressed copies. The mission planner's fictional ships (Star Trek, Star Wars,
The Expanse) use original, schematic primitive-built models (`src/render/ProceduralShips.ts`);
no third-party model or artwork is bundled. NASA material is generally not copyrighted, but the
[NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) apply:
the NASA insignia and name must not be used in a way that implies endorsement.

## Streamed imagery (not bundled)

Loaded at runtime directly from NASA servers; see `src/data/imagery.ts`.

* Earth — [NASA GIBS](https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api):
  *Blue Marble Next Generation* and *VIIRS Black Marble* — public domain.
* Moon — [NASA Moon Trek](https://trek.nasa.gov/moon/): *LRO WAC Global Mosaic* — public domain.
* Mars — [NASA Mars Trek](https://trek.nasa.gov/mars/): *Viking MDIM 2.1 Colour Mosaic* — public domain.

## Software dependencies

* [three.js](https://threejs.org/) — MIT
* [Vite](https://vite.dev/), [TypeScript](https://www.typescriptlang.org/) — MIT / Apache-2.0 (build-time only)
* Production image: nginx (2-clause BSD), Node.js (MIT) — build-time only

## Trademarks

"Your Eyes In Space", the eye-and-orbit logo and "BigBrains" are trademarks of BigBrains
(https://bigbrains.com.tr). Forks must use their own name and logo.

"Star Trek", "USS Enterprise", "Star Wars", "Millennium Falcon", "X-wing" and "The Expanse" /
"Rocinante" are trademarks of their respective owners (Paramount, Lucasfilm/Disney, Alcon/Amazon).
They are referenced nominatively in the mission planner as well-known fictional vehicles for
educational comparison with real spacecraft; this project is not affiliated with or endorsed by
those owners.
