# Third-party notices

The source code of Your Eyes In Space is licensed under the GNU AGPL-3.0 (see `LICENSE`); tours, lessons and audio are covered by `LICENSE-CONTENT.md`. The project bundles or
streams the following third-party material, each under its own terms.

## Data

| Item | Files | Source | Licence |
|---|---|---|---|
| Star catalogue (derived) | `public/data/stars*.bin`, `public/data/star-names.json`, `public/data/catalog.json` | [HYG Database v4.1](https://github.com/astronexus/HYG-Database) and [AT-HYG v4.0](https://codeberg.org/astronexus/athyg) by David Nash (Astronexus), compiled from Hipparcos, Yale BSC, Gliese, Tycho-2 and Gaia DR3; [Gaia Catalogue of Nearby Stars](https://www.cosmos.esa.int/web/gaia/edr3-gcns) (Gaia Collaboration, Smart et al. 2021) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — the derived binaries are redistributed under the same licence; Gaia data: ESA/Gaia/DPAC, [CC BY-SA 3.0 IGO](https://creativecommons.org/licenses/by-sa/3.0/igo/); build with `scripts/build-catalog.mjs` |
| Exoplanets | `public/data/exoplanets.json` | [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/), Planetary Systems Composite Parameters; operated by Caltech under the NASA Exoplanet Exploration Program | Public; acknowledgement as requested by the archive |
| Brown dwarfs | `public/data/browndwarfs.json` | [UltracoolSheet](https://zenodo.org/records/13993077) (Best, Liu, Magnier & Dupuy 2024) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Asteroids and comets | `public/data/smallbodies.*` | [NASA/JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_query.html) | Public domain (US Government work) |
| Multiple stars | `public/data/binaries.json` | Multiple Star Catalogue (Tokovinin 2018, ApJS 235, 6; VizieR J/ApJS/235/6); USNO *Sixth Catalog of Orbits of Visual Binary Stars* (ORB6); build with `scripts/build-binaries.mjs` | Facts; ORB6 is a US Government work |
| Deep-sky survey catalogues | `public/data/deepsky.json` | ATNF Pulsar Catalogue (Manchester et al. 2005); MWSC (Kharchenko et al. 2013); Harris globular clusters (2010 edition); Strasbourg–ESO planetary nebulae (Acker et al. 1992); Green's SNR catalogue (2019); WISE Catalog of Galactic H II Regions (Anderson et al. 2014); through NASA HEASARC; build with `scripts/build-deepsky.mjs` | Facts; no copyright claimed |
| Galaxy surveys | `public/data/galaxies.json` | Updated Nearby Galaxy Catalog (Karachentsev, Makarov & Kaisina 2013); 2MASS Redshift Survey (Huchra et al. 2012); build with `scripts/build-galaxies.mjs` | Facts; no copyright claimed |
| Olympus Mons relief (derived) | `public/tour-media/terrain/olympus/` | USGS Astrogeology *Mars HRSC MOLA Blended DEM Global 200m v2* (NASA/JPL/GSFC, ESA/DLR/FU Berlin) and NASA Trek *Viking MDIM 2.1 Colour Mosaic*; build with `scripts/olympus-relief.py` | Public domain |
| Outer Solar System maps (derived) | `public/maps/{pluto,charon,triton}-*.webp` | USGS Astrogeology *Pluto / Charon New Horizons Global Mosaic 300 m* (NASA/JHUAPL/SwRI) and *Triton Voyager 2 Colour Mosaic 600 m* (NASA/JPL) — resampled; Pluto and Charon colourised, unimaged regions filled with synthesised texture | Public domain |
| Gas giant maps | `public/maps/{jupiter,saturn,uranus,neptune}-*.webp` | [Solar System Scope](https://www.solarsystemscope.com/textures/) (INOVE) — resampled | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| HD 189733 b cloud map (generated) | `public/maps/hd189733b-*.webp` | Rendered in Blender by `scripts/hd189733b-map.py` from the procedural shader `scripts/hd189733b-map.osl`; styled after the NASA/ESA/M. Kornmesser artist's impression (used as a reference only, no pixels taken from it) | Original output of this project (AGPL-3.0) |
| Famous exoplanet maps (generated) | `public/maps/{51pegb,hd209458b,kelt9b,betpicb,hr8799e,hd80606b,k218b,55cnce,proximab,trappist1e,kepler186f,lhs3844b,kepler452b}-*.webp` | Rendered in Blender by `scripts/exo-maps.py` from the procedural shaders `scripts/exo-gas.osl` and `scripts/exo-rocky.osl`, packed by `scripts/exo-maps-pack.py`; each styled after the planet's best-known artist's impression or simulation (ESO/M. Kornmesser/N. Risinger; ESA/A. Vidal-Madjar/NASA; NASA/JPL-Caltech; ESO/L. Calçada/N. Risinger; ESO/L. Calçada; NASA/JPL-Caltech/J. Langton; ESA/Hubble/M. Kornmesser; NASA/JPL-Caltech; ESO/M. Kornmesser; NASA/JPL-Caltech; NASA Ames/SETI Institute/JPL-Caltech; NASA/JPL-Caltech/R. Hurt; NASA/Ames/JPL-Caltech/T. Pyle, in the order of the files) — used as references only, no pixels taken from them | Original output of this project (AGPL-3.0) |
| Landing ground materials (derived) | `public/ground/cc0/*.webp` | [Poly Haven](https://polyhaven.com/) photoscans (*moon_01*, *moon_meteor_01*, *aerial_sand*, *dry_ground_rocks*, *red_laterite_soil_stones*, *rocky_trail*, *river_small_rocks*, *mud_cracked_dry_03*, *rock_boulder_cracked*, *snow_field_aerial*, *snow_03*, *cliff_side*, *rock_face*) — relief and grain repacked by `scripts/ground-photoscan.py` | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Landing ground rocks (derived) | `public/ground/cc0/rocks.glb` | [Poly Haven](https://polyhaven.com/) photoscanned models (*moon_rock_01*–*06*, *namaqualand_boulder_03*–*06*, *rock_09*, *stone_01*) — decimated by `scripts/rocks-build.py` | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Landing ground rock families (generated) | `public/ground/rocks/rocks-*.{glb,webp}` | Generated by `scripts/rocks-gen.py` with the *Rock & Boulder Generator* Blender add-on (Z. E. Güzel, GPL-3.0): levels of detail and their baked normal / tone atlases | Original output of this project (AGPL-3.0) |
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

## Site-only assets (not in the repository)

Baked from licensed Blender assets and deployed with the official site only (gitignored; forks
fall back to the procedural surfaces):

* `public/skins/` — planet and moon surface libraries baked with *Planet Gen* by Adam Kubecki
  (GPL-3.0 add-on) and the gas giant bands of Brent Patterson's *Gas Giant & Molecular Cloud
  Bundle* ([CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)).
* `public/nebulae/gen/` — molecular cloud renders from the same Brent Patterson bundle
  (CC BY 3.0), shown as the night sky of worlds inside a nebula and credited on screen.
* `public/ground/` (except `cc0/`) — the Moon's close-up ground material, baked from a commercial
  *Procedural Moon Surface Material*; without it the Moon's ground falls back to its CC0 materials.

## Software dependencies

* [three.js](https://threejs.org/) — MIT
* [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase — MIT (Streamer Mode join codes; "QR Code" is a registered trademark of DENSO WAVE INCORPORATED)
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
