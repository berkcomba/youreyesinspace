# Your Eyes In Space

**[youreyesinspace.com](https://youreyesinspace.com)** — a Space Engine–style universe explorer that
runs in the browser. Fly seamlessly from the Solar System to the edge of the observable universe
(13.8 Gpc); real star/galaxy catalogues plus a deterministic procedural universe.
Vite · TypeScript · Three.js. UI in English, Turkish, German, Spanish and French.

## Features

- **Solar System** — planets, dwarf planets, moons and comets from NASA/JPL Keplerian elements;
  procedural surface/atmosphere/cloud/ring shaders, eclipse and ring shadows.
- **Real surface imagery** — Earth (NASA Blue Marble NG + Black Marble night lights), Moon (LRO WAC),
  Mars (Viking MDIM 2.1); altitude-based LOD tile streaming straight from NASA servers.
- **Humanity's spacecraft** — Voyager 1/2, Pioneer 10/11, New Horizons, Parker, ISS, Hubble, JWST (L2),
  Perseverance, Curiosity, Juno; current positions and NASA 3D models.
- **Stars** — 109,000 real stars from the HYG catalogue; procedural planetary systems; interstellar
  flight and a flyable Milky Way.
- **Galaxies** — 55 real galaxies plus a procedural cosmic web out to 13.8 Gpc; LOD chain.
- **Black holes** — Sagittarius A* (with the S2/S38/S55 orbits), M87*, M31*, Centaurus A*, Cygnus X-1,
  Gaia BH1, V404 Cygni, A0620-00, LMC X-1/X-3, M33 X-7 and more; real-time screen-space Schwarzschild
  ray tracing (null geodesics), accretion disc with Doppler beaming and gravitational redshift, shadow
  and Einstein ring.
- **Deep-sky landmarks** — the Orion, Carina, Tarantula and NGC 604 nebulae; the Pleiades, Omega Centauri
  and Mayall II clusters; the Crab, SN 1987A and Cas A remnants; record-holding stars such as Eta Carinae,
  R136a1 and WOH G64 — at their real positions in the Milky Way and neighbouring galaxies, all flyable.
- **Pulsars** — the Crab and Vela pulsars, the first pulsar PSR B1919+21, the first exoplanet host
  PSR B1257+12 (with Draugr, Poltergeist and Phobetor), the fastest pulsar J1748-2446ad (716 Hz), the
  Hulse–Taylor binary, Geminga, J0437-4715 and the magnetar SGR 1806-20; neutron stars spinning at their
  real periods, sweeping beam cones along the magnetic axis that flash when they cross the line of sight.
- **Mission planner** — pick a departure body and a target in the Solar System and get a route for the
  selected simulation time: launch-window scan with a Lambert solver, Hohmann (Earth→Moon), single
  gravity-assist transfers, elliptical capture; the Δv budget is compared against real vehicles (Voyager,
  New Horizons, Parker, Juno, Galileo, Cassini, Dawn, Orion, Starship). Sci-fi ships (Enterprise-D /
  NCC-1701 warp, Millennium Falcon / X-wing hyperspace, Rocinante constant acceleration) can reach stars,
  pulsars, black holes and galaxies. On launch the vehicle is added to the scene, the trajectory is drawn
  and the camera follows live; on interstellar arrival the reference frame switches to the target system.
- **Camera** — free flight, orbit, follow, autopilot, pointer-locked roaming; floating origin plus a
  logarithmic depth buffer (from 1 m to 10¹³ km).
- **UI** — search, info panel, time controls, a "Places worth seeing" menu, settings, `F1` help.
- **Mobile** — touch controls (one finger look/orbit, two fingers zoom/fly and pan, tap / double tap),
  phone layout (bottom-sheet panels, safe areas), automatic lower render scale on mobile.
- **Multilingual** — English, Turkish, German, Spanish, French. UI, info panels, the mission planner and
  all body/landmark descriptions are translated; the language is detected from the browser and can be
  changed in settings or with a URL parameter such as `?lang=de`.

## Development

```bash
npm ci
npm run dev        # http://localhost:5173
npm run typecheck
npm run build      # dist/
```

To rebuild the star catalogue (requires the HYG CSV):

```bash
node scripts/build-stars.mjs /path/to/hygdata_v41.csv
```

Translations: the source language is Turkish; `_('…')` calls, `data-i18n*` attributes and the
display fields of the data files are used as keys. Dictionaries live in
`src/i18n/locales/<lang>/{ui,data}.json`. To find missing/unused keys:

```bash
node scripts/i18n-check.mjs              # report (exit 1 if anything is missing)
node scripts/i18n-check.mjs --missing de # list missing keys for one language
```

## Deployment

The app is static; in production it is served from `nginx:alpine` (`Dockerfile`, `deploy/nginx/*`:
CSP and security headers, gzip, immutable caching, optional origin protection).

- **CI/CD** — `.github/workflows/deploy.yml`: typecheck + build on every push/PR; on push to `main`,
  Cloud Build builds the image and deploys to Cloud Run (Workload Identity Federation, keyless).
  Setup: `deploy/github-cicd-setup.sh`.
- **Manual** — `GCP_PROJECT=<project> ./deploy/cloudrun-deploy.sh`
- **Domain / Cloudflare** — `deploy/cloudflare.md`

Secrets (`ORIGIN_AUTH_SECRET`, `CF_API_TOKEN`, …) are provided only via environment variables /
GitHub Secrets and are never committed.

## Architecture (short)

```
src/core      Engine (renderer, post-processing), Universe, StarSystem, CelestialBody, TimeSystem
src/math      Kepler solver, reference frames (ecliptic ↔ scene)
src/data      Solar System, spacecraft, black hole and deep-sky data, HYG catalogue reader, imagery providers
src/gen       Procedural star-system generator
src/galaxy    Galaxy catalogue/model, procedural stars, far-universe layers
src/render    Body/tile/star/galaxy/orbit renderers, black-hole lensing pass and GLSL shaders
src/camera    Camera controller (modes, autopilot, speed scaling)
src/ui        HUD, panels, settings, search, places menu, mission planner
src/i18n      Translation runtime and dictionaries
```

## License

Code: [MIT](LICENSE). See [NOTICE.md](NOTICE.md) for the licences of data, models and streamed imagery
(the HYG-derived catalogue is **CC BY-SA 4.0**; NASA content is public domain). The name "Your Eyes In
Space" and the logo are trademarks of BigBrains; forks should use their own name and logo.

Your Eyes In Space is a [BigBrains](https://bigbrains.com.tr) product.
