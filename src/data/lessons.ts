/**
 * Academy — course content.
 *
 * A course is chapters → sections → steps. A step is one "slide" of a lesson: a few content
 * blocks (prose, formulas, callouts, tables…), optionally an interactive widget rendered inside
 * the panel, and optionally scene cues that move the 3-D universe behind it. Content is English.
 */

export type Block =
  /** paragraph; may contain inline HTML (<em>, <b>, <sub>, <sup>) and inline formulas via $…$ */
  | { kind: 'p'; html: string }
  /** display formula (LaTeX subset, see ui/lessons/math.ts) with an optional caption */
  | { kind: 'eq'; tex: string; note?: string; label?: string }
  /** highlighted aside */
  | { kind: 'callout'; tone: 'key' | 'think' | 'history' | 'note' | 'example'; title?: string; html: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  /** term → definition pairs */
  | { kind: 'terms'; items: Array<[string, string]> }
  | { kind: 'timeline'; items: Array<{ when: string; title: string; text: string }> }
  | { kind: 'table'; head: string[]; rows: string[][]; caption?: string }
  /** two-column comparison */
  | { kind: 'compare'; left: { title: string; items: string[] }; right: { title: string; items: string[] } }
  /** closing summary */
  | { kind: 'summary'; items: string[] }
  | { kind: 'figure'; image: string; caption: string; source?: string };

export type WidgetSpec =
  /** the naked-eye sky from an ancient city: fixed stars turning, the Moon's phases, the five wanderers along the ecliptic */
  | { type: 'ancientsky' }
  /** retrograde motion: Ptolemy's epicycles vs Copernicus' heliocentric orbits, same sky */
  | { type: 'models'; mode: 'ptolemy' | 'copernicus'; lock?: boolean }
  /** Eudoxus' two nested spheres tracing the hippopede */
  | { type: 'eudoxus' }
  /** sidereal vs synodic period */
  | { type: 'synodic' }
  /** celestial sphere: horizon system, diurnal motion, equatorial coordinates */
  | { type: 'sphere'; mode: 'altaz' | 'diurnal' | 'equatorial' }
  /** precession of the celestial pole around the ecliptic pole */
  | { type: 'precession' }
  /** electromagnetic spectrum with telescopes and atmospheric windows */
  | { type: 'spectrum' }
  /** ellipse geometry (foci, a, b, e, r(θ)); `conics` extends e past 1 to parabola/hyperbola */
  | { type: 'ellipse'; conics?: boolean }
  /** Kepler's second law: equal areas in equal times */
  | { type: 'kepler2' }
  /** Kepler's third law: log–log plot of P against a with the real planets */
  | { type: 'kepler3' }
  /** Newton's cannonball: launch speed → sub-orbital, circular, elliptical, escape */
  | { type: 'cannon' }
  /** two bodies orbiting their centre of mass; mass ratio presets */
  | { type: 'twobody' }
  /** kinetic, potential and total energy along an orbit with running time averages */
  | { type: 'virial' }
  /** stellar parallax: Earth's orbit, the line of sight and the yearly shift against background stars */
  | { type: 'parallax' }
  /** the magnitude scale: two markers on a −27…+31 ruler and the brightness ratio between them */
  | { type: 'magnitude' }
  /** inverse-square law and the distance modulus: move a star of given M and watch m change */
  | { type: 'distmod' }
  /** Young's double slit: wavefronts from two slits and the interference pattern on a screen */
  | { type: 'doubleslit' }
  /** an electromagnetic wave: E and B fields in phase, perpendicular, moving at c */
  | { type: 'emwave' }
  /** Planck curves against wavelength; `mode: 'catastrophe'` overlays Rayleigh–Jeans and Wien approximations */
  | { type: 'blackbody'; mode?: 'planck' | 'catastrophe' }
  /** Stefan–Boltzmann: luminosity from radius and temperature, with real-star presets */
  | { type: 'lrt' }
  /** Planck's quantum ladder: an oscillator's allowed energies nhν and their Boltzmann occupation at T */
  | { type: 'quantum' }
  /** UBV filters over a blackbody spectrum → B−V, U−B and the colour–colour diagram */
  | { type: 'colorindex' }
  /** Michelson–Morley interferometer: ether-wind prediction vs the observed null result */
  | { type: 'michelson' }
  /** Galilean vs relativistic velocity addition */
  | { type: 'velocityadd' }
  /** Minkowski spacetime diagram with a boosted frame and a draggable event */
  | { type: 'minkowski' }
  /** Einstein's train: two lightning strikes, two observers, relativity of simultaneity */
  | { type: 'train' }
  /** two light clocks, one at rest and one moving: time dilation */
  | { type: 'lightclock' }
  /** cosmic-ray muons reaching the ground: classical vs relativistic survival */
  | { type: 'muon' }
  /** relativistic momentum, kinetic energy, γ against β; the energy–momentum triangle */
  | { type: 'relenergy' }
  /** the solar spectrum with Fraunhofer's dark lines; drag a cursor to identify them, zoom in */
  | { type: 'fraunhofer' }
  /** Kirchhoff's laws: a lamp, a gas cloud and a draggable observer — continuous, emission or absorption */
  | { type: 'kirchhoff' }
  /** identify-the-element game: match a mystery emission spectrum to a reference */
  | { type: 'elementid' }
  /** Doppler shift of spectral lines: a moving source, its wavefronts and the shifted spectrum */
  | { type: 'dopplerlines' }
  /** a spectroscopic binary: two stars orbiting, their lines splitting and merging */
  | { type: 'specbinary' }
  /** the photoelectric effect: wavelength, intensity, metal, retarding voltage → K_max and current */
  | { type: 'photoelectric' }
  /** a photon across the spectrum: energy, frequency, momentum, equivalent temperature, what it does to matter */
  | { type: 'photonscale' }
  /** Compton scattering: drag the scattering angle, see Δλ and the recoil electron */
  | { type: 'compton' }
  /** Rutherford's gold foil: Thomson vs nuclear atom, α trajectories and the scattering histogram */
  | { type: 'rutherford' }
  /** hydrogen series (Lyman, Balmer, Paschen, Brackett) on a wavelength axis; click a line for its transition */
  | { type: 'series' }
  /** Bohr's atom: click energy levels to make the electron jump and emit or absorb a photon */
  | { type: 'bohr' }
  /** hydrogen-like ions: nuclear charge Z and reduced mass rescale the ladder */
  | { type: 'hydrogenic' }
  /** de Broglie standing waves around a Bohr orbit; integer n fits, fractional n cancels */
  | { type: 'matterwave' }
  /** hydrogen orbitals |ψ|² for (n, l, m) with the radial probability and the Bohr radius */
  | { type: 'orbitals' }
  /** a wave packet: position spread against momentum spread, Δx·Δp */
  | { type: 'wavepacket' }
  /** Pauli's exclusion principle builds the periodic table: fill shells electron by electron */
  | { type: 'pauli' }
  /** the light bucket: aperture, exposure and magnitude → photons collected and a simulated star field */
  | { type: 'lightbucket' }
  /** Snell's law: drag the incident ray; media, wavelength (dispersion), total internal reflection */
  | { type: 'snell' }
  /** thin lens / concave mirror ray diagram: object distance, focal length, image and magnification */
  | { type: 'lens' }
  /** Airy pattern of a circular aperture; two stars and the Rayleigh criterion */
  | { type: 'airy' }
  /** atmospheric seeing: speckles, long-exposure blur, adaptive optics */
  | { type: 'seeing' }
  /** chromatic aberration of a single lens and its cure, the achromatic doublet */
  | { type: 'chromatic' }
  /** reflecting telescope designs: prime, Newtonian, Cassegrain, Gregorian, Schmidt — ray paths */
  | { type: 'designs' }
  /** focal length, plate scale, field of view and magnification on real targets */
  | { type: 'platescale' }
  /** compare two telescopes: aperture to scale, light grasp, limiting magnitude, resolution */
  | { type: 'scopes' }
  /** alt-azimuth vs equatorial mounts: tracking a star and field rotation */
  | { type: 'mount' }
  /** Jansky's antenna: a signal that peaks 4 minutes earlier each day — the sidereal clue */
  | { type: 'jansky' }
  /** a radio dish: wavefronts to the feed, beam pattern, half-power beam width, flux density in janskys */
  | { type: 'dish' }
  /** two-element interferometer: baseline, fringes, synthesized resolution, Earth-rotation uv coverage */
  | { type: 'interferometer' }
  /** atmospheric transmission against wavelength at different altitudes */
  | { type: 'atmwindow' }
  /** infrared: the glow of a warm telescope against a cold target; cooling */
  | { type: 'irthermal' }
  /** grazing-incidence X-ray mirrors: reflectivity against angle and energy, nested Wolter shells */
  | { type: 'grazing' }
  /** gamma-ray detection: coded mask, Compton telescope, pair conversion, Cherenkov air shower */
  | { type: 'gammadetect' }
  /** the same galaxy seen in radio, infrared, optical, ultraviolet, X-ray and gamma rays */
  | { type: 'multiview' }
  /** all-sky maps in galactic coordinates across the spectrum (Mollweide) */
  | { type: 'skymap' }
  /** survey data volumes against time, and the time to move them */
  | { type: 'datagrowth' }
  /** cross-matching two catalogues: match radius, true pairs and false matches */
  | { type: 'crossmatch' }
  /** optical double vs bound pair: forty years of positions — two straight proper-motion tracks or a shared drift with an orbit */
  | { type: 'doubletest' }
  /** a visual binary's apparent orbit: ρ, θ measurements accumulating (observe) or true vs projected ellipse with the displaced focus (deproject) */
  | { type: 'visualorbit'; mode: 'observe' | 'deproject' }
  /** astrometric binary: the proper-motion path of a visible star wobbling about an unseen companion */
  | { type: 'astrometric' }
  /** sorting game: image, light curve, spectrum or proper-motion track → which class of binary */
  | { type: 'binaryclassify' }
  /** both stars tracked against the background: the centre-of-mass line and the ratio of the two orbits */
  | { type: 'massratio' }
  /** m₁ + m₂ = α³/(p³P²): sliders for angular semi-major axis, parallax, period and ratio with error propagation; real presets */
  | { type: 'binarymass' }
  /** mass–luminosity diagram of real binaries with an adjustable power-law fit */
  | { type: 'massluminosity' }
  /** radial-velocity curve shape against eccentricity and argument of periastron, with the orbit */
  | { type: 'rvshape' }
  /** the mass function: P and K₁ fixed, inclination and primary mass varied → companion mass */
  | { type: 'massfunction' }
  /** eclipsing binary: two stars, inclination and light curve (animate) or contacts, timings and depths → radii and temperature ratio (measure) */
  | { type: 'eclipse'; mode: 'animate' | 'measure' }
  /** Algol, β Lyrae and W UMa light curves with the morphing geometry */
  | { type: 'lcgallery' }
  /** a star's reflex velocity from one planet, against the precision floors of successive spectrographs */
  | { type: 'planetrv' }
  /** a planetary transit: radius, distance, inclination → light curve, depth, duration, probability */
  | { type: 'transit' }
  /** the exoplanet population: mass against separation, coloured by discovery method, with each method's reach */
  | { type: 'methods' }
  /** mass–radius diagram with composition curves and a draggable test planet */
  | { type: 'density' }
  /** habitable zone around a chosen star, a planet placed in it, and the signals it would produce */
  | { type: 'habitable' }
  /** the Harvard sequence O5 → M8 as one slider: continuum colour and the strengths of H, He, Ca II, metal and TiO lines */
  | { type: 'spectralseq' }
  /** a planet's spectrum assembled from reflected sunlight (solar lines intact), the planet's reflectivity and molecular bands, and its own thermal emission */
  | { type: 'planetspectrum' }
  /** Boltzmann equation: populations of hydrogen's levels against temperature, with N₂/N₁ */
  | { type: 'boltzmann' }
  /** Saha equation: ionisation fraction of a chosen element against temperature at a chosen electron pressure */
  | { type: 'saha' }
  /** Boltzmann × Saha: the fraction of hydrogen in n = 2 against temperature, peaking at A0, with the spectral classes marked */
  | { type: 'balmerpeak' }
  /** spectra of an M dwarf, L, T and Y dwarfs and Jupiter side by side: TiO, hydrides, methane, ammonia */
  | { type: 'coolspectra' }
  /** the H–R diagram built star by star from real and field data, with switchable axes (spectral class / B−V / T against M_V / L) */
  | { type: 'hrbuild' }
  /** a main-sequence star of chosen mass: its place on the diagram, T, L, R, lifetime, drawn to scale */
  | { type: 'hrmass' }
  /** H–R diagram with lines of constant radius; drag a star and read its radius, shown against the Sun */
  | { type: 'hrradius' }
  /** the H–R diagram extended to brown dwarfs and the planets, with an age slider for the cooling objects */
  | { type: 'hrextended' }
  /** MK luminosity classes: a Balmer line's width against surface gravity, with the star's place on an inset diagram */
  | { type: 'luminosityclass' }
  /** spectroscopic parallax: classify a star's spectrum, choose the luminosity class, get a distance, compare with Gaia */
  | { type: 'specparallax' }
  /** Specific intensity vs flux: an observer backing away from a resolved star; surface brightness stays constant while flux falls as 1/r² */
  | { type: 'intensity' }
  /** Polar diagram of the intensity I(θ) at a chosen optical depth in an atmosphere, with the mean intensity ⟨I⟩ compared with the local Planck value */
  | { type: 'meanintensity' }
  /** Integrates I cos θ over the sphere for a user-shaped radiation field: isotropic gives zero flux, surface field gives πB */
  | { type: 'fluxcos' }
  /** Radiation pressure vs gravity on a dust grain near the Sun, and P_rad/P_gas in a star of chosen mass */
  | { type: 'radpressure' }
  /** Fits blackbodies to a stellar energy distribution in different ways: effective, colour and Balmer-jump temperatures disagree */
  | { type: 'colortemp' }
  /** A beam through a slab with adjustable density, opacity and thickness; transmitted fraction follows e^(−τ) */
  | { type: 'opticaldepth' }
  /** Sunset simulator: transmitted solar spectrum and disc colour vs zenith angle for Earth (Rayleigh λ⁻⁴) and Mars (dust) */
  | { type: 'sunset' }
  /** Opacity κ_λ against wavelength split into bound–free hydrogen, H⁻, free–free and electron scattering as T and ρ vary */
  | { type: 'opacitysources' }
  /** Rosseland mean opacity vs temperature for several densities: H⁻ rise, ionisation peak, Kramers T^−3.5 fall, scattering floor */
  | { type: 'rosseland' }
  /** Animated photon random walk; net displacement compared with ℓ√N over many trials and the escape time through the Sun */
  | { type: 'randomwalk' }
  /** Solar limb darkening: drag a cursor across the disc, see the slanted τ = 2/3 depth; 'eddington' mode overlays the gray-atmosphere prediction on measured profiles */
  | { type: 'limbdark'; mode: 'observe' | 'eddington' }
  /** Slab transfer solution I = I₀e^(−τ) + S(1 − e^(−τ)) with sliders for I₀, S and τ; shows emission vs absorption lines */
  | { type: 'transfer' }
  /** Thermalisation: mean intensity vs Planck function against depth for pure absorption and for scattering with destruction probability ε */
  | { type: 'thermalize' }
  /** Plane-parallel geometry: layers, a ray at angle θ, slant optical depth τ_v/μ and the depth where it reaches 2/3 */
  | { type: 'planeparallel' }
  /** Eddington gray-atmosphere T(τ) = T_eff(3/4(τ + 2/3))^(1/4) compared with an empirical solar model */
  | { type: 'grayatm' }
  /** Eddington–Barbier relation: user-shaped S(τ), escape-probability weighting for chosen μ, exact integral vs S(τ = μ) */
  | { type: 'barbier' }
  /** Anatomy of a line profile: core, wings, FWHM, equivalent width rectangle, formation depth across the profile */
  | { type: 'lineprofile' }
  /** Natural, Doppler and pressure broadening combined into a Voigt profile as temperature, pressure and turbulence change */
  | { type: 'broadening' }
  /** Rotational broadening: a disc colour-coded by line-of-sight velocity builds a flat-bottomed line profile; v sin i slider */
  | { type: 'rotation' }
  /** Curve of growth: equivalent width vs column density through the linear, saturated and damping regimes */
  | { type: 'curveofgrowth' }
  /** Solar photospheric abundances as a bar chart with the CI-chondrite values overlaid; X, Y, Z readout */
  | { type: 'abundances' };

export type SceneCue =
  | { action: 'goto'; ref: string; kind?: 'body' | 'blackhole' | 'star' | 'landmark' | 'galaxy' }
  | { action: 'overview'; ref: string }
  | { action: 'vantage'; ref: string; elev: number; az: number; dist: number }
  | { action: 'rate'; rate: number }
  | { action: 'backdrop' }
  | { action: 'grid'; equatorial?: boolean; ecliptic?: boolean }
  | { action: 'orbits'; on: boolean };

export interface Step {
  id: string;
  /** small label above the title: Concept · Derivation · History · Interactive … */
  kicker?: string;
  title: string;
  body: Block[];
  widget?: WidgetSpec;
  scene?: SceneCue[];
}

export interface Section {
  id: string;
  /** "1.1" */
  number: string;
  title: string;
  summary: string;
  minutes: number;
  steps: Step[];
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  summary: string;
  sections: Section[];
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  chapters: Chapter[];
}

/* ---------- shorthands ---------- */
const p = (html: string): Block => ({ kind: 'p', html });
const eq = (tex: string, note?: string, label?: string): Block => ({ kind: 'eq', tex, note, label });
const key = (html: string, title = 'Key idea'): Block => ({ kind: 'callout', tone: 'key', title, html });
const think = (html: string, title = 'Think about it'): Block => ({ kind: 'callout', tone: 'think', title, html });
const history = (html: string, title = 'History'): Block => ({ kind: 'callout', tone: 'history', title, html });
const note = (html: string, title?: string): Block => ({ kind: 'callout', tone: 'note', title, html });
const example = (html: string, title = 'Worked example'): Block => ({ kind: 'callout', tone: 'example', title, html });
const list = (...items: string[]): Block => ({ kind: 'list', items });
const terms = (...items: Array<[string, string]>): Block => ({ kind: 'terms', items });
const summary = (...items: string[]): Block => ({ kind: 'summary', items });
const timeline = (items: Array<{ when: string; title: string; text: string }>): Block => ({ kind: 'timeline', items });
const table = (head: string[], rows: string[][], caption?: string): Block => ({ kind: 'table', head, rows, caption });
const compare = (left: { title: string; items: string[] }, right: { title: string; items: string[] }): Block => ({ kind: 'compare', left, right });
const goto = (ref: string, kind?: 'body' | 'blackhole' | 'star' | 'landmark' | 'galaxy'): SceneCue => ({ action: 'goto', ref, kind });
const overview = (ref: string): SceneCue => ({ action: 'overview', ref });
const rate = (r: number): SceneCue => ({ action: 'rate', rate: r });
const grid = (equatorial?: boolean, ecliptic?: boolean): SceneCue => ({ action: 'grid', equatorial, ecliptic });
const backdrop = (): SceneCue => ({ action: 'backdrop' });

/* ================================================================================ */
/*  Chapter 1 — The Celestial Sphere                                                 */
/* ================================================================================ */

const S1_1: Section = {
  id: 'greek-tradition',
  number: '1.1',
  title: 'The Greek Tradition',
  summary: 'How the regularity of the sky invited mathematics: Pythagoras, Plato, Eudoxus, Hipparchus and the first models of the heavens.',
  minutes: 12,
  steps: [
    {
      id: 'look-up',
      kicker: 'Interactive · where it begins',
      title: 'What the ancients actually saw',
      widget: { type: 'ancientsky' },
      scene: [goto('earth'), rate(1)],
      body: [
        p('Before telescopes, before physics, there was only the naked eye and a dark sky. Watch it for a few nights and you notice patterns that are almost suspiciously regular. The whole dome of stars turns once a night around a fixed point in the north. The Sun drifts eastward against the stars and comes back to the same place after a year. The Moon changes shape on a 29½-day cycle.'),
        p('And then there are five lights that refuse to behave. They look like stars but they wander among the constellations, speed up, slow down, and sometimes stop and go <em>backwards</em> for a few weeks. The Greeks called them <em>planētai</em> — wanderers. We still do.'),
        p('The window above is that sky: the real stars as they stood over Athens in 500 BCE, with the Sun, the Moon and the five wanderers where they actually were. In <em>one night</em> the whole dome turns about a point in the north — drag the view there and notice that no bright star marks it; Polaris was far from the pole then. In <em>night after night</em> the clock is frozen at the same hour: the stars slip a little westward each evening as the Sun drifts east, the Moon runs through its phases, and the planets leave trails among the stars — watch Mars loop backwards.'),
        terms(
          ['Fixed stars', 'Stars that keep their relative positions; they turn together as one sphere.'],
          ['Planets (wanderers)', 'Mercury, Venus, Mars, Jupiter, Saturn — the five bodies visible to the eye that move against the stars.'],
          ['Ecliptic', 'The Sun\'s yearly path through the constellations. The planets stay close to it.'],
          ['Zodiac', 'The band of constellations along the ecliptic that the Sun, Moon and planets pass through.'],
        ),
        key('Regularity is an invitation. A sky that repeats can be <em>predicted</em>, and anything that can be predicted can be described with numbers. That is the step the Greeks took.'),
      ],
    },
    {
      id: 'pythagoras',
      kicker: 'History',
      title: 'Pythagoras: nature is written in numbers',
      scene: [goto('moon'), rate(1)],
      body: [
        p('Around 530 BCE, Pythagoras and his followers made a claim that still drives physics today: the world is fundamentally mathematical. They had discovered that musical harmony follows simple ratios of string lengths (2:1, 3:2, 4:3), and they assumed the heavens must be built on the same kind of harmony — the "music of the spheres".'),
        p('The Pythagoreans were also among the first to argue that the Earth is a sphere. The evidence was already in the sky, and Aristotle later listed it cleanly:'),
        list(
          'During a lunar eclipse the Earth\'s shadow on the Moon is always a circular arc — only a sphere casts a round shadow from every direction.',
          'Travelling south, new stars rise above the southern horizon and northern stars sink. On a flat Earth everyone would see the same sky.',
          'A ship sailing away disappears hull first, mast last.',
        ),
        { kind: 'timeline', items: [
          { when: '~530 BCE', title: 'Pythagoras', text: 'Number as the basis of nature; spherical Earth.' },
          { when: '~380 BCE', title: 'Plato', text: 'Sets the problem: explain the sky with uniform circular motion.' },
          { when: '~370 BCE', title: 'Eudoxus', text: 'Nested homocentric spheres; the first geometric model.' },
          { when: '~270 BCE', title: 'Aristarchus', text: 'Proposes a Sun-centred cosmos; mostly ignored.' },
          { when: '~240 BCE', title: 'Eratosthenes', text: 'Measures the circumference of the Earth.' },
          { when: '~130 BCE', title: 'Hipparchus', text: 'Star catalogue, magnitudes, precession, epicycles.' },
          { when: '~150 CE', title: 'Ptolemy', text: 'The Almagest: the geocentric model that lasted 1400 years.' },
        ] },
      ],
    },
    {
      id: 'plato',
      kicker: 'The problem',
      title: 'Plato\'s challenge: "save the phenomena"',
      scene: [goto('earth'), rate(1)],
      body: [
        p('Plato (c. 428–348 BCE) turned sky-watching into a research programme. He asked his students a precise question: <em>what combination of uniform, circular motions can reproduce the observed movements of the planets?</em> The Earth, obviously, sat motionless at the centre — we feel no motion, and nothing flies off.'),
        p('Why circles, and why uniform speed? To the Greeks the heavens were the realm of perfection and permanence. A circle has no beginning and no end; uniform motion never changes. Anything else would be an imperfection, and the heavens had none. This assumption is the single most important thing to keep in mind for the next two thousand years of astronomy — it is what every model was forced to obey.'),
        think('Imagine you had never seen a photograph of the Solar System. You stand on ground that feels perfectly still and watch everything in the sky go around you once a day. Which model would <em>you</em> propose first? The geocentric picture was not naive; it was the straightforward reading of the evidence.'),
        key('A scientific model is judged by whether it reproduces what is observed — "saving the phenomena" — <em>and</em> by the assumptions it is willing to make. The Greeks had the first part right and were locked in by the second.'),
      ],
    },
    {
      id: 'eudoxus',
      kicker: 'Interactive · first model',
      title: 'Eudoxus and the nested spheres',
      widget: { type: 'eudoxus' },
      body: [
        p('Eudoxus of Cnidus (c. 400–347 BCE) answered Plato with a beautiful piece of geometry. Each planet was carried by a set of concentric, transparent spheres, all centred on the Earth, each rotating uniformly about its own axis. The outermost sphere gave the daily rotation; the next gave the planet\'s slow drift along the zodiac.'),
        p('The clever part was the two innermost spheres. If they rotate at <em>equal and opposite</em> rates about axes that are slightly tilted with respect to each other, a point on the inner sphere traces a figure-eight on the sky. Eudoxus called it the <em>hippopede</em> — the horse fetter. Superimpose that figure-eight on the planet\'s steady eastward drift, and the planet appears to slow down, stop and briefly move backwards.'),
        p('Try it: change the tilt between the two axes and watch the loop grow. Twenty-seven spheres were needed for the whole sky — 4 for each planet, 3 each for the Sun and Moon, 1 for the stars. Aristotle later added more, reaching 55.'),
        note('The model could not explain why planets become noticeably <em>brighter</em> during retrograde motion. Every sphere was centred on Earth, so a planet\'s distance never changed. That flaw would eventually kill it.', 'Where it failed'),
      ],
    },
    {
      id: 'retrograde',
      kicker: 'Interactive · the phenomenon',
      title: 'Retrograde motion and the epicycle',
      widget: { type: 'models', mode: 'ptolemy' },
      body: [
        p('This is the behaviour every model had to explain. Watch the sky strip at the bottom: Mars creeps eastward against the stars, then slows, reverses for about two months, and resumes. The reversal happens roughly every 26 months, and Mars is at its brightest in the middle of it.'),
        p('The solution adopted by Apollonius and Hipparchus (3rd–2nd century BCE) and perfected by Ptolemy was the <em>epicycle</em>: the planet rides on a small circle (the epicycle) whose centre rides on a large circle around the Earth (the <em>deferent</em>). When the planet is on the inner part of the epicycle it moves backwards relative to the deferent\'s motion — and it is closest to Earth, hence brightest. Two problems solved with one circle.'),
        terms(
          ['Deferent', 'The large circle, centred on (or near) the Earth, that carries the epicycle.'],
          ['Epicycle', 'The small circle the planet actually moves on. Its centre moves along the deferent.'],
          ['Retrograde motion', 'The apparent east-to-west reversal of a planet against the background stars.'],
          ['Opposition', 'When a planet is opposite the Sun in the sky; for outer planets this is the middle of retrograde motion.'],
        ),
        key('Notice how <em>natural</em> this looks once drawn. The epicycle was not a desperate patch; it was an elegant answer to Plato\'s question that worked for fourteen centuries.'),
      ],
    },
    {
      id: 'hipparchus-ptolemy',
      kicker: 'History',
      title: 'Hipparchus and Ptolemy: precision arrives',
      scene: [goto('mars'), rate(1)],
      body: [
        p('Hipparchus of Nicaea (c. 190–120 BCE) was the greatest observer of antiquity. He compiled a catalogue of about 850 stars with positions and a six-step brightness scale — the ancestor of the <em>magnitude</em> system still in use. Comparing his positions with records 150 years older, he discovered that the whole sky had shifted slightly: the <em>precession of the equinoxes</em>, which we will meet in Section 1.3.'),
        p('Three centuries later Claudius Ptolemy (c. 100–170 CE) gathered everything into the <em>Mathēmatikē Syntaxis</em>, known through its Arabic title as the <em>Almagest</em>. To match the data he gave each deferent an off-centre Earth (the <em>eccentric</em>) and introduced the <em>equant</em>: a point from which the epicycle\'s centre appeared to move uniformly, even though it did not from the Earth. It was a quiet betrayal of Plato\'s rule — but it worked, predicting planetary positions to about a degree.'),
        history('The Almagest was translated into Arabic in the 9th century and refined for centuries by astronomers in Baghdad, Cairo, Maragha and Samarkand. Latin Europe received it back through those translations in the 12th century. When Copernicus wrote, the model he was arguing against was Ptolemy\'s, 1400 years old and still in daily use.', 'Fourteen centuries of use'),
        think('Ptolemy\'s model was <em>wrong</em> about the structure of the cosmos but <em>right</em> in its predictions. Is a model that predicts well but describes reality badly a good model? Astronomers argued about exactly this for the next millennium and a half.'),
      ],
    },
    {
      id: 'aristarchus',
      kicker: 'Derivation · the road not taken',
      title: 'Aristarchus, Eratosthenes and the size of things',
      scene: [overview('earth'), rate(4e5)],
      body: [
        p('Not every Greek accepted the geocentric picture. Aristarchus of Samos (c. 310–230 BCE) placed the Sun at the centre and let the Earth orbit it, eighteen centuries before Copernicus. He also tried to measure how far away the Sun is, using the geometry of the half-lit Moon. His method was sound; his angle measurement was off, and he got a Sun about 19 times farther than the Moon (the true value is ~390).'),
        p('His heliocentric idea was rejected for a reason that was scientifically respectable: if the Earth moves around the Sun, nearby stars should appear to shift against distant ones over the year — a <em>parallax</em>. The shift, in radians, is roughly the size of Earth\'s orbit divided by the star\'s distance:'),
        eq('p \\approx \\frac{1\\,\\text{AU}}{d}', 'Parallax angle p (radians) of a star at distance d. No parallax was visible, so either the Earth is still or the stars are absurdly far away.'),
        p('Nobody could see any parallax, so either the Earth did not move, or the stars were unimaginably distant. The Greeks chose the first option. They were wrong, but the stars really are that far: the largest stellar parallax, that of Proxima Centauri, is 0.77 arcseconds — the width of a coin seen from 5 km. It was first measured in 1838.'),
        p('Meanwhile Eratosthenes (c. 276–194 BCE) measured the Earth itself. At noon on the summer solstice the Sun was directly overhead at Syene (Aswan) but 7.2° from the vertical at Alexandria, roughly 5000 stadia to the north. Since 7.2° is 1/50 of a full circle:'),
        eq('C = \\frac{360°}{7.2°} \\times 5000\\ \\text{stadia} = 250\\,000\\ \\text{stadia} \\approx 40\\,000\\ \\text{km}', 'The circumference of the Earth from one shadow and one distance. The modern value is 40 075 km.'),
        summary(
          'The Greeks turned sky-watching into geometry: predict the motions with uniform circular motion around a fixed Earth.',
          'Eudoxus\' nested spheres and Ptolemy\'s epicycles both reproduced retrograde motion; epicycles also explained brightness changes.',
          'Hipparchus brought precision: a star catalogue, magnitudes and the discovery of precession.',
          'A Sun-centred cosmos was proposed by Aristarchus but rejected for lack of stellar parallax — a correct argument with a wrong conclusion.',
        ),
      ],
    },
  ],
};

const S1_2: Section = {
  id: 'copernican-revolution',
  number: '1.2',
  title: 'The Copernican Revolution',
  summary: 'Copernicus moves the Sun to the centre: retrograde motion explained, the planets put in order, and why it still took a century to win.',
  minutes: 14,
  steps: [
    {
      id: 'cracks',
      kicker: 'Setting the stage',
      title: 'A model under strain',
      scene: [backdrop()],
      body: [
        p('By the 1500s Ptolemy\'s system had been patched and re-patched for over a thousand years. The <em>Alfonsine Tables</em> (1252), computed from it, drifted from the real sky by several degrees over the centuries. The calendar had drifted too: the Julian year was 11 minutes too long, and by the 16th century the spring equinox fell on March 11 instead of March 21. The Church needed a reliable date for Easter, and reliable astronomy to get it.'),
        p('There was also an aesthetic problem. Each planet\'s epicycles, eccentrics and equants were fitted separately; nothing connected one planet to another. The order of the planets and their distances were essentially guesses. For a Renaissance scholar steeped in Plato\'s love of harmony, this was deeply unsatisfying.'),
        history('Nicolaus Copernicus (1473–1543), a Polish canon, physician and administrator, worked on his heliocentric system for about thirty years. He circulated a short summary (the <em>Commentariolus</em>) around 1514, but published the full work — <em>De revolutionibus orbium coelestium</em> — only in 1543, the year he died. Legend says he saw the first printed copy on his deathbed.', 'The reluctant revolutionary'),
      ],
    },
    {
      id: 'the-model',
      kicker: 'Concept',
      title: 'Copernicus: put the Sun in the middle',
      scene: [overview('mars'), rate(1.5e6)],
      body: [
        p('Copernicus kept Plato\'s rule — uniform circular motion — and changed only one thing: he moved the centre. The result is the picture behind this panel. The Sun sits (nearly) at the centre. The Earth is a planet, third from the Sun, and it does two things at once: it <em>rotates</em> on its axis once a day and <em>revolves</em> around the Sun once a year. Only the Moon still orbits the Earth.'),
        list(
          'The daily turning of the whole sky is an illusion caused by the Earth\'s rotation.',
          'The Sun\'s yearly drift along the ecliptic is an illusion caused by the Earth\'s revolution.',
          'Mercury and Venus never stray far from the Sun because their orbits lie <em>inside</em> ours.',
          'Mars, Jupiter and Saturn can appear opposite the Sun because their orbits lie <em>outside</em> ours.',
          'The slower a planet moves, the farther it is from the Sun — a natural ordering appears for the first time.',
        ),
        key('Every one of the facts above was known to Ptolemy and had its own separate explanation. In the heliocentric model they all follow from <em>one</em> arrangement. That economy — many facts from one idea — is what scientists mean when they call a theory beautiful.'),
      ],
    },
    {
      id: 'retrograde-explained',
      kicker: 'Interactive · the same sky, a simpler cause',
      title: 'Retrograde motion, explained by overtaking',
      widget: { type: 'models', mode: 'copernicus' },
      scene: [overview('mars'), rate(2e6)],
      body: [
        p('Here is the same Mars loop you saw in Section 1.1 — but now switch the model to Copernicus. The Earth moves on an inner, faster orbit (one lap per year); Mars moves on an outer, slower one (one lap per 1.88 years). Every 26 months the Earth catches up and overtakes Mars on the inside. During the overtaking, our line of sight to Mars swings backwards against the distant stars, exactly as a slower car seems to drift backwards when you pass it on the motorway.'),
        p('No epicycle is needed. The retrograde loop is simply the shape of our changing line of sight. And since the overtaking happens when Earth and Mars are closest, Mars is brightest in mid-retrograde — the fact Eudoxus\' spheres could never explain.'),
        p('Flip between the two models while the animation runs. The sky strip at the bottom is <em>identical</em> in both. The models differ not in what they predict but in what they assume.'),
        think('If both models give the same sky, how would you decide between them? Copernicus\' contemporaries asked the same question — and for sixty years, honestly, there was no decisive observation. Keep that in mind when we reach Galileo.'),
      ],
    },
    {
      id: 'distances',
      kicker: 'Derivation',
      title: 'Measuring the Solar System with a protractor',
      scene: [overview('venus'), rate(1e6)],
      body: [
        p('The heliocentric model does something Ptolemy\'s could not: it lets you <em>measure</em> the relative sizes of the orbits using nothing but angles seen from Earth. Take Venus. Because it orbits inside us, it never gets more than about 46° from the Sun in the sky. At that moment of <em>greatest elongation</em> the line from Earth to Venus is tangent to Venus\' orbit, so Earth–Venus–Sun is a right angle:'),
        eq('\\sin\\theta_{\\max} = \\frac{a_{\\text{Venus}}}{a_{\\oplus}} \\quad\\Rightarrow\\quad a_{\\text{Venus}} = \\sin 46° \\approx 0.72\\ \\text{AU}', 'Greatest elongation θmax of an inferior planet gives its orbital radius in units of the Earth\'s (the astronomical unit, AU).'),
        p('For outer planets the geometry is a little longer (it uses the time between opposition and the next quadrature), but the idea is the same: one well-timed angle, one right triangle. Copernicus got all five planets to within a few percent of today\'s values.'),
        { kind: 'table', head: ['Planet', 'Copernicus (AU)', 'Modern (AU)'], rows: [
          ['Mercury', '0.38', '0.387'],
          ['Venus', '0.72', '0.723'],
          ['Earth', '1.00', '1.000'],
          ['Mars', '1.52', '1.524'],
          ['Jupiter', '5.22', '5.203'],
          ['Saturn', '9.17', '9.537'],
        ], caption: 'Orbital radii relative to the Earth\'s. The scale of the whole system — how long an AU is in kilometres — stayed unknown until the 17th century.' },
        key('The AU was first measured <em>relatively</em>. Copernicus knew the shape of the Solar System to good accuracy without knowing its absolute size — a map with no scale bar.'),
      ],
    },
    {
      id: 'synodic',
      kicker: 'Interactive · derivation',
      title: 'Two kinds of year: sidereal and synodic periods',
      widget: { type: 'synodic' },
      body: [
        p('There is a subtlety that Copernicus had to untangle. What we observe directly is a planet\'s <em>synodic period</em> S: the time between two successive identical alignments with the Sun (opposition to opposition, say). What the model needs is the <em>sidereal period</em> P: the true time for one orbit around the Sun, measured against the stars. They are not the same, because the Earth is moving too.'),
        p('Think of two runners on circular tracks. The Earth completes 1/P<sub>⊕</sub> laps per unit time, the planet 1/P laps. They line up again when the faster one has gained exactly one lap on the slower. For an outer (superior) planet the Earth is the faster runner:'),
        eq('\\frac{1}{S} = \\frac{1}{P_\\oplus} - \\frac{1}{P} \\qquad \\text{(superior planet)}'),
        eq('\\frac{1}{S} = \\frac{1}{P} - \\frac{1}{P_\\oplus} \\qquad \\text{(inferior planet)}'),
        example('Mars returns to opposition every S = 779.9 days = 2.135 yr. With P<sub>⊕</sub> = 1 yr: 1/P = 1 − 1/2.135 = 0.5316, so <b>P = 1.881 yr = 687 days</b>. Watch the widget: the stopwatch counts the synodic period between oppositions while the planet completes its sidereal orbit.'),
        think('Why does Mars have the longest synodic period of all the planets (780 days), even though Jupiter and Saturn are slower? Hint: the formula involves the <em>difference</em> of two rates. Mars moves at a speed closest to the Earth\'s, so the Earth takes longest to lap it.'),
      ],
    },
    {
      id: 'not-a-win',
      kicker: 'Critical thinking',
      title: 'Why it was not an obvious victory',
      scene: [goto('earth'), rate(1)],
      body: [
        p('It is tempting to tell this story as truth defeating error. In 1543 it did not look that way. Copernicus kept perfect circles, so to match the data he still needed small epicycles — about as many as Ptolemy. His tables were <em>not</em> noticeably more accurate. And he faced serious physical objections that nobody could answer yet.'),
        { kind: 'compare',
          left: { title: 'Ptolemy (geocentric)', items: [
            'Matches everyday experience: the ground is still.',
            'Consistent with Aristotle\'s physics: heavy things fall toward the centre of the universe — the Earth.',
            'No stellar parallax expected, none seen.',
            'Needs epicycles, eccentrics and equants fitted planet by planet.',
            'Cannot explain why Mercury and Venus hug the Sun.',
          ] },
          right: { title: 'Copernicus (heliocentric)', items: [
            'One arrangement explains retrograde motion, elongations and planetary order.',
            'Gives relative distances of the planets.',
            'Earth must move at ~30 km/s — why don\'t we feel it, and why do dropped stones fall straight down?',
            'Predicts stellar parallax — none seen, so stars must be enormously far.',
            'Still uses circles and epicycles; accuracy no better than Ptolemy.',
          ] } },
        p('The objections on the right were real science, not stubbornness. They were answered only later: Galileo\'s relativity of motion (1632) for the falling stone, Newton\'s mechanics (1687) for the physics, and Bessel\'s parallax measurement (1838) for the stars.'),
        key('A new theory rarely wins on accuracy alone. It wins when it explains <em>more with less</em>, and when the objections against it are gradually answered. Copernicus supplied the first; the century after him supplied the second.'),
      ],
    },
    {
      id: 'aftermath',
      kicker: 'What came next',
      title: 'Tycho, Kepler, Galileo',
      scene: [overview('ganymede'), rate(2e4)],
      body: [
        p('Three people turned the Copernican idea into established fact. Tycho Brahe (1546–1601) built the finest instruments before the telescope and measured planetary positions to about one arcminute — ten times better than anyone before. Johannes Kepler (1571–1630) inherited that data and, after years of failing to fit circles to Mars, abandoned Plato\'s rule: orbits are <em>ellipses</em>, and planets speed up near the Sun. We derive his three laws in Chapter 2.'),
        p('Galileo Galilei (1564–1642) pointed a telescope at the sky in 1609 and found what you see behind this panel: four moons circling Jupiter — proof that not everything orbits the Earth. He saw Venus run through a full set of phases, from crescent to nearly full, which is impossible in Ptolemy\'s model (where Venus always sits between Earth and Sun) and required in Copernicus\'. The debate was effectively over by the 1630s, even if the Church took longer.'),
        summary(
          'Copernicus moved the centre to the Sun and made the Earth a rotating, revolving planet.',
          'Retrograde motion became a simple overtaking effect; elongations and planetary order followed automatically.',
          'The relative scale of the Solar System could be measured from angles alone.',
          'Synodic periods (observed) must be converted to sidereal periods (physical): 1/S = |1/P⊕ − 1/P|.',
          'The model was not more accurate at first; it won through explanatory economy and, later, Galileo\'s observations and Kepler\'s ellipses.',
        ),
      ],
    },
  ],
};

const S1_3: Section = {
  id: 'celestial-sphere',
  number: '1.3',
  title: 'Positions on the Celestial Sphere',
  summary: 'How astronomers map the sky: angles, the horizon system, the rotating Earth, and the equatorial system of right ascension and declination.',
  minutes: 18,
  steps: [
    {
      id: 'why-a-sphere',
      kicker: 'Concept',
      title: 'An honest fiction: the celestial sphere',
      scene: [goto('earth'), grid(true, false), rate(1)],
      body: [
        p('We know the Earth orbits the Sun and the stars lie at wildly different distances. Yet astronomers still describe the sky as if every object were painted on the inside of a giant sphere centred on the Earth — the <em>celestial sphere</em>. This is not a step backwards. For locating things it is exactly right: from Earth we see only <em>directions</em>, and directions are points on a sphere. Distance is a separate question, answered by separate methods.'),
        p('Positions on a sphere are angles, so we need angular units. A full circle is 360 degrees; each degree is split into 60 arcminutes (′), each arcminute into 60 arcseconds (″).'),
        eq('1° = 60\' = 3600\'\' \\qquad 1\\ \\text{rad} = \\frac{180°}{\\pi} \\approx 57.3° \\approx 206\\,265\'\''),
        p('A useful consequence: if something of physical size D is at distance d, and d is much larger than D, its angular size θ in radians is simply their ratio.'),
        eq('\\theta \\approx \\frac{D}{d}', 'The small-angle formula (θ in radians). It links what we can measure — an angle — to what we want — a size or a distance.'),
        example('The Moon is 3474 km across and 384 400 km away: θ = 3474 / 384 400 = 0.00904 rad = 0.52°. Your little finger at arm\'s length is about 1°; a fist is about 10°. The Moon fits twice inside your fingertip.'),
        key('Everything in observational astronomy starts as an angle. Learning the sky means learning to think in degrees, arcminutes and arcseconds.'),
      ],
    },
    {
      id: 'altaz',
      kicker: 'Interactive · the local sky',
      title: 'The horizon system: altitude and azimuth',
      widget: { type: 'sphere', mode: 'altaz' },
      body: [
        p('The most natural way to point at a star is the way you would describe it to a friend: how high up, and in which compass direction. That is the <em>altitude–azimuth</em> (horizon) system. The <em>horizon</em> is the great circle where sky meets ground; the <em>zenith</em> is the point straight overhead; the <em>meridian</em> is the great circle through the zenith and the north and south points.'),
        terms(
          ['Altitude h', 'Angle above the horizon, 0° on the horizon to 90° at the zenith.'],
          ['Azimuth A', 'Compass angle measured along the horizon from north through east: N = 0°, E = 90°, S = 180°, W = 270°.'],
          ['Zenith', 'The point directly overhead; its opposite, under your feet, is the nadir.'],
          ['Meridian', 'The north–south great circle through the zenith. Objects reach their highest point when they cross it.'],
        ),
        p('Drag the sky in the widget and read off the star\'s altitude and azimuth. Then press play. The coordinates change continuously — because the Earth is turning. Move to a different latitude and they change again. Altitude and azimuth describe where a star is <em>for you, right now</em>, which is useful for pointing a telescope and useless for a catalogue.'),
        note('Horizon coordinates depend on the observer\'s latitude, longitude and the time, down to the second. Two astronomers comparing notes need a system that does not.', 'The problem'),
      ],
    },
    {
      id: 'diurnal',
      kicker: 'Interactive · derivation',
      title: 'The turning Earth: diurnal motion and the sidereal day',
      widget: { type: 'sphere', mode: 'diurnal' },
      body: [
        p('As the Earth rotates eastward, the whole celestial sphere appears to rotate westward about an axis through the <em>celestial poles</em> — the points where the Earth\'s rotation axis, extended, pierces the sky. Every star traces a circle around the pole once a day. Stars close enough to the pole never set: they are <em>circumpolar</em>. Watch the star\'s dotted daily track in the widget and change the latitude.'),
        p('There is a simple and beautiful relation here. The altitude of the north celestial pole above your horizon equals your latitude. At the north pole the celestial pole is overhead; at the equator it lies on the horizon. Sailors used it for centuries: measure the height of Polaris and you know how far north you are.'),
        eq('h_{\\text{pole}} = \\varphi', 'Altitude of the celestial pole = observer\'s latitude φ. A star is circumpolar if its declination δ satisfies δ > 90° − φ.'),
        p('Now a subtlety that matters for every observatory. One rotation relative to the <em>stars</em> takes 23 h 56 min 4.09 s — a <em>sidereal day</em>. One rotation relative to the <em>Sun</em> takes 24 h — a <em>solar day</em>. Why the difference? Because while the Earth turns once, it also moves about 1° along its orbit, so it must turn a little more to face the Sun again:'),
        eq('\\frac{360°}{365.25\\ \\text{d}} \\approx 0.986°\\ \\text{per day} \\;\\Rightarrow\\; 24\\,\\text{h}\\times\\frac{0.986°}{360°} \\approx 3\\,\\text{min}\\ 56\\,\\text{s}', 'The daily extra turn. Over a year the 3 min 56 s add up to one whole extra rotation: 366.25 sidereal days = 365.25 solar days.'),
        key('A star rises about 4 minutes earlier each night. That is why the constellations of winter are different from those of summer, and why observatories keep clocks in <em>sidereal</em> time.'),
      ],
    },
    {
      id: 'equatorial',
      kicker: 'Interactive · the catalogue system',
      title: 'The equatorial system: right ascension and declination',
      widget: { type: 'sphere', mode: 'equatorial' },
      scene: [goto('earth'), grid(true, true), rate(1)],
      body: [
        p('To get coordinates that do not change with the clock, attach the grid to the sky itself and let it rotate with the stars. Project the Earth\'s equator onto the celestial sphere: that is the <em>celestial equator</em>. Project the poles: the <em>celestial poles</em>. Now a star\'s position is fixed to this grid and does not change as the Earth turns (we will worry about slower changes in a moment).'),
        terms(
          ['Declination δ', 'Angle north (+) or south (−) of the celestial equator, from −90° to +90°. The celestial equivalent of latitude.'],
          ['Right ascension α', 'Angle measured eastward along the celestial equator from the <em>vernal equinox</em>. Given in hours, minutes and seconds: 24 h = 360°, so 1 h = 15°, 1 min = 15′, 1 s = 15″.'],
          ['Vernal equinox ♈︎', 'The point where the Sun crosses the celestial equator heading north, around 20 March. It is the zero of right ascension — the sky\'s Greenwich.'],
          ['Ecliptic', 'The Sun\'s annual path; a great circle tilted 23.44° to the celestial equator. It crosses the equator at the two equinoxes.'],
        ),
        p('Why hours for right ascension? Because the sky turns 15° per hour. A star with α = 6 h crosses your meridian 6 sidereal hours after the vernal equinox does. Right ascension is a clock reading as much as an angle. Switch the widget to the equatorial view and watch: as the sky turns, the star\'s α and δ stay fixed while h and A run.'),
        { kind: 'table', head: ['Star', 'α (J2000)', 'δ (J2000)'], rows: [
          ['Sirius', '06h 45m 09s', '−16° 42′ 58″'],
          ['Betelgeuse', '05h 55m 10s', '+07° 24′ 25″'],
          ['Vega', '18h 36m 56s', '+38° 47′ 01″'],
          ['Polaris', '02h 31m 49s', '+89° 15′ 51″'],
        ], caption: 'Equatorial coordinates of four bright stars. Polaris sits within a degree of the north celestial pole.' },
      ],
    },
    {
      id: 'hour-angle',
      kicker: 'Derivation',
      title: 'From catalogue to telescope: the hour angle',
      widget: { type: 'sphere', mode: 'equatorial' },
      body: [
        p('The link between the fixed catalogue grid and your local sky is one number: the <em>local sidereal time</em> (LST), the right ascension currently crossing your meridian. A star\'s <em>hour angle</em> H tells how long ago it crossed:'),
        eq('H = \\text{LST} - \\alpha', 'Hour angle (hours or degrees). H = 0 at transit (the star\'s highest point); H < 0 means it is still rising toward the meridian.'),
        p('With H, your latitude φ and the star\'s declination δ, spherical trigonometry gives the altitude directly — this is the formula every telescope-pointing computer runs:'),
        eq('\\sin h = \\sin\\varphi\\,\\sin\\delta + \\cos\\varphi\\,\\cos\\delta\\,\\cos H'),
        eq('\\tan A = \\frac{\\sin H}{\\cos H\\,\\sin\\varphi - \\tan\\delta\\,\\cos\\varphi}', 'Azimuth A, measured from north through east (resolve the quadrant from the signs of numerator and denominator).'),
        p('At transit (H = 0) the altitude formula collapses to something you can do in your head:'),
        eq('h_{\\max} = 90° - |\\varphi - \\delta|', 'Maximum altitude of a star. It culminates south of the zenith if δ < φ, north of it if δ > φ.'),
        example('Sirius (δ = −16.7°) seen from Istanbul (φ = 41.0°): h<sub>max</sub> = 90° − |41.0° − (−16.7°)| = 90° − 57.7° = <b>32.3°</b>, due south. From Sydney (φ = −33.9°): h<sub>max</sub> = 90° − |−33.9° + 16.7°| = 72.8°, almost overhead. Same star, same catalogue numbers, different sky.'),
      ],
    },
    {
      id: 'ecliptic',
      kicker: 'Concept',
      title: 'The tilted ecliptic and the seasons',
      scene: [{ action: 'vantage', ref: 'earth', elev: 24, az: 90, dist: 3.4 }, grid(true, true), rate(1)],
      body: [
        p('The Earth\'s rotation axis is tilted 23.44° from the perpendicular to its orbit. Seen from Earth, this means the Sun\'s yearly path — the ecliptic — is tilted 23.44° to the celestial equator. The two circles cross at the <em>vernal</em> and <em>autumnal equinoxes</em>; the Sun reaches its northernmost point at the <em>summer solstice</em> (δ = +23.44°, around 21 June) and its southernmost at the <em>winter solstice</em> (δ = −23.44°, around 21 December).'),
        eq('\\sin\\delta_\\odot = \\sin\\varepsilon\\,\\sin\\lambda_\\odot', 'The Sun\'s declination from its ecliptic longitude λ☉ (0° at the vernal equinox) and the obliquity ε = 23.44°.'),
        p('That declination drives the seasons. A higher Sun means longer days and steeper, more concentrated sunlight. At φ = 41° the noon Sun stands at 90° − 41° + 23.44° = 72.4° in June and 90° − 41° − 23.44° = 25.6° in December. The distance to the Sun barely matters: the Earth is actually <em>closest</em> to the Sun in early January.'),
        note('The twelve zodiac constellations are simply the ones the ecliptic passes through. Because of precession (next step) the Sun is now in each sign about a month later than when the zodiac was defined 2500 years ago — and it also crosses a thirteenth, Ophiuchus.', 'The zodiac, demystified'),
        key('Equatorial coordinates are tied to the Earth\'s equator; the ecliptic is tied to its orbit. The 23.44° between them is the single angle behind the seasons, the solstices and the zodiac.'),
      ],
    },
    {
      id: 'precession',
      kicker: 'Interactive · derivation',
      title: 'Nothing is quite fixed: precession',
      widget: { type: 'precession' },
      body: [
        p('Hipparchus noticed in 130 BCE that star positions had shifted since earlier records. The reason is that the Earth\'s axis is not fixed in space: like a spinning top nudged by gravity, it slowly sweeps out a cone. The Sun and Moon pull on the Earth\'s equatorial bulge and try to tip it toward the ecliptic; because the Earth spins, the response is a sideways drift of the axis — <em>precession</em>. The pole takes about 25 772 years to go once around the pole of the ecliptic, on a circle of radius 23.44°.'),
        p('The consequences are slow but relentless. The north celestial pole is near Polaris today; 4700 years ago it was near Thuban in Draco, and in 12 000 years it will be near Vega. The vernal equinox slides westward along the ecliptic by 50.3″ per year — so right ascensions and declinations of <em>every</em> star change, even though the stars themselves are not moving.'),
        eq('\\Delta\\alpha \\approx M + N\\,\\sin\\alpha\\,\\tan\\delta, \\qquad \\Delta\\delta \\approx N\\,\\cos\\alpha', 'Approximate precession corrections to equatorial coordinates over a time interval, where M and N depend on the interval:'),
        eq('M = 1.2812323°\\,T + 0.0003879°\\,T^2, \\qquad N = 0.5567530°\\,T - 0.0001185°\\,T^2', 'T is the interval in Julian centuries (36 525 days). Over one century a star near the equator moves ~1.28° in right ascension.'),
        p('Because of this, every catalogue position carries an <em>epoch</em>: the moment its coordinate grid is defined. Modern work uses <b>J2000.0</b> — 1 January 2000, 12:00 Terrestrial Time, Julian Date 2 451 545.0. Older catalogues used B1950.0; the two grids differ by about 0.7°.'),
        example('Vega at J2000: α = 18h 36m 56s = 279.23°, δ = +38.78°. For one century, T = 1: M = 1.2816°, N = 0.5566°. Δα = 1.2816° + 0.5566° × sin 279.23° × tan 38.78° = 1.2816° − 0.4414° = 0.840° = 3.36 min; Δδ = 0.5566° × cos 279.23° = +0.089°. By 2100 Vega will be listed at about 18h 40m, +38° 52′.'),
      ],
    },
    {
      id: 'time',
      kicker: 'Reference',
      title: 'Keeping time: the Julian Date and what to remember',
      scene: [goto('earth'), grid(false, false), rate(1)],
      body: [
        p('Astronomers also need a calendar without the irregularities of months and leap years. The <em>Julian Date</em> (JD) is a running count of days since noon on 1 January 4713 BCE. J2000.0 is JD 2 451 545.0; adding 36 525 days gives one Julian century. A star catalogue, an eclipse record from Babylon and a spacecraft telemetry packet can all be placed on the same axis.'),
        eq('T = \\frac{\\text{JD} - 2\\,451\\,545.0}{36\\,525}', 'Julian centuries since J2000.0 — the T that appears in the precession formulas and throughout positional astronomy.'),
        p('And a last caveat: the stars themselves do move. Their <em>proper motion</em> across the sky is tiny — Barnard\'s Star, the record holder, shifts 10.3″ per year — but over centuries it is measurable and must be applied on top of precession. We will return to it when we measure stellar distances.'),
        summary(
          'The celestial sphere is a map of directions; positions are angles (°, ′, ″). Small angle: θ ≈ D/d.',
          'Horizon coordinates (altitude, azimuth) are local and change every second as the Earth turns.',
          'The sidereal day (23h 56m 4s) is shorter than the solar day because the Earth also orbits the Sun.',
          'Equatorial coordinates — right ascension (hours, from the vernal equinox) and declination — ride with the sky and suit catalogues.',
          'Hour angle H = LST − α connects the two systems; at transit h = 90° − |φ − δ|.',
          'The ecliptic is tilted 23.44° to the equator (seasons, solstices, zodiac).',
          'Precession moves the pole once around in 25 772 years, so coordinates need an epoch (J2000.0).',
        ),
      ],
    },
  ],
};

const S1_4: Section = {
  id: 'physics-and-astronomy',
  number: '1.4',
  title: 'Physics and Astronomy',
  summary: 'From describing the sky to explaining it: how light, telescopes across the spectrum and the laws of physics turned astronomy into astrophysics.',
  minutes: 14,
  steps: [
    {
      id: 'describe-to-explain',
      kicker: 'The turning point',
      title: 'From describing to explaining',
      scene: [goto('sun'), rate(1)],
      body: [
        p('Everything in this chapter so far has been <em>description</em>: where things are, how they move, how to write it down. Kepler\'s laws, which we meet next, are the summit of that tradition — exact rules for planetary motion with no idea of <em>why</em>. The why arrived in 1687. Isaac Newton showed that a single law of gravitation, together with his laws of motion, produces Kepler\'s ellipses, the tides, the fall of an apple and the orbit of the Moon.'),
        eq('F = G\\,\\frac{m_1 m_2}{r^2}', 'Newton\'s law of universal gravitation. The first time a law tested on Earth was shown to run the heavens. We derive Kepler\'s laws from it in Chapter 2.'),
        p('A second door opened in the 19th century. In 1835 the philosopher Auguste Comte declared that the chemical composition of stars was something humanity could <em>never</em> know. Within a generation, Kirchhoff and Bunsen (1859) showed that each element imprints its own pattern of dark lines on the spectrum of light passing through it — and those lines were already visible in sunlight, mapped by Fraunhofer in 1814. Starlight carries a chemical fingerprint. The science of reading it, spectroscopy, created <em>astrophysics</em>.'),
        key('Astronomy asks <em>where</em> and <em>when</em>. Astrophysics asks <em>why</em> and <em>what is it made of</em>. The tools that made the second set of questions answerable were gravity and light.'),
      ],
    },
    {
      id: 'light',
      kicker: 'Interactive · the messenger',
      title: 'Light: almost everything we know arrives as a wave',
      widget: { type: 'spectrum' },
      scene: [goto('jwst'), rate(1)],
      body: [
        p('With a handful of exceptions, every piece of information about the universe reaches us as electromagnetic radiation — light in the broad sense. Visible light is a thin slice of it. Radio waves metres long, infrared heat, ultraviolet, X-rays and gamma rays are all the same phenomenon at different wavelengths, and all travel at the same speed c.'),
        eq('c = \\lambda\\,\\nu \\qquad E = h\\,\\nu = \\frac{h\\,c}{\\lambda}', 'Wavelength λ, frequency ν and photon energy E. Shorter wavelength means higher frequency and more energetic photons. c = 2.998 × 10⁸ m/s, h = 6.626 × 10⁻³⁴ J·s.'),
        p('Each band shows a different universe. Drag the slider across the spectrum: cold dust glows only in the far infrared; ordinary stars peak in the visible; gas at millions of degrees radiates X-rays; the leftover heat of the Big Bang is a microwave hiss. An object\'s temperature largely decides where it shines, a connection (Wien\'s law) we quantify in Chapter 3.'),
        note('The curve above the spectrum in the widget is the atmosphere\'s transparency. Air is clear only in the visible, a few infrared windows and the radio. Everything else — most of the infrared, all ultraviolet, X-rays and gamma rays — never reaches the ground. That is why we launch telescopes.', 'Why telescopes go to space'),
      ],
    },
    {
      id: 'telescopes',
      kicker: 'Concept',
      title: 'Eyes for every wavelength',
      scene: [goto('hubble'), rate(1)],
      body: [
        p('The telescope orbiting behind this panel — Hubble, launched 1990 — sees from the near ultraviolet to the near infrared, above the blurring of the atmosphere. Its successor, the James Webb Space Telescope (2021), has a 6.5-metre mirror cooled to −233 °C so that its own heat does not drown the faint infrared glow of the first galaxies. Neither could do its job from the ground.'),
        { kind: 'table', head: ['Band', 'Reaches ground?', 'Observatories', 'What it reveals'], rows: [
          ['Radio (m–cm)', 'Yes', 'VLA, FAST, LOFAR, EHT', 'Pulsars, cold hydrogen, jets, black hole shadows'],
          ['Millimetre / sub-mm', 'High, dry sites', 'ALMA, Planck (space)', 'Molecular clouds, forming planets, the cosmic microwave background'],
          ['Infrared', 'Partly', 'JWST, Spitzer, VLT', 'Dust-shrouded stars, exoplanets, the earliest galaxies'],
          ['Visible', 'Yes', 'Hubble, Keck, Rubin, Gaia', 'Stars, galaxies, positions and spectra'],
          ['Ultraviolet', 'No', 'Hubble, GALEX', 'Hot young stars, stellar atmospheres'],
          ['X-ray', 'No', 'Chandra, XMM-Newton', 'Million-degree gas, accretion onto black holes, supernova remnants'],
          ['Gamma ray', 'No', 'Fermi, Swift', 'Gamma-ray bursts, pulsars, matter–antimatter annihilation'],
        ] },
        p('Technology set the pace of discovery. Radio astronomy began with an accidental detection in 1932 and gave us pulsars (1967) and the cosmic microwave background (1965). X-ray astronomy needed rockets and satellites and found the first black hole candidate, Cygnus X-1 (1964–71). Each new window opened a new astronomy.'),
        key('Every band in the table is the same physics — electromagnetic waves — seen with a different instrument. A complete picture of any object needs several of them at once.'),
      ],
    },
    {
      id: 'messengers',
      kicker: 'Concept',
      title: 'Beyond light: new messengers',
      scene: [goto('l-sn1987a', 'landmark'), rate(1)],
      body: [
        p('For all of history until the 20th century, astronomy was the study of light. That has changed. On 23 February 1987 a star exploded in the Large Magellanic Cloud — the supernova you see here, SN 1987A. Three hours <em>before</em> its light brightened, detectors in Japan and the United States caught about two dozen <em>neutrinos</em>, ghostly particles released as the star\'s core collapsed. It was the first time we had looked inside a dying star.'),
        list(
          '<b>Cosmic rays</b> — atomic nuclei accelerated to nearly the speed of light, raining on Earth from supernova remnants and beyond (discovered 1912).',
          '<b>Neutrinos</b> — from the Sun\'s core, from SN 1987A, and since 2013 from distant active galaxies (IceCube).',
          '<b>Gravitational waves</b> — ripples in spacetime predicted by Einstein in 1916 and first detected by LIGO on 14 September 2015, from two black holes merging 1.3 billion light years away.',
          '<b>Meteorites and returned samples</b> — the only astronomy you can hold in your hand.',
        ),
        p('Combining these channels is called <em>multi-messenger astronomy</em>. Its showcase came on 17 August 2017: a gravitational-wave signal from two merging neutron stars, followed 1.7 seconds later by a gamma-ray burst and, within days, by light at every wavelength — showing that such mergers forge heavy elements like gold and platinum.'),
      ],
    },
    {
      id: 'physics-explains',
      kicker: 'Derivation',
      title: 'What physics lets us say',
      scene: [goto('b0', 'blackhole'), rate(1)],
      body: [
        p('Here is a taste of what the rest of this course will do: take a law tested in a laboratory and apply it to an object we can never touch. Start with the Sun. Its luminosity — the total power it radiates — is measured to be 3.828 × 10²⁶ W. Einstein\'s relation between mass and energy tells us what that costs:'),
        eq('E = m\\,c^2 \\;\\Rightarrow\\; \\frac{dm}{dt} = \\frac{L_\\odot}{c^2} = \\frac{3.828\\times10^{26}\\ \\text{W}}{(2.998\\times10^{8}\\ \\text{m/s})^2} \\approx 4.3\\times10^{9}\\ \\text{kg/s}', 'The Sun converts about 4.3 million tonnes of matter into light every second — and has done so for 4.6 billion years, losing only 0.03 % of its mass.'),
        p('Or take the object in front of you: Sagittarius A*, the black hole at the centre of the Milky Way. Nobody can see it directly, but stars orbit it, and Kepler\'s third law — Newton\'s gravity — turns their orbits into a mass. The star S2 completes an orbit of semi-major axis ~1000 AU in 16.05 years:'),
        eq('M = \\frac{4\\pi^2 a^3}{G\\,P^2} \\approx 4\\times10^{6}\\ M_\\odot', 'Four million solar masses inside a region smaller than our Solar System. The 2020 Nobel Prize in Physics was awarded for this measurement.'),
        p('And general relativity, tested with clocks and satellites around the Earth, predicted the size and shape of the glowing ring the Event Horizon Telescope photographed around this black hole in 2022. The same equations, from GPS to the galactic centre.'),
        key('The laws of physics are assumed to be the same everywhere and at all times. That single assumption — universality — is what lets a measurement on Earth tell us the mass of a black hole 26 000 light years away.'),
      ],
    },
    {
      id: 'road-ahead',
      kicker: 'Looking forward',
      title: 'Why we do this, and where we go next',
      scene: [backdrop()],
      body: [
        p('None of this is strictly necessary for survival. We study the universe because we are the kind of creature that wants to know where it is. Every culture has looked up and told stories; what the Greeks began, and what Copernicus, Kepler, Newton and the spectroscopists continued, is the long project of replacing stories with explanations that can be tested — and of finding that the explanations are, if anything, stranger and more beautiful than the stories.'),
        p('The course ahead follows that path. We will first put the Solar System on a firm footing: elliptical orbits, Kepler\'s three laws and their derivation from Newton\'s gravity (Chapter 2). Then we learn to read light — brightness, colour, spectra — and to turn it into temperatures, distances and compositions (Chapter 3 onward). With those tools we will build stars from the inside out, follow their births and deaths, and finally step outside the Milky Way to galaxies and the expanding universe.'),
        { kind: 'timeline', items: [
          { when: 'Chapter 2', title: 'Celestial Mechanics', text: 'Elliptical orbits, Kepler\'s laws derived, the virial theorem.' },
          { when: 'Chapter 3', title: 'The Continuous Spectrum of Light', text: 'Parallax, magnitudes, blackbody radiation, colour.' },
          { when: 'Chapter 4', title: 'Special Relativity', text: 'Lorentz transformations, relativistic Doppler effect.' },
          { when: 'Chapter 5', title: 'The Interaction of Light and Matter', text: 'Spectral lines, the Bohr atom, quantum mechanics.' },
        ] },
        summary(
          'Newton\'s gravitation (1687) turned the description of orbits into an explanation; spectroscopy (1814–1859) made the composition of stars knowable.',
          'Almost all our information arrives as electromagnetic radiation: c = λν, E = hν.',
          'The atmosphere blocks most wavelengths, so each band needs its own telescope — many of them in space.',
          'Neutrinos, cosmic rays and gravitational waves are new messengers; combining them is multi-messenger astronomy.',
          'The universality of physical law lets laboratory physics measure the Sun\'s mass loss and weigh a black hole.',
        ),
      ],
    },
  ],
};

/* ================================================================================ */
/*  Chapter 2 — Celestial Mechanics                                                  */
/* ================================================================================ */

const S2_1: Section = {
  id: 'elliptical-orbits',
  number: '2.1',
  title: 'Elliptical Orbits',
  summary: 'Tycho\'s data, Kepler\'s ellipses, equal areas and the harmonic law — the first exact description of how planets move.',
  minutes: 16,
  steps: [
    {
      id: 'tycho',
      kicker: 'History · the data',
      title: 'Tycho Brahe: measuring the sky to one arcminute',
      scene: [overview('mars'), rate(1.5e6)],
      body: [
        p('Every good theory starts with good data. Tycho Brahe (1546–1601), a Danish nobleman with a gold-and-silver nose (he lost the original in a duel), spent twenty years on the island of Hven measuring planetary positions with giant quadrants and sextants — no telescope, just enormous, carefully calibrated instruments and relentless repetition. His positions were good to about <b>1 arcminute</b>, ten times better than anyone before him.'),
        p('That precision mattered. In 1600 Tycho hired a young mathematician, Johannes Kepler (1571–1630), and set him the hardest problem in the data: the orbit of Mars. Kepler spent years fitting circles — with eccentrics, with equants, with every trick Ptolemy and Copernicus had used. His best circular model matched Tycho\'s observations to within 8 arcminutes. For any earlier astronomer that would have been a triumph.'),
        key('Kepler refused to accept the 8′ discrepancy, because he knew Tycho\'s instruments were good to 1′. "These eight minutes," he wrote, "point the road to a complete reformation of astronomy." The quality of the data forced the theory to change. That is how science is supposed to work.'),
        history('Tycho himself did not accept the Copernican system. His compromise — the Sun orbiting the Earth, the other planets orbiting the Sun — was geometrically equivalent to Copernicus\' and avoided the parallax problem. Kepler, a convinced Copernican, inherited the data when Tycho died in 1601.', 'The Tychonic system'),
      ],
    },
    {
      id: 'ellipse',
      kicker: 'Interactive · geometry',
      title: 'The ellipse',
      widget: { type: 'ellipse' },
      body: [
        p('Kepler\'s breakthrough was a shape. An <em>ellipse</em> is the set of points whose distances to two fixed points — the <em>foci</em> — add up to a constant, 2a. Pin a string to two nails and trace it with a pencil kept taut: that is an ellipse. Drag the eccentricity slider and watch the two foci move apart.'),
        terms(
          ['Semi-major axis a', 'Half the longest diameter. It sets the size of the orbit — and, as we will see, its period.'],
          ['Semi-minor axis b', 'Half the shortest diameter. b = a√(1 − e²).'],
          ['Eccentricity e', 'How far each focus sits from the centre, as a fraction of a: 0 is a circle, values near 1 are long and thin.'],
          ['Perihelion / aphelion', 'The closest and farthest points from the Sun (at one focus): r = a(1 − e) and r = a(1 + e).'],
        ),
        eq('r = \\frac{a\\,(1 - e^2)}{1 + e\\cos\\theta}', 'Polar equation of an ellipse measured from a focus. θ, the <em>true anomaly</em>, is the angle from perihelion. At θ = 0 the denominator is largest and r is smallest.'),
        eq('r_p = a(1-e) \\qquad r_a = a(1+e) \\qquad b = a\\sqrt{1-e^2} \\qquad r_p + r_a = 2a'),
        example('Mars: a = 1.524 AU, e = 0.0934. Perihelion = 1.524 × 0.9066 = 1.381 AU; aphelion = 1.524 × 1.0934 = 1.666 AU. b = 1.524 × √(1 − 0.00872) = 1.517 AU — only 0.4 % less than a. Mars\'s orbit is very nearly a circle; what gives it away is that the Sun sits 0.14 AU off centre, not the shape.'),
      ],
    },
    {
      id: 'first-law',
      kicker: 'Kepler\'s first law',
      title: 'Planets move on ellipses with the Sun at one focus',
      scene: [overview('halley'), rate(8e6)],
      body: [
        p('Here is the first law, stated in 1609 in <em>Astronomia Nova</em>: <b>each planet moves on an ellipse, with the Sun at one focus.</b> Not at the centre — at a focus. The other focus is empty. This single statement swept away two thousand years of circles, epicycles and equants.'),
        p('For the planets the ellipses are so nearly circular that the shape is hard to see; the off-centre Sun is the visible effect. Behind this panel is an orbit where the ellipse is unmistakable: Halley\'s Comet, with e = 0.967, dives from beyond Neptune to inside the orbit of Venus every 76 years.'),
        { kind: 'table', head: ['Body', 'a (AU)', 'e', 'Perihelion (AU)', 'Aphelion (AU)'], rows: [
          ['Mercury', '0.387', '0.206', '0.307', '0.467'],
          ['Venus', '0.723', '0.007', '0.718', '0.728'],
          ['Earth', '1.000', '0.017', '0.983', '1.017'],
          ['Mars', '1.524', '0.093', '1.381', '1.666'],
          ['Jupiter', '5.203', '0.049', '4.95', '5.46'],
          ['Pluto', '39.5', '0.249', '29.7', '49.3'],
          ['Halley\'s Comet', '17.8', '0.967', '0.586', '35.1'],
        ], caption: 'Pluto\'s orbit is eccentric enough that it was inside Neptune\'s from 1979 to 1999.' },
        key('Why did nobody see this before? Because the planets\' eccentricities are tiny and the sky was never measured to better than 10′. Tycho\'s 1′ data and Mars\'s relatively large e = 0.093 made the ellipse just barely visible. Kepler found it in the one planet where it could be found.'),
      ],
    },
    {
      id: 'second-law',
      kicker: 'Interactive · Kepler\'s second law',
      title: 'Equal areas in equal times',
      widget: { type: 'kepler2' },
      body: [
        p('Kepler actually discovered his second law first, while still fighting with circles. It describes <em>how fast</em> a planet moves along its ellipse: <b>the line from the Sun to the planet sweeps out equal areas in equal intervals of time.</b> Near perihelion the line is short, so the planet must move far to sweep the same area — it speeds up. Near aphelion the line is long and the planet dawdles.'),
        p('Watch the shaded sectors in the animation. They have different shapes but identical areas, and each took the same number of days to sweep. Raise the eccentricity and the effect becomes dramatic.'),
        eq('\\frac{dA}{dt} = \\frac{1}{2}\\,r^2\\,\\frac{d\\theta}{dt} = \\text{constant}', 'The areal velocity. A thin triangle of base r dθ and height r has area ½ r² dθ.'),
        eq('\\frac{v_p}{v_a} = \\frac{r_a}{r_p} = \\frac{1 + e}{1 - e}', 'At perihelion and aphelion the velocity is perpendicular to r, so equal areas gives r_p v_p = r_a v_a directly.'),
        example('Halley\'s Comet, e = 0.967: v_p / v_a = 1.967 / 0.033 = 60. It crosses the inner Solar System at 54 km/s and crawls past aphelion at under 1 km/s. Of its 76-year period it spends about 70 years beyond the orbit of Saturn.'),
        think('Kepler had no idea <em>why</em> areas should be equal. In Section 2.3 you will see that the second law is nothing but conservation of angular momentum in disguise — a law of physics hiding inside a rule of geometry.'),
      ],
    },
    {
      id: 'third-law',
      kicker: 'Interactive · Kepler\'s third law',
      title: 'The harmonic law: P² = a³',
      widget: { type: 'kepler3' },
      body: [
        p('Ten years after the first two laws, in <em>Harmonices Mundi</em> (1619), Kepler found the rule that ties all the planets together. Comparing orbital periods P with semi-major axes a, he noticed that the square of the period is proportional to the cube of the distance. With P in years and a in astronomical units the constant is exactly 1:'),
        eq('P^2 = a^3 \\qquad (P\\ \\text{in years},\\ a\\ \\text{in AU})'),
        p('The plot shows every planet on logarithmic axes. On such axes a power law is a straight line, and its slope is the exponent: here 3/2. Drag the test point along the line and read off the period of an imaginary planet at any distance. Every real planet, every asteroid, every comet lies on this one line.'),
        { kind: 'table', head: ['Planet', 'a (AU)', 'P (yr)', 'a³', 'P²'], rows: [
          ['Mercury', '0.387', '0.241', '0.058', '0.058'],
          ['Earth', '1.000', '1.000', '1.000', '1.000'],
          ['Mars', '1.524', '1.881', '3.54', '3.54'],
          ['Jupiter', '5.203', '11.86', '140.8', '140.7'],
          ['Saturn', '9.537', '29.46', '867', '868'],
          ['Neptune', '30.07', '164.8', '27 190', '27 160'],
        ] },
        key('The third law turns a stopwatch into a ruler. Measure how long something takes to go around the Sun — easy, you just wait — and you know how far away it is. Kepler had no physics for it; Newton would show it follows from gravity, with the Sun\'s mass hidden in the constant.'),
      ],
    },
    {
      id: 'worked',
      kicker: 'Worked example',
      title: 'Using the laws: Halley\'s Comet from two numbers',
      scene: [goto('halley'), rate(1)],
      body: [
        p('Kepler\'s laws let you reconstruct an entire orbit from very little. Suppose all you know about Halley\'s Comet is its period, 76 years, and how close it comes to the Sun, 0.586 AU.'),
        eq('a = P^{2/3} = 76^{2/3} = 17.9\\ \\text{AU}', 'Third law: the semi-major axis from the period alone.'),
        eq('e = 1 - \\frac{r_p}{a} = 1 - \\frac{0.586}{17.9} = 0.967', 'From r_p = a(1 − e).'),
        eq('r_a = a(1 + e) = 17.9 \\times 1.967 = 35.2\\ \\text{AU}', 'Aphelion: out past the orbit of Neptune (30.1 AU).'),
        eq('b = a\\sqrt{1 - e^2} = 17.9\\sqrt{1 - 0.935} = 4.6\\ \\text{AU}', 'The orbit is 36 AU long and only 9 AU wide.'),
        p('The dark, potato-shaped nucleus in front of you is 15 km long. In 1705 Edmond Halley used Newton\'s new mechanics to recognise that the comets of 1531, 1607 and 1682 were the same object on this orbit, and predicted its return for 1758. It came back on schedule, sixteen years after his death — the first successful prediction of a comet\'s return and a spectacular public victory for Newton\'s physics.'),
        note('The period is not exactly constant: the giant planets tug the comet on every pass, so successive returns have ranged from 74 to 79 years. Kepler\'s laws describe the two-body problem exactly; the Solar System is only approximately two bodies at a time.', 'Why "76 years" is approximate'),
      ],
    },
    {
      id: 'kepler-summary',
      kicker: 'Looking back',
      title: 'What Kepler had — and what he lacked',
      scene: [backdrop()],
      body: [
        p('By 1619 Kepler had the first exact description of planetary motion in history: three laws that predicted positions to the limit of Tycho\'s data. The <em>Rudolphine Tables</em> (1627), computed from them, were thirty times more accurate than anything before. And yet the laws were purely descriptive. Why ellipses and not some other curve? Why equal areas? Why 3/2? Kepler guessed at a "magnetic" influence spreading from the rotating Sun. He was close in spirit and wrong in detail.'),
        { kind: 'callout', tone: 'think', title: 'Critical thinking · paradigm shifts', html: 'The historian Thomas Kuhn used this very episode to argue that science does not progress by smooth accumulation but by occasional <em>paradigm shifts</em>, in which the whole framework of assumptions is replaced. Circular motion was not disproved by one measurement; it was abandoned when a new framework explained more. Keep Kuhn\'s point in mind as the course goes on: our present picture of the universe — dark matter, dark energy, inflation — is also a paradigm, and parts of it may one day be revised in the same way.' },
        summary(
          'Tycho\'s 1′ positions made it possible to see that circles fail; Kepler\'s refusal to ignore an 8′ error made it happen.',
          'First law: planets move on ellipses with the Sun at one focus. r = a(1 − e²)/(1 + e cos θ).',
          'Second law: the Sun–planet line sweeps equal areas in equal times; planets move fastest at perihelion, v_p/v_a = (1 + e)/(1 − e).',
          'Third law: P² = a³ in years and AU — a stopwatch becomes a ruler.',
          'The laws describe but do not explain. Explaining them is the job of the next three sections.',
        ),
      ],
    },
  ],
};

const S2_2: Section = {
  id: 'newtonian-mechanics',
  number: '2.2',
  title: 'Newtonian Mechanics',
  summary: 'Newton\'s three laws and universal gravitation: the physics that makes the Moon fall, the planets orbit and the apple drop — all with one equation.',
  minutes: 16,
  steps: [
    {
      id: 'principia',
      kicker: 'History',
      title: '1687: the Principia',
      scene: [goto('moon'), rate(1)],
      body: [
        p('In August 1684 Edmond Halley visited Isaac Newton in Cambridge with a question that was going around London\'s coffee houses: if the Sun attracts the planets with a force that falls off as the inverse square of distance, what path would a planet follow? Newton replied at once: an ellipse. He had worked it out years earlier and lost the notes. Halley urged him to write it up. Three years later Newton delivered the <em>Philosophiæ Naturalis Principia Mathematica</em> — and Halley paid for the printing himself.'),
        p('The <em>Principia</em> did something no book had done before. It stated a small set of laws about force and motion, added one law of gravity, and then <em>derived</em> Kepler\'s three laws, the tides, the precession of the equinoxes, the flattened shape of the Earth and the paths of comets — the behaviour of the heavens and of ordinary objects on Earth, from the same equations.'),
        key('Before Newton, "celestial" and "terrestrial" physics were different subjects. After him there was one physics. The Moon behind this panel is <em>falling</em> toward the Earth in exactly the way an apple does; it simply moves sideways fast enough to keep missing.'),
      ],
    },
    {
      id: 'three-laws',
      kicker: 'Concept',
      title: 'Newton\'s three laws of motion',
      scene: [goto('iss'), rate(1)],
      body: [
        p('Newton\'s laws describe how motion changes when forces act — and how it doesn\'t change when they don\'t.'),
        terms(
          ['First law (inertia)', 'A body at rest stays at rest, and a body in motion keeps moving in a straight line at constant speed, unless a net force acts on it. Uniform motion needs no cause; <em>changes</em> of motion do.'],
          ['Second law', 'The net force on a body equals the rate of change of its momentum. For constant mass: F = ma. Force and acceleration are vectors pointing the same way.'],
          ['Third law', 'When body A pushes on body B, B pushes back on A with an equal and opposite force. Forces always come in pairs acting on <em>different</em> bodies.'],
        ),
        eq('\\vec F = \\frac{d\\vec p}{dt} = m\\,\\vec a \\qquad \\vec p = m\\vec v', 'The second law. Momentum p is mass times velocity; for constant mass this is the familiar F = ma.'),
        eq('\\vec F_{AB} = -\\vec F_{BA}', 'The third law. The Earth pulls the Moon; the Moon pulls the Earth back with exactly the same force — which is why we have tides.'),
        p('The first law is the one that took Aristotle\'s physics apart. To Aristotle, motion needed a continual push; a planet needed something to keep it going. To Newton, a planet needs no push to <em>move</em> — only to <em>turn</em>. The question is no longer "what keeps the planets going?" but "what keeps bending their paths?"'),
        note('The space station behind you feels no force from the ground, no air drag, nothing but gravity — and gravity is bending its straight line into a circle 90 minutes long. Inside, the astronauts float not because gravity is absent (it is 90 % of its ground value) but because they and the station are falling together.', 'Why astronauts float'),
      ],
    },
    {
      id: 'gravitation',
      kicker: 'The law',
      title: 'Universal gravitation',
      scene: [goto('earth'), rate(1)],
      body: [
        p('Newton\'s law of gravity says every mass attracts every other mass, along the line joining them, with a force proportional to both masses and inversely proportional to the square of their separation:'),
        eq('F = G\\,\\frac{M\\,m}{r^2}', 'G = 6.674 × 10⁻¹¹ N m² kg⁻² is the gravitational constant — the same everywhere and for everything. Its tiny value is why gravity between everyday objects is unnoticeable and why you need a planet\'s worth of mass to feel it.'),
        p('Newton proved a result that makes the law usable: a spherically symmetric body attracts outside objects as if all its mass were concentrated at its centre. So "r" for an apple on the ground is the radius of the Earth, 6371 km, not the few metres to the soil. Put that into the second law and the acceleration of <em>any</em> falling object follows — independent of its mass, as Galileo had found by experiment:'),
        eq('g = \\frac{G M_\\oplus}{R_\\oplus^2} = \\frac{6.674\\times10^{-11} \\times 5.972\\times10^{24}}{(6.371\\times10^{6})^2} = 9.82\\ \\text{m/s}^2'),
        example('Your weight is just this force. For m = 70 kg: F = m g = 687 N. Standing on Mars (M = 6.42 × 10²³ kg, R = 3390 km): g = 3.72 m/s², weight 260 N — you could lift a friend. On the surface of the Sun, if you could stand there: g = 274 m/s².'),
        key('G is universal — it is not a property of the Earth or the Sun. Measured in a laboratory by Cavendish in 1798 with lead balls and a torsion balance, it is the same constant that holds galaxies together.'),
      ],
    },
    {
      id: 'moon-test',
      kicker: 'Derivation · the famous check',
      title: 'The Moon test: does the apple\'s gravity reach the Moon?',
      widget: { type: 'cannon' },
      body: [
        p('Here is the calculation that convinced Newton. A body moving on a circle of radius r at speed v is accelerating toward the centre — its velocity changes direction even though its speed does not. The <em>centripetal acceleration</em> is:'),
        eq('a_c = \\frac{v^2}{r} = \\frac{4\\pi^2 r}{P^2}', 'Using v = 2πr / P for one full circle in period P.'),
        p('For the Moon, r = 384 400 km and P = 27.32 days = 2.36 × 10⁶ s:'),
        eq('a_{\\text{Moon}} = \\frac{4\\pi^2 \\times 3.844\\times10^{8}}{(2.36\\times10^{6})^2} = 2.72\\times10^{-3}\\ \\text{m/s}^2'),
        p('An apple at the surface accelerates at 9.81 m/s². The Moon is 60.3 Earth radii away. If gravity weakens as 1/r², the Moon should feel 9.81 / 60.3² = 9.81 / 3636 = <b>2.70 × 10⁻³ m/s²</b>. The two numbers agree to 1 %. The same force that drops an apple holds the Moon in orbit, diluted exactly as the inverse square predicts.'),
        p('The widget above is Newton\'s own thought experiment from the <em>Principia</em>. Fire a cannonball horizontally from a high mountain. Slowly, it falls to the ground nearby. Faster, it falls further. At 7.9 km/s it falls at exactly the rate the ground curves away and never lands: it is in orbit. Faster still and the orbit becomes an ellipse; at 11.2 km/s it escapes.'),
        key('An orbit is not the absence of gravity. It is a perpetual fall that keeps missing the ground.'),
      ],
    },
    {
      id: 'circular',
      kicker: 'Derivation',
      title: 'Circular orbits: speed and period',
      scene: [{ action: 'vantage', ref: 'earth', elev: 35, az: 60, dist: 6 }, { action: 'orbits', on: true }, rate(60)],
      body: [
        p('Set gravity equal to the centripetal force and the whole theory of circular orbits falls out in two lines. For a small mass m orbiting a large mass M at radius r:'),
        eq('\\frac{G M m}{r^2} = \\frac{m v^2}{r} \\quad\\Rightarrow\\quad v_{\\text{circ}} = \\sqrt{\\frac{G M}{r}}', 'The orbital speed depends only on the central mass and the radius — not on the mass of the orbiting body.'),
        eq('P = \\frac{2\\pi r}{v} \\quad\\Rightarrow\\quad P^2 = \\frac{4\\pi^2}{G M}\\,r^3', 'Kepler\'s third law — derived, with the constant made explicit. The "1" in P² = a³ was the Sun\'s mass in disguise.'),
        example('The ISS orbits 420 km up, so r = 6371 + 420 = 6791 km. v = √(3.986 × 10¹⁴ / 6.791 × 10⁶) = 7.66 km/s; P = 2π × 6.791 × 10⁶ / 7660 = 5570 s = 92.8 min. Sixteen sunrises a day. (GM⊕ = 3.986 × 10¹⁴ m³/s² is known far more precisely than G or M⊕ separately.)'),
        example('A geostationary satellite must have P = 1 sidereal day = 86 164 s. Then r = (GM P² / 4π²)^{1/3} = 42 164 km, i.e. 35 786 km above the equator. Every TV satellite sits on that one circle.', 'Second example'),
        p('Notice the inverse: the farther out, the <em>slower</em>. The ISS does 7.7 km/s, the Moon 1.0 km/s, Neptune 5.4 km/s around the Sun against Mercury\'s 47 km/s. Slow and far, fast and close — the pattern Copernicus noticed, now with a formula.'),
      ],
    },
    {
      id: 'energy',
      kicker: 'Concept',
      title: 'Energy in orbit: bound or free',
      scene: [goto('voyager1'), rate(1)],
      body: [
        p('There is a second way to think about orbits, through energy. A moving mass has kinetic energy ½mv². A mass in a gravitational field has potential energy — and because gravity does work on a body falling in from infinitely far away, the natural zero of potential energy is at infinity, making it <em>negative</em> everywhere else:'),
        eq('K = \\tfrac{1}{2} m v^2 \\qquad U = -\\frac{G M m}{r} \\qquad E = K + U', 'Total mechanical energy E is conserved along the orbit: as r shrinks, U drops and K rises by the same amount — Kepler\'s second law again, in energy language.'),
        p('The sign of E decides the fate of the body. If E < 0 the body cannot reach infinity (it would need K < 0 there): it is <em>bound</em>, on an ellipse. If E ≥ 0 it can escape: a parabola at exactly zero, a hyperbola above. For an ellipse the total energy depends only on the semi-major axis:'),
        eq('E = -\\frac{G M m}{2a}', 'Every orbit with the same a has the same energy, whatever its eccentricity.'),
        eq('v_{\\text{esc}} = \\sqrt{\\frac{2 G M}{r}} = \\sqrt{2}\\;v_{\\text{circ}}', 'Escape velocity: set E = 0. From the Earth\'s surface 11.2 km/s; from the Sun at the Earth\'s distance 42.1 km/s.'),
        p('The spacecraft in front of you, Voyager 1, has E > 0 with respect to the Sun. Launched in 1977 and flung outward by Jupiter and Saturn, it is on a hyperbola and will never come back; at 17 km/s it crossed into interstellar space in 2012. It carries a golden record for whoever finds it.'),
      ],
    },
    {
      id: 'newton-summary',
      kicker: 'In short',
      title: 'One force, many motions',
      scene: [backdrop()],
      body: [
        p('With three laws of motion and one of gravity, Newton explained falling apples, the Moon, the planets, comets and tides. The next section does the hardest part explicitly: deriving Kepler\'s ellipses, equal areas and harmonic law from F = ma and the inverse square.'),
        summary(
          'First law: no force, no change in velocity. Orbits are bent, not pushed.',
          'Second law: F = dp/dt = ma. Third law: forces come in equal and opposite pairs.',
          'Gravity: F = GMm/r², with G universal; a sphere attracts as if its mass were at its centre.',
          'The Moon test: a_Moon = 2.72 × 10⁻³ m/s² = g / 60², confirming the inverse square.',
          'Circular orbits: v = √(GM/r), P² = 4π²r³/(GM) — Kepler\'s third law with the mass visible.',
          'Energy: E = −GMm/(2a) < 0 bound, E ≥ 0 escapes; v_esc = √2 v_circ.',
        ),
      ],
    },
  ],
};

const S2_3: Section = {
  id: 'kepler-derived',
  number: '2.3',
  title: 'Kepler\'s Laws Derived',
  summary: 'From Newton\'s laws to Kepler\'s: the centre-of-mass frame, conservation of angular momentum, the conic sections and the general third law.',
  minutes: 20,
  steps: [
    {
      id: 'two-body',
      kicker: 'Interactive · the setup',
      title: 'Two bodies and their centre of mass',
      widget: { type: 'twobody' },
      body: [
        p('Kepler put the Sun at a focus and let the planet move. Newton\'s third law says that cannot be exactly right: if the Sun pulls the planet, the planet pulls the Sun, and the Sun must move too. The way to handle two mutually attracting bodies is to describe them relative to their <em>centre of mass</em>, the mass-weighted average position:'),
        eq('\\vec R = \\frac{m_1 \\vec r_1 + m_2 \\vec r_2}{m_1 + m_2}', 'With no external forces, the centre of mass moves in a straight line at constant speed — so we may sit on it and treat it as fixed.'),
        p('Seen from the centre of mass, both bodies move on ellipses of the same shape and period, always on opposite sides of it, with sizes inversely proportional to their masses. The heavy body makes a small ellipse, the light body a large one. Try the presets in the widget: for the Earth–Moon pair the centre of mass is inside the Earth, 4670 km from its centre; for Pluto–Charon it is in open space between them.'),
        eq('\\vec r = \\vec r_2 - \\vec r_1 \\qquad \\mu = \\frac{m_1 m_2}{m_1 + m_2}', 'The separation vector r and the <em>reduced mass</em> μ. Writing Newton\'s second law for each body and subtracting gives a single equation for r:'),
        eq('\\mu\\,\\frac{d^2\\vec r}{dt^2} = -\\frac{G\\,m_1 m_2}{r^2}\\,\\hat r', 'The two-body problem has become a one-body problem: a fictitious particle of mass μ moving around a fixed centre under the full force. Solve this and you have both real orbits.'),
        key('For a planet around the Sun, m₂ ≪ m₁, so μ ≈ m₂ and the centre of mass is essentially at the Sun\'s centre — Kepler\'s picture is recovered. For two stars of similar mass it is not, and the centre-of-mass treatment is essential. Nearly half of all stars are in such pairs.'),
      ],
    },
    {
      id: 'angular-momentum',
      kicker: 'Derivation · the second law',
      title: 'Angular momentum and the law of areas',
      scene: [overview('mercury'), rate(2e5)],
      body: [
        p('The gravitational force always points along the line between the bodies — it is a <em>central force</em>. That one fact gives Kepler\'s second law immediately. Define the angular momentum of the reduced particle:'),
        eq('\\vec L = \\vec r \\times \\vec p = \\mu\\,\\vec r \\times \\vec v'),
        eq('\\frac{d\\vec L}{dt} = \\vec v \\times \\mu\\vec v + \\vec r \\times \\vec F = 0 + \\vec r \\times \\left(-\\frac{G m_1 m_2}{r^2}\\hat r\\right) = 0', 'Both cross products vanish: v × v is zero, and r × r̂ is zero because the force is parallel to r. A central force conserves angular momentum.'),
        p('Two consequences follow. First, since L is a fixed vector and r is always perpendicular to it, the motion stays in one plane for ever — orbits are flat. Second, write the area swept by r in a short time dt. The small triangle has area ½ |r × v dt|:'),
        eq('\\frac{dA}{dt} = \\frac{1}{2}\\left|\\vec r \\times \\vec v\\right| = \\frac{L}{2\\mu} = \\text{constant}', 'Kepler\'s second law. Equal areas in equal times is conservation of angular momentum, nothing more.'),
        p('Mercury, behind the panel, is the planet where you can see it best: with e = 0.206 it moves at 59 km/s at perihelion and 39 km/s at aphelion. The ratio 1.51 is exactly (1 + e)/(1 − e).'),
      ],
    },
    {
      id: 'first-law-derived',
      kicker: 'Interactive · the first law',
      title: 'Why an ellipse: the conic sections',
      widget: { type: 'ellipse', conics: true },
      body: [
        p('Deriving the shape of the orbit takes a little more algebra, and it is worth seeing the result in full. Write the equation of motion in polar coordinates (r, θ) in the orbital plane, eliminate time using the constant L = μ r² dθ/dt, and the radial equation turns into a simple equation for u = 1/r as a function of θ:'),
        eq('\\frac{d^2 u}{d\\theta^2} + u = \\frac{G M \\mu^2}{L^2}, \\qquad u = \\frac{1}{r},\\quad M = m_1 + m_2', 'A harmonic oscillator with a constant forcing term — the same equation as a mass on a spring with gravity. Its solution is a cosine plus a constant.'),
        eq('r(\\theta) = \\frac{L^2 / (G M \\mu^2)}{1 + e\\cos\\theta}', 'Compare with the polar equation of an ellipse from Section 2.1: this is it, with a(1 − e²) = L²/(GMμ²). The Sun (the centre of force) sits at the focus, exactly as Kepler said.'),
        p('The constant e that appears is fixed by the energy and the angular momentum of the orbit:'),
        eq('e = \\sqrt{1 + \\frac{2 E L^2}{\\mu^3 G^2 M^2}}', 'E < 0 gives e < 1, an ellipse; E = 0 gives e = 1, a parabola; E > 0 gives e > 1, a hyperbola. Drag the slider past 1 in the widget to see the orbit open up.'),
        p('All three curves are <em>conic sections</em> — slices through a cone — and all three occur in nature. Planets and periodic comets move on ellipses. Many long-period comets arrive on orbits so close to parabolic that one cannot tell whether they are bound. Interstellar visitors like \'Oumuamua (2017) and comet Borisov (2019) came through on hyperbolas: one pass, never to return.'),
        key('Newton\'s inverse-square law is special: it is one of only two force laws (the other is the spring, F ∝ r) that give <em>closed</em> orbits. Any other exponent would make the ellipse slowly rotate — and in fact general relativity adds a tiny such rotation: Mercury\'s perihelion advances by 43″ per century, the first great test of Einstein\'s theory.'),
      ],
    },
    {
      id: 'third-law-derived',
      kicker: 'Derivation · the third law',
      title: 'The harmonic law, with the masses made visible',
      scene: [overview('io'), rate(2e4)],
      body: [
        p('The third law now takes two lines. The area of an ellipse is πab. The areal velocity is L/(2μ). So one orbit takes a time P with πab = (L/2μ) P. Square it, use b² = a²(1 − e²) and a(1 − e²) = L²/(GMμ²) to eliminate L and e, and:'),
        eq('P^2 = \\frac{4\\pi^2}{G\\,(m_1 + m_2)}\\,a^3', 'Newton\'s form of Kepler\'s third law. Kepler\'s P² = a³ is the special case m₁ + m₂ ≈ M☉ with P in years and a in AU; the "1" was 4π²/(GM☉) in those units.'),
        p('This is one of the most useful equations in astronomy, because it is the only general way we have to <em>weigh</em> things. Anything that has a satellite can be weighed: measure the satellite\'s period and semi-major axis, and the sum of the masses falls out. Behind you, Io circles Jupiter every 1.769 days at 421 700 km:'),
        eq('M_{\\text{Jup}} = \\frac{4\\pi^2 a^3}{G P^2} = \\frac{4\\pi^2 (4.217\\times10^{8})^3}{6.674\\times10^{-11}\\,(1.528\\times10^{5})^2} = 1.90\\times10^{27}\\ \\text{kg}', '318 Earth masses — from a stopwatch and an angle, exactly as Galileo\'s moons allowed in principle in 1610.'),
        example('The Sun from the Earth\'s orbit: a = 1.496 × 10¹¹ m, P = 3.156 × 10⁷ s → M☉ = 4π² a³ / (G P²) = 1.99 × 10³⁰ kg. The Earth\'s own mass (0.0003 %) is negligible in the sum. For a binary star the sum is what you get; splitting it between the two stars needs the sizes of their individual ellipses around the centre of mass — the widget from the first step.'),
      ],
    },
    {
      id: 'vis-viva',
      kicker: 'Derivation · a bonus formula',
      title: 'Speed anywhere on the orbit: the vis-viva equation',
      scene: [goto('halley'), rate(1)],
      body: [
        p('Combine energy conservation with E = −GMm/(2a) and you get the speed at any point of an orbit from its distance alone — the <em>vis-viva</em> ("living force") equation:'),
        eq('\\tfrac{1}{2} v^2 - \\frac{G M}{r} = -\\frac{G M}{2a} \\quad\\Rightarrow\\quad v^2 = G M\\left(\\frac{2}{r} - \\frac{1}{a}\\right)'),
        p('Check the limits. On a circle r = a, so v² = GM/a — the circular speed. For a parabola a → ∞ and v² = 2GM/r — escape speed. At perihelion and aphelion of an ellipse:'),
        eq('v_p = \\sqrt{\\frac{G M}{a}\\,\\frac{1+e}{1-e}} \\qquad v_a = \\sqrt{\\frac{G M}{a}\\,\\frac{1-e}{1+e}}'),
        example('Halley\'s Comet (a = 17.8 AU, e = 0.967, GM☉/a → √ = 7.06 km/s): v_p = 7.06 × √(1.967/0.033) = 54.5 km/s; v_a = 7.06 × √(0.033/1.967) = 0.91 km/s. Earth (a = 1 AU, e = 0.0167): 30.3 km/s in January, 29.3 km/s in July.'),
        p('Mission planners live by this equation. To move a spacecraft from one orbit to another you change its speed at one point and let vis-viva do the rest — the Hohmann transfer that the Mission panel in this app computes uses nothing else.'),
      ],
    },
    {
      id: 'derived-summary',
      kicker: 'In short',
      title: 'From three laws to three laws',
      scene: [backdrop()],
      body: [
        p('Kepler\'s laws were a discovery about the planets. Newton showed they are consequences of a universal law of force, and in doing so turned them into tools: the second law became conservation of angular momentum, the first a statement about conic sections and energy, and the third a scale for weighing the universe.'),
        summary(
          'Two bodies → one: the centre-of-mass frame and the reduced mass μ = m₁m₂/(m₁ + m₂) reduce the problem to one particle around a fixed centre.',
          'A central force conserves angular momentum L; orbits are planar and sweep equal areas: dA/dt = L/(2μ).',
          'The inverse-square law gives conic sections: r = (L²/GMμ²)/(1 + e cos θ), with e set by E and L; e < 1 ellipse, e = 1 parabola, e > 1 hyperbola.',
          'Third law with masses: P² = 4π²a³ / (G(m₁ + m₂)) — the astronomer\'s scale.',
          'Vis-viva: v² = GM(2/r − 1/a) gives the speed anywhere on the orbit.',
        ),
      ],
    },
  ],
};

const S2_4: Section = {
  id: 'virial-theorem',
  number: '2.4',
  title: 'The Virial Theorem',
  summary: 'For any stable, gravitationally bound system the kinetic and potential energies are locked together: ⟨K⟩ = −½⟨U⟩. One line, with consequences from star formation to dark matter.',
  minutes: 14,
  steps: [
    {
      id: 'many-bodies',
      kicker: 'Motivation',
      title: 'When there are too many bodies to follow',
      scene: [goto('l-omegacen', 'landmark'), rate(1)],
      body: [
        p('Two bodies we can solve exactly. Three cannot be solved in closed form at all — Newton himself said the problem "made his head ache" — and the globular cluster in front of you, Omega Centauri, contains about ten million stars. Nobody will ever write down their orbits. Yet we can say precise things about the cluster as a whole, because of a theorem about <em>averages</em>.'),
        p('The idea is to stop asking where each star is and ask instead how the system\'s total kinetic energy K (the sum of ½mv² over all stars) compares with its total gravitational potential energy U (the sum of −Gm₁m₂/r over all pairs). For a system that is <em>bound</em> (it holds together) and <em>stable</em> (it is not collapsing or flying apart on average), the answer is fixed.'),
        key('The virial theorem relates the time-averaged kinetic and potential energies of any stable, self-gravitating system, no matter how many bodies it has. It is to clusters and galaxies what Kepler\'s third law is to a single orbit: a way to weigh them.'),
      ],
    },
    {
      id: 'statement',
      kicker: 'Interactive · the theorem',
      title: 'The statement: ⟨K⟩ = −½⟨U⟩',
      widget: { type: 'virial' },
      body: [
        p('For a stable system bound by gravity (or any inverse-square force), the time average of the kinetic energy is minus one half of the time average of the potential energy:'),
        eq('\\langle K \\rangle = -\\tfrac{1}{2}\\,\\langle U \\rangle', 'Angle brackets denote averages over a long time. For a single Kepler orbit, one period is enough.'),
        eq('E = \\langle K \\rangle + \\langle U \\rangle = \\tfrac{1}{2}\\langle U \\rangle = -\\langle K \\rangle', 'The total energy is negative (bound), equal to half the potential energy, and equal to minus the kinetic energy.'),
        p('Test it on the simplest case, a circular orbit of radius r. From Section 2.2, v² = GM/r, so K = ½mv² = GMm/(2r), while U = −GMm/r. So K = −U/2 exactly, at every instant. For an elliptical orbit it holds only on average: watch the widget — K and U swing up and down as the planet moves, but the running averages (the dashed lines) settle onto the virial ratio within one orbit.'),
        think('Here is a strange consequence. Suppose a bound system <em>loses</em> energy — a star cluster radiates, a gas cloud cools. E becomes more negative, so −⟨K⟩ becomes more negative: ⟨K⟩ <em>increases</em>. The system gets hotter by losing energy. Gravitating systems have negative heat capacity, and this is the reason stars shine steadily for billions of years instead of cooling off.'),
      ],
    },
    {
      id: 'proof',
      kicker: 'Derivation',
      title: 'Where it comes from',
      scene: [goto('l-47tuc', 'landmark'), rate(1)],
      body: [
        p('The proof is short and it uses nothing beyond Newton\'s second law. For a system of particles with positions rᵢ and momenta pᵢ, define the scalar quantity'),
        eq('Q = \\sum_i \\vec p_i \\cdot \\vec r_i', 'Half the time derivative of the moment of inertia, ½ d(Σ mᵢrᵢ²)/dt — a measure of whether the system is expanding or contracting.'),
        eq('\\frac{dQ}{dt} = \\sum_i \\vec p_i \\cdot \\vec v_i + \\sum_i \\vec F_i \\cdot \\vec r_i = 2K + \\sum_i \\vec F_i \\cdot \\vec r_i', 'Product rule: the first sum is Σ mᵢvᵢ² = 2K; the second uses dpᵢ/dt = Fᵢ.'),
        p('Now take the time average. The left side is (Q(T) − Q(0))/T. For a bound system Q stays finite (nothing runs off to infinity), so as T grows the average of dQ/dt goes to zero. That leaves:'),
        eq('2\\langle K \\rangle + \\Big\\langle \\sum_i \\vec F_i \\cdot \\vec r_i \\Big\\rangle = 0', 'The general virial theorem, valid for any force law.'),
        p('The last step is special to gravity. For forces between pairs of particles that fall off as 1/r², the sum Σ Fᵢ·rᵢ works out to be exactly the total potential energy U (for a single pair: F·r = −GMm/r² × r = −GMm/r = U). Substituting:'),
        eq('2\\langle K \\rangle + \\langle U \\rangle = 0 \\quad\\Rightarrow\\quad \\langle K \\rangle = -\\tfrac{1}{2}\\langle U \\rangle'),
        note('The theorem needs two assumptions: the system is bound (Q finite) and we have averaged long enough. For a cluster that formed billions of years ago both are excellent. For a system caught in the act of collapsing or being torn apart, the theorem does not hold — and that itself is a useful diagnostic.', 'Fine print'),
      ],
    },
    {
      id: 'weighing',
      kicker: 'Application',
      title: 'Weighing a cluster of galaxies',
      scene: [goto('l-omegacen', 'landmark'), rate(1)],
      body: [
        p('Here is the theorem at work. For a cluster of N stars (or galaxies) of total mass M and typical radius R, the kinetic energy is roughly ½ M ⟨v²⟩ and the potential energy roughly −GM²/R (the exact coefficient depends on how the mass is distributed). Virial equilibrium then gives the mass from two observable quantities, the velocity spread and the size:'),
        eq('M \\approx \\frac{\\langle v^2 \\rangle\\,R}{G}', 'Velocities come from Doppler shifts of spectral lines; R from the angular size and distance. Neither requires seeing the mass itself — only its gravitational effect on the motions.'),
        example('Omega Centauri: velocity dispersion about 17 km/s (so ⟨v²⟩ ≈ 3 × 17² = 870 km²/s² in three dimensions), half-mass radius about 10 light years = 9.5 × 10¹⁶ m. M ≈ 8.7 × 10⁸ × 9.5 × 10¹⁶ / 6.67 × 10⁻¹¹ ≈ 1.2 × 10³⁶ kg ≈ 6 × 10⁵ M☉ — within a factor of a few of the detailed value, 4 × 10⁶ M☉, which is exactly the accuracy this rough estimate promises.'),
        p('In 1933 Fritz Zwicky applied the same reasoning to the Coma cluster of galaxies. The galaxies were moving at about 1000 km/s; the virial mass needed to hold them together was hundreds of times the mass of all the visible stars. He called the missing part <em>dunkle Materie</em> — dark matter. It took forty years and the rotation curves of spiral galaxies (Vera Rubin, 1970s) before astronomers took him seriously, but the first evidence for dark matter was the virial theorem applied to a cluster.'),
        key('Much of what we know about the masses of clusters, galaxies and the universe\'s dark matter comes from this one relation between motion and gravity. A theorem about time averages, proved in six lines, weighs the largest structures there are.'),
      ],
    },
    {
      id: 'stars',
      kicker: 'Application',
      title: 'Why a contracting cloud heats up — and becomes a star',
      scene: [goto('l-m42', 'landmark'), rate(1)],
      body: [
        p('The virial theorem\'s most important application is inside this nebula. A cold cloud of gas in Orion begins to contract under its own gravity. As it shrinks, its potential energy U = −GM²/R becomes more negative. Where does the released energy go? The theorem answers: exactly <em>half</em> of it goes into kinetic energy — heating the gas — and the other half must be radiated away.'),
        eq('\\Delta K = -\\tfrac{1}{2}\\,\\Delta U \\qquad E_{\\text{radiated}} = -\\tfrac{1}{2}\\,\\Delta U', 'Of the gravitational energy released by contraction, half heats the object and half leaves as light.'),
        p('So a protostar gets hotter as it collapses, which raises its pressure, which slows the collapse — until the centre reaches about 10 million kelvin and hydrogen fusion ignites, replacing the lost energy. The contraction stops. The star you see is a gravitationally bound ball of gas in virial equilibrium, with fusion paying the radiation bill. We will build this star in detail from Chapter 10 on.'),
        example('In the 1850s Kelvin and Helmholtz asked how long the Sun could shine on gravitational contraction alone. The Sun\'s potential energy is roughly −GM☉²/R☉ ≈ −3.8 × 10⁴¹ J; half of that, radiated at the present luminosity 3.8 × 10²⁶ W, lasts 10¹⁵ s ≈ 30 million years. Geologists already knew the Earth was far older. The contradiction was resolved only in the 1930s with nuclear fusion — but the virial estimate (the <em>Kelvin–Helmholtz timescale</em>) is still how we estimate how long a star takes to form.', 'Historical example'),
      ],
    },
    {
      id: 'virial-summary',
      kicker: 'Chapter close',
      title: 'Celestial mechanics in one page',
      scene: [backdrop()],
      body: [
        p('This chapter went from Tycho\'s arcminutes to a theorem that weighs galaxy clusters. The thread through all of it is a single idea: that motion in the heavens obeys the same few laws as motion on Earth, and that those laws can be turned into tools.'),
        summary(
          'Kepler: ellipses with the Sun at a focus; equal areas in equal times; P² = a³.',
          'Newton: F = ma and F = GMm/r² — the Moon falls like an apple, 3600 times more gently.',
          'Kepler derived: the centre-of-mass frame, L conserved → planar orbits and equal areas; inverse-square → conic sections; P² = 4π²a³/(G(m₁ + m₂)).',
          'Energy: E = −GMm/(2a); bound for E < 0; vis-viva v² = GM(2/r − 1/a).',
          'Virial theorem: ⟨K⟩ = −½⟨U⟩ for stable bound systems; weighs clusters (dark matter), explains why contracting clouds heat up and why stars are stable.',
        ),
        { kind: 'callout', tone: 'history', title: 'Suggested reading', html: 'Thomas Kuhn, <em>The Copernican Revolution</em> (1957) and <em>The Structure of Scientific Revolutions</em> (1962) for how scientific frameworks change; Richard Westfall, <em>Never at Rest</em> (1980), the definitive biography of Newton. Next chapter: the continuous spectrum of light — parallax, magnitudes and the colours of stars.' },
      ],
    },
  ],
};

/* ================================================================================ */
/*  Chapter 3 — The Continuous Spectrum of Light                                     */
/* ================================================================================ */

const S3_1: Section = {
  id: 'stellar-parallax',
  number: '3.1',
  title: 'Stellar Parallax',
  summary: 'The first rung of the cosmic distance ladder: how the Earth\'s orbit becomes a surveyor\'s baseline, why it took until 1838 to see a star shift, and how Hipparcos and Gaia turned a handful of parallaxes into two billion.',
  minutes: 16,
  steps: [
    {
      id: 'the-problem',
      kicker: 'The problem of distance',
      title: 'Astronomy\'s hardest easy question: how far?',
      scene: [goto('sun'), rate(1)],
      body: [
        p('Everything in this course that deserves the name <em>astrophysics</em> rests on knowing how far away things are. A star\'s brightness in the sky tells you nothing about its true power until you know its distance; a galaxy\'s size, a supernova\'s energy, the age of the universe — all of them begin with a distance. And distance is exactly what the sky refuses to show. Stars are points. There is no depth, only direction.'),
        p('The one tool that works without any assumption about what a star <em>is</em> is the oldest one in surveying: look at the object from two places, measure how much its direction changes, and use the baseline between your two viewpoints to triangulate. Hold a finger at arm\'s length and blink one eye, then the other — the finger jumps against the far wall. That jump is <em>parallax</em>, and the distance between your eyes is the baseline.'),
        terms(
          ['Parallax', 'The apparent shift in the direction of a nearby object when it is viewed from two different places.'],
          ['Baseline', 'The separation between the two viewpoints. The larger the baseline, the larger the shift.'],
          ['Triangulation', 'Finding a distance from a known baseline and the measured angles at its ends — the method behind every survey map.'],
        ),
        key('For the stars, the biggest baseline we can use without leaving home is the diameter of the Earth\'s orbit: 2 AU, about 300 million kilometres. The Earth itself carries us from one end of it to the other every six months.'),
      ],
    },
    {
      id: 'geometry',
      kicker: 'Interactive · geometry',
      title: 'The parallax angle and the parsec',
      widget: { type: 'parallax' },
      body: [
        p('Watch the widget. As the Earth goes round the Sun, the line of sight to a nearby star sweeps back and forth against the distant background stars, which are so far away that their own parallax is negligible. Over a year the nearby star traces a tiny ellipse — a reflection of the Earth\'s orbit. Half the full angular swing, the angle subtended by 1 AU as seen from the star, is the <em>parallax angle</em> p.'),
        eq('\\tan p = \\frac{1\\,\\text{AU}}{d} \\quad\\Rightarrow\\quad d \\approx \\frac{1\\,\\text{AU}}{p} \\qquad (p \\text{ in radians})', 'For every star p is tiny, so the small-angle approximation tan p ≈ p is exact to far better than any measurement.'),
        p('The angles are so small that astronomers invented a unit to match. The <em>parsec</em> — a <em>par</em>allax of one arc <em>sec</em>ond — is the distance at which 1 AU subtends 1″. Since one radian is 206 265″, that distance is 206 265 AU. With this unit the formula becomes the simplest in astronomy:'),
        eq('d = \\frac{1}{p_{\\text{arcsec}}}\\ \\text{pc} \\qquad 1\\ \\text{pc} = 206\\,265\\ \\text{AU} = 3.086 \\times 10^{16}\\ \\text{m} = 3.262\\ \\text{ly}', 'Distance in parsecs is one over the parallax in arcseconds. A star with p = 0.1″ is 10 pc away.'),
        note('Drag the distance slider. The parallax shrinks as 1/d — at 10 pc the star swings through only 0.2″ over the whole year, which is 1/9000 of the Moon\'s diameter. No star is closer than 1.3 pc, so <em>no star has a parallax larger than one arcsecond</em>. The widget exaggerates the shift so you can see it at all.', 'What the slider shows'),
      ],
    },
    {
      id: 'why-so-hard',
      kicker: 'History',
      title: 'Two thousand years without a parallax',
      scene: [goto('earth'), rate(1)],
      body: [
        p('Aristarchus\' heliocentric idea (Chapter 1) made a sharp prediction: if the Earth moves, the stars must show parallax. Nobody could see any, and for two millennia that was the strongest scientific argument <em>against</em> a moving Earth. Copernicus\' only answer was that the stars must be enormously far away — which turned out to be exactly right, but at the time sounded like an excuse.'),
        timeline([
          { when: '1573', title: 'Tycho looks for it', text: 'Tycho Brahe measures to about 1′ and finds no parallax. He concludes, reasonably for his data, that the Earth stands still.' },
          { when: '1729', title: 'Bradley finds something else', text: 'Hunting for the parallax of γ Draconis, James Bradley discovers aberration — a 20″ yearly shift caused by the Earth\'s velocity, not its position. It proves the Earth moves, but it is not parallax.' },
          { when: '1838', title: 'Bessel: 61 Cygni', text: 'Friedrich Wilhelm Bessel, using a Fraunhofer heliometer, measures p = 0.314″ for 61 Cygni, chosen because its large proper motion suggested it was near. Distance: about 3 pc (modern value 0.286″, 3.5 pc).' },
          { when: '1838–39', title: 'Henderson and Struve', text: 'Thomas Henderson publishes the parallax of α Centauri (0.75″ today), and Wilhelm Struve that of Vega. Within a year the stellar distance scale exists.' },
        ]),
        p('Why did it take so long? Because an arcsecond is a brutally small angle: the width of a coin seen from four kilometres away. Atmospheric blurring smears a star into a disc one or two arcseconds across, so you are trying to measure a shift smaller than the blob you are measuring. Bessel succeeded by measuring the <em>relative</em> position of 61 Cygni against two faint neighbours, night after night, and fitting a yearly sinusoid to hundreds of observations.'),
        think('Bessel picked 61 Cygni because it drifts across the sky at 5″ per year — the "flying star". Why is a large proper motion a good hint that a star is nearby, even before you have measured its parallax?'),
      ],
    },
    {
      id: 'space-astrometry',
      kicker: 'Modern methods',
      title: 'From Hipparcos to Gaia',
      scene: [goto('earth'), rate(1)],
      body: [
        p('Above the atmosphere the blur disappears, and a telescope that scans the whole sky can measure every star against every other. That was the idea behind ESA\'s <em>Hipparcos</em> (1989–1993), which measured 118 000 stars to a precision of about 1 milliarcsecond (0.001″). Its successor, <em>Gaia</em> (launched 2013, operating from the Sun–Earth L2 point), reached 20–30 microarcseconds for bright stars and has catalogued nearly two billion sources.'),
        table(['Method', 'Precision', 'Distance at 10 % error', 'Reach'],
          [
            ['Ground, photographic (1900s)', '≈ 0.01″', '10 pc', 'a few dozen stars'],
            ['Hipparcos (1993)', '≈ 0.001″ = 1 mas', '100 pc', '≈ 1.2 × 10⁵ stars'],
            ['Gaia DR3 (2022)', '≈ 25 µas (bright stars)', '≈ 4 000 pc', '≈ 1.8 × 10⁹ sources'],
          ], 'The reach of parallax grows with precision. The "10 % error" column is the distance at which the measurement uncertainty equals a tenth of the parallax itself.'),
        p('Gaia\'s precision is almost absurd: 25 µas is the angle subtended by a human hair seen from 1000 km. At that level, the parallax of a star on the far side of the Galactic centre is still measurable, and the parallax method — once good for a few dozen stars — now reaches across a fair fraction of the Milky Way.'),
        example('Proxima Centauri, the nearest star: Gaia measures p = 768.07 ± 0.05 mas. Distance d = 1/0.76807 = 1.302 pc = 4.246 ly = 4.02 × 10¹³ km. Light from Proxima that reaches you tonight left it 4.2 years ago.'),
        key('Parallax is the <em>only</em> geometric, assumption-free distance to anything beyond the solar system. Every other method — standard candles, the Hubble law — is ultimately calibrated against stars whose parallax we have measured. It is the bottom rung of the distance ladder, and the whole ladder stands on it.'),
      ],
    },
    {
      id: 'limits',
      kicker: 'Concept',
      title: 'Errors, limits and a useful by-product',
      scene: [overview('sun'), rate(1)],
      body: [
        p('Because d = 1/p, errors in parallax do not translate simply into errors in distance. A parallax of 1.0 ± 0.1 mas gives d between 909 and 1111 pc — an asymmetric range — while a parallax of 0.1 ± 0.1 mas gives almost no distance at all. Rule of thumb: a parallax is useful when its uncertainty is well under ten percent of its value, which limits each instrument to a certain radius around the Sun.'),
        eq('\\frac{\\sigma_d}{d} \\approx \\frac{\\sigma_p}{p} \\qquad d_{\\text{max}} \\approx \\frac{1}{10\\,\\sigma_p}\\ \\text{pc} \\quad (\\sigma_p \\text{ in arcsec})', 'A 10 % distance needs a parallax ten times its own error. For Gaia\'s best stars, σ_p ≈ 25 µas gives d_max ≈ 4 kpc.'),
        p('Parallax measurements come with a free gift. Over the years the same star also drifts steadily across the sky — its <em>proper motion</em> μ, in arcseconds per year — because it and the Sun are moving through the Galaxy at different velocities. Once you know the distance, that angular drift becomes a real speed across the line of sight:'),
        eq('v_t = 4.74\\,\\mu\\,d \\qquad (v_t \\text{ in km/s},\\ \\mu \\text{ in arcsec/yr},\\ d \\text{ in pc})', 'The constant 4.74 converts AU per year into km/s. Together with the radial velocity from the Doppler shift, this gives the star\'s full velocity in space.'),
        example('Barnard\'s star has the largest proper motion known, μ = 10.36″/yr, and a parallax of 547 mas, so d = 1.83 pc. Transverse speed: v_t = 4.74 × 10.36 × 1.83 = 90 km/s — it will cross the Moon\'s diameter in about 180 years.'),
      ],
    },
    {
      id: 'parallax-summary',
      kicker: 'Section close',
      title: 'What to remember',
      scene: [backdrop()],
      body: [
        summary(
          'Parallax is the yearly shift of a nearby star against distant ones, with the Earth\'s orbit (1 AU) as baseline.',
          'd = 1/p: distance in parsecs equals one over the parallax in arcseconds. 1 pc = 206 265 AU = 3.26 ly.',
          'No star has p > 1″; the nearest (Proxima) has 0.768″. Bessel measured the first one, 61 Cygni, in 1838.',
          'Hipparcos (1 mas) reached 100 pc; Gaia (≈ 25 µas) reaches kiloparsecs for nearly two billion stars.',
          'Distance error ≈ parallax error in fractional terms; proper motion μ gives the transverse velocity v_t = 4.74 μ d.',
        ),
        p('Now that we can put a distance on a star, we can finally ask the question that brightness alone could not answer: how much light does it really emit? That needs a scale for brightness, and astronomy\'s is two thousand years old.'),
      ],
    },
  ],
};

const S3_2: Section = {
  id: 'magnitude-scale',
  number: '3.2',
  title: 'The Magnitude Scale',
  summary: 'Hipparchus\' six classes become a logarithmic ruler: apparent magnitude, the inverse-square law, absolute magnitude and the distance modulus that ties them together.',
  minutes: 18,
  steps: [
    {
      id: 'hipparchus',
      kicker: 'History',
      title: 'A ruler inherited from Hipparchus',
      scene: [goto('Sirius', 'star'), rate(1)],
      body: [
        p('Around 130 BC Hipparchus sorted the stars he could see into six classes. The brightest twenty or so were "first magnitude"; the faintest the eye could make out were "sixth". The scale was a ranking, not a measurement — and it ran backwards, with bigger numbers for fainter stars. Both quirks survive today, and every astronomer lives with them.'),
        p('When photometry became quantitative in the nineteenth century, astronomers found that the eye responds roughly to the <em>logarithm</em> of brightness: each of Hipparchus\' steps corresponded to a fairly constant <em>ratio</em> of light, and his first-magnitude stars delivered about a hundred times more light than his sixth. In 1856 Norman Pogson turned that into a definition.'),
        key('Pogson\'s rule: a difference of 5 magnitudes is <em>exactly</em> a factor of 100 in brightness. One magnitude is therefore a factor of 100<sup>1/5</sup> = 2.512. The scale is logarithmic and inverted: the larger the magnitude, the fainter the star.'),
        history('Hipparchus\' catalogue of about 850 stars, with positions and magnitudes, was the first of its kind and survived through Ptolemy\'s <em>Almagest</em>. The same man discovered precession (Chapter 1) by comparing his positions with older ones. Sirius, in front of you, was a first-magnitude star to him; on the modern scale it is −1.46, brighter than "first".'),
      ],
    },
    {
      id: 'apparent',
      kicker: 'Interactive · the scale',
      title: 'Apparent magnitude and the brightness ratio',
      widget: { type: 'magnitude' },
      body: [
        p('The <em>apparent magnitude</em> m measures how bright a star looks from Earth — strictly, the <em>radiant flux</em> F it delivers: the energy per second crossing each square metre of your telescope\'s aperture, in W m⁻². Pogson\'s rule relates the flux ratio of two stars to their magnitude difference:'),
        eq('\\frac{F_2}{F_1} = 100^{(m_1 - m_2)/5} \\qquad\\Longleftrightarrow\\qquad m_1 - m_2 = -2.5\\,\\log_{10}\\!\\left(\\frac{F_1}{F_2}\\right)', 'Five magnitudes = factor 100; one magnitude = factor 2.512; 0.1 mag ≈ 10 %. Note the sign: a <em>brighter</em> object has a <em>smaller</em> (or more negative) magnitude.'),
        p('Set the two markers in the widget to any pair of objects. The Sun at −26.8 and the full Moon at −12.7 differ by 14.1 magnitudes — a factor of 100<sup>14.1/5</sup> = 440 000 in brightness. The faintest objects imaged by the James Webb Space Telescope, near magnitude +31, are 10<sup>(31 + 26.8)/2.5</sup> ≈ 10<sup>23</sup> times fainter than the Sun.'),
        table(['Object', 'm', 'Object', 'm'],
          [
            ['Sun', '−26.83', 'Vega (defines ≈ 0)', '+0.03'],
            ['Full Moon', '−12.7', 'Polaris', '+1.98'],
            ['Venus at brightest', '−4.9', 'Naked-eye limit (dark sky)', '≈ +6.5'],
            ['Jupiter at brightest', '−2.9', 'Pluto', '≈ +14'],
            ['Sirius, brightest star', '−1.46', 'JWST deep field limit', '≈ +31'],
          ], 'Apparent (visual) magnitudes. The scale was anchored so that Vega is close to zero; today the zero point is defined by a set of standard stars.'),
        think('Two stars differ by exactly 1 magnitude. A third star is 1 magnitude fainter than the second. Is the first star 2 × 2.512 = 5.02 times brighter than the third, or 2.512² = 6.31 times? Why does the logarithmic scale make magnitudes <em>add</em> while fluxes <em>multiply</em>?'),
      ],
    },
    {
      id: 'inverse-square',
      kicker: 'Interactive · physics',
      title: 'The inverse-square law',
      widget: { type: 'distmod' },
      body: [
        p('Apparent magnitude mixes two very different things: how much light a star emits, and how far away it is. To separate them we need the <em>luminosity</em> L — the total energy the star radiates per second, in watts — and the rule that spreads that energy out. Light from a star crosses, at distance r, a sphere of area 4πr². If none is absorbed on the way, the flux through each square metre of that sphere is:'),
        eq('F = \\frac{L}{4\\pi r^2}', 'The inverse-square law. Double the distance and the same light is spread over four times the area, so the flux drops to a quarter.'),
        p('In the widget the shells around the star all carry the <em>same</em> total power; the farther one is simply bigger, so each square metre of it receives less. Drag the star away and watch the detector reading fall as 1/r² and its magnitude climb by 5 for every factor of 10 in distance — because a factor 100 in flux is 5 magnitudes.'),
        example('The Sun\'s luminosity is L☉ = 3.828 × 10²⁶ W and the Earth is 1 AU = 1.496 × 10¹¹ m away. F = 3.828 × 10²⁶ / (4π × (1.496 × 10¹¹)²) = 1361 W m⁻² — the <em>solar constant</em> measured by satellites above the atmosphere. At Neptune, 30 AU out, the Sun delivers 1361/900 = 1.5 W m⁻²: still 400 times brighter than the full Moon on Earth.', 'Worked example: the solar constant'),
        key('Flux is what we measure; luminosity is what we want. The inverse-square law connects them, but only if we know the distance — which is why Section 3.1 had to come first.'),
      ],
    },
    {
      id: 'absolute',
      kicker: 'Definition',
      title: 'Absolute magnitude: putting every star at 10 parsecs',
      scene: [goto('Vega', 'star'), rate(1)],
      body: [
        p('To compare stars fairly, astronomers imagine moving each one to the same standard distance and ask how bright it would look from there. The standard distance is 10 pc, and the apparent magnitude a star would have at 10 pc is its <em>absolute magnitude</em> M. Because the flux scales as 1/d², the inverse-square law and Pogson\'s rule combine into a single relation between m, M and d:'),
        eq('100^{(m - M)/5} = \\frac{F_{10}}{F} = \\left(\\frac{d}{10\\ \\text{pc}}\\right)^2', 'F is the flux at the true distance d, F₁₀ the flux the star would deliver from 10 pc.'),
        eq('m - M = 5\\,\\log_{10}\\!\\left(\\frac{d}{10\\ \\text{pc}}\\right) = 5\\log_{10} d - 5 \\qquad (d \\text{ in pc})', 'The <em>distance modulus</em>. It depends only on distance: for every factor of 10 in d, m − M grows by 5.'),
        p('The distance modulus is one of the most used relations in astronomy. Know any two of m, M and d and you have the third. Measure m and the parallax and you get M, the star\'s true brightness. Later we will learn to <em>infer</em> M from a star\'s spectrum or pulsation period; then measuring m gives the distance — and the distance ladder climbs beyond the reach of parallax.'),
        table(['Star', 'm', 'd (pc)', 'm − M', 'M'],
          [
            ['Sun', '−26.83', '4.85 × 10⁻⁶', '−31.57', '+4.74'],
            ['Sirius', '−1.46', '2.64', '−2.89', '+1.43'],
            ['Vega', '+0.03', '7.68', '−0.57', '+0.60'],
            ['Betelgeuse', '+0.45 (var.)', '≈ 168', '+6.1', '≈ −5.7'],
            ['Rigel', '+0.13', '≈ 260', '+7.1', '≈ −7.0'],
            ['Proxima Centauri', '+11.1', '1.30', '−4.43', '+15.5'],
          ], 'Sirius looks brightest because it is close. Rigel, 100 times farther, is intrinsically ten thousand times more luminous than Sirius. Proxima, the nearest star of all, is invisible to the naked eye.'),
      ],
    },
    {
      id: 'luminosity-ratio',
      kicker: 'Derivation',
      title: 'From magnitudes to luminosities',
      scene: [goto('Betelgeuse', 'star'), rate(1)],
      body: [
        p('Since absolute magnitudes compare stars at a common distance, a difference in M is a difference in luminosity. Applying Pogson\'s rule to the fluxes at 10 pc, which are proportional to L:'),
        eq('\\frac{L_2}{L_1} = 100^{(M_1 - M_2)/5} \\qquad M_1 - M_2 = -2.5\\,\\log_{10}\\!\\left(\\frac{L_1}{L_2}\\right)', 'With the Sun as reference, M☉ = +4.74: a star of M = −0.26 is exactly 100 times more luminous than the Sun.'),
        example('Betelgeuse: m ≈ +0.45, parallax about 6 mas → d ≈ 168 pc. Distance modulus m − M = 5 log₁₀(16.8) = 6.13, so M ≈ −5.7. Luminosity ratio to the Sun: L/L☉ = 100<sup>(4.74 + 5.7)/5</sup> = 100<sup>2.09</sup> ≈ 15 000 — in visible light alone. Most of Betelgeuse\'s output is infrared, which the eye does not count; its true total luminosity is about 100 000 L☉, as we will see in Section 3.6.'),
        p('A caution hides in that example. The magnitudes we have used so far are <em>visual</em>: they measure the light the eye (or a V filter) receives, not the total. Hot stars radiate mostly ultraviolet, cool stars mostly infrared, and both are undercounted by visual magnitudes. The full accounting — the <em>bolometric</em> magnitude — needs the physics of the next four sections.'),
        think('The distance modulus formula assumes no light is lost on the way. Between the stars there is dust, which dims and reddens starlight by a few tenths of a magnitude per kiloparsec in the Galactic plane. If you ignore it, do you over- or under-estimate the distance to a star of known M?'),
      ],
    },
    {
      id: 'magnitude-summary',
      kicker: 'Section close',
      title: 'What to remember',
      scene: [backdrop()],
      body: [
        summary(
          'Apparent magnitude m: logarithmic, inverted (brighter = smaller). 5 mag = ×100 in flux; 1 mag = ×2.512.',
          'F₂/F₁ = 100^((m₁−m₂)/5);  m₁ − m₂ = −2.5 log₁₀(F₁/F₂).',
          'Inverse-square law: F = L/(4πr²). The solar constant is 1361 W m⁻².',
          'Absolute magnitude M = apparent magnitude at 10 pc. M☉ = +4.74.',
          'Distance modulus: m − M = 5 log₁₀(d/10 pc). Luminosity ratio: L₂/L₁ = 100^((M₁−M₂)/5).',
        ),
        p('Magnitudes tell us how much light arrives. To learn what the light <em>is</em>, and what it says about the temperature of the surface that emitted it, we have to understand light itself. That story starts with a dispute between Newton and Huygens.'),
      ],
    },
  ],
};

const S3_3: Section = {
  id: 'wave-nature',
  number: '3.3',
  title: 'The Wave Nature of Light',
  summary: 'Particles or waves? Young\'s double slit settles it for a century, Maxwell shows light is an electromagnetic wave travelling at c, and the spectrum opens from radio to gamma rays.',
  minutes: 18,
  steps: [
    {
      id: 'newton-huygens',
      kicker: 'History',
      title: 'Corpuscles against waves',
      scene: [goto('sun'), rate(1)],
      body: [
        p('What is light? Newton, in his <em>Opticks</em> (1704), argued that it is a stream of tiny particles — <em>corpuscles</em> — because light travels in straight lines and casts sharp shadows, which waves, spreading around corners, seemed unable to do. Christiaan Huygens had argued in 1678 that light is a wave in an all-pervading medium: every point on a wavefront acts as a source of secondary wavelets, and the new wavefront is their envelope. Huygens\' principle explained reflection and refraction beautifully. Newton\'s authority won anyway, for a hundred years.'),
        compare({ title: 'Newton · corpuscles', items: ['Straight-line travel and sharp shadows', 'Different colours = different sized particles', 'Refraction: particles pulled into the denser medium, so light should be <em>faster</em> in glass'] },
          { title: 'Huygens · waves', items: ['Wavefronts and secondary wavelets', 'Different colours = different wavelengths', 'Refraction: waves <em>slower</em> in glass, bending toward the normal'] }),
        p('The two theories made one opposite prediction — the speed of light in glass or water — but nobody could measure it until Foucault in 1850 (slower in water: waves win). Long before that, in 1801, Thomas Young found a simpler test: let light pass through two slits and see whether it adds like particles or like waves.'),
        history('Huygens also built the best telescopes of his day, discovered Titan and worked out that Saturn\'s "handles" were a ring. His <em>Traité de la Lumière</em> (1690) is the first wave theory of light; it even explains the double refraction of Iceland spar.'),
      ],
    },
    {
      id: 'young',
      kicker: 'Interactive · experiment',
      title: 'Young\'s double-slit experiment',
      widget: { type: 'doubleslit' },
      body: [
        p('Monochromatic light falls on two narrow slits a distance d apart. Each slit becomes a source of circular wavelets (Huygens again). Where the two wave trains arrive <em>in step</em> — crest meeting crest — they reinforce, and the screen is bright. Where they arrive half a wavelength out of step — crest meeting trough — they cancel, and the screen is dark. Particles cannot cancel. Waves can, and do.'),
        eq('d\\sin\\theta = n\\lambda \\quad \\text{(bright)} \\qquad d\\sin\\theta = \\left(n + \\tfrac{1}{2}\\right)\\lambda \\quad \\text{(dark)} \\qquad n = 0, 1, 2, \\ldots', 'The path difference between the two slits to a point at angle θ is d sin θ. A whole number of wavelengths → constructive; a half-integer → destructive.'),
        eq('\\Delta y \\approx \\frac{\\lambda L}{d}', 'For a screen at distance L ≫ d, the bright fringes are evenly spaced. Long wavelengths and narrow slit separations spread the pattern out.'),
        p('Try it. Slide the wavelength from blue to red: the fringes spread apart, so <em>colour is wavelength</em>. Push the slits closer together and the pattern spreads too. Young measured fringe spacings and obtained the first wavelengths of visible light — about 0.4 µm for violet and 0.7 µm for red — from a candle, two pinholes and a ruler.'),
        key('Interference is the signature of a wave. The double slit showed that light has wavelength and phase; Fresnel\'s mathematics (1818) then explained diffraction and sharp shadows too, and Newton\'s corpuscles were abandoned — until Einstein brought them back in a new form in 1905 (Section 3.5).'),
        think('In 1818 Poisson argued that Fresnel\'s theory predicted something absurd: a bright spot at the centre of the shadow of a round disc. Arago went and looked. The spot was there. What does it take for a theory\'s most "absurd" prediction to become its best confirmation?'),
      ],
    },
    {
      id: 'maxwell',
      kicker: 'Interactive · theory',
      title: 'Maxwell: light is an electromagnetic wave',
      widget: { type: 'emwave' },
      body: [
        p('Waves need something to wave. In the 1860s James Clerk Maxwell gathered everything known about electricity and magnetism into four equations and noticed that they admit wave solutions: a changing electric field creates a magnetic field, a changing magnetic field creates an electric field, and the pair can sustain itself and travel through empty space. The speed of that wave came out of two laboratory constants:'),
        eq('c = \\frac{1}{\\sqrt{\\varepsilon_0 \\mu_0}} = 2.998 \\times 10^{8}\\ \\text{m/s}', 'ε₀ and μ₀, the electric and magnetic constants, were measured with capacitors and coils. Their combination gave the speed of light — which had been measured quite separately by Fizeau and Foucault. Maxwell concluded that light <em>is</em> such a wave.'),
        p('Watch the widget. The electric field E (vertical) and the magnetic field B (horizontal) oscillate in phase, perpendicular to each other and to the direction of travel; the whole pattern slides forward at c. The distance between crests is the wavelength λ, the number of crests passing per second is the frequency ν, and because the wave moves at c:'),
        eq('c = \\lambda\\,\\nu', 'Wavelength and frequency are two labels for the same wave. Visible light: λ ≈ 400–700 nm, ν ≈ 4–7.5 × 10¹⁴ Hz.'),
        p('Maxwell\'s waves carry energy and momentum. The energy flow per unit area is the Poynting vector S = E × B/μ₀, and a beam of flux F absorbed by a surface pushes on it with a pressure F/c (twice that if reflected). Sunlight at Earth pushes with 4.5 µPa — negligible for you, but enough to steer a solar sail and to blow the dust tail of a comet away from the Sun.'),
        history('Heinrich Hertz generated and detected Maxwell\'s waves with spark gaps in 1887–88 and showed they reflect, refract and interfere just like light. Asked what use they were, he reportedly said "nothing, I guess." Radio followed within a decade.'),
      ],
    },
    {
      id: 'the-spectrum',
      kicker: 'Interactive · the spectrum',
      title: 'The electromagnetic spectrum',
      widget: { type: 'spectrum' },
      scene: [goto('jwst'), rate(1)],
      body: [
        p('If light is an electromagnetic wave, there is no reason its wavelength should be confined to the narrow band our eyes evolved to use. Herschel had already found invisible "calorific rays" beyond the red in 1800, and Ritter ultraviolet beyond the violet in 1801. Maxwell\'s theory predicted a continuum from arbitrarily long to arbitrarily short wavelengths, and every part of it has since been found in the sky.'),
        table(['Band', 'Wavelength', 'Sources in the sky', 'From the ground?'],
          [
            ['Radio', '> 1 mm', 'pulsars, cold gas (21 cm), jets', 'yes'],
            ['Microwave', '1 mm – 1 cm', 'cosmic microwave background', 'partly'],
            ['Infrared', '700 nm – 1 mm', 'dust, protostars, redshifted galaxies', 'narrow windows'],
            ['Visible', '400 – 700 nm', 'stars, nebulae, galaxies', 'yes'],
            ['Ultraviolet', '10 – 400 nm', 'hot stars, white dwarfs', 'no'],
            ['X-ray', '0.01 – 10 nm', 'accretion discs, hot cluster gas', 'no'],
            ['Gamma ray', '< 0.01 nm', 'bursts, pulsars, active galaxies', 'no'],
          ]),
        p('The atmosphere is transparent only in the visible and radio windows, which is why the telescope in front of you — JWST, observing in the infrared — sits 1.5 million kilometres away at L2, and why X-ray and gamma-ray astronomy had to wait for rockets and satellites. Every band tells a different part of the story: the same galaxy looks like a smooth disc of old stars in the infrared and a scatter of hot young clusters in the ultraviolet.'),
        key('Wavelength is the organising variable of all astronomy. In the next sections it will tell us a star\'s temperature; in later chapters its composition, its velocity and its distance.'),
      ],
    },
    {
      id: 'wave-summary',
      kicker: 'Section close',
      title: 'What to remember',
      scene: [backdrop()],
      body: [
        summary(
          'Newton\'s corpuscles vs Huygens\' waves; Young\'s double slit (1801) showed interference — a wave property.',
          'Bright fringes at d sin θ = nλ; fringe spacing Δy = λL/d. Colour is wavelength.',
          'Maxwell (1865): light is an electromagnetic wave with E ⟂ B ⟂ direction of travel, speed c = 1/√(ε₀μ₀).',
          'c = λν. Light carries energy (Poynting vector) and momentum (radiation pressure F/c).',
          'The spectrum runs from radio to gamma rays; the atmosphere passes only the visible and radio windows.',
        ),
        p('We now know what light is. The next question is why a hot object glows at all, and why hotter things glow bluer — the physics that lets us take a star\'s temperature from across the Galaxy.'),
      ],
    },
  ],
};

const S3_4: Section = {
  id: 'blackbody-radiation',
  number: '3.4',
  title: 'Blackbody Radiation',
  summary: 'Why hot things glow and why colour tracks temperature: Wien\'s displacement law, the Stefan–Boltzmann law and the effective temperature — then Betelgeuse measured with them.',
  minutes: 18,
  steps: [
    {
      id: 'colours-of-stars',
      kicker: 'Observation',
      title: 'Orion\'s two shoulders',
      scene: [goto('Betelgeuse', 'star'), rate(1)],
      body: [
        p('Look at Orion on a winter night and the two brightest stars are plainly different colours. Betelgeuse, at the hunter\'s shoulder, is a deep orange-red. Rigel, at his foot, is a brilliant blue-white. The contrast is visible to the naked eye and it was noted by ancient observers — but only in the nineteenth century did anyone understand that they were looking at a <em>thermometer</em>.'),
        p('You know the effect from everyday life. Heat a piece of iron and it first glows dull red, then orange, then yellow, and at the temperatures of a welding arc, blue-white. The colour of a glowing object depends on its temperature, and hardly at all on what it is made of. A heated iron bar, the filament of an old light bulb, molten glass and the surface of a star all follow the same curve.'),
        key('The colour of a hot, opaque object is set by its temperature. Betelgeuse is red because its surface is about 3 600 K; Rigel is blue because its surface is about 12 000 K. Reading the colour of a star is taking its temperature from hundreds of light years away.'),
        terms(
          ['Blackbody', 'An idealised object that absorbs all light falling on it (hence "black") and, in thermal equilibrium, re-emits a spectrum that depends only on its temperature.'],
          ['Thermal radiation', 'Light emitted by matter because of its temperature — produced by the thermal jiggling of charged particles.'],
          ['Continuous spectrum', 'Emission at all wavelengths, without gaps or lines. A blackbody has the smoothest continuous spectrum there is.'],
        ),
      ],
    },
    {
      id: 'blackbody',
      kicker: 'Interactive · the curves',
      title: 'The blackbody spectrum and Wien\'s law',
      widget: { type: 'blackbody' },
      body: [
        p('A perfect absorber is also, in equilibrium, a perfect emitter; its emission is called <em>blackbody radiation</em> and its spectrum has a universal shape — a hump that rises steeply from short wavelengths, peaks, and falls slowly toward long ones. Raise the temperature and two things happen at once: the whole curve rises at every wavelength, and the peak slides toward shorter wavelengths. Slide the temperature in the widget and watch the hump move through the rainbow band.'),
        eq('\\lambda_{\\max}\\,T = 0.002898\\ \\text{m K} = 2.898 \\times 10^{6}\\ \\text{nm K}', 'Wien\'s displacement law (1893). The wavelength of peak emission is inversely proportional to temperature.'),
        example('The Sun, T = 5772 K: λ_max = 2.898 × 10⁶ / 5772 = 502 nm — green-blue, near the peak sensitivity of the human eye, which is no coincidence. Betelgeuse, 3 600 K: λ_max = 805 nm, in the near infrared — most of its light is invisible to us, and what we see is the red tail. Rigel, 12 000 K: λ_max = 242 nm, in the ultraviolet; we see only its blue shoulder.'),
        p('Note what the curves do <em>not</em> do: they never cross. A hotter blackbody emits more at <em>every</em> wavelength, red included. Betelgeuse looks red not because it emits little blue light compared with a cool object, but because it emits so much more red than blue; Rigel looks blue because its blue is overwhelming. Stars are not perfect blackbodies — absorption lines and the structure of their atmospheres leave fingerprints we will study later — but the overall shape of a stellar spectrum is close enough to make these laws the working tools of the subject.'),
        history('Wien derived his law in 1893 by a thermodynamic argument about radiation in a slowly compressed cavity, without knowing the shape of the curve. He won the Nobel Prize for it in 1911 — ironically, the year after Planck\'s formula had shown exactly where Wien\'s own guess for the full spectrum went wrong.'),
      ],
    },
    {
      id: 'stefan-boltzmann',
      kicker: 'Interactive · the law',
      title: 'The Stefan–Boltzmann law and the effective temperature',
      widget: { type: 'lrt' },
      body: [
        p('The <em>total</em> power a blackbody radiates — the area under the whole curve — rises very fast with temperature. Josef Stefan found the rule empirically in 1879 and Ludwig Boltzmann derived it from thermodynamics in 1884: the energy emitted per second from each square metre of surface goes as the <em>fourth power</em> of the temperature.'),
        eq('F_{\\text{surf}} = \\sigma T^4 \\qquad \\sigma = 5.670 \\times 10^{-8}\\ \\text{W m}^{-2}\\text{K}^{-4}', 'Double the temperature and each square metre radiates sixteen times as much.'),
        eq('L = 4\\pi R^2 \\sigma T_e^4', 'A spherical star of radius R: surface area times flux. This <em>defines</em> the effective temperature T_e — the temperature of the blackbody that would radiate the star\'s luminosity from the star\'s surface.'),
        p('Play with the widget. Luminosity depends on two things, size and temperature, and the fourth power makes temperature dominate: a star twice as hot as the Sun with the same radius is 16 L☉; a star the Sun\'s temperature but twice its radius is only 4 L☉. The presets show how differently real stars combine the two — a white dwarf is hotter than the Sun yet a thousand times fainter, because it is the size of the Earth.'),
        example('The Sun: L☉ = 3.828 × 10²⁶ W, R☉ = 6.957 × 10⁸ m. T_e = (L/(4πR²σ))^{1/4} = (3.828 × 10²⁶ / (4π × 4.840 × 10¹⁷ × 5.670 × 10⁻⁸))^{1/4} = (1.110 × 10¹⁵)^{1/4} = 5772 K. Each square metre of the solar surface radiates σT⁴ = 63 MW — the output of a small power station from a patch the size of a dining table.', 'Worked example: the Sun\'s effective temperature'),
      ],
    },
    {
      id: 'betelgeuse',
      kicker: 'Worked example',
      title: 'Measuring Betelgeuse',
      scene: [goto('Betelgeuse', 'star'), rate(1)],
      body: [
        p('Now combine everything. Betelgeuse has a measured parallax of about 6 mas, so d ≈ 168 pc. Its total (bolometric) flux at Earth, adding up all wavelengths including the infrared, is about 1.3 × 10⁻⁷ W m⁻². From its colour (Section 3.6) its effective temperature is about 3 600 K. Three numbers — and we can find its luminosity, its radius and the wavelength at which it shines brightest.'),
        eq('L = 4\\pi d^2 F = 4\\pi\\,(5.18 \\times 10^{18}\\ \\text{m})^2 \\times 1.3 \\times 10^{-7}\\ \\text{W m}^{-2} \\approx 4.4 \\times 10^{31}\\ \\text{W} \\approx 1.2 \\times 10^{5}\\ L_\\odot', 'Inverse-square law, run backwards: from flux and distance to luminosity.'),
        eq('R = \\sqrt{\\frac{L}{4\\pi\\sigma T_e^4}} = \\sqrt{\\frac{4.4 \\times 10^{31}}{4\\pi \\times 5.67 \\times 10^{-8} \\times (3600)^4}} \\approx 6.2 \\times 10^{11}\\ \\text{m} \\approx 890\\ R_\\odot \\approx 4.1\\ \\text{AU}', 'Stefan–Boltzmann, run backwards: a star that cool and that luminous must be enormous.'),
        eq('\\lambda_{\\max} = \\frac{2.898 \\times 10^{6}\\ \\text{nm K}}{3600\\ \\text{K}} \\approx 805\\ \\text{nm}', 'Wien\'s law: the peak is in the near infrared.'),
        p('Put Betelgeuse where the Sun is and its surface would reach beyond the orbit of Mars, swallowing the Earth. It is a red supergiant — a star near the end of its life, puffed up to a size at which its average density is a ten-millionth of the air you are breathing. The temperature that makes it red also makes it, square metre for square metre, a feeble radiator; it is luminous only because it has an almost unimaginable number of square metres.'),
        note('Betelgeuse\'s distance is genuinely uncertain — estimates range from about 150 to 220 pc, and the star is so large that its own disc confuses the parallax measurement. Since L ∝ d² and R ∝ d, a 30 % error in distance becomes a 70 % error in luminosity. In 2019–20 the star dimmed by more than a magnitude when it ejected a cloud of dust; such episodes make its "true" brightness a moving target.', 'A caution about the numbers'),
      ],
    },
    {
      id: 'blackbody-summary',
      kicker: 'Section close',
      title: 'What to remember',
      scene: [backdrop()],
      body: [
        summary(
          'A blackbody absorbs everything and emits a continuous spectrum fixed by its temperature alone. Stars are approximate blackbodies.',
          'Wien\'s law: λ_max T = 2.898 × 10⁶ nm K. Hotter → bluer. Sun 502 nm, Betelgeuse 805 nm, Rigel 242 nm.',
          'Stefan–Boltzmann: surface flux σT⁴; luminosity L = 4πR²σT_e⁴. This defines the effective temperature.',
          'Hotter curves lie above cooler ones at every wavelength; they never cross.',
          'Flux + distance → L; L + T → R. Betelgeuse: 1.2 × 10⁵ L☉, R ≈ 890 R☉ ≈ 4 AU.',
        ),
        p('These laws were found by experiment and thermodynamics. Nobody could derive the <em>shape</em> of the blackbody curve from first principles — and when they tried, classical physics gave an answer so wrong it has been called a catastrophe.'),
      ],
    },
  ],
};

const S3_5: Section = {
  id: 'quantization',
  number: '3.5',
  title: 'The Quantization of Energy',
  summary: 'Classical physics predicts infinite ultraviolet light from every warm object. Planck\'s desperate fix — energy in packets of hν — gives the correct blackbody formula and starts quantum mechanics.',
  minutes: 18,
  steps: [
    {
      id: 'catastrophe',
      kicker: 'Interactive · the crisis',
      title: 'The ultraviolet catastrophe',
      widget: { type: 'blackbody', mode: 'catastrophe' },
      body: [
        p('By 1900 the blackbody curve had been measured precisely in Berlin, and the theorists set out to derive it. Lord Rayleigh (and later James Jeans) did it the honest classical way: count the standing electromagnetic waves that fit inside a hot cavity, and give each one the average thermal energy kT that classical statistical mechanics assigns to every oscillator. The result:'),
        eq('B_\\lambda(T) \\approx \\frac{2ckT}{\\lambda^4}', 'The Rayleigh–Jeans law. It fits the measurements beautifully at long wavelengths — and goes to infinity as λ → 0.'),
        p('Look at the dashed curve in the widget. At long wavelengths it hugs the data. But there is no limit to how many short-wavelength waves fit in a box, and each gets the same kT, so the predicted intensity climbs without bound into the ultraviolet. Integrate over all wavelengths and every warm object should radiate <em>infinite</em> power — your coffee cup should vaporise you with gamma rays. Ehrenfest later called this the <em>ultraviolet catastrophe</em>. The failure was not of a detail but of classical physics itself.'),
        p('Wilhelm Wien had earlier guessed a formula, B_λ ∝ λ⁻⁵ e^{−b/λT}, that worked at <em>short</em> wavelengths and failed at long ones (the dotted curve). Two half-right formulas, each wrong where the other was right. Max Planck, who had spent years on the thermodynamics of radiation, set out in October 1900 to find a single expression that joined them.'),
        key('The Rayleigh–Jeans law is not a mistake in algebra; it is the correct consequence of classical physics. Its failure showed that something fundamental about energy and oscillators was missing.'),
      ],
    },
    {
      id: 'planck',
      kicker: 'The formula',
      title: 'Planck\'s function',
      scene: [goto('sun'), rate(1)],
      body: [
        p('Planck first found the right formula by interpolating between Wien and Rayleigh–Jeans — "a lucky guess", he called it. Then he spent the "most strenuous weeks of my life" trying to derive it. He succeeded only by making an assumption he himself called "an act of desperation": the oscillators in the cavity walls could not have any energy they liked. Their energy had to be a whole-number multiple of a smallest unit proportional to the frequency.'),
        eq('E = n\\,h\\nu \\qquad n = 0, 1, 2, \\ldots \\qquad h = 6.626 \\times 10^{-34}\\ \\text{J s}', 'Planck\'s quantum hypothesis. The constant h — Planck\'s constant — is new to physics and sets the scale of the quantum world.'),
        eq('B_\\lambda(T) = \\frac{2hc^2/\\lambda^5}{e^{hc/(\\lambda k T)} - 1}', 'The Planck function in wavelength form: intensity per unit wavelength, per unit solid angle, in W m⁻³ sr⁻¹. The −1 in the denominator is the whole story.'),
        eq('B_\\nu(T) = \\frac{2h\\nu^3/c^2}{e^{h\\nu/(kT)} - 1}', 'The same function per unit frequency. Note B_ν dν = B_λ dλ with dν = −(c/λ²) dλ, so the peak of B_ν is <em>not</em> at ν = c/λ_max.'),
        p('Check its two ends. For long wavelengths, hc/λkT ≪ 1, and e^x − 1 ≈ x, so B_λ → 2hc²/λ⁵ × λkT/hc = 2ckT/λ⁴: Rayleigh–Jeans, with Planck\'s constant cancelling out — classical physics is the low-frequency limit of quantum physics. For short wavelengths, hc/λkT ≫ 1 and the −1 is negligible, giving Wien\'s exponential. In between, the exponential wins over the λ⁻⁵ and the curve turns over: the catastrophe is gone.'),
        history('Planck presented the formula to the German Physical Society on 14 December 1900 — the date usually given as the birth of quantum theory. He regarded the quantisation as a mathematical device and spent years hoping to remove it. He never could. He received the Nobel Prize in 1918.'),
      ],
    },
    {
      id: 'why-it-works',
      kicker: 'Interactive · the mechanism',
      title: 'Why quantisation tames the ultraviolet',
      widget: { type: 'quantum' },
      body: [
        p('Why does chopping energy into packets of hν cure the catastrophe? Because of a mismatch between the rungs of the ladder and the thermal energy available to climb it. In a cavity at temperature T, the chance that an oscillator has energy E is proportional to the Boltzmann factor e^{−E/kT}. Classically E is continuous and the <em>average</em> energy is always kT, whatever the frequency. With rungs at 0, hν, 2hν, … the average becomes:'),
        eq('\\langle E \\rangle = \\frac{h\\nu}{e^{h\\nu/(kT)} - 1}', 'The average energy of a quantised oscillator in thermal equilibrium. Multiply by the number of modes per unit volume and you have Planck\'s law.'),
        p('Use the widget. At low frequency the rungs are close together compared with kT; many are occupied and the average is almost exactly kT, as classical physics says. Raise the frequency: the first rung, hν, moves above kT. Now the oscillator almost never has enough energy to reach even the first step — the Boltzmann factor e^{−hν/kT} crushes it — and its average energy plunges toward zero. High-frequency modes are <em>frozen out</em>. There are still infinitely many of them, but they carry no energy.'),
        p('Five years later, in 1905, Einstein took the hypothesis more seriously than Planck did. If oscillators exchange energy in packets of hν, perhaps the light <em>itself</em> comes in packets. His light quanta — later called <em>photons</em> — explained the photoelectric effect and earned him his Nobel Prize. Newton\'s corpuscles were back, now with a wavelength attached.'),
        eq('E_{\\text{photon}} = h\\nu = \\frac{hc}{\\lambda} \\qquad hc = 1240\\ \\text{eV nm}', 'A photon of green light (500 nm) carries 2.5 eV; an X-ray photon of 1 nm carries 1240 eV; a 21-cm radio photon 6 µeV. The electron-volt, 1.602 × 10⁻¹⁹ J, is the natural unit.'),
        think('Starlight at 500 nm delivers about 10⁻⁸ W m⁻² to your eye from a bright star. How many photons per second enter a 7 mm pupil? (About 10⁵ — enough that you never notice the graininess. Now repeat for a magnitude-30 galaxy in a 6.5-m telescope: a few photons per <em>minute</em>.)'),
      ],
    },
    {
      id: 'consequences',
      kicker: 'Derivation',
      title: 'Everything in Section 3.4 falls out of Planck\'s law',
      scene: [goto('sun'), rate(1)],
      body: [
        p('Planck\'s function is not just a curve-fit; it <em>contains</em> the empirical laws. Set the derivative of B_λ with respect to λ to zero and you find the peak, where the dimensionless combination x = hc/(λkT) satisfies x = 5(1 − e^{−x}), whose solution is x = 4.965:'),
        eq('\\lambda_{\\max} T = \\frac{hc}{4.965\\,k} = 2.898 \\times 10^{-3}\\ \\text{m K}', 'Wien\'s displacement law, now derived, with its constant expressed in h, c and k.'),
        eq('\\int_0^\\infty \\pi B_\\lambda(T)\\,d\\lambda = \\sigma T^4 \\qquad \\sigma = \\frac{2\\pi^5 k^4}{15\\,c^2 h^3}', 'Integrate over all wavelengths (and over the hemisphere, which gives the factor π) and the Stefan–Boltzmann law appears, with σ built from fundamental constants. Measuring σ and the Wien constant is thus a way to measure h and k.'),
        p('For astronomy the useful quantities are the <em>monochromatic</em> luminosity and flux — the power emitted or received in a narrow wavelength interval dλ. For a spherical blackbody of radius R, seen from distance r:'),
        eq('L_\\lambda\\,d\\lambda = 4\\pi R^2\\,\\pi B_\\lambda\\,d\\lambda \\qquad F_\\lambda\\,d\\lambda = \\pi B_\\lambda \\left(\\frac{R}{r}\\right)^2 d\\lambda', 'Surface area × emitted flux per wavelength; and the inverse-square law applied wavelength by wavelength. These are what a spectrograph measures.'),
        key('Planck\'s law is the bridge between the microscopic (h, the quantum) and the astronomical (the colours and luminosities of stars). It is why a measured spectrum can be converted to a temperature, and why that temperature, with a radius, gives a luminosity.'),
      ],
    },
    {
      id: 'quantization-summary',
      kicker: 'Section close',
      title: 'What to remember',
      scene: [backdrop()],
      body: [
        summary(
          'Rayleigh–Jeans (classical): B_λ = 2ckT/λ⁴ — right at long λ, infinite at short λ: the ultraviolet catastrophe.',
          'Planck (1900): oscillator energies are quantised, E = nhν, h = 6.626 × 10⁻³⁴ J s.',
          'Planck function: B_λ = (2hc²/λ⁵)/(e^{hc/λkT} − 1). Limits: Rayleigh–Jeans for hc/λkT ≪ 1, Wien for ≫ 1.',
          'High-frequency modes are frozen out because hν ≫ kT; ⟨E⟩ = hν/(e^{hν/kT} − 1).',
          'Photons: E = hν = hc/λ (hc = 1240 eV nm). Wien\'s law and σ = 2π⁵k⁴/(15c²h³) follow from Planck\'s law.',
        ),
        p('We can now predict exactly how much light a star of given temperature emits at every wavelength. The last step is to turn that around: measure a star through a few coloured filters and read off its temperature.'),
      ],
    },
  ],
};

const S3_6: Section = {
  id: 'color-index',
  number: '3.6',
  title: 'The Color Index',
  summary: 'Three filters, two numbers: the UBV system, how B−V measures temperature, the colour–colour diagram, and the bolometric correction that recovers the light our eyes cannot see.',
  minutes: 18,
  steps: [
    {
      id: 'ubv',
      kicker: 'The system',
      title: 'Measuring colour with filters: the UBV system',
      scene: [goto('Vega', 'star'), rate(1)],
      body: [
        p('A full spectrum of every star is expensive. A cheaper way to capture the <em>shape</em> of the blackbody curve is to measure a star\'s brightness through a few standard coloured filters and compare the results. The standard set, defined by Harold Johnson and William Morgan in 1953, has three: U for ultraviolet, B for blue and V for "visual" (yellow-green, matching the eye). Each filter passes a band roughly 100 nm wide.'),
        table(['Filter', 'Central wavelength', 'Bandwidth', 'Magnitude'],
          [
            ['U — ultraviolet', '365 nm', '≈ 68 nm', 'U'],
            ['B — blue', '440 nm', '≈ 98 nm', 'B'],
            ['V — visual', '550 nm', '≈ 89 nm', 'V'],
          ], 'The Johnson–Morgan UBV system. V magnitudes are close to the eye\'s "apparent magnitude" of Section 3.2; the Sun has V = −26.74.'),
        p('A star\'s U, B and V magnitudes are its apparent magnitudes through each filter. The zero points are set so that an A0 star like Vega has U = B = V — its colours are all zero by definition. Absolute magnitudes exist for each filter too (M_U, M_B, M_V); the distance modulus is the same for all of them, since distance does not care about colour:'),
        eq('U - M_U = B - M_B = V - M_V = 5\\log_{10}\\!\\left(\\frac{d}{10\\ \\text{pc}}\\right)', 'One distance modulus for all filters — which is why magnitude <em>differences</em> between filters are distance-independent.'),
        key('Subtracting two filter magnitudes cancels the distance entirely. What remains measures only the <em>shape</em> of the spectrum — and the shape of a blackbody spectrum is set by temperature.'),
      ],
    },
    {
      id: 'color-index',
      kicker: 'Interactive · colour and temperature',
      title: 'B − V: a thermometer you can read with two measurements',
      widget: { type: 'colorindex' },
      body: [
        p('The <em>colour indices</em> are the differences between filter magnitudes, by convention shorter wavelength minus longer:'),
        eq('U - B = M_U - M_B \\qquad B - V = M_B - M_V', 'Independent of distance. Remember magnitudes run backwards: a <em>large</em> B − V means the star is fainter in B than in V — it is <em>red</em>. A negative B − V means more blue than yellow light: a blue star.'),
        p('In the widget the three filter bands sit over a blackbody spectrum. Slide the temperature. For a hot star the curve rises toward the blue, so more light gets through B than V, B is numerically smaller, and B − V is negative. For a cool star the curve climbs toward the red and B − V becomes large and positive. One index, two photometric measurements, and you have the temperature.'),
        table(['Star', 'T_e (K)', 'B − V', 'U − B', 'Colour'],
          [
            ['Rigel', '12 100', '−0.03', '−0.66', 'blue-white'],
            ['Vega', '9 600', '0.00', '0.00', 'white (by definition)'],
            ['Sirius', '9 940', '+0.00', '−0.05', 'white'],
            ['Sun', '5 772', '+0.65', '+0.17', 'yellow'],
            ['Arcturus', '4 290', '+1.23', '+1.27', 'orange'],
            ['Betelgeuse', '3 600', '+1.85', '+2.06', 'red'],
          ], 'Measured colour indices of real stars. B − V runs from about −0.3 for the hottest stars to about +2 for the coolest.'),
        example('Suppose a star is measured at B = 10.52 and V = 9.87, so B − V = +0.65 — the same as the Sun. For a blackbody that colour corresponds to T ≈ 5 800 K (a widely used empirical fit is T ≈ 4600 K × [1/(0.92(B−V) + 1.70) + 1/(0.92(B−V) + 0.62)], which gives 5 770 K). Without knowing its distance we have taken its temperature.'),
        think('Stars are not perfect blackbodies, and the widget\'s U − B for an A-type star like Vega is slightly off the real value. The culprit is hydrogen: at ≈ 10 000 K the atmosphere absorbs strongly just shortward of 365 nm (the <em>Balmer jump</em>), stealing light from the U band. Why does this make the <em>colour–colour</em> diagram useful for identifying a star\'s type as well as its temperature?'),
      ],
    },
    {
      id: 'color-color',
      kicker: 'Concept',
      title: 'The colour–colour diagram',
      scene: [goto('l-pleiades', 'landmark'), rate(1)],
      body: [
        p('Plot U − B against B − V for a sample of stars and you get a <em>colour–colour diagram</em>. Blackbodies of every temperature fall on a single smooth line. Real stars trace a line that is close to it but wiggles: hot O and B stars lie near the blackbody line, A stars (like Vega) sit <em>above</em> it in U − B because the Balmer jump removes ultraviolet light, and cool stars drift away because molecular bands eat into their spectra.'),
        p('Those departures are not noise; they are information. The vertical offset from the blackbody line measures the strength of the Balmer jump, which depends on the surface gravity of the star — a giant and a dwarf of the same temperature separate. Interstellar dust moves a star along a known diagonal (reddening both indices), so the diagram also measures how much dust lies in front of a star cluster like the Pleiades.'),
        key('Three magnitudes give two colours. One colour is a thermometer; two colours together begin to tell you what <em>kind</em> of star you are looking at and what lies between you and it. This is the cheapest spectroscopy there is, and for faint stars it is the only kind possible.'),
        note('The UBV system has been extended with R and I (red and near-infrared) and joined by many others — the Sloan ugriz filters, the Gaia G/BP/RP bands, the 2MASS JHK infrared bands. The idea is always the same: magnitude differences between bands measure spectral shape, free of distance.', 'Beyond UBV'),
      ],
    },
    {
      id: 'bolometric',
      kicker: 'Definition',
      title: 'The bolometric correction: counting all the light',
      scene: [goto('Betelgeuse', 'star'), rate(1)],
      body: [
        p('All the magnitudes so far have been measured through filters, so each misses most of the spectrum. The <em>bolometric magnitude</em> m_bol counts the flux at <em>all</em> wavelengths — the quantity that connects to luminosity through the inverse-square law. The difference between it and the visual magnitude is the <em>bolometric correction</em> BC:'),
        eq('BC = m_{\\text{bol}} - V = M_{\\text{bol}} - M_V', 'Always zero or negative in this convention: the total light is at least as much as what V alone sees, so m_bol ≤ V.'),
        p('For a star like the Sun, whose spectrum peaks near the V band, the correction is tiny: BC☉ = −0.07, M_bol,☉ = +4.74. For stars whose light is mostly outside the visible it is large. Betelgeuse radiates mainly in the infrared and has BC ≈ −1.6; a hot O star radiates mainly in the ultraviolet and can have BC ≈ −4. The correction depends almost entirely on temperature, so once B − V has given you T, a table gives you BC.'),
        eq('\\frac{L}{L_\\odot} = 10^{\\,0.4\\,(M_{\\text{bol},\\odot} - M_{\\text{bol}})} = 10^{\\,0.4\\,(4.74 - M_{\\text{bol}})}', 'Bolometric absolute magnitude to luminosity — the only version of the magnitude–luminosity relation that is exact.'),
        example('Betelgeuse again, this time properly. V ≈ +0.45, BC ≈ −1.6 → m_bol ≈ −1.15. With d ≈ 168 pc the distance modulus is 6.13, so M_bol ≈ −7.3. Then L/L☉ = 10^{0.4 × (4.74 + 7.3)} = 10^{4.8} ≈ 65 000 — compared with the 15 000 we got from visual light alone in Section 3.2. Including the infrared quadruples the luminosity, and brings it in line with the 10⁵ L☉ of the Stefan–Boltzmann estimate in Section 3.4 (within the large uncertainty in Betelgeuse\'s distance).'),
      ],
    },
    {
      id: 'the-toolkit',
      kicker: 'Synthesis',
      title: 'The toolkit, assembled',
      scene: [goto('Rigel', 'star'), rate(1)],
      body: [
        p('Step back and look at what this chapter has built. With a parallax, three filter magnitudes and the physics of blackbodies, we can take a point of light we will never visit and determine its distance, its temperature, its total power output and its size. Here is the chain, applied to Rigel in front of you:'),
        list(
          'Parallax p ≈ 3.8 mas → d = 1/p ≈ 260 pc (Section 3.1).',
          'V = +0.13, B − V = −0.03 → T_e ≈ 12 000 K from the colour index (Section 3.6).',
          'BC ≈ −0.8 at that temperature → m_bol ≈ −0.67; distance modulus 7.1 → M_bol ≈ −7.8 → L ≈ 10^{0.4 × 12.5} ≈ 10⁵ L☉ (Sections 3.2, 3.6).',
          'L = 4πR²σT⁴ → R = √(L/4πσT⁴) ≈ 5.5 × 10¹⁰ m ≈ 79 R☉ (Section 3.4).',
          'λ_max = 2.898 × 10⁶ / 12 000 ≈ 240 nm — Rigel\'s peak is in the ultraviolet; we see its blue tail (Section 3.4).',
        ),
        p('Betelgeuse and Rigel, the two shoulders of Orion, turn out to have nearly the same luminosity — about a hundred thousand Suns — delivered in opposite ways: Betelgeuse cool and vast, Rigel hot and merely large. Both are supergiants near the ends of their lives, and both will end as supernovae. Everything that let us say that came from measuring light: its direction, its amount and its colour.'),
        key('Direction gives distance (parallax). Amount gives flux, and with distance, luminosity (magnitudes, inverse square). Colour gives temperature (blackbody laws, colour index). Luminosity and temperature together give size (Stefan–Boltzmann). This is the foundation on which every later chapter stands.'),
      ],
    },
    {
      id: 'chapter-close',
      kicker: 'Chapter close',
      title: 'The continuous spectrum in one page',
      scene: [backdrop()],
      body: [
        summary(
          'Parallax: d = 1/p (pc, arcsec). 1 pc = 3.26 ly. Gaia measures ≈ 2 × 10⁹ stars to tens of µas.',
          'Magnitudes: 5 mag = ×100. m − M = 5 log₁₀(d/10 pc). F = L/4πr². M☉ = +4.74.',
          'Light is an electromagnetic wave (Young, Maxwell): c = λν; interference d sin θ = nλ.',
          'Blackbody: λ_max T = 2.898 × 10⁶ nm K; L = 4πR²σT_e⁴.',
          'Planck: B_λ = (2hc²/λ⁵)/(e^{hc/λkT} − 1); E = hν; classical physics is the hν ≪ kT limit.',
          'Colour index B − V measures T; bolometric correction recovers the light outside V; M_bol → L exactly.',
        ),
        { kind: 'callout', tone: 'history', title: 'Suggested reading', html: 'J. B. Hearnshaw, <em>The Measurement of Starlight: Two Centuries of Astronomical Photometry</em> (1996), for how magnitudes became a science; Thomas Kuhn, <em>Black-Body Theory and the Quantum Discontinuity, 1894–1912</em> (1978), on what Planck did and did not believe he had done; Alan Hirshfeld, <em>Parallax: The Race to Measure the Cosmos</em> (2001), on Bessel, Henderson and Struve. For the Gaia mission, the ESA Gaia archive and data-release papers (Gaia Collaboration 2016, 2023).' },
        { kind: 'callout', tone: 'think', title: 'Problems to try', html: '(1) Gaia measures a parallax of 2.50 ± 0.03 mas. Find the distance in parsecs and light years, with its uncertainty. (2) Show that B_ν peaks at ν_max = 2.82 kT/h, and that c/ν_max ≠ λ_max. Why? (3) A star has U = 8.42, B = 8.11, V = 7.90. Compute its colour indices, estimate its temperature, and say roughly where it falls on the colour–colour diagram. (4) The Sun\'s surface flux is σT⁴ ≈ 63 MW m⁻². How much is radiated per square metre at the Earth\'s orbit? (5) How many photons per second does a 100 W light bulb emit if all its power were at 550 nm?' },
      ],
    },
  ],
};

/* ================================================================================ */
/*  Chapter 4 — The Theory of Special Relativity                                    */
/* ================================================================================ */

const S4_1: Section = {
  id: 'galilean-failure',
  number: '4.1',
  title: 'The Failure of the Galilean Transformations',
  summary: 'Light needed a medium, the medium needed a rest frame, and the rest frame refused to show itself: the ether, Galileo\'s relativity, and the experiment that found nothing.',
  minutes: 16,
  steps: [
    {
      id: 'ether',
      kicker: 'The problem',
      title: 'What does light wave in?',
      scene: [goto('sun'), rate(1)],
      body: [
        p('Maxwell had shown (Section 3.3) that light is a wave of electric and magnetic fields travelling at c = 1/√(ε₀μ₀). Every wave physicists knew had a medium: sound waves in air, ripples on water, vibrations on a string. So light, they reasoned, must travel through a medium too — a weightless, perfectly transparent, perfectly rigid substance filling all of space. They called it the <em>luminiferous ether</em>.'),
        p('The ether raised an immediate question. Maxwell\'s equations give one speed, c, with no reference to who is measuring. Speed relative to what? The natural answer was: relative to the ether. The ether would define a special frame of reference, the one truly at rest, and in that frame alone would light travel at exactly c in all directions. For anyone moving through the ether — and the Earth orbits the Sun at 30 km/s — light should appear a little faster in one direction and a little slower in the other.'),
        terms(
          ['Luminiferous ether', 'The hypothetical medium that carried light waves; "luminiferous" means light-bearing.'],
          ['Inertial reference frame', 'A frame in which Newton\'s first law holds: an object with no net force moves in a straight line at constant speed. Any frame moving at constant velocity relative to an inertial frame is also inertial.'],
          ['Absolute motion', 'Motion relative to a frame that is at rest in some absolute sense — which, if the ether existed, would be its rest frame.'],
        ),
        key('The ether promised something Newton\'s mechanics could never provide: a way to measure <em>absolute</em> motion. Detect the ether wind, and you have found the one frame in the universe that is truly standing still.'),
      ],
    },
    {
      id: 'galilean',
      kicker: 'The old rules',
      title: 'Galilean transformations',
      scene: [goto('iss'), rate(1)],
      body: [
        p('Galileo already understood that mechanics cannot detect uniform motion. Below the deck of a smoothly sailing ship, he wrote, butterflies fly and water drips exactly as they do on land; no experiment inside tells you whether the ship is moving. The mathematics of that idea is the <em>Galilean transformation</em>. Let frame S′ move along the x-axis at speed u relative to frame S, with the origins coinciding at t = 0. Then an event seen at (x, y, z, t) in S is seen in S′ at:'),
        eq('x\' = x - u\\,t \\qquad y\' = y \\qquad z\' = z \\qquad t\' = t', 'The Galilean transformation. Note the last equation: time is the same for everyone. Newton called it "absolute, true and mathematical time, which flows equably without regard to anything external."'),
        eq('v_x\' = v_x - u \\qquad a_x\' = a_x', 'Differentiate once: velocities simply add and subtract. Differentiate twice: accelerations are the same in both frames, so F = ma holds in S′ if it holds in S. Newton\'s laws are <em>Galilean invariant</em>.'),
        p('Now apply the same rule to light. If a flash travels at c in the ether frame S, then in a frame S′ moving at u through the ether it should travel at c − u in the forward direction and c + u backward. Maxwell\'s equations would not hold in S′; they would hold only in the ether frame. The space station in front of you orbits at 7.7 km/s; by the Galilean rule, a laser fired forward from it should outrun one fired backward by 15 km/s.'),
        think('Galileo\'s ship argument says no <em>mechanical</em> experiment can detect uniform motion. The ether theory says an <em>optical</em> one can. Is there any good reason why the laws of mechanics should obey a relativity principle and the laws of light should not? Einstein thought not — and that single aesthetic judgement is where this chapter is going.'),
      ],
    },
    {
      id: 'michelson',
      kicker: 'Interactive · the experiment',
      title: 'The Michelson–Morley experiment',
      widget: { type: 'michelson' },
      scene: [goto('earth'), rate(1)],
      body: [
        p('A speed difference of 30 km/s against 300 000 km/s is one part in ten thousand — far too small to time directly. In 1881 Albert Michelson invented an instrument that could see it anyway: the <em>interferometer</em>. A half-silvered mirror splits a beam of light into two perpendicular arms of equal length L. The beams reflect off mirrors at the ends, recombine and interfere, producing fringes. If one arm lies along the ether wind and the other across it, the two round trips take slightly different times:'),
        eq('t_\\parallel = \\frac{L}{c - u} + \\frac{L}{c + u} = \\frac{2L}{c}\\,\\frac{1}{1 - u^2/c^2} \\qquad t_\\perp = \\frac{2L}{\\sqrt{c^2 - u^2}} = \\frac{2L}{c}\\,\\frac{1}{\\sqrt{1 - u^2/c^2}}', 'Along the wind the light fights upstream and then is carried back; across it, the beam must aim slightly upwind to hit the mirror, like a swimmer crossing a river. The along-wind trip is always longer.'),
        eq('\\Delta t = t_\\parallel - t_\\perp \\approx \\frac{L}{c}\\,\\frac{u^2}{c^2} \\qquad \\text{fringe shift on rotating by } 90°: \\quad \\frac{2L\\,u^2/c^2}{\\lambda}', 'With L = 11 m (Michelson and Morley folded the path with multiple reflections), λ = 590 nm and u = 30 km/s, the expected shift was about 0.4 fringe. Their instrument could detect 0.01.'),
        p('Watch the widget. In the ether model the two pulses leave the splitter together and the along-wind pulse returns late; as the apparatus slowly turns, the fringes should march back and forth. Switch to <em>observed</em>: in July 1887, in the basement of a dormitory in Cleveland, on a stone slab floating in mercury to kill vibrations, Michelson and Edward Morley saw <em>nothing</em>. No shift, in any season, at any time of day. The most famous null result in physics.'),
        history('Michelson was disappointed — he regarded the experiment as a failure and went on to other things, including the first measurement of a star\'s diameter. He received the 1907 Nobel Prize for his instruments. The null result was repeated with ever greater precision for a century; modern versions using optical resonators constrain any anisotropy in c to below one part in 10¹⁷.'),
      ],
    },
    {
      id: 'aftermath',
      kicker: 'History',
      title: 'Trying to save the ether',
      scene: [goto('earth'), rate(1)],
      body: [
        p('Physicists did not give up the ether at once; they patched it. Perhaps the Earth dragged the ether along with it — but that contradicted stellar aberration (Bradley, 1729), which requires the ether to stream freely past the Earth. Perhaps, suggested George FitzGerald in 1889 and Hendrik Lorentz in 1892 independently, motion through the ether <em>physically compresses</em> matter along the direction of travel by exactly the factor √(1 − u²/c²), shortening the along-wind arm just enough to cancel the delay.'),
        timeline([
          { when: '1865', title: 'Maxwell', text: 'Light is an electromagnetic wave with a fixed speed c. Relative to what? Presumably the ether.' },
          { when: '1887', title: 'Michelson & Morley', text: 'No ether wind detected; expected 0.4 fringe, observed < 0.01.' },
          { when: '1889–92', title: 'FitzGerald, Lorentz', text: 'Hypothesis: moving bodies contract by √(1 − u²/c²). Ad hoc, but it saves the null result.' },
          { when: '1904', title: 'Lorentz', text: 'Finds the full set of transformations under which Maxwell\'s equations keep their form, including a "local time" t′ that he treats as a mathematical fiction.' },
          { when: '1905', title: 'Einstein', text: '"On the Electrodynamics of Moving Bodies." Drops the ether entirely, derives the same transformations from two postulates, and takes t′ seriously as real time.' },
        ]),
        p('Lorentz had, by 1904, essentially the right equations — but with the wrong story attached. Contraction was a real squeeze caused by the ether; his "local time" was a convenient variable, not what clocks read. Einstein\'s 1905 paper does not mention the Michelson–Morley experiment at all. He reached the same equations from a different direction: not "how does the ether hide itself?" but "what if there is nothing to hide?"'),
        key('The patches worked, but every one of them was designed to make the ether <em>undetectable</em>. A medium that no experiment can ever reveal is a medium that physics does not need. The next section removes it.'),
      ],
    },
    {
      id: 'failure-summary',
      kicker: 'Section close',
      title: 'What to remember',
      scene: [backdrop()],
      body: [
        summary(
          'The ether was the supposed medium for light and would have defined an absolute rest frame.',
          'Galilean transformation: x′ = x − ut, t′ = t; velocities add; Newton\'s laws are invariant but Maxwell\'s equations are not.',
          'Michelson–Morley (1887) looked for the Earth\'s 30 km/s motion through the ether with an interferometer sensitive to 0.01 fringe. Expected 0.4; found nothing.',
          'Lorentz and FitzGerald saved the result with an ad hoc contraction √(1 − u²/c²); Lorentz found the full transformations by 1904 but kept the ether.',
          'The experiment did not disprove the ether; it made it undetectable, which is worse.',
        ),
        p('A twenty-six-year-old patent clerk in Bern was about to ask a different question: what if the speed of light really is the same for everyone, and it is our ideas of space and time that have to give?'),
      ],
    },
  ],
};

const S4_2: Section = {
  id: 'lorentz-transformations',
  number: '4.2',
  title: 'The Lorentz Transformations',
  summary: 'Two postulates, one set of equations: how Einstein replaced absolute time with the Lorentz transformations, what the factor γ means, and how velocities really add.',
  minutes: 18,
  steps: [
    {
      id: 'postulates',
      kicker: 'The foundation',
      title: 'Einstein\'s two postulates',
      scene: [goto('earth'), rate(1)],
      body: [
        p('In 1905 Albert Einstein, then an examiner at the Swiss patent office, published a paper that began not with an experiment but with an asymmetry he found ugly. A magnet moved past a coil induces a current; a coil moved past a magnet induces the same current — yet Maxwell\'s theory explained the two cases with completely different mechanisms. Einstein decided that nature does not distinguish them, and that the same must be true of all uniform motion. He built the whole theory on two statements:'),
        list(
          '<b>The principle of relativity.</b> The laws of physics are the same in every inertial reference frame. No experiment — mechanical, optical, or any other — can detect absolute uniform motion.',
          '<b>The constancy of the speed of light.</b> Light in vacuum travels at the same speed c in every inertial frame, regardless of the motion of the source or the observer.',
        ),
        p('The first postulate extends Galileo\'s ship to all of physics, and it is what makes the ether superfluous: if there is no way to detect the ether frame, it plays no role. The second postulate is the shocking one. It says that if you chase a light beam at 0.99c, you will still measure it passing you at c, not 0.01c. The Galilean rule v′ = v − u is simply wrong for light. And if it is wrong for light, it is wrong in general; it merely happens to be a very good approximation at the speeds we are used to.'),
        key('Both postulates are statements about <em>symmetry</em>: no frame is special, and c is a constant of nature, not a speed relative to something. Everything strange in this chapter — slowed clocks, shortened rods, the end of simultaneity — is forced by these two sentences together.'),
        history('Einstein published four landmark papers in 1905, his <em>annus mirabilis</em>: the photoelectric effect (light quanta), Brownian motion (the reality of atoms), special relativity, and E = mc². He was 26 and had been unable to get an academic job.'),
      ],
    },
    {
      id: 'derivation',
      kicker: 'Derivation',
      title: 'From the postulates to the transformations',
      scene: [goto('earth'), rate(1)],
      body: [
        p('Let frame S′ move at speed u along the x-axis of frame S, origins coinciding at t = t′ = 0. Suppose a flash of light leaves the common origin at that instant. In S the light forms a sphere x² + y² + z² = c²t². By the second postulate it must <em>also</em> form a sphere in S′, centred on S′\'s origin: x′² + y′² + z′² = c²t′². The Galilean transformation cannot satisfy both. Ask instead for the most general linear transformation that does, and the answer is unique:'),
        eq('x\' = \\gamma\\,(x - u\\,t) \\qquad y\' = y \\qquad z\' = z \\qquad t\' = \\gamma\\left(t - \\frac{u\\,x}{c^2}\\right)', 'The Lorentz transformation from S to S′.'),
        eq('\\gamma \\equiv \\frac{1}{\\sqrt{1 - u^2/c^2}} \\geq 1', 'The Lorentz factor. It is 1 at rest and grows without bound as u → c. We will also write β = u/c, so γ = 1/√(1 − β²).'),
        p('Two things leap out. First, time is no longer universal: t′ depends on t <em>and</em> on x. Two clocks at different places that agree in S do not agree in S′. Second, when u ≪ c, γ → 1 and ux/c² → 0, so the equations shrink back to Galileo\'s. Relativity does not overthrow Newton; it contains him as a low-speed limit. The inverse transformation is obtained by swapping primes and changing the sign of u — exactly as the first postulate demands, since S moves at −u relative to S′:'),
        eq('x = \\gamma\\,(x\' + u\\,t\') \\qquad t = \\gamma\\left(t\' + \\frac{u\\,x\'}{c^2}\\right)', 'The inverse Lorentz transformation. Neither frame is privileged.'),
        table(['u', 'β = u/c', 'γ', 'What it means'],
          [
            ['30 km/s (Earth\'s orbit)', '10⁻⁴', '1.000 000 005', 'Galileo is right to 9 decimal places'],
            ['0.1 c', '0.1', '1.005', 'half a percent'],
            ['0.5 c', '0.5', '1.155', 'noticeable'],
            ['0.9 c', '0.9', '2.294', 'clocks run at less than half speed'],
            ['0.99 c', '0.99', '7.09', 'a seven-fold stretch'],
            ['0.9999 c', '0.9999', '70.7', 'LHC protons reach γ ≈ 7000'],
          ]),
      ],
    },
    {
      id: 'spacetime',
      kicker: 'Interactive · geometry',
      title: 'Spacetime diagrams',
      widget: { type: 'minkowski' },
      body: [
        p('The Lorentz transformation has a picture, invented by Einstein\'s former mathematics teacher Hermann Minkowski in 1908. Plot position x horizontally and time — multiplied by c so it has units of length — vertically. Every <em>event</em> (something happening at one place at one instant) is a point. A particle\'s history is a curve, its <em>world line</em>. Light moves one unit of x per unit of ct, so light rays are lines at 45°; together they form the <em>light cone</em> of an event.'),
        p('Now add the moving frame S′. Its time axis (x′ = 0) is the world line of its origin, x = ut — a line tilted from vertical by the angle whose tangent is β. Its space axis (t′ = 0) is the set of events S′ calls simultaneous with the origin, ct = βx — a line tilted from horizontal by the <em>same</em> angle. The two axes close like scissors toward the light cone as β → 1. Drag the event in the widget and read off its coordinates in both frames.'),
        eq('(c\\,t)^2 - x^2 = (c\\,t\')^2 - x\'^2 \\equiv s^2', 'The <em>spacetime interval</em>. Lengths and durations change between frames; this combination does not. It is the relativistic analogue of distance, with the crucial minus sign.'),
        key('Two observers disagree about where and when an event happened, but they agree on the interval s². If s² > 0 the events are <em>timelike</em> separated — a clock could travel between them, and all observers agree on their order. If s² < 0 they are <em>spacelike</em> — nothing can connect them, and observers may disagree about which came first. The light cone, s² = 0, is the boundary.'),
        think('The tilted x′-axis is the key to everything in Section 4.3. Events on it all happen "at the same time" for S′ — yet they lie at different heights, i.e. at different S-times. Which frame is right about simultaneity? Both. Neither. The question has no frame-independent answer.'),
      ],
    },
    {
      id: 'velocity-addition',
      kicker: 'Interactive · consequence',
      title: 'How velocities really add',
      widget: { type: 'velocityadd' },
      body: [
        p('A rocket moves at u relative to you and fires a probe forward at v′ relative to itself. How fast is the probe relative to you? Galileo says u + v′. The Lorentz transformation says otherwise. Differentiate x = γ(x′ + ut′) and t = γ(t′ + ux′/c²), divide, and the γ cancels:'),
        eq('v = \\frac{v\' + u}{1 + u\\,v\'/c^2}', 'Relativistic velocity addition for motion along the line of relative velocity. For u, v′ ≪ c the denominator is 1 and Galileo returns.'),
        p('Try the extremes in the widget. Two speeds of 0.9c combine to 0.994c, not 1.8c. Set v′ = c — the probe is a light beam — and the result is c no matter what u is: the second postulate falls out of the formula automatically. No combination of sub-light speeds ever reaches c. The speed of light is not a fast speed; it is the structure of the addition rule itself.'),
        example('A proton in the LHC moves at 0.999 999 991c. A second proton approaches head-on at the same speed. Galileo: closing speed 1.999 999 98c. Relativity: v = (2 × 0.999 999 991)/(1 + 0.999 999 982) c = 0.999 999 999 999 96c. The collision energy, however, is enormous — Section 4.4 explains why speed is the wrong thing to look at.'),
        history('In 1851 Hippolyte Fizeau measured the speed of light in flowing water and found it was dragged along by the water, but only partially — by a fraction 1 − 1/n² of the water\'s speed, where n is the refractive index. Nobody could explain the fraction. The relativistic addition formula gives it exactly: add c/n (light in still water) to u (the water\'s speed) and expand for small u. Einstein said this experiment was one of his strongest guides.'),
      ],
    },
    {
      id: 'lorentz-summary',
      kicker: 'Section close',
      title: 'What to remember',
      scene: [backdrop()],
      body: [
        summary(
          'Postulate 1: the laws of physics are the same in all inertial frames. Postulate 2: c is the same in all inertial frames.',
          'Lorentz transformation: x′ = γ(x − ut), t′ = γ(t − ux/c²), with γ = 1/√(1 − u²/c²). Inverse: swap primes, u → −u.',
          'Time depends on position: t′ mixes t and x. Simultaneity is frame-dependent.',
          'Spacetime diagrams: light at 45°; the moving frame\'s axes tilt toward the light cone. The interval (ct)² − x² is invariant.',
          'Velocity addition: v = (v′ + u)/(1 + uv′/c²). Nothing combines to exceed c; c + anything = c.',
        ),
        p('The equations are in hand. Now we ask what they do to the two quantities we thought we understood best: how long things take, and how long things are.'),
      ],
    },
  ],
};

const S4_3: Section = {
  id: 'time-and-space',
  number: '4.3',
  title: 'Time and Space in Special Relativity',
  summary: 'What the Lorentz transformations do to clocks and rulers: the relativity of simultaneity, time dilation and its proof in cosmic-ray muons, length contraction, and the relativistic Doppler shift.',
  minutes: 22,
  steps: [
    {
      id: 'simultaneity',
      kicker: 'Interactive · the key idea',
      title: 'The relativity of simultaneity',
      widget: { type: 'train' },
      body: [
        p('Einstein\'s own thought experiment. A train moves along a platform. At the instant the two ends of the train pass marks A and B on the platform, lightning strikes both ends. An observer M standing on the platform midway between A and B receives both flashes at the same moment and, knowing the distances are equal, concludes the strikes were <em>simultaneous</em>. Fair enough.'),
        p('Now consider an observer M′ sitting at the midpoint of the train. In the platform frame, M′ is moving toward the flash from B and away from the flash from A, so the flash from B reaches her first. But M′ has every right to use her own frame. In it, she is at rest, exactly midway between the two ends, and light from each end travels at the same speed c (postulate 2). If the flash from B arrives first, she must conclude that lightning <em>struck B first</em>. She is not mistaken. In her frame the strikes were not simultaneous.'),
        eq('\\Delta t\' = -\\gamma\\,\\frac{u\\,\\Delta x}{c^2}', 'From the Lorentz transformation with Δt = 0: two events simultaneous in S and separated by Δx are separated in time by this amount in S′. The farther apart they are and the faster S′ moves, the bigger the disagreement.'),
        key('Simultaneity is not a fact about the world; it is a fact about a reference frame. "At the same time" has no meaning for events at different places until you say in which frame. This single idea is what makes time dilation and length contraction consistent rather than paradoxical.'),
        think('Both observers agree on the <em>physical</em> facts: which flash reached M′ first, what each clock read when a flash arrived. They disagree only about the interpretation "simultaneous". Can you find any experiment, in principle, that would settle who is right? (Postulate 1 says no — and that is the point.)'),
      ],
    },
    {
      id: 'time-dilation',
      kicker: 'Interactive · time',
      title: 'Proper time and time dilation',
      widget: { type: 'lightclock' },
      body: [
        p('Build the simplest possible clock: two mirrors a distance h apart, with a light pulse bouncing between them. Each round trip is one tick, lasting Δt₀ = 2h/c. Now watch the same clock move past you at speed u. In your frame the pulse travels a zig-zag path, longer than 2h — but it still moves at c (postulate 2). So each tick takes longer in your frame. By Pythagoras:'),
        eq('\\left(\\frac{c\\,\\Delta t}{2}\\right)^2 = h^2 + \\left(\\frac{u\\,\\Delta t}{2}\\right)^2 \\quad\\Rightarrow\\quad \\Delta t = \\frac{2h/c}{\\sqrt{1 - u^2/c^2}} = \\gamma\\,\\Delta t_0', 'Time dilation. A moving clock ticks slowly by the factor γ, as seen by an observer it is moving past.'),
        p('The quantity Δt₀ — the time between two events measured by a clock that is <em>present at both</em> — is the <em>proper time</em> Δτ. It is the shortest time interval any observer can assign to those events, and it is invariant: everybody agrees what the moving clock reads, they just disagree about how much of their own time elapsed meanwhile. In the widget, both clocks\' pulses move at the same speed on your screen; the moving one simply has farther to go.'),
        p('Is it a trick of light clocks? No. Any clock sitting beside the light clock in the moving frame must agree with it — otherwise the two clocks would drift apart and the observer in that frame could detect her own motion, violating postulate 1. Every process slows: pendulums, heartbeats, radioactive decay, ageing.'),
        note('Time dilation is symmetric. You see her clock run slow; she sees <em>yours</em> run slow, by the same factor. This is not a contradiction, because the two of you disagree about simultaneity — about which of your ticks lines up with which of hers. The famous "twin paradox" arises only if one twin turns around, which breaks the symmetry: the travelling twin changes inertial frame and comes home younger. The effect is real and has been measured with atomic clocks on aircraft.', 'Whose clock is really slow?'),
      ],
    },
    {
      id: 'muons',
      kicker: 'Interactive · the proof',
      title: 'Muons from the sky',
      widget: { type: 'muon' },
      scene: [goto('earth'), rate(1)],
      body: [
        p('Cosmic rays striking the upper atmosphere about 15 km up produce <em>muons</em> — heavy cousins of the electron that decay with a mean lifetime of τ = 2.2 µs. Even at nearly the speed of light, 2.2 µs is enough to travel only c τ = 660 m. By classical reckoning, essentially none should survive the 15 km journey to the ground. Yet about 200 muons pass through every square metre of the Earth\'s surface every second. You are being hit by a few right now.'),
        eq('N = N_0\\,e^{-t/\\tau} \\qquad t_{\\text{Earth}} = \\frac{h}{u} \\qquad t_{\\text{muon}} = \\frac{h}{u\\,\\gamma}', 'Exponential decay. The muon\'s own clock — its proper time — runs slow by γ in the Earth frame, so far fewer lifetimes elapse during the descent.'),
        example('Frisch and Smith (1963) counted muons moving at 0.995c (γ ≈ 10) on top of Mount Washington (1907 m) and at sea level. Classical prediction: the 1907 m descent takes 6.4 µs ≈ 2.9 lifetimes, so only e^{−2.9} ≈ 5 % should survive — about 27 of their 563 muons per hour. Relativity: the muons experience only 0.64 µs ≈ 0.29 lifetimes, so 75 % survive — about 420. They measured 408 ± 9. Textbook agreement, and one of the clearest confirmations of time dilation ever made.', 'The Frisch–Smith experiment'),
        p('Slide the speed in the widget and compare the two predictions. At 0.9999c the atmosphere is crossed in what the muon feels as 0.7 µs. Time dilation is not a philosophical nicety; it is why you are being irradiated by particles that, by Newton\'s clock, died ten kilometres above your head.'),
        key('Time dilation has a thousand confirmations: muon lifetimes, atomic clocks on jets and satellites, the decay of fast particles in accelerators. GPS satellites move at 3.9 km/s and their clocks lose 7 µs per day to special relativity (and gain 45 µs from general relativity). Without the correction, your position would drift by 10 km a day.'),
      ],
    },
    {
      id: 'length-contraction',
      kicker: 'Concept',
      title: 'Length contraction',
      scene: [goto('voyager1'), rate(1)],
      body: [
        p('Return to the muon, but this time ride along with it. In the muon\'s frame it is at rest and lives its ordinary 2.2 µs. How does it reach the ground? Because in its frame the atmosphere is rushing up at 0.995c — and a moving object is <em>shorter</em>. The 15 km of air is contracted to 15 km/γ ≈ 1.5 km, which the ground covers in 5 µs. Same physics, two descriptions: in the Earth frame the muon\'s time is dilated; in the muon\'s frame the Earth\'s length is contracted.'),
        eq('L = \\frac{L_0}{\\gamma} = L_0\\sqrt{1 - u^2/c^2}', 'Length contraction. L₀ is the <em>proper length</em>, measured in the frame where the object is at rest; L is its length measured in a frame where it moves at u, along the direction of motion only. Perpendicular dimensions are unchanged.'),
        p('Where does the formula come from? To measure the length of a moving rod you must locate both ends <em>at the same time</em> — and "at the same time" is frame-dependent. Set Δt = 0 in the Lorentz transformation for the two end-events: Δx′ = γ Δx, where Δx′ = L₀ is the rest length and Δx = L is what you measure. Length contraction is the relativity of simultaneity applied to a ruler.'),
        p('This is the FitzGerald–Lorentz contraction of Section 4.1, but with the story changed. Nothing squeezes the rod; no ether presses on its atoms. Its rest length is unaffected and its own observers notice nothing. The contraction is a statement about how a frame slices spacetime, exactly as the shortening of a shadow is a statement about the angle of the Sun, not about the object.'),
        think('Voyager 1, in front of you, is the fastest human-made object to leave the solar system: 17 km/s, β = 5.7 × 10⁻⁵. By how much is it contracted along its direction of motion? (About 1.6 × 10⁻⁹ — a few nanometres across its 3.7-metre dish. Relativity is real at every speed; it is just invisibly small at ours.)'),
      ],
    },
    {
      id: 'doppler',
      kicker: 'Application',
      title: 'The relativistic Doppler shift',
      scene: [goto('Sirius', 'star'), rate(1)],
      body: [
        p('Astronomy\'s most used relativistic formula is the Doppler effect. A source emits light of frequency ν_rest in its own frame and moves away from you at speed u. Two things stretch the arriving wave: each successive crest has farther to travel (the classical Doppler effect), and the source\'s clock — which sets the rate at which crests are emitted — runs slow by γ (time dilation). Combined:'),
        eq('\\nu_{\\text{obs}} = \\nu_{\\text{rest}}\\,\\frac{\\sqrt{1 - u/c}}{\\sqrt{1 + u/c}} \\qquad \\frac{\\lambda_{\\text{obs}}}{\\lambda_{\\text{rest}}} = \\sqrt{\\frac{1 + u/c}{1 - u/c}}', 'Relativistic longitudinal Doppler shift for a source receding at speed u. For approach, change the sign of u. For u ≪ c it reduces to Δλ/λ ≈ u/c.'),
        eq('z \\equiv \\frac{\\lambda_{\\text{obs}} - \\lambda_{\\text{rest}}}{\\lambda_{\\text{rest}}} \\qquad 1 + z = \\sqrt{\\frac{1 + u/c}{1 - u/c}} \\quad\\Rightarrow\\quad \\frac{u}{c} = \\frac{(1+z)^2 - 1}{(1+z)^2 + 1}', 'The <em>redshift</em> z. A receding source has z > 0 (lines shifted to the red); approaching, z < 0 (blueshift). Note that z can exceed 1 while u stays below c.'),
        p('Unlike sound, light has no medium, so only the <em>relative</em> velocity matters — there is no separate formula for "source moving" and "observer moving". And relativity predicts something sound cannot: a <em>transverse</em> Doppler shift. A source moving purely across your line of sight is still redshifted by the factor γ, purely from time dilation. This was measured in the 1938 Ives–Stilwell experiment with fast hydrogen atoms, another direct confirmation of the slowing of moving clocks.'),
        example('A quasar\'s hydrogen line at 121.6 nm (rest) is observed at 486.4 nm: 1 + z = 4.0, z = 3. The naive classical formula u = cz gives three times the speed of light. The relativistic formula gives u/c = (16 − 1)/(16 + 1) = 0.88. (For cosmological distances the redshift is really due to the expansion of space rather than motion through it, and the conversion to a speed needs general relativity — but the lesson stands: z > 1 does not mean faster than light.)'),
      ],
    },
    {
      id: 'spacetime-summary',
      kicker: 'Section close',
      title: 'What to remember',
      scene: [backdrop()],
      body: [
        summary(
          'Simultaneity is relative: events simultaneous in S are separated by Δt′ = −γuΔx/c² in S′.',
          'Time dilation: Δt = γΔτ. Proper time Δτ is read by a clock present at both events and is the shortest possible interval.',
          'Proof: cosmic-ray muons (Frisch & Smith 1963), atomic clocks on aircraft, GPS (−7 µs/day).',
          'Length contraction: L = L₀/γ along the motion. It is the relativity of simultaneity applied to measuring a rod.',
          'Relativistic Doppler: 1 + z = √((1 + β)/(1 − β)) for recession; transverse shift from time dilation alone.',
          'The effects are symmetric between frames; only the invariant interval s² = (cΔt)² − (Δx)² is agreed by all.',
        ),
        p('Space and time have been rebuilt. Newton\'s mechanics was built on the old ones, so it too needs rebuilding — and the rebuilding produces the most famous equation in physics.'),
      ],
    },
  ],
};

const S4_4: Section = {
  id: 'relativistic-energy',
  number: '4.4',
  title: 'Relativistic Momentum and Energy',
  summary: 'Why p = mv cannot survive, what replaces it, how E = mc² falls out of the correction, and the energy–momentum relation that governs everything from the Sun\'s core to the LHC.',
  minutes: 18,
  steps: [
    {
      id: 'momentum',
      kicker: 'Interactive · momentum',
      title: 'Why p = mv has to go',
      widget: { type: 'relenergy' },
      body: [
        p('Conservation of momentum is the backbone of mechanics, and by the first postulate it must hold in every inertial frame. But velocities no longer add Galileo\'s way, and a collision that conserves Σmv in one frame does <em>not</em> conserve it in another once the relativistic velocity addition is used. Either momentum conservation fails — unthinkable — or momentum is not mv. The quantity that <em>is</em> conserved in all frames is:'),
        eq('\\vec p = \\gamma\\,m\\,\\vec v = \\frac{m\\,\\vec v}{\\sqrt{1 - v^2/c^2}}', 'Relativistic momentum. Here γ is built from the particle\'s own speed v, and m is its mass as measured at rest — the only mass we will ever use.'),
        p('Look at the momentum curve in the widget. At low speed it hugs the classical line p = mv. Near c it turns upward and goes to infinity: pushing on a particle with a constant force keeps increasing its momentum, but its speed creeps toward c without ever arriving. The speed of light is unreachable not because of some cosmic prohibition but because momentum — the thing a force actually changes — becomes infinite there.'),
        note('Older books speak of a "relativistic mass" m γ that grows with speed. Modern usage, and this course, keeps mass as an invariant property of the particle and puts the γ with the velocity. The physics is identical; the bookkeeping is cleaner.', 'A word about mass'),
        key('Newton\'s second law survives in the form F = dp/dt, with the new p. What changes is not the law but the relation between momentum and velocity.'),
      ],
    },
    {
      id: 'energy',
      kicker: 'Derivation',
      title: 'Kinetic energy, rest energy, and E = mc²',
      scene: [goto('sun'), rate(1)],
      body: [
        p('Kinetic energy is the work done to bring a particle from rest to speed v: K = ∫F dx = ∫(dp/dt) dx = ∫v dp. Insert the relativistic momentum and integrate (a few lines of calculus, with the substitution dp = m γ³ dv), and the result is startlingly simple:'),
        eq('K = \\gamma\\,m c^2 - m c^2 = (\\gamma - 1)\\,m c^2', 'Relativistic kinetic energy. Check the low-speed limit: expand γ ≈ 1 + ½v²/c² + ⅜v⁴/c⁴ + …, and K ≈ ½mv² + (3/8)mv⁴/c² + … Newton\'s formula is the first term.'),
        p('The expression γmc² − mc² invites an interpretation. Call γmc² the <em>total energy</em> E of the particle. Then K is the total energy minus a term that is present even at rest. That term — mc² — must be energy the particle has <em>simply by existing</em>:'),
        eq('E = \\gamma\\,m c^2 \\qquad E_0 = m c^2 \\qquad E = E_0 + K', 'Total energy, rest energy, and their relation. For v = 0, γ = 1 and E = mc². The most famous equation in physics is the statement that mass is a form of energy.'),
        p('How much energy? One gram of anything, converted completely, is 9 × 10¹³ J — the output of a large power station for a day. The Sun, in front of you, is running on this equation: fusing four protons into a helium nucleus releases 0.7 % of their mass as energy, and the Sun converts 4.3 million tonnes of mass into light every second (Section 1.4 found this number from L☉/c²). Chemical reactions release mass too — a charged battery is heavier than a dead one — but by parts in 10¹⁰, far too small to weigh.'),
        history('Einstein published E = mc² (in the form "the mass of a body is a measure of its energy content") in a three-page follow-up to his relativity paper in September 1905. The first experimental confirmation came in 1932, when Cockcroft and Walton split lithium nuclei with protons and found the kinetic energy of the fragments matched the mass lost — to within the 1 % precision of the day.'),
      ],
    },
    {
      id: 'energy-momentum',
      kicker: 'Derivation',
      title: 'The energy–momentum relation',
      scene: [goto('b0', 'blackhole'), rate(1)],
      body: [
        p('Energy and momentum both contain γ, and eliminating it between them gives the relation that physicists actually use. From E = γmc² and p = γmv, compute E² − p²c² = γ²m²c⁴(1 − v²/c²) = m²c⁴. So:'),
        eq('E^2 = p^2 c^2 + m^2 c^4', 'The energy–momentum relation. The widget draws it as a right triangle: legs pc and mc², hypotenuse E. Boost the particle and the pc leg grows; the mc² leg never changes.'),
        p('The right-hand side is a Lorentz invariant — every observer measures different E and p, but the same combination E² − p²c². Just as (ct)² − x² is the invariant "length" of a displacement in spacetime, m²c⁴ is the invariant "length" of the energy–momentum vector. Mass is the one thing about a particle that all frames agree on.'),
        eq('E = p\\,c \\qquad (m = 0) \\qquad\\qquad v = \\frac{p\\,c^2}{E}', 'Set m = 0 and the relation gives E = pc: a massless particle carries momentum p = E/c and, by the second formula, always moves at exactly c. Photons have energy hν (Section 3.5) and therefore momentum hν/c = h/λ — the origin of radiation pressure.'),
        example('A proton (mc² = 938.3 MeV) in the LHC has total energy 6.8 TeV = 6 800 000 MeV. Its γ is E/mc² = 7250, its speed is c√(1 − 1/γ²) = 0.999 999 990 c, and its momentum pc = √(E² − m²c⁴) ≈ 6.8 TeV — essentially E/c, as for a photon. Its kinetic energy is 6.8 TeV − 0.94 GeV ≈ 6.8 TeV: the rest energy is a rounding error. This is why accelerator physicists quote energies, not speeds; past about 0.99c the speed stops being informative.'),
      ],
    },
    {
      id: 'applications',
      kicker: 'Application',
      title: 'Where relativity runs the universe',
      scene: [goto('l-sn1987a', 'landmark'), rate(1)],
      body: [
        p('Special relativity is sometimes presented as exotic. In astrophysics it is daily business. Every star shines by converting mass to energy. Every spectrum we measure is Doppler shifted and interpreted with the relativistic formula. And the universe is full of matter moving at speeds where γ is not 1.0001 but 10, 1000, or 10¹¹.'),
        list(
          '<b>Stellar energy.</b> The Sun\'s luminosity 3.8 × 10²⁶ W is mass loss at 4.3 × 10⁹ kg/s. Over its 10-billion-year life it will convert about 0.07 % of its mass to light.',
          '<b>Supernovae.</b> The remnant in front of you, SN 1987A, released about 10⁴⁶ J in neutrinos — the rest energy of roughly 0.1 solar masses — in ten seconds. The neutrinos arrived at Earth three hours <em>before</em> the light, because the light had to fight its way out of the collapsing star.',
          '<b>Jets and cosmic rays.</b> Black holes and pulsars launch particle jets with bulk γ of 10–100. The highest-energy cosmic ray ever detected (1991, the "Oh-My-God particle") was a proton with E ≈ 3 × 10²⁰ eV, γ ≈ 3 × 10¹¹ — the kinetic energy of a baseball at 100 km/h in a single nucleus. In its own frame the Galaxy was 300 light years thick.',
          '<b>Pair creation and annihilation.</b> A photon with E > 2 m_e c² = 1.022 MeV can become an electron–positron pair; the pair can annihilate back into two 511 keV photons. The 511 keV line glows from the centre of our Galaxy.',
          '<b>Technology.</b> GPS, particle accelerators, PET scanners, the colour of gold and the liquidity of mercury (relativistic effects on inner electrons) all depend on it.',
        ),
        key('Relativity does not replace Newtonian mechanics; it tells us where Newton\'s mechanics is a good approximation (γ ≈ 1) and takes over where it is not. In this course it will return whenever something moves fast: the Doppler shifts of Chapter 5, the degenerate electrons of white dwarfs, the jets of active galaxies, and the expansion of the universe itself.'),
      ],
    },
    {
      id: 'relativity-close',
      kicker: 'Chapter close',
      title: 'Special relativity in one page',
      scene: [backdrop()],
      body: [
        summary(
          'The ether could not be detected (Michelson–Morley 1887); the Galilean transformation fails for light.',
          'Einstein 1905: the laws of physics and the speed of light are the same in every inertial frame.',
          'Lorentz transformation: x′ = γ(x − ut), t′ = γ(t − ux/c²), γ = 1/√(1 − u²/c²). Velocities: v = (v′ + u)/(1 + uv′/c²).',
          'Simultaneity is relative. Moving clocks run slow (Δt = γΔτ); moving rods are short (L = L₀/γ). Muons prove it daily.',
          'Doppler: 1 + z = √((1 + β)/(1 − β)). The interval (cΔt)² − (Δx)² is invariant.',
          'p = γmv, E = γmc², K = (γ − 1)mc², E₀ = mc², E² = p²c² + m²c⁴. Massless particles move at c with E = pc.',
        ),
        { kind: 'callout', tone: 'history', title: 'Suggested reading', html: 'Einstein\'s 1905 paper "On the Electrodynamics of Moving Bodies" is short and surprisingly readable (in <em>The Principle of Relativity</em>, Dover). His popular book <em>Relativity: The Special and the General Theory</em> (1916) contains the train thought experiment. Edwin Taylor & John Archibald Wheeler, <em>Spacetime Physics</em> (1992), is the best way to make the spacetime diagram second nature; N. David Mermin, <em>It\'s About Time</em> (2005), builds the whole theory from simultaneity. For the history, Abraham Pais, <em>Subtle is the Lord</em> (1982).' },
        { kind: 'callout', tone: 'think', title: 'Problems to try', html: '(1) Show that for u ≪ c the Lorentz transformation reduces to the Galilean one, and estimate the first correction term for u = 30 km/s. (2) A spacecraft passes Earth at 0.6c and its crew measures their ship as 100 m long. How long is it in Earth\'s frame, and how long does one hour of ship time take on Earth? (3) Two rockets approach each other, each at 0.75c relative to a space station. What is their relative speed? (4) An electron (mc² = 0.511 MeV) has kinetic energy 1.0 MeV. Find γ, v/c and pc. (5) A galaxy\'s Hα line (656.3 nm) is observed at 720 nm. Find z and, assuming pure Doppler motion, u/c. (6) Reread Einstein\'s train: write down the two strikes as events in the platform frame, Lorentz-transform them into the train frame, and show which came first and by how much.' },
      ],
    },
  ],
};

/* ================================================================================ */
/*  Chapter 5 — The Interaction of Light and Matter                                 */
/* ================================================================================ */

const S5_1: Section = {
  id: 'spectral-lines',
  number: '5.1',
  title: 'Spectral Lines',
  summary: 'Dark lines in sunlight, Kirchhoff\'s three laws, elements identified across light-years, a new element found in the Sun before it was found on Earth, and the Doppler shift that turns lines into velocities.',
  minutes: 22,
  steps: [
    {
      id: 'fraunhofer',
      kicker: 'Interactive · history',
      title: 'Dark lines in the rainbow',
      widget: { type: 'fraunhofer' },
      scene: [goto('sun'), rate(1)],
      body: [
        p('Newton split sunlight with a prism and saw a continuous band of colour. He used a round hole as his aperture, so each colour was smeared over the next; nobody could have seen fine detail. In 1802 William Hyde Wollaston repeated the experiment with a narrow <em>slit</em> and noticed a handful of dark gaps in the spectrum. He took them for the natural boundaries between colours, and moved on.'),
        p('Twelve years later the Bavarian optician Joseph von Fraunhofer, testing the glass he made for telescopes, built a spectroscope — slit, prism, small telescope — and saw not a handful but <em>hundreds</em> of dark lines, always at the same places. He catalogued 574 of them and labelled the strongest with letters, A to K, a notation astronomers still use: the D lines of sodium, the H and K lines of calcium, the C and F lines we now know as hydrogen. He found the same lines in the light of the Moon and planets (reflected sunlight) and <em>different</em> lines in the spectra of Sirius and other stars.'),
        p('Drag the cursor across the spectrum in the widget to identify Fraunhofer\'s letters, and zoom in to see how narrow the lines really are. Fraunhofer died at 39 without knowing what the lines meant. He did know they were a precise, reproducible property of sunlight — a fingerprint waiting to be read.'),
        history('Fraunhofer also noticed that the bright yellow line emitted by a sodium flame fell at exactly the position of the dark D lines in sunlight. He recorded the coincidence and did not pursue it. Forty years later it would become the key to the whole subject.', 'The clue he left'),
        key('A spectrum is not just colour. Looked at with enough resolution it is full of structure — narrow dark lines in the Sun and stars, bright lines in flames and gas discharges — and that structure is the same in the laboratory and in the sky.'),
      ],
    },
    {
      id: 'kirchhoff',
      kicker: 'Interactive · principle',
      title: 'Kirchhoff\'s three laws',
      widget: { type: 'kirchhoff' },
      scene: [goto('l-m42', 'landmark'), rate(1)],
      body: [
        p('In Heidelberg in 1859 the chemist Robert Bunsen (with his new clean-burning burner) and the physicist Gustav Kirchhoff heated salts in a flame and looked at the light through a spectroscope. Each element gave its own set of bright lines — sodium its yellow pair, lithium a red line, potassium a violet one — regardless of the compound it was in. Then Kirchhoff shone bright sunlight <em>through</em> a sodium flame and saw the dark D lines get <em>darker</em>. A cool sodium vapour was absorbing exactly the wavelengths a hot one emitted. He summarised the behaviour of light and matter in three empirical laws:'),
        list(
          '<b>A hot, dense gas or a hot solid</b> produces a <b>continuous spectrum</b> with no lines — a blackbody, Chapter 3.',
          '<b>A hot, diffuse gas</b> produces <b>bright emission lines</b> at wavelengths characteristic of its chemical composition.',
          '<b>A cool, diffuse gas in front of a continuous source</b> produces <b>dark absorption lines</b> — at the same wavelengths that gas would emit if it were hot.',
        ),
        p('The widget puts you in the laboratory. A lamp (continuous source) shines through a cloud of gas. <em>Drag the observer</em>: look at the lamp through the gas and you see absorption lines; step aside and look only at the gas and the same wavelengths appear as emission lines; switch the gas off and the continuum returns. Change the element and the pattern changes; heat the gas and the lines strengthen.'),
        p('The Sun is now easy to read. Its hot, dense interior and lower photosphere emit a continuum. The thinner, cooler gas above — still 4500–6000 K, but cooler than what lies beneath — absorbs its own wavelengths out of that continuum. Fraunhofer\'s lines are the chemical inventory of the solar atmosphere. The glowing nebula in the scene behind you, Orion, shows law two: thin gas excited by hot stars, emitting its lines, red Hα above all.'),
        note('Kirchhoff\'s laws describe <em>what</em> happens; they do not say <em>why</em> a gas emits and absorbs at exactly the same discrete wavelengths. That question — why sodium, and only sodium, owns 589.0 and 589.6 nm — has no classical answer. It will take the rest of this chapter.', 'What the laws do not explain'),
      ],
    },
    {
      id: 'fingerprints',
      kicker: 'Interactive · application',
      title: 'Reading the cosmic fingerprint',
      widget: { type: 'elementid' },
      scene: [goto('sun'), rate(1)],
      body: [
        p('Kirchhoff turned at once to the Sun. Matching Fraunhofer\'s dark lines with laboratory emission spectra, he identified sodium, iron, magnesium, calcium, chromium, nickel and more. The philosopher Auguste Comte had written in 1835 that the chemical composition of the stars was the example par excellence of knowledge forever beyond human reach. Within twenty-five years it was routine.'),
        p('Try it yourself: the widget shows a mystery emission spectrum and a set of laboratory references. Match the pattern — the <em>spacing</em> of the lines, not just the colours. Spectroscopists do exactly this, with thousands of lines and a few more digits of precision.'),
        history('During the total solar eclipse of 18 August 1868 the French astronomer Jules Janssen recorded a bright yellow line in the spectrum of a solar prominence, close to sodium\'s D lines but not at their position. Norman Lockyer in London measured it at 587.49 nm and, finding no element that produced it, proposed a new one and named it after the Sun: <em>helium</em>. For 27 years helium was known only in the Sun. In 1895 William Ramsay isolated it on Earth from a uranium mineral and saw the same yellow line. It is the second most abundant element in the universe and had been hiding in plain sight.', 'An element found in the Sun first'),
        example('You point a telescope at a faint star. Its light shows strong dark lines at 393.4 and 396.8 nm (ionised calcium, Fraunhofer\'s H and K), weaker ones at 656.3 and 486.1 nm (hydrogen Hα and Hβ), and a thicket of iron lines. The <em>presence</em> of these lines says which atoms are in the star\'s atmosphere. Their <em>strengths</em> — as Chapter 8 will show — say how hot it is and how much of each element is there. Their <em>positions</em>, shifted a fraction of a nanometre from the laboratory values, say how fast the star moves toward or away from you. And their <em>widths</em> say how fast it rotates and how dense its atmosphere is. One spectrum, four kinds of knowledge; no spacecraft required.', 'Reading a star'),
        think('Spectroscopy is powerful because the laws of atomic physics are the same everywhere — a sodium atom in Orion emits the same wavelengths as one in Heidelberg. But <em>interpreting</em> a spectrum always involves a model: the temperature structure of the atmosphere, the assumption of equilibrium, the atomic data for each transition. Two groups can measure the same spectrum and infer different abundances. When this course quotes "the Sun is 73 % hydrogen by mass", remember that the number comes out of a model, and that models improve. The solar oxygen abundance, for instance, was revised downward by almost a factor of two in the 2000s when 3-D atmosphere models replaced 1-D ones — and the revision is still debated.', 'How objective is a spectrum?'),
      ],
    },
    {
      id: 'doppler-lines',
      kicker: 'Interactive · measurement',
      title: 'Lines in motion: radial velocity',
      widget: { type: 'dopplerlines' },
      scene: [goto('Aldebaran', 'star'), rate(1)],
      body: [
        p('A spectral line is a wavelength marker of extraordinary precision — a laboratory standard stamped on starlight. If a star moves toward us, every marker arrives compressed: the whole pattern shifts toward the blue. If it recedes, the pattern shifts to the red. Since the pattern is known, the shift can be measured to a part in a million, and Chapter 4\'s Doppler formula converts it into a velocity. For speeds small compared with c:'),
        eq('\\frac{\\lambda_{\\text{obs}} - \\lambda_{\\text{rest}}}{\\lambda_{\\text{rest}}} = \\frac{\\Delta\\lambda}{\\lambda_{\\text{rest}}} = \\frac{v_r}{c} \\equiv z', 'Low-speed Doppler shift. v_r is the radial velocity — the component of the star\'s velocity along the line of sight. Positive v_r (receding) gives a redshift z > 0; approach gives a blueshift. Only the radial component shifts the lines; motion across the sky does not.'),
        eq('1 + z = \\sqrt{\\frac{1 + v_r/c}{1 - v_r/c}}', 'The exact relativistic form (Section 4.3), needed for quasars and jets. For v_r = 100 km/s the two formulas differ by one part in 10⁷.'),
        p('Slide the source velocity in the widget. The wavefronts bunch up ahead and stretch behind; the spectrum below shows the laboratory lines (grey) and the observed ones (coloured) sliding together. Switch to "galaxy" mode and the shifts become large enough to move Hα out of the red entirely.'),
        example('The red hydrogen line Hα is at 656.281 nm in the laboratory. In the spectrum of Aldebaran, the star in the scene, it is measured at 656.399 nm. Then Δλ = +0.118 nm, z = 1.80 × 10⁻⁴, and v_r = zc = +54 km/s: Aldebaran is receding. (Earth\'s own orbital motion, up to ±30 km/s depending on the season, has to be subtracted first — astronomers reduce all velocities to the solar system barycentre.) Precision today: the spectrographs that find exoplanets measure stellar velocities to 0.3 m/s, a shift of Δλ/λ = 10⁻⁹, by tracking thousands of lines at once.', 'Aldebaran'),
        history('In 1842 Christian Doppler proposed the effect to explain the colours of binary stars — wrongly, since stellar velocities are far too small to change a star\'s colour. The first stellar radial velocity was measured by William Huggins in 1868: Sirius, receding at (he thought) 47 km/s. The true value is −5.5 km/s; the measurement was heroic and the error enormous. By 1890 Vogel at Potsdam, with photographic plates, was reliable to a few km/s. Today\'s Gaia catalogue holds radial velocities for 33 million stars.'),
      ],
    },
    {
      id: 'binaries',
      kicker: 'Interactive · preview',
      title: 'Lines that dance: spectroscopic binaries',
      widget: { type: 'specbinary' },
      scene: [goto('Mizar', 'star'), rate(1)],
      body: [
        p('In 1889 Edward Pickering at Harvard noticed that the K line of calcium in the spectrum of Mizar — the star in the scene, the middle of the Big Dipper\'s handle — was sometimes single and sometimes double, with a period of about 20 days. Two stars too close to resolve were orbiting each other; as one approached and the other receded, their lines split apart, then merged again as both moved across the line of sight. Mizar A was the first <em>spectroscopic binary</em>.'),
        p('Press play in the widget and watch the two sets of lines oscillate in antiphase. Change the inclination: a system seen face-on shows no shifts at all (no radial component), while an edge-on system shows the full orbital velocity. Change the mass ratio: the lighter star swings faster and its lines move further — the velocity ratio is the inverse of the mass ratio, because both stars orbit a common centre of mass (Section 2.3).'),
        eq('\\frac{v_1}{v_2} = \\frac{m_2}{m_1} \\qquad\\qquad m_1 + m_2 = \\frac{P}{2\\pi G}\\,\\frac{(v_1 + v_2)^3}{\\sin^3 i}', 'From the two velocity amplitudes and the period, Kepler\'s third law gives the total mass — up to the unknown inclination i. This is how most stellar masses are measured; Chapter 7 does it in full.'),
        key('Spectral lines carry velocities, velocities carry orbits, orbits carry masses. Almost everything we know about the masses of stars — and, in the last thirty years, of planets around other stars and black holes at the centres of galaxies — comes from the dance of spectral lines.'),
      ],
    },
    {
      id: 'lines-summary',
      kicker: 'Summary',
      title: 'Spectral lines in brief',
      scene: [backdrop()],
      body: [
        summary(
          'Wollaston (1802) and Fraunhofer (1814) found dark lines in the solar spectrum; Fraunhofer catalogued 574 and lettered the strongest (A, B, C, D, …, H, K).',
          'Kirchhoff (1859): hot dense matter → continuum; hot thin gas → emission lines; cool thin gas before a continuum → absorption lines at the same wavelengths.',
          'Each element has its own line pattern. Kirchhoff read the Sun\'s composition; Lockyer found helium in the Sun (1868) 27 years before it was found on Earth.',
          'Doppler: Δλ/λ = v_r/c for v ≪ c; redshift means recession. Radial velocities are measurable to m/s.',
          'Spectroscopic binaries: lines split and merge with the orbital period; velocity amplitudes give mass ratios and, with Kepler\'s third law, masses.',
          'Open question for the rest of the chapter: why are the lines discrete, and why does each element own a particular set?',
        ),
        think('Fraunhofer\'s letters were assigned from red to violet (A, B, C … H), by position, before anyone knew what caused them. Why was it nonetheless a good idea to label the lines rather than wait until they were understood? What would have been lost if everyone had used their own labels?'),
      ],
    },
  ],
};

const S5_2: Section = {
  id: 'photons',
  number: '5.2',
  title: 'Photons',
  summary: 'Hertz proves light is a wave and stumbles on evidence it is not; Einstein takes Planck\'s quantum seriously; Compton makes photons collide like billiard balls.',
  minutes: 20,
  steps: [
    {
      id: 'hertz',
      kicker: 'History',
      title: 'The wave confirmed — and the first crack',
      scene: [goto('earth'), rate(1)],
      body: [
        p('By 1887 Maxwell\'s electromagnetic theory (Section 3.3) predicted that oscillating charges should radiate waves travelling at c. Heinrich Hertz built the first radio transmitter — a spark gap driven by an induction coil — and a receiver, a loop of wire with a tiny gap in which a spark appeared when the wave arrived. He measured the wavelength (about 4 m), showed the waves reflected, refracted, polarised and interfered like light, and found their speed to be c. Maxwell was right; light was an electromagnetic wave. Hertz, asked about applications, replied that there were none.'),
        p('In the same experiments Hertz noticed something odd. The receiver spark jumped more easily when ultraviolet light from the transmitter spark fell on the gap. Light was somehow helping charge leave the metal. Hertz noted the effect, and died in 1894 at 36 before it was understood. His assistant Philipp Lenard pursued it and by 1902 had the facts:'),
        list(
          'Light falling on a clean metal surface in a vacuum ejects electrons (<em>photoelectrons</em>) — but only if its frequency is above a <b>threshold</b> that depends on the metal. Below the threshold no electrons appear however intense the light.',
          'Above threshold, the <b>maximum kinetic energy</b> of the electrons depends only on the frequency of the light, not on its intensity. Brighter light ejects <em>more</em> electrons, not faster ones.',
          'There is <b>no delay</b>. Even in very faint light, the first electrons leave within nanoseconds.',
        ),
        p('Each point contradicts the wave picture. A wave\'s energy is spread continuously over its front and grows with intensity; a faint wave should need time to accumulate enough energy at one atom to free an electron, and an intense wave of any colour should eventually do it. Lenard proposed that the electrons\' energy came from inside the atom and the light merely triggered its release — a theory that explained nothing quantitatively.'),
        timeline([
          { when: '1887', title: 'Hertz', text: 'Radio waves generated and detected; the photoelectric effect noticed as a side issue.' },
          { when: '1899', title: 'J. J. Thomson', text: 'The ejected particles are electrons — the same particle he had discovered in cathode rays in 1897.' },
          { when: '1902', title: 'Lenard', text: 'Threshold frequency; kinetic energy independent of intensity. Nobel Prize 1905.' },
          { when: '1905', title: 'Einstein', text: 'Light quanta: E = hν. Explains everything in one line. Nobel Prize 1921 — for this, not for relativity.' },
          { when: '1914–16', title: 'Millikan', text: 'Ten years of experiments designed to disprove Einstein confirm his equation and measure h to 0.5 %. Nobel Prize 1923.' },
        ]),
      ],
    },
    {
      id: 'photoelectric',
      kicker: 'Interactive · principle',
      title: 'Einstein\'s light quanta',
      widget: { type: 'photoelectric' },
      scene: [goto('iss'), rate(1)],
      body: [
        p('In March 1905 — before the relativity paper — Einstein proposed that Planck\'s quantisation (Section 3.5) was not a property of the oscillators in the cavity walls but of <em>light itself</em>. Light of frequency ν comes in indivisible packets, later called <em>photons</em>, each carrying energy:'),
        eq('E_{\\text{photon}} = h\\nu = \\frac{h c}{\\lambda}', 'Energy of one photon. For visible light (λ ≈ 500 nm), E ≈ 4 × 10⁻¹⁹ J ≈ 2.5 eV — a convenient unit: 1 eV = 1.602 × 10⁻¹⁹ J is the energy an electron gains falling through one volt. A handy form is E = 1240 eV·nm / λ.'),
        p('The photoelectric effect then becomes bookkeeping. An electron absorbs <em>one</em> photon, all at once. It needs at least the <em>work function</em> φ — the binding energy of the loosest electrons in that metal, a few eV — to escape; whatever remains is kinetic energy. The fastest electrons, from the surface and bound least tightly, have:'),
        eq('K_{\\max} = h\\nu - \\phi', 'Einstein\'s photoelectric equation. It is a straight line of slope h in a plot of K_max against ν, with intercept −φ: the same slope for every metal, a different intercept for each. Below the threshold frequency ν₀ = φ/h a photon simply does not have enough energy, and no intensity will help.'),
        p('Everything is in the widget. Choose a metal, set the wavelength and intensity, and watch the electrons leave with speeds set by colour, in numbers set by brightness. Then apply a <em>retarding voltage</em>: the current stops at V_s = K_max/e, which is how Millikan measured the electron energies. Plot K_max against ν and the slope is Planck\'s constant — the same h that fixed the shape of the blackbody curve. Two unrelated experiments, one constant: that is when a theory becomes real.'),
        history('Einstein called it "a heuristic point of view" and later described the paper as "very revolutionary". Planck, recommending him for the Prussian Academy in 1913, wrote that Einstein "may sometimes have missed the target in his speculations, as for example in his hypothesis of light quanta" — and asked that it not be held against him. Robert Millikan spent a decade trying to prove the equation wrong and in 1916 reported that it was "exactly" right, while still calling the theory behind it "wholly untenable". It took the Compton effect (next step) to convince the sceptics.', 'Nobody believed it'),
      ],
    },
    {
      id: 'photon-scale',
      kicker: 'Interactive · orders of magnitude',
      title: 'What a photon can do',
      widget: { type: 'photonscale' },
      scene: [goto('jwst'), rate(1)],
      body: [
        p('A photon has energy hν, moves at c, and — by the energy–momentum relation of Section 4.4 with m = 0 — carries momentum:'),
        eq('p = \\frac{E}{c} = \\frac{h\\nu}{c} = \\frac{h}{\\lambda}', 'Photon momentum. A beam of light pushes on what it hits: radiation pressure. For the Sun at Earth it is 4.6 µPa — tiny, but it drives comet tails and solar sails, and inside massive stars it holds up a significant part of the weight.'),
        p('Slide across the spectrum in the widget and the photon\'s energy spans twenty orders of magnitude; what it does to matter changes accordingly. Radio photons (µeV) barely nudge the spins of nuclei; the 21 cm line of hydrogen, the most important spectral line in radio astronomy, is a 6 µeV photon. Microwave and far-infrared photons (meV) make molecules rotate; near-infrared ones make them vibrate. Visible and ultraviolet photons (1–10 eV) rearrange the outer electrons of atoms — this is chemistry, and the subject of the rest of this chapter. Beyond 13.6 eV a photon can tear the electron out of hydrogen altogether. X-rays (keV) reach the inner electrons of heavy atoms; gamma rays (MeV) reach the nucleus.'),
        p('Photon counting makes faint astronomy possible. The Sun delivers about 10²¹ photons per second to each square metre of Earth; a star at the limit of the naked eye, magnitude 6, delivers about 10⁵ per second per square metre — and a magnitude-30 galaxy in a Hubble deep field, about one photon per second into the entire 2.4 m mirror. A modern detector registers nearly every one of them. The telescope in the scene, JWST, works in the infrared, where each photon carries a tenth of an eV and the telescope itself must be cooled to 40 K so that its own thermal photons do not swamp the signal.'),
        example('A 100 W light bulb radiates about 5 W as visible light near 550 nm. Each photon carries hc/λ = 3.6 × 10⁻¹⁹ J, so the bulb emits 5 / 3.6 × 10⁻¹⁹ ≈ 1.4 × 10¹⁹ visible photons per second. That is why light looks continuous: the graininess is there, but at 10¹⁹ grains per second you do not notice. A dark-adapted eye, by contrast, can register a flash of about 100 photons — the retina is nearly a photon counter.', 'Photons from a bulb'),
      ],
    },
    {
      id: 'compton',
      kicker: 'Interactive · evidence',
      title: 'The Compton effect: photons as billiard balls',
      widget: { type: 'compton' },
      scene: [goto('b0', 'blackhole'), rate(1)],
      body: [
        p('If photons carry momentum, they should be able to <em>collide</em>. In 1923 Arthur Compton scattered X-rays off the electrons in a graphite target and measured the wavelength of the scattered radiation at each angle. A wave theory predicts that the electrons, shaken at the frequency of the incoming wave, re-radiate at the <em>same</em> frequency. Compton found instead that the scattered X-rays had a <em>longer</em> wavelength, and that the increase depended only on the scattering angle θ:'),
        eq('\\Delta\\lambda = \\lambda_f - \\lambda_i = \\frac{h}{m_e c}\\,(1 - \\cos\\theta)', 'The Compton formula. The constant h/m_e c = 2.426 × 10⁻³ nm is the Compton wavelength of the electron. The maximum shift, for the photon bouncing straight back (θ = 180°), is twice this: 0.00485 nm.'),
        p('The formula follows from treating the collision as a relativistic two-body problem: a particle of energy hν and momentum hν/c hits an electron at rest; energy and momentum are conserved (Section 4.4). The photon gives up some energy to the recoiling electron, so it leaves with less energy — a longer wavelength. The derivation uses nothing but E = hν, p = h/λ and E² = p²c² + m²c⁴; no wave physics at all.'),
        p('<em>Drag the outgoing photon</em> in the widget to set the scattering angle and watch Δλ follow (1 − cos θ) while the electron recoils to conserve momentum. Lower the incoming wavelength toward the Compton wavelength and the energy transfer becomes dramatic: a gamma ray can hand most of its energy to the electron. For visible light (λ = 500 nm) the shift is the same 0.005 nm — one part in 10⁵, which is why Compton needed X-rays to see it.'),
        note('Compton scattering runs in reverse too. A photon that hits a <em>fast</em> electron can gain energy: <em>inverse Compton scattering</em>. The hot gas spiralling into the black hole in the scene is full of relativistic electrons, and it is inverse Compton scattering that turns the disc\'s ultraviolet photons into the hard X-rays by which we detect such systems. The same process imprints the shadows of galaxy clusters on the cosmic microwave background (the Sunyaev–Zel\'dovich effect).', 'Inverse Compton in astrophysics'),
        key('After Compton (Nobel Prize 1927) no one doubted the photon. Light exchanges energy and momentum in discrete, localised packets — and yet it interferes and diffracts like a wave. Both facts are true at once. How that can be is the subject of Section 5.4.'),
      ],
    },
    {
      id: 'photons-summary',
      kicker: 'Summary',
      title: 'Wave and particle: the evidence',
      scene: [backdrop()],
      body: [
        compare(
          { title: 'Light behaves as a wave', items: ['Young\'s double slit (1801): interference fringes', 'Diffraction and polarisation', 'Maxwell (1865): c from electric and magnetic constants', 'Hertz (1887): radio waves reflect, refract, interfere, travel at c', 'Fringes build up even one photon at a time'] },
          { title: 'Light behaves as particles', items: ['Blackbody spectrum needs E = nhν (Planck 1900)', 'Photoelectric effect: threshold, K_max = hν − φ, no delay (Einstein 1905)', 'Compton effect: Δλ = (h/m_e c)(1 − cos θ) (1923)', 'Photon counting: detectors click', 'Radiation pressure: p = E/c'] },
        ),
        summary(
          'A photon has energy E = hν = hc/λ, momentum p = h/λ, zero mass, speed c.',
          'Photoelectric equation K_max = hν − φ; threshold ν₀ = φ/h; intensity sets the number of electrons, frequency sets their energy.',
          'Useful numbers: E(eV) = 1240/λ(nm); visible photons ≈ 2–3 eV; hydrogen is ionised above 13.6 eV; Compton wavelength h/m_e c = 0.00243 nm.',
          'Light is neither a classical wave nor a classical particle. It is a quantum object that shows wave behaviour in propagation and particle behaviour in exchange of energy and momentum.',
        ),
      ],
    },
  ],
};

const S5_3: Section = {
  id: 'bohr-atom',
  number: '5.3',
  title: 'The Bohr Model of the Atom',
  summary: 'Rutherford finds the nucleus, Balmer finds a formula, and Bohr joins them with a single bold postulate that explains the hydrogen spectrum to five decimal places.',
  minutes: 24,
  steps: [
    {
      id: 'rutherford',
      kicker: 'Interactive · history',
      title: 'The nuclear atom',
      widget: { type: 'rutherford' },
      scene: [goto('sun'), rate(1)],
      body: [
        p('By 1900 the atom had parts. J. J. Thomson had found the electron — a particle nearly 2000 times lighter than hydrogen, present in all matter — and proposed the "plum pudding": a sphere of diffuse positive charge with electrons embedded in it like raisins. In 1909 Hans Geiger and Ernest Marsden, students of Ernest Rutherford in Manchester, fired α particles (helium nuclei, from radioactive radium) at a gold foil a few hundred atoms thick and counted the flashes where they landed on a screen.'),
        p('In Thomson\'s atom the positive charge is spread over the whole atomic volume, so its electric field is weak everywhere; an α particle should pass through barely deflected. Most did. But about 1 in 8000 bounced back through more than 90°. Rutherford: "It was almost as incredible as if you fired a 15-inch shell at a piece of tissue paper and it came back and hit you." Only a <em>concentrated</em> positive charge could produce such a field. In 1911 he proposed the nuclear atom: nearly all the mass and all the positive charge in a nucleus about 10⁻¹⁵ m across, with the electrons orbiting at 10⁻¹⁰ m — a hundred thousand times further out. An atom is overwhelmingly empty space.'),
        p('Fire particles in the widget and switch between the two models. In Rutherford\'s atom the trajectories are hyperbolae (the repulsive version of Chapter 2\'s orbits), and the scattering angle depends on how close to the nucleus the particle is aimed. The histogram on the right builds up the famous 1/sin⁴(θ/2) distribution that Geiger and Marsden measured — proving that the force is Coulomb\'s inverse square right down to 10⁻¹⁴ m.'),
        p('The nuclear atom had an immediate, fatal problem. An orbiting electron accelerates; by Maxwell\'s theory an accelerating charge radiates; the electron should lose energy and spiral into the nucleus in about 10⁻¹¹ s, emitting a continuous flash of ever-shorter wavelengths on the way. Atoms should not exist, and their spectra should not be lines. Something in the physics was missing, and it was the same thing that was missing from the blackbody and the photoelectric effect.'),
        note('The Sun in the scene is a useful picture of the problem of scale. If a hydrogen nucleus were the size of the Sun (1.4 million km), the electron would orbit at about 100 000 solar radii — twice the distance of Pluto. The analogy with a planetary system was irresistible in 1911 and is the origin of the word "orbit" for electron states. It is also, as Section 5.4 will show, deeply misleading.', 'A planetary system?'),
      ],
    },
    {
      id: 'balmer',
      kicker: 'Interactive · pattern',
      title: 'Balmer\'s formula',
      widget: { type: 'series' },
      scene: [goto('l-m42', 'landmark'), rate(1)],
      body: [
        p('Hydrogen, the simplest atom, has the simplest spectrum: in the visible, four lines — red at 656.3 nm (Hα), blue-green at 486.1 (Hβ), violet at 434.0 (Hγ) and 410.2 nm (Hδ) — then more, crowding together toward a limit at 364.6 nm. In 1885 Johann Balmer, a Swiss schoolteacher of sixty with a taste for numerology, found that all four wavelengths were given by a single formula with integers. Rewritten in the form Johannes Rydberg gave it in 1888:'),
        eq('\\frac{1}{\\lambda} = R_H \\left( \\frac{1}{m^2} - \\frac{1}{n^2} \\right), \\qquad n > m, \\qquad R_H = 1.0968 \\times 10^{7}\\ \\text{m}^{-1}', 'The Rydberg formula for hydrogen. Balmer\'s visible series is m = 2, n = 3, 4, 5, …; the series limit is n → ∞, λ = 4/R_H = 364.6 nm. R_H is the Rydberg constant.'),
        p('The formula predicted other series. Theodore Lyman found the m = 1 series in the ultraviolet (1906–14), starting at Lyman α, 121.6 nm, the brightest line in the universe. Friedrich Paschen found m = 3 in the infrared (1908), Frederick Brackett m = 4 (1922), August Pfund m = 5 (1924). Every one fell where Rydberg\'s two integers said it would.'),
        p('Click any line in the widget to see its two integers and its wavelength, and watch each series pile up against its own limit. The nebula in the scene glows in Balmer lines: ultraviolet from hot young stars ionises the hydrogen, the electrons recombine, and as they cascade down they emit Hα — the red of every emission nebula ever photographed.'),
        p('Balmer\'s formula was pure pattern, with no physics behind it. It was precise to one part in 10⁴ and involved <em>integers</em>, which in a continuous world should have no place. Any theory of the atom had to produce it, and in 1913 one did.'),
        think('Why integers? Where in classical physics do integers arise naturally? (Standing waves on a string have an integer number of half-wavelengths. Keep this in mind for Section 5.4.)'),
      ],
    },
    {
      id: 'bohr-model',
      kicker: 'Interactive · model',
      title: 'Bohr\'s atom',
      widget: { type: 'bohr' },
      body: [
        p('Niels Bohr, a 27-year-old Dane who had just spent a year with Rutherford, cut the knot in 1913 with two postulates that simply <em>forbade</em> the classical catastrophe:'),
        list(
          'The electron moves in circular orbits under the Coulomb force, but only orbits whose <b>angular momentum is an integer multiple of ħ = h/2π</b> are allowed: L = m_e v r = nħ, n = 1, 2, 3, … In these <em>stationary states</em> the electron does <b>not</b> radiate.',
          'The atom emits or absorbs light only when the electron <b>jumps</b> between allowed orbits, and the photon carries exactly the energy difference: hν = E_n − E_m.',
        ),
        p('Everything else is classical mechanics. Circular motion under Coulomb attraction gives m_e v²/r = e²/4πε₀r². Combine with L = nħ, and the radius and energy of the n-th orbit follow:'),
        eq('r_n = \\frac{4\\pi\\varepsilon_0 \\hbar^2}{m_e e^2}\\, n^2 = a_0\\, n^2, \\qquad a_0 = 5.29 \\times 10^{-11}\\ \\text{m}', 'The Bohr radius a₀ and the allowed orbits. Radii grow as n²: the n = 2 orbit is four times the size of the ground state, n = 10 a hundred times.'),
        eq('E_n = -\\frac{m_e e^4}{32\\pi^2 \\varepsilon_0^2 \\hbar^2}\\,\\frac{1}{n^2} = -\\frac{13.6\\ \\text{eV}}{n^2}', 'Energy levels of hydrogen (kinetic plus potential). Negative because the electron is bound; zero is the ionisation limit. The ground state, n = 1, lies 13.6 eV below it: this is the ionisation energy of hydrogen, and it came out of the theory with no adjustable parameters.'),
        p('Now apply postulate two to a jump from n to m. The photon energy is hc/λ = E_n − E_m = 13.6 eV (1/m² − 1/n²). Divide by hc and this is <em>exactly Balmer\'s formula</em>, with the Rydberg constant expressed in fundamental constants: R = m_e e⁴/(64π³ε₀²ħ³c) = 1.097 × 10⁷ m⁻¹. Bohr computed the number and it matched Rydberg\'s measured one to 0.1 %. Einstein, told of it, called it "one of the greatest discoveries".'),
        p('In the widget the orbits and the energy ladder are drawn to scale. <em>Click a level</em> to send the electron there: a downward jump emits a photon whose colour and wavelength appear on the spectrum below; an upward jump absorbs one. Build the Balmer series by jumping down to n = 2 from each higher level, and the Lyman series by jumping to n = 1.'),
        key('Bohr\'s postulates were not derived from anything — they were a declaration that classical physics stops at the atom and that something with Planck\'s constant in it takes over. The theory was half-classical and self-contradictory, and it worked.'),
      ],
    },
    {
      id: 'hydrogenic',
      kicker: 'Interactive · generalisation',
      title: 'Other nuclei, and the limits of the model',
      widget: { type: 'hydrogenic' },
      scene: [goto('Rigel', 'star'), rate(1)],
      body: [
        p('Bohr\'s derivation works for any <em>one-electron</em> system: hydrogen, deuterium, He⁺, Li²⁺, and so on. A nucleus of charge Ze pulls Z times harder, so the orbits shrink by Z and the energies grow by Z²:'),
        eq('r_n = \\frac{a_0 n^2}{Z}, \\qquad E_n = -13.6\\ \\text{eV}\\,\\frac{Z^2}{n^2}, \\qquad \\frac{1}{\\lambda} = R\\,Z^2\\left(\\frac{1}{m^2} - \\frac{1}{n^2}\\right)', 'Hydrogen-like ions. He⁺ (Z = 2) has an ionisation energy of 54.4 eV and a spectrum four times "stretched" in energy. Its n = 4 → 2 line falls almost exactly on hydrogen\'s Hα, 656 nm.'),
        p('There is a smaller correction too. The electron does not orbit a fixed nucleus; both orbit their common centre of mass (Section 2.3), and m_e must be replaced by the <em>reduced mass</em> μ = m_e M/(m_e + M). For hydrogen μ is 0.9995 m_e; for deuterium, with a nucleus twice as heavy, slightly larger. The result: deuterium\'s lines are shifted by 0.03 % — Hα moves from 656.28 to 656.10 nm — and that is how Harold Urey discovered deuterium in 1931. Slide Z and switch the nucleus in the widget to see both effects.'),
        p('In 1896 Edward Pickering had found a series of lines in the hot star ζ Puppis that fitted Rydberg\'s formula with <em>half-integer</em> n — a mystery. Bohr showed they were He⁺ with Z = 2: every other line coincides with a hydrogen line, and the ones in between look half-integer. The reduced-mass correction even explained a tiny mismatch between the coincident lines. Hot stars like Rigel in the scene show He⁺ absorption; their presence is the signature of a surface above 30 000 K.'),
        table(
          ['n', 'r_n (a₀)', 'E_n (eV)', 'v_n / c', 'Lyman n→1 (nm)'],
          [['1', '1', '−13.60', '1/137', '—'], ['2', '4', '−3.40', '1/274', '121.6'], ['3', '9', '−1.51', '1/411', '102.6'], ['4', '16', '−0.85', '1/548', '97.3'], ['5', '25', '−0.54', '1/685', '95.0'], ['∞', '∞', '0', '0', '91.2']],
          'The hydrogen ladder. v₁/c = e²/(4πε₀ħc) = 1/137.036 is the fine-structure constant α — the pure number that measures the strength of electromagnetism. Relativity is a small correction for hydrogen but grows as Z²: the inner electrons of gold move at 0.6c, which is why gold is yellow.',
        ),
        compare(
          { title: 'What Bohr\'s model gets right', items: ['Hydrogen energy levels and all its spectral series', 'The Rydberg constant from fundamental constants', 'Ionisation energy 13.6 eV', 'Hydrogen-like ions (Z²) and isotope shifts (reduced mass)', 'The size of atoms (a₀) and why they are stable'] },
          { title: 'What it gets wrong or cannot do', items: ['Helium and every atom with more than one electron', 'The relative brightness of lines (transition rates)', 'Fine structure: lines that are close doublets', 'Spectra in magnetic fields (the Zeeman effect)', 'The ground state has L = ħ in Bohr, L = 0 in reality', 'An electron "in orbit" would radiate — the postulate forbids it but does not explain why'] },
        ),
      ],
    },
    {
      id: 'bohr-summary',
      kicker: 'Summary',
      title: 'The Bohr atom in brief',
      scene: [backdrop()],
      body: [
        summary(
          'Rutherford (1911): a tiny massive positive nucleus, electrons far outside. Classically unstable — an orbiting electron should radiate and fall in.',
          'Balmer (1885) / Rydberg (1888): 1/λ = R_H(1/m² − 1/n²) fits every hydrogen line; Lyman (UV), Balmer (visible), Paschen, Brackett, Pfund (IR).',
          'Bohr (1913): L = nħ; no radiation in stationary states; hν = E_n − E_m on jumps.',
          'r_n = a₀n², a₀ = 0.0529 nm; E_n = −13.6 eV/n²; Rydberg constant derived to 0.1 %.',
          'Hydrogen-like ions: E ∝ Z²; reduced mass μ shifts isotopes (deuterium discovered this way).',
          'Limits: one electron only; no line strengths; no fine structure; the orbit picture itself is wrong.',
        ),
        think('Bohr\'s model is taught in every introductory course even though it is known to be wrong in its picture of the atom. What makes a wrong model worth learning? Which of its results survive into the correct theory, and which do not?'),
      ],
    },
  ],
};

const S5_4: Section = {
  id: 'quantum-mechanics',
  number: '5.4',
  title: 'Quantum Mechanics and Wave–Particle Duality',
  summary: 'De Broglie gives the electron a wavelength, Schrödinger gives it an equation, Heisenberg gives it limits, Pauli gives it a rule — and the periodic table, white dwarfs and the 21 cm line all follow.',
  minutes: 26,
  steps: [
    {
      id: 'debroglie',
      kicker: 'Interactive · idea',
      title: 'Matter waves',
      widget: { type: 'matterwave' },
      scene: [goto('earth'), rate(1)],
      body: [
        p('In his 1924 doctoral thesis Louis de Broglie asked a symmetrical question. If light, long thought a wave, has particle properties with E = hν and p = h/λ, might matter, long thought particles, have wave properties with the <em>same</em> relations? He proposed that every particle of momentum p has an associated wavelength:'),
        eq('\\lambda = \\frac{h}{p} = \\frac{h}{m v}, \\qquad \\nu = \\frac{E}{h}', 'The de Broglie relations. For an electron accelerated through 100 V, p = √(2m_e K) and λ = 0.12 nm — about the spacing of atoms in a crystal. For a thrown baseball, λ ≈ 10⁻³⁴ m, which is why baseballs do not diffract.'),
        p('The idea explained Bohr\'s mysterious postulate at once. Wrap a wave around a circular orbit of radius r: it fits only if the circumference holds a whole number of wavelengths, 2πr = nλ. Otherwise the wave interferes with itself and cancels. Put in λ = h/mv and 2πr = nh/mv, that is, mvr = nħ — Bohr\'s condition, derived rather than declared. The integers in the hydrogen spectrum are the integers of standing waves, as on a guitar string.'),
        p('Try it in the widget: slide n through non-integer values and watch the wave fail to close on itself; at integers it locks into a standing pattern. Then switch the "particle" selector to see the de Broglie wavelength of an electron, a proton, a dust grain and a person.'),
        history('Einstein read the thesis and wrote that de Broglie had "lifted a corner of the great veil". Direct proof came in 1927: Clinton Davisson and Lester Germer, firing electrons at a nickel crystal, found them scattered into the same angular pattern that X-rays of wavelength h/p produce; G. P. Thomson (son of J. J., who had shown the electron was a particle) got diffraction rings by passing electrons through thin metal foils. Father and son both won Nobel Prizes, one for showing the electron is a particle, the other for showing it is a wave. Electron diffraction is now a standard tool: electron microscopes see atoms because an electron\'s wavelength is a thousand times shorter than light\'s. Since then neutrons, whole atoms, and molecules of 2000 atoms have been diffracted.', 'Proof'),
      ],
    },
    {
      id: 'schrodinger',
      kicker: 'Interactive · theory',
      title: 'Schrödinger\'s equation and the real hydrogen atom',
      widget: { type: 'orbitals' },
      scene: [goto('sun'), rate(1)],
      body: [
        p('If the electron is a wave, there must be a wave equation. Erwin Schrödinger wrote it down over the Christmas holidays of 1925. For a particle of mass m in a potential V, the <em>wavefunction</em> Ψ(x, t) obeys:'),
        eq('i\\hbar\\,\\frac{\\partial \\Psi}{\\partial t} = -\\frac{\\hbar^2}{2m}\\,\\nabla^2 \\Psi + V\\,\\Psi', 'The Schrödinger equation. For a state of definite energy E, Ψ = ψ(x) e^{−iEt/ħ}, and the time-independent form is −(ħ²/2m)∇²ψ + Vψ = Eψ: an eigenvalue problem whose solutions exist only for certain E. Quantisation is no longer a postulate; it is the mathematics of waves confined by a potential.'),
        p('What is Ψ? Max Born gave the answer in 1926: |Ψ|² is a <em>probability density</em>. The electron does not orbit; it has a probability |Ψ|² dV of being found in each small volume dV. The atom is a standing wave of probability, and the "orbits" of Bohr are replaced by <em>orbitals</em> — clouds of varying density. For the Coulomb potential of hydrogen the equation can be solved exactly, and the allowed energies are:'),
        eq('E_n = -\\frac{13.6\\ \\text{eV}}{n^2}', 'The same levels as Bohr — but now n is the principal quantum number of a three-dimensional standing wave, and each level comes with other quantum numbers describing the shape of the wave.'),
        terms(
          ['n = 1, 2, 3, …', 'Principal quantum number: sets the energy and the overall size (⟨r⟩ ≈ a₀ n²).'],
          ['l = 0, 1, …, n − 1', 'Orbital angular momentum quantum number: L = √(l(l+1)) ħ. l = 0, 1, 2, 3 are called s, p, d, f. The ground state has l = 0: no angular momentum, unlike Bohr\'s ħ.'],
          ['m_l = −l, …, +l', 'Magnetic quantum number: the component of L along a chosen axis, L_z = m_l ħ. The 2l + 1 values are degenerate (same energy) unless a magnetic field is applied — the Zeeman effect, which lets us measure stellar magnetic fields.'],
        ),
        p('The widget renders the real thing: a slice through |ψ|² for the lowest orbitals of hydrogen, with the radial probability curve and the Bohr radius marked. The 1s cloud is a fuzzy ball most dense at the nucleus; its most probable <em>radius</em> is exactly a₀ — Bohr\'s orbit survives as the peak of a distribution. The 2p orbitals are dumbbells; 3d are cloverleaves. Chemistry is the shapes on this screen.'),
        key('Bohr\'s n survives, his orbits do not. Quantum mechanics keeps every number Bohr got right and explains the ones he got wrong: the degeneracies of the levels, the selection rules (Δl = ±1) that say which transitions happen, their rates, and — once the electron\'s spin and relativity are added — the fine structure of the lines.'),
      ],
    },
    {
      id: 'uncertainty',
      kicker: 'Interactive · principle',
      title: 'Heisenberg\'s uncertainty principle',
      widget: { type: 'wavepacket' },
      scene: [goto('hubble'), rate(1)],
      body: [
        p('A wave with a single, exact wavelength extends forever — it has a definite momentum p = h/λ but no position at all. To <em>localise</em> a wave you must add waves of different wavelengths so they reinforce in one region and cancel elsewhere: a <em>wave packet</em>. The narrower the packet, the wider the range of wavelengths — of momenta — it must contain. This is a theorem about waves (Fourier\'s), and in 1927 Werner Heisenberg saw what it means for matter waves:'),
        eq('\\Delta x\\,\\Delta p \\geq \\frac{\\hbar}{2}', 'The uncertainty principle. Δx and Δp are the standard deviations of position and momentum. The product has a minimum; a Gaussian packet achieves it. Nothing about measurement technology is involved: an electron does not <em>have</em> a sharp position and a sharp momentum at the same time, any more than a sound can have a definite pitch and a definite instant.'),
        p('In the widget, narrow the packet in position and watch its momentum distribution broaden; the product sits on the limit. Add fewer waves and the packet spreads. The slider is doing exactly what nature does when an electron is confined to an atom: squeeze it into a₀ and it acquires a momentum spread ħ/a₀ — a kinetic energy of order ħ²/2m_e a₀² ≈ 13.6 eV. The uncertainty principle sets the size of atoms: the electron cannot fall into the nucleus because confining it costs more kinetic energy than the Coulomb attraction pays back. Rutherford\'s collapse is averted by Heisenberg.'),
        eq('\\Delta E\\,\\Delta t \\geq \\frac{\\hbar}{2}', 'The energy–time form. A state that lives for Δt has an energy uncertain by ħ/2Δt. Excited atomic states live about 10⁻⁸ s, so their energies are uncertain by 10⁻⁷ eV and the spectral lines they emit have a <em>natural width</em> — the first of several broadening mechanisms Chapter 9 will use to measure stellar atmospheres.'),
        p('The telescope in the scene, Hubble, obeys the same principle with photons. A photon that passes through a mirror of diameter D has its transverse position fixed to Δx ≈ D, so its transverse momentum is uncertain by ħ/D and its direction by Δθ ≈ λ/D. That is the diffraction limit of every telescope: Hubble\'s 2.4 m mirror cannot resolve better than about 0.05 arcseconds in visible light, however perfect its optics. Bigger mirrors see sharper not only because they collect more light but because they localise the photon less.'),
        think('Heisenberg\'s original argument used a "gamma-ray microscope": to see where an electron is you must bounce a photon off it, and the photon\'s momentum kick disturbs the electron. This is a useful picture but it is <em>not</em> the content of the principle, which holds even when nothing is measured. Can you state the difference?'),
      ],
    },
    {
      id: 'spin-pauli',
      kicker: 'Interactive · principle',
      title: 'Spin and the exclusion principle',
      widget: { type: 'pauli' },
      scene: [goto('Sirius', 'star'), rate(1)],
      body: [
        p('High-resolution spectra showed that many lines are close doublets: sodium\'s D line is two lines 0.6 nm apart, hydrogen\'s Hα is split by 0.016 nm. In 1925 Samuel Goudsmit and George Uhlenbeck proposed that the electron has an intrinsic angular momentum, <em>spin</em>, of fixed magnitude S = √(3/4) ħ, with a component along any axis of only two possible values:'),
        eq('S_z = m_s\\,\\hbar, \\qquad m_s = \\pm\\tfrac{1}{2}', '"Spin up" and "spin down". Spin is not literal rotation — a point particle spinning fast enough to have ħ/2 would have its surface moving faster than light — but a purely quantum property with no classical picture. The Stern–Gerlach experiment (1922) had already shown it: a beam of silver atoms through a non-uniform magnetic field split into exactly two beams, not a continuous smear.'),
        p('Spin interacts with the magnetic field of the electron\'s own orbital motion; the two orientations have slightly different energies, and every level with l > 0 splits in two. That is the <em>fine structure</em>, and its size is set by the fine-structure constant α = 1/137 that appeared in Bohr\'s velocities. (The nuclear spin splits things further, by much less: the <em>hyperfine</em> splitting of hydrogen\'s ground state is a 6 µeV photon of 21 cm wavelength, the line that maps the gas of the Milky Way.)'),
        p('In the same year Wolfgang Pauli stated the rule that organises all of matter. A complete description of an electron in an atom is the set (n, l, m_l, m_s). The <em>exclusion principle</em>: <b>no two electrons in a system can have the same set of quantum numbers</b>. Each spatial orbital (n, l, m_l) can hold at most two electrons, one of each spin. Fill the atom in the widget electron by electron and watch the shells close: 2 electrons in n = 1, 8 in n = 2, 8 more to fill 3s and 3p — helium, neon, argon. The periodic table is the exclusion principle in a grid.'),
        p('Without it, every electron would drop to the 1s state, all atoms would be tiny and chemically identical, and there would be no chemistry. With it, matter resists compression: squeeze electrons together and they are forced into states of higher momentum, a pressure that depends on density but not on temperature — <em>degeneracy pressure</em>. The faint companion of Sirius in the scene, Sirius B, is a white dwarf: the mass of the Sun in the volume of the Earth, held up against gravity by nothing but Pauli\'s principle. Chapter 16 will show that this support fails above 1.4 solar masses, with consequences for the whole universe.'),
        history('Pauli was 25 when he stated the principle and had no idea why it should be true. The explanation — that particles with half-integer spin (<em>fermions</em>: electrons, protons, neutrons, neutrinos) must have antisymmetric wavefunctions, while those with integer spin (<em>bosons</em>: photons, helium-4 atoms) may crowd into one state without limit — came from relativistic quantum field theory in 1940, in Pauli\'s own spin-statistics theorem. Photons being bosons is why lasers work; electrons being fermions is why you do not fall through the floor.', 'Fermions and bosons'),
      ],
    },
    {
      id: 'quantum-close',
      kicker: 'Chapter close',
      title: 'Light and matter in one page',
      scene: [backdrop()],
      body: [
        summary(
          'Kirchhoff\'s laws: continuum from hot dense matter; emission lines from hot thin gas; absorption lines from cool thin gas before a continuum. Doppler shifts give radial velocities, Δλ/λ = v_r/c.',
          'Photons: E = hν = hc/λ, p = h/λ. Photoelectric: K_max = hν − φ. Compton: Δλ = (h/m_e c)(1 − cos θ).',
          'Bohr: L = nħ, r_n = a₀n², E_n = −13.6 eV/n²; jumps give the Rydberg formula 1/λ = R(1/m² − 1/n²). Hydrogen-like ions: E ∝ Z².',
          'De Broglie: λ = h/p; standing waves explain the integers. Schrödinger: |ψ|² is probability; quantum numbers n, l, m_l; orbitals, not orbits.',
          'Heisenberg: Δx Δp ≥ ħ/2, ΔE Δt ≥ ħ/2 — the size of atoms and the natural width of lines.',
          'Spin ½ and Pauli\'s exclusion principle: two electrons per orbital, the periodic table, degeneracy pressure, white dwarfs.',
        ),
        key('Every spectral line is a transition between two quantum states. Its wavelength says which element and which levels; its strength says how many atoms are in the lower level, hence the temperature and abundance; its shift says the velocity; its width says the pressure, rotation and magnetic field. Chapters 8 and 9 turn these facts into the classification and analysis of stellar spectra. Everything we know about the chemistry of the universe passes through this chapter.'),
        { kind: 'callout', tone: 'history', title: 'Suggested reading', html: 'For the physics, any introductory modern-physics text (Tipler & Llewellyn, <em>Modern Physics</em>; Eisberg & Resnick, <em>Quantum Physics of Atoms, Molecules, Solids, Nuclei and Particles</em>). Richard Feynman, <em>QED: The Strange Theory of Light and Matter</em> (1985), is the best short account of what photons actually do. For the history: Abraham Pais, <em>Inward Bound</em> (1986) and <em>Niels Bohr\'s Times</em> (1991); Manjit Kumar, <em>Quantum</em> (2008); and the original papers in <em>Sources of Quantum Mechanics</em> (van der Waerden, ed., Dover). J. B. Hearnshaw, <em>The Analysis of Starlight</em> (2nd ed., 2014), is the definitive history of astronomical spectroscopy.' },
        { kind: 'callout', tone: 'think', title: 'Problems to try', html: '(1) Sodium\'s D₂ line is at 588.995 nm. A star shows it at 589.120 nm. Find the radial velocity. (2) The work function of potassium is 2.30 eV. Find the threshold wavelength, and K_max for light of 400 nm. (3) An X-ray photon of 0.0711 nm (Mo Kα) scatters through 90°. Find the scattered wavelength and the energy given to the electron. (4) Compute the wavelength of the Paschen α line (n = 4 → 3) and the Balmer series limit. (5) Find the de Broglie wavelength of an electron with 13.6 eV of kinetic energy, and compare it with the circumference of the n = 1 Bohr orbit. (6) Use Δx Δp ≈ ħ to estimate the minimum kinetic energy of an electron confined to a nucleus of radius 5 × 10⁻¹⁵ m, and argue that electrons cannot be nuclear constituents. (7) Write the electron configuration of oxygen (Z = 8) and iron (Z = 26), and count the electrons in the outermost shell of each.' },
      ],
    },
  ],
};

/* ================================================================================ */
/*  Chapter 6 — Telescopes                                                           */
/* ================================================================================ */

const S6_1: Section = {
  id: 'basic-optics',
  number: '6.1',
  title: 'Basic Optics',
  summary: 'Why a telescope is first of all a bucket for light; how refraction and reflection bend it to a focus; and the two limits — diffraction and the atmosphere — that decide how sharp the picture can be.',
  minutes: 28,
  steps: [
    {
      id: 'light-bucket',
      kicker: 'Interactive · the point of it',
      title: 'A telescope is a bucket for light',
      widget: { type: 'lightbucket' },
      scene: [goto('hubble'), rate(1)],
      body: [
        p('Everything in the previous chapters arrived as light, and almost all of that light is pitifully faint. The dark-adapted eye has a pupil about 7 mm across and integrates for roughly a tenth of a second; with that it reaches 6th magnitude — a few thousand stars. A galaxy at the edge of the observable universe delivers to the Earth perhaps one photon per square metre per <em>minute</em> in the visible. No eye and no cleverness can see it. What is needed is a larger collecting area, a longer exposure, and a detector that does not forget.'),
        p('That is the first and most important job of a telescope, and it is the one Galileo\'s audience in 1609 appreciated least: it <b>gathers light</b>. The number of photons collected scales with the area of the aperture, that is, with the square of its diameter D, and with the exposure time t:'),
        eq('N \\propto D^2\\, t', 'A 10 m telescope collects (10/0.007)² ≈ 2 million times the light of the eye per second; a one-hour exposure multiplies that by another 36 000. Together: eleven magnitudes… times another eleven. That is how a 30th-magnitude galaxy becomes an image.'),
        p('The widget is a light bucket. Set the aperture — from the eye to the 39 m Extremely Large Telescope — and the exposure, and watch a patch of sky fill in: stars that were below the noise emerge as the photon count grows, since a source is detected when its photons outnumber the fluctuations in the background. Notice that doubling the exposure gains far less than doubling the aperture.'),
        terms(
          ['Aperture D', 'The diameter of the objective lens or primary mirror — the single most quoted number about a telescope, because light grasp ∝ D² and resolution ∝ 1/D.'],
          ['Light-gathering power', 'Collecting area relative to the eye: (D / 7 mm)². A 20 cm amateur telescope: about 800×.'],
          ['Limiting magnitude', 'The faintest star detectable; grows by 5 magnitudes for every factor of 10 in diameter, and by 2.5 magnitudes for every factor of 10 in exposure time (when background noise dominates, half of that).'],
          ['Signal-to-noise ratio', 'Detected photons from the source divided by the random fluctuation in the total count (√N for photon counting). Astronomers speak of "a 5σ detection".'],
        ),
        key('Magnification is the least important property of a telescope; it can be changed by swapping an eyepiece. Aperture cannot. Every advance in observational astronomy since 1609 — Herschel\'s 1.2 m, the 5 m Hale, the 10 m Kecks, the 6.5 m JWST mirror in the scene\'s neighbourhood, the coming 39 m ELT — has first of all been a bigger bucket.'),
      ],
    },
    {
      id: 'refraction',
      kicker: 'Interactive · physics',
      title: 'Refraction: Snell\'s law',
      widget: { type: 'snell' },
      scene: [goto('earth'), rate(1)],
      body: [
        p('Light travels more slowly in glass or water than in vacuum. The ratio is the <em>index of refraction</em> n = c/v: about 1.00029 for air, 1.33 for water, 1.5–1.7 for glasses, 2.42 for diamond. When a wavefront crosses obliquely from one medium into another, the part that enters first slows first, and the front pivots — the ray bends. Willebrord Snell found the rule in 1621 (Ibn Sahl had it in 984):'),
        eq('n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2', 'Snell\'s law. Angles are measured from the normal to the surface. Entering a denser medium (n₂ > n₁) the ray bends <em>toward</em> the normal; leaving it, away.'),
        p('Drag the incident ray in the widget. Going from glass to air, increase the angle and watch the refracted ray flatten along the surface and then vanish: beyond the <em>critical angle</em> sin θ_c = n₂/n₁ there is no solution and all the light reflects. This total internal reflection is what guides light along optical fibres — including the fibres that carry starlight from a telescope\'s focal plane to its spectrograph.'),
        p('Now change the wavelength. The index of refraction is not quite constant: for ordinary glass it is larger for blue light than for red (<em>dispersion</em>), so blue bends more. Newton\'s prism splits sunlight for exactly this reason — and the same effect will haunt every lens in the next section.'),
        p('Reflection has an even simpler law, known to Euclid: the angle of reflection equals the angle of incidence, with both rays and the normal in one plane. A mirror does not care about wavelength. Remember that.'),
        note('Snell\'s law is a consequence of Fermat\'s principle — light takes the path of least <em>time</em> between two points — or, equivalently, of the continuity of the wave across the boundary: the wavelength shrinks by a factor n inside the medium while the frequency stays fixed. In quantum language the photon\'s momentum component parallel to the surface is conserved.', 'Why it holds'),
      ],
    },
    {
      id: 'lenses',
      kicker: 'Interactive · geometry',
      title: 'Lenses, mirrors and the focal length',
      widget: { type: 'lens' },
      scene: [goto('moon'), rate(1)],
      body: [
        p('Shape a piece of glass so that it is thicker in the middle and Snell\'s law bends parallel rays toward a common point: a <em>converging lens</em>. Curve a mirror into a paraboloid and the law of reflection does the same. In both cases the distance from the optic to the point where parallel light converges is the <em>focal length</em> f. Light from a star is parallel to an extraordinary degree, so a star\'s image forms exactly in the <em>focal plane</em> — which is where the detector goes.'),
        p('For an object that is not at infinity, at distance p, the image forms at distance q given by the thin-lens equation:'),
        eq('\\frac{1}{p} + \\frac{1}{q} = \\frac{1}{f}, \\qquad m = -\\frac{q}{p}', 'The thin-lens (and mirror) equation; m is the lateral magnification, negative for an inverted image. For a spherical mirror f = R/2. Astronomical telescopes always work with p → ∞, so q → f.'),
        p('In the widget, slide the object toward the lens and watch the image recede, grow, and finally — inside the focal length — become a virtual, upright, magnified image on the same side: a magnifying glass. The three construction rays (parallel → through the focus; through the centre → undeviated; through the focus → parallel) are drawn for you. Switch to the concave mirror and note that nothing about the geometry changes except that the light folds back.'),
        p('A telescope is two of these in series. The <em>objective</em> (lens or mirror) forms a real image of the sky in its focal plane; an <em>eyepiece</em> of short focal length then acts as a magnifying glass on that image, or a camera simply records it. The <em>f-ratio</em> F = f/D sets how concentrated the light in the image is: a "fast" f/2 mirror makes a small, bright image good for faint extended nebulae; a "slow" f/15 system spreads it out for planets and spectroscopy.'),
        example('The Moon subtends 0.52°. In the focal plane of a lens of focal length f the image of an object of angular size θ has linear size y = f θ (θ in radians). For a 1000 mm lens, y = 1000 × 0.0091 = 9.1 mm — the Moon just fits on a 35 mm frame. For the 57 m effective focal length of the Hale telescope at its Cassegrain focus, the Moon\'s image is half a metre wide. Short focal length: wide field. Long focal length: fine detail spread across many pixels.', 'The Moon in the focal plane'),
      ],
    },
    {
      id: 'diffraction',
      kicker: 'Interactive · limit 1',
      title: 'Diffraction and the resolution limit',
      widget: { type: 'airy' },
      scene: [goto('Mizar', 'star'), rate(1)],
      body: [
        p('Geometric optics promises a point image of a point star. Waves do not deliver it. An aperture of diameter D admits only a slice of the incoming wavefront, and the truncated wave spreads — it <em>diffracts</em> — exactly as in Young\'s double slit of Chapter 3, now with a circular opening. The image of a star is a bright central disc surrounded by faint rings: the <em>Airy pattern</em>, named for George Airy who derived it in 1835. The first dark ring falls at an angle'),
        eq('\\theta = 1.22\\,\\frac{\\lambda}{D}', 'The radius of the Airy disc (radians). For the eye at 550 nm: 1.22 × 5.5×10⁻⁷/0.007 ≈ 10⁻⁴ rad ≈ 20 arcseconds (the eye actually does a little worse). For Hubble\'s 2.4 m: 0.057″. For a 10 m Keck: 0.014″ — <em>if</em> nothing else interferes.'),
        p('Two stars closer together than this merge into one blob. Lord Rayleigh\'s practical criterion: two point sources are <em>just resolved</em> when the central maximum of one falls on the first minimum of the other, that is, when their separation equals θ above. In the widget set the aperture and wavelength, then slide the two stars together and watch the profile: two peaks, a saddle, one peak. The number in the readout is the only thing that ever improves resolution: a bigger D or a shorter λ.'),
        eq('\\theta_{\\min} \\approx 2.5 \\times 10^5\\,\\frac{\\lambda}{D}\\ \\text{arcsec}', 'The same formula in observers\' units (206 265 arcsec per radian × 1.22). At 21 cm a radio dish of 100 m resolves only 9 arcminutes — a third of the Moon. Hence Section 6.3.'),
        p('The pair in the scene, Mizar and Alcor, is 12 arcminutes apart and easy for the eye. Mizar itself is a double of 14 arcseconds — the first telescopic double star, seen by Riccioli in 1650 — which needs an aperture of about 1 cm; and each of those two is again a spectroscopic binary (Chapter 5) that no telescope will ever split.'),
        key('Resolution is set by the wave nature of light, not by the quality of the optics. A perfect telescope is called <em>diffraction-limited</em>: the only way past its limit is to make the aperture larger — or, as Section 6.3 shows, to make several apertures behave as one.'),
      ],
    },
    {
      id: 'seeing',
      kicker: 'Interactive · limit 2',
      title: 'The atmosphere: seeing and adaptive optics',
      widget: { type: 'seeing' },
      scene: [goto('iss'), rate(1)],
      body: [
        p('From the ground, however, diffraction is rarely the limit. Starlight crosses tens of kilometres of air in which temperature — and therefore index of refraction — varies from one centimetre-sized pocket to the next, on timescales of milliseconds. The flat wavefront from the star arrives crumpled. A short exposure shows the star shattered into a cloud of dancing <em>speckles</em>, each one a diffraction-limited image from a different coherent patch of the wavefront; a long exposure smears them into a blob 0.5–2 arcseconds across. Astronomers call that blob\'s size the <em>seeing</em>. It is why stars twinkle.'),
        p('In the widget compare the two exposures, change the seeing and the aperture. Above a certain aperture — the <em>Fried parameter</em> r₀, 10–20 cm in the visible at a good site — making the telescope bigger no longer sharpens the long-exposure image at all; it only collects more light into the same blur. A 10 m telescope in 1″ seeing resolves no better than a 12 cm one. That was the state of affairs for three centuries, and it is why observatories went to mountain tops (Mauna Kea, the Chilean Andes, La Palma) where the air is thin, dry and smooth, and finally — Hubble — above the air altogether.'),
        p('Since the 1990s there has been a third way. <em>Adaptive optics</em> measures the wavefront distortion several hundred times a second using a bright reference star — or an artificial one, a <em>laser guide star</em> made by exciting sodium atoms 90 km up — and cancels it with a deformable mirror whose surface is pushed by hundreds of actuators. Switch it on in the widget: the speckles collapse back into an Airy disc. With AO the 10 m Kecks and the 8 m VLT reach their diffraction limit in the infrared, and the images of the stars orbiting the Galactic Centre black hole (Chapter 24) were made this way.'),
        terms(
          ['Seeing', 'The angular size (FWHM) of a star\'s long-exposure image through the atmosphere; 0.4″ on a superb night, 3″ in a city.'],
          ['Scintillation', 'The twinkling in brightness, caused by the same turbulence focusing and defocusing the light; planets twinkle less because their discs average it out.'],
          ['Fried parameter r₀', 'The size of the atmospheric patch over which the wavefront is still flat; scales as λ^(6/5), which is why seeing is better in the infrared.'],
          ['Strehl ratio', 'Peak intensity of the actual star image relative to a perfect Airy disc; 0.01 uncorrected, 0.3–0.9 with adaptive optics.'],
        ),
        think('The space station in the scene orbits at 400 km, well above the turbulent layers, yet astronauts photograph the Earth through air that is at its most turbulent when seen from above. Why does the atmosphere blur a star seen from below far more than it blurs a city seen from above, through the same air? (Think about where the turbulence is relative to the aperture, and what "near" and "far" field mean.)'),
      ],
    },
    {
      id: 'optics-summary',
      kicker: 'Summary',
      title: 'Basic optics in brief',
      scene: [backdrop()],
      body: [
        summary(
          'Light grasp ∝ D² t. Aperture is the number that matters; magnification is a detail.',
          'Refraction: n₁ sin θ₁ = n₂ sin θ₂; n = c/v; dispersion makes n depend on λ. Reflection: θ_r = θ_i, independent of λ.',
          'Focal length f: parallel light converges there; 1/p + 1/q = 1/f, m = −q/p; image size y = f θ; f-ratio F = f/D.',
          'Diffraction: the Airy pattern; Rayleigh resolution θ = 1.22 λ/D. Bigger D or shorter λ — nothing else.',
          'Seeing: atmospheric turbulence limits ground-based images to ~1″ regardless of aperture beyond r₀ ≈ 10–20 cm; adaptive optics and space restore the diffraction limit.',
        ),
        key('Three numbers describe the raw capability of any telescope: its aperture (how faint), its diffraction limit (how sharp) and its focal length (how large the image). Everything in the rest of the chapter is engineering to get close to those numbers at each wavelength.'),
      ],
    },
  ],
};

const S6_2: Section = {
  id: 'optical-telescopes',
  number: '6.2',
  title: 'Optical Telescopes',
  summary: 'Refractors and their colour problem; the mirror designs — Newtonian, Cassegrain, Schmidt — that replaced them; focal length and field of view; the race for aperture; and the mounts that keep a star still.',
  minutes: 30,
  steps: [
    {
      id: 'refractors',
      kicker: 'Interactive · history & flaw',
      title: 'Refracting telescopes and chromatic aberration',
      widget: { type: 'chromatic' },
      scene: [goto('jupiter'), rate(1)],
      body: [
        p('The first telescopes were <em>refractors</em>: an objective lens and an eyepiece. Hans Lippershey applied for a patent in 1608; Galileo heard of it, built his own, and by January 1610 had found four moons circling Jupiter — the ones in the scene — with a 37 mm objective magnifying 20 times. Kepler improved the design with a convex eyepiece (inverted image, wider field), and for two centuries the refractor was <em>the</em> telescope.'),
        p('It has a built-in flaw. Because glass disperses, a single lens has a different focal length for every colour: blue light focuses closer than red. Focus on the yellow and every star wears a purple halo. This <em>chromatic aberration</em> is what the widget shows: trace the three colours through the single lens and see the three separate foci. The spread is about f/60 for ordinary crown glass — 17 mm for a one-metre focal length.'),
        p('Seventeenth-century opticians could do only one thing: make the focal length enormous, so that the colour spread became small compared with the depth of focus. Hevelius built a 45 m "aerial telescope" slung from a mast; Huygens discovered Titan and Saturn\'s ring with a 7 m tube. Newton, concluding the problem was incurable, built a mirror instead (next step).'),
        p('He was wrong about incurable. In 1733 Chester Moor Hall, and in 1758 John Dollond, combined a converging lens of crown glass with a weaker diverging lens of dense flint glass. Flint disperses more strongly per unit of bending, so the pair can cancel the colour spread while keeping net convergence. Switch the widget to the <em>achromatic doublet</em> and watch red and blue meet at a common focus (green sits slightly off: the residual "secondary spectrum"). Add a third glass and you have an <em>apochromat</em>.'),
        eq('\\frac{1}{f_{\\text{total}}} = \\frac{1}{f_1} + \\frac{1}{f_2}, \\qquad \\frac{f_1}{f_2} = -\\frac{V_1}{V_2}', 'Achromat condition. V is the Abbe number, a measure of how little a glass disperses (crown ≈ 60, flint ≈ 36). The weaker flint lens has about −1.7 times the focal length of the crown lens.'),
        history('Achromats made the great refractors of the nineteenth century possible: Fraunhofer\'s 24 cm at Dorpat (1824, the first on a modern equatorial mount), the 91 cm Lick (1888) and the 1.02 m Yerkes (1897), which remains the largest refractor ever used. The reasons it <em>remains</em> the largest: a lens can only be held at its edge and sags under its own weight; the glass must be flawless all the way through; it absorbs blue and ultraviolet light; and two surfaces per element must be figured. A mirror has one surface, can be supported from behind, and is colour-blind. After Yerkes, every large telescope has been a reflector.', 'Why 1 m is the limit'),
      ],
    },
    {
      id: 'reflectors',
      kicker: 'Interactive · designs',
      title: 'Reflecting telescopes: Newton, Cassegrain and Schmidt',
      widget: { type: 'designs' },
      scene: [goto('hubble'), rate(1)],
      body: [
        p('Newton presented his reflector to the Royal Society in 1672: a 33 mm spherical mirror of speculum metal, with a small flat secondary mirror set at 45° to fold the converging beam out of the side of the tube to an eyepiece. The <em>Newtonian</em> is still the commonest amateur design — simple, cheap, and with the observer conveniently at the top. The widget traces the rays; switch between the designs and watch where the light goes.'),
        p('A paraboloidal primary brings <em>on-axis</em> parallel light to a perfect focus (that is the defining property of the parabola), but off-axis stars grow comet-shaped tails — <em>coma</em> — that limit the useful field. The other designs are mostly ways to deal with that, and with the awkward position of the focus.'),
        terms(
          ['Prime focus', 'The detector sits directly at the focus of the primary, inside the tube. Fastest f-ratio, widest field, but anything there blocks light. The 5 m Hale had a cage for the observer; today a camera (or the Subaru Hyper Suprime-Cam, 870 megapixels) rides there.'],
          ['Newtonian', 'A flat diagonal sends the focus out of the side. Compact to build, awkward to balance on large instruments.'],
          ['Cassegrain', 'A convex hyperboloidal secondary reflects the beam back through a hole in the primary. The folded path gives a long effective focal length in a short tube; heavy instruments hang at the bottom where the mount can carry them. Most large telescopes work this way. The <em>Ritchey–Chrétien</em> variant makes both mirrors hyperboloidal and removes coma — Hubble, Keck, VLT, Gemini, and most of the giants are RCs.'],
          ['Gregorian', 'A concave ellipsoidal secondary placed <em>beyond</em> the prime focus; longer, but gives an upright image and an accessible intermediate focus. Used by the Giant Magellan Telescope and by solar telescopes, which can put a heat stop at that intermediate focus.'],
          ['Coudé / Nasmyth', 'Further flats send the beam along the polar axis (coudé) or out through the altitude bearing (Nasmyth) to instruments that never move: a spectrograph the size of a room.'],
          ['Schmidt camera', 'A <em>spherical</em> mirror, which has no preferred axis and so no coma, with a thin aspheric corrector plate at its centre of curvature to remove the spherical aberration. Result: a very fast, very wide field (6° for the 1.2 m Palomar Schmidt) on a curved focal surface. Built for surveys; the Palomar Sky Survey plates and the Kepler spacecraft used Schmidt optics.'],
        ),
        p('Hubble, in the scene, is a 2.4 m f/24 Ritchey–Chrétien. Its primary was ground to the wrong shape — too flat at the edge by 2.2 µm, a textbook <em>spherical aberration</em> — because a null corrector in the test rig had been assembled 1.3 mm out of place. The 1993 servicing mission installed corrective optics (COSTAR) and a new camera with the opposite error built in. Diffraction limits and seeing are physics; this was a measurement mistake, and it was fixable.'),
        note('Mirrors used to be metal and tarnished within months; since Foucault (1857) they have been glass with a thin reflecting coat — silver, then aluminium (Hale, 1930s), today protected silver or gold for the infrared. The glass only has to hold a shape. Modern primaries are thin "meniscus" blanks held in shape by computer-controlled actuators (<em>active optics</em>, correcting slow flexure and temperature; not to be confused with the fast adaptive optics of 6.1), or honeycomb castings, or — Keck, GTC, JWST, ELT — mosaics of hexagonal segments kept aligned to nanometres.', 'From speculum to segments'),
      ],
    },
    {
      id: 'plate-scale',
      kicker: 'Interactive · numbers',
      title: 'Focal length, plate scale, field and magnification',
      widget: { type: 'platescale' },
      scene: [goto('moon'), rate(1)],
      body: [
        p('How big is the picture? In the focal plane an angle θ on the sky becomes a length y = f θ, so the <em>plate scale</em> — arcseconds per millimetre of detector, the number every observer knows for their instrument — is'),
        eq('\\frac{d\\theta}{dy} = \\frac{206\\,265}{f}\\ \\frac{\\text{arcsec}}{\\text{mm}} \\quad (f \\text{ in mm})', 'Plate scale. A 500 mm camera lens: 413″/mm. The 10 m Keck at f/15 (f = 150 m): 1.38″/mm, so a 15 µm pixel covers 0.02″ — well matched to adaptive-optics images.'),
        p('The <em>field of view</em> then follows from the detector size: a 36 mm sensor behind a 2 m focal length sees 1°. Long focal lengths magnify but see little — the whole of Hubble\'s famous Deep Field is 1/12 the width of the Moon. Survey telescopes go the other way: Rubin Observatory\'s 8.4 m mirror has a focal length of only 10.3 m (f/1.23) and a 64 cm, 3.2-gigapixel focal plane covering 9.6 square degrees — 40 full Moons at once.'),
        p('For a visual telescope the eyepiece is a magnifying glass on the focal-plane image, and the angular magnification is simply the ratio of focal lengths:'),
        eq('M = \\frac{f_{\\text{objective}}}{f_{\\text{eyepiece}}}', 'A 1200 mm telescope with a 10 mm eyepiece: 120×. Beyond about 2× per millimetre of aperture the magnified image shows only the Airy disc and the seeing; "600× power!" on a 60 mm department-store refractor is a lie.'),
        p('In the widget pick a target — the Moon, Jupiter, the Orion Nebula, the Andromeda Galaxy — and slide the focal length and the detector or eyepiece: the circle shows what fits in the frame, the readout gives the plate scale, the field and the magnification. Try to put all of Andromeda (3° long) in one frame, then try to resolve the Cassini division in Saturn\'s rings (0.7″).'),
        example('The Moon (31′ = 1860″) on a 24 mm × 36 mm sensor. With a 200 mm lens the plate scale is 1031″/mm, the Moon is 1.8 mm across — a dot. With 2000 mm it is 18 mm and fills half the short side. With 4000 mm (plate scale 52″/mm) the field is 19′ × 28′ and the Moon no longer fits. Doubling f quadruples the pixels on the Moon and divides the light per pixel by four: the exposure must be four times longer. There is no free lunch in the focal plane.', 'Framing the Moon'),
      ],
    },
    {
      id: 'aperture',
      kicker: 'Interactive · the race',
      title: 'Aperture: from Galileo to the Extremely Large Telescope',
      widget: { type: 'scopes' },
      scene: [goto('l-m16', 'landmark'), rate(1)],
      body: [
        p('Because light grasp goes as D² and resolution as 1/D, the history of the telescope is essentially the history of its diameter. The widget puts any two instruments side by side, to scale, with the three consequences: how many photons, how faint, how sharp. Compare Galileo\'s 37 mm with the eye, Herschel\'s 1.2 m "40-foot" with Galileo, Hubble with Keck, and Keck with the ELT.'),
        timeline([
          { when: '1609', title: 'Galileo, 37 mm refractor', text: 'Moons of Jupiter, phases of Venus, mountains on the Moon, stars in the Milky Way.' },
          { when: '1789', title: 'Herschel, 1.2 m speculum reflector', text: 'Largest for half a century; discovered two moons of Saturn on its first night.' },
          { when: '1845', title: 'Lord Rosse, 1.8 m "Leviathan"', text: 'First to see spiral structure, in M51.' },
          { when: '1917', title: 'Hooker 2.5 m, Mount Wilson', text: 'Hubble measured the distance to Andromeda and the expansion of the universe with it.' },
          { when: '1948', title: 'Hale 5 m, Palomar', text: 'Pyrex honeycomb mirror; the largest for 45 years; quasars, the cosmic distance scale.' },
          { when: '1990', title: 'Hubble Space Telescope, 2.4 m', text: 'Small, but above the atmosphere: diffraction-limited images, ultraviolet access, dark sky.' },
          { when: '1993', title: 'Keck I, 10 m segmented', text: '36 hexagonal segments, actively aligned; the template for every giant since.' },
          { when: '1998–2005', title: 'VLT (4 × 8.2 m), Gemini, Subaru, GTC 10.4 m', text: 'Thin meniscus and segmented mirrors; adaptive optics becomes routine.' },
          { when: '2022', title: 'JWST, 6.5 m, infrared, at L2', text: '18 gold-coated beryllium segments unfolded in space; 40 K passive cooling.' },
          { when: '2025–2030s', title: 'Rubin 8.4 m survey; GMT 25 m; ELT 39 m', text: 'The ELT\'s 798 segments give 13× the light of a Keck and 0.01″ resolution with AO.' },
        ]),
        eq('m_{\\lim} \\approx 7.5 + 5\\log_{10}\\!\\left(\\frac{D}{\\text{cm}}\\right)', 'Rough visual limiting magnitude of a telescope (eye: 6.7 for 0.7 cm; 20 cm: 14; 5 m: 21). Long CCD exposures go 8–10 magnitudes deeper: Hubble\'s deepest fields reach m ≈ 31, JWST beyond 32.'),
        p('The Pillars of Creation in the scene are the test case everyone knows: Hubble\'s 1995 visible-light image showed dust silhouettes; JWST\'s 2022 infrared image, with a mirror of 2.7 times the diameter and 7 times the area, sees <em>through</em> the dust to the protostars inside. Aperture, wavelength and location, all three at once.'),
        think('Herschel\'s 1.2 m mirror was bigger than any telescope built for the next 56 years, yet he did most of his great work — Uranus, the structure of the Milky Way, infrared light — with a 47 cm. Speculum metal reflected only 60% and tarnished; the big tube was so hard to point that Herschel rarely used it. A larger aperture is only better if the rest of the system — mount, optics quality, detector, site — can keep up. Which link in <em>today\'s</em> chain do you think limits the giant telescopes most?'),
      ],
    },
    {
      id: 'mounts',
      kicker: 'Interactive · engineering',
      title: 'Mounts: keeping a star still',
      widget: { type: 'mount' },
      scene: [goto('earth'), grid(true), rate(1)],
      body: [
        p('The sky turns at 15 arcseconds per second of time. A star drifts across the 0.02″ pixels of a modern camera in a millisecond; to expose for an hour the telescope must follow it to a fraction of an arcsecond over tonnes of moving steel. How it follows depends on the geometry of the mount.'),
        compare(
          { title: 'Equatorial mount', items: ['One axis (the <em>polar axis</em>) is aligned parallel to the Earth\'s rotation axis — tilted at the observer\'s latitude.', 'Tracking is a single, constant rotation about that axis: one motor, one speed.', 'The field of view does not rotate; long photographic exposures were possible with no further correction.', 'Mechanically awkward for large telescopes: the tilted axis must carry the whole weight off-centre. The 5 m Hale\'s horseshoe yoke was the practical limit.'] },
          { title: 'Alt-azimuth mount', items: ['Axes are vertical (azimuth) and horizontal (altitude), like a gun turret or a camera tripod.', 'Tracking needs both axes to move at continuously varying rates — trivial since computers, impossible before.', 'The field of view <em>rotates</em> as the star crosses the sky, at a rate that becomes infinite as the star passes overhead; a third motor turns the instrument to compensate.', 'The weight always bears straight down: symmetric, stiff, compact. Every large telescope since the Soviet 6 m BTA (1975) is alt-az.'] },
        ),
        p('The widget tracks a star with each mount. Set your latitude and the star\'s declination, start the clock and watch: on the equatorial the frame stays fixed; on the alt-az a reference pattern turns in the eyepiece, slowly near the horizon and quickly near the zenith — there is a small "blind spot" overhead where no alt-az telescope can follow. The Earth below, with its equatorial grid drawn, is the reason the two mounts differ: one copies its axis, the other ignores it.'),
        eq('\\frac{d\\chi}{dt} = \\omega_\\oplus \\cos\\varphi\\,\\frac{\\cos A}{\\cos a}', 'Field-rotation rate on an alt-az mount for an observer at latitude φ watching a star at azimuth A and altitude a; ω⊕ = 15″/s. It diverges as a → 90°.'),
        note('Keeping a star still well enough for a one-hour exposure also requires that the telescope\'s own structure not sag as it tilts (hence active optics), that the dome not shed warm air into the beam (hence vented enclosures and chilled mirrors), and that the mount\'s encoders know where it points to a fraction of an arcsecond (hence pointing models with dozens of terms). A modern 8 m points blind to 1″ and tracks to 0.05″. The guiding is done by a small camera watching a reference star in the field and nudging the telescope — or, more cheaply, nudging the detector.', 'Precision'),
      ],
    },
    {
      id: 'optical-summary',
      kicker: 'Summary',
      title: 'Optical telescopes in brief',
      scene: [backdrop()],
      body: [
        summary(
          'Refractors suffer chromatic aberration; achromatic doublets reduce it; lenses stop at 1 m (Yerkes).',
          'Reflectors: parabolic primary; prime, Newtonian, Cassegrain (Ritchey–Chrétien), Gregorian, Nasmyth/coudé foci; Schmidt cameras for wide fields.',
          'Plate scale 206 265/f ″/mm; field = detector size / f; magnification M = f_obj / f_eye; f-ratio sets image brightness.',
          'Aperture history: 37 mm → 1.2 m → 5 m → 10 m segmented → 39 m. Light ∝ D², limiting magnitude +5 per decade in D.',
          'Equatorial mounts track with one axis and no field rotation; alt-az mounts are stiff and compact but need computed tracking and a rotator.',
        ),
        key('A modern large optical telescope is a thin or segmented mirror held in shape by actuators, on an alt-az mount steered by computer, delivering light through a Cassegrain or Nasmyth focus to a cooled camera or spectrograph, with adaptive optics sharpening the image. Every element on that list was impossible in 1950.'),
      ],
    },
  ],
};

const S6_3: Section = {
  id: 'radio-telescopes',
  number: '6.3',
  title: 'Radio Telescopes',
  summary: 'An accidental discovery at Bell Labs opened the second window on the universe; dishes, beams and the jansky; and interferometry, the trick that turns a continent — or a planet — into one aperture.',
  minutes: 24,
  steps: [
    {
      id: 'jansky',
      kicker: 'Interactive · history',
      title: 'Jansky\'s hiss: a signal that keeps sidereal time',
      widget: { type: 'jansky' },
      scene: [goto('b0', 'blackhole'), rate(1)],
      body: [
        p('In 1931 Karl Jansky, a 26-year-old engineer at Bell Telephone Laboratories, was asked to find the sources of static that troubled transatlantic radio-telephone calls at 20.5 MHz (λ = 14.6 m). He built a 30 m rotating antenna array on a turntable of Ford Model-T wheels — "Jansky\'s merry-go-round" — and logged the noise for a year. Thunderstorms, near and far, accounted for most of it. A third component was a faint, steady hiss whose direction swept around the sky once a day.'),
        p('A daily cycle suggested the Sun. But the peak came about four minutes earlier each day, and after a year it had gained a whole day: the period was 23 h 56 min — the <em>sidereal</em> day of Chapter 1, the rotation of the Earth relative to the stars, not the Sun. The source was fixed among the stars, toward Sagittarius — the centre of the Milky Way, where the black hole in the scene sits. Jansky published "Electrical disturbances apparently of extraterrestrial origin" in 1933. The <em>New York Times</em> put it on the front page; the astronomers ignored it; Bell Labs moved him to other work.'),
        p('The widget is Jansky\'s chart recorder. Watch the signal peak drift across the daily record and use the slider to read off how many days it takes to gain an hour; the readout compares the period with the solar and sidereal days. It is a beautiful example of a measurement that identifies a source without seeing it at all.'),
        timeline([
          { when: '1932–33', title: 'Jansky', text: 'Galactic radio noise at 20 MHz; period 23 h 56 m.' },
          { when: '1937', title: 'Grote Reber', text: 'Builds a 9 m parabolic dish in his back garden in Illinois; maps the Milky Way at 160 MHz. For a decade he is the world\'s only radio astronomer.' },
          { when: '1942', title: 'J. S. Hey', text: 'Radar jamming turns out to be the Sun; later detects radio meteors and Cygnus A.' },
          { when: '1951', title: 'Ewen & Purcell', text: 'Detect the 21 cm line of hydrogen predicted by van de Hulst; the spiral arms of the Milky Way are mapped in gas.' },
          { when: '1957', title: 'Jodrell Bank 76 m', text: 'First giant steerable dish; tracks Sputnik\'s rocket.' },
          { when: '1963', title: 'Schmidt; Arecibo 305 m', text: '3C 273 identified as a quasar at z = 0.16; the Arecibo fixed spherical dish opens.' },
          { when: '1965', title: 'Penzias & Wilson', text: 'A 3 K excess in a Bell Labs horn antenna: the cosmic microwave background.' },
          { when: '1967', title: 'Jocelyn Bell', text: 'Pulsars, with a 4-acre dipole array at Cambridge.' },
          { when: '1980', title: 'VLA', text: '27 dishes of 25 m on rails in New Mexico; aperture synthesis becomes routine imaging.' },
          { when: '2013', title: 'ALMA', text: '66 antennas at 5000 m in Chile, 0.3–3 mm; protoplanetary discs resolved.' },
          { when: '2019 / 2022', title: 'Event Horizon Telescope', text: 'Earth-sized interferometer at 1.3 mm images the shadows of M87* and Sgr A*.' },
        ]),
        key('Radio astronomy is the first time astronomy was done with something other than visible light, and it was done by engineers. Every later window — infrared, X-ray, gamma, gravitational waves — followed the same pattern: new technology, an unexpected signal, and a sky nobody had predicted.'),
      ],
    },
    {
      id: 'dish',
      kicker: 'Interactive · instrument',
      title: 'The dish, the beam and the jansky',
      widget: { type: 'dish' },
      scene: [goto('l-casa', 'landmark'), rate(1)],
      body: [
        p('A radio telescope is an optical reflector built for long wavelengths. A paraboloidal dish reflects incoming plane waves to a focus where a <em>feed horn</em> and a cryogenically cooled amplifier replace the eyepiece; a sub-reflector often folds the light back Cassegrain-style to receivers in a cabin behind the dish. Because λ is 10⁴–10⁶ times longer than visible light, the surface need only be accurate to about λ/20 — a few millimetres for a 21 cm dish, which is why dishes can be wire mesh and can be built 100 m across (Effelsberg, Green Bank). At millimetre wavelengths (ALMA) the surface must again be good to 20 µm.'),
        p('The long wavelength has one severe price: diffraction. The antenna\'s sensitivity on the sky — its <em>beam pattern</em> — is the Airy pattern of 6.1 with λ a million times larger. The <em>half-power beam width</em> ≈ 1.2 λ/D is the resolution:'),
        eq('\\theta_{\\text{HPBW}} \\approx 1.2\\,\\frac{\\lambda}{D} \\approx 4100\\,\\frac{\\lambda}{D}\\ \\text{arcmin}', 'For the 100 m Green Bank Telescope at 21 cm: 8.6′. For Arecibo at 21 cm: 3.4′. The eye does 1′. A single dish is a very blurry instrument, and much of its energy also leaks into <em>side lobes</em> that pick up the ground and the Sun.'),
        p('What the receiver measures is power per unit collecting area per unit bandwidth: the <em>spectral flux density</em> S_ν, in W m⁻² Hz⁻¹. Cosmic sources are so weak that a special unit was adopted in Jansky\'s honour:'),
        eq('1\\ \\text{Jy} = 10^{-26}\\ \\text{W m}^{-2}\\,\\text{Hz}^{-1}, \\qquad P = S_\\nu\\, A_{\\text{eff}}\\, \\Delta\\nu', 'The jansky. Cassiopeia A in the scene, the brightest source in the sky after the Sun, is about 2400 Jy at 1 GHz; a typical quasar is 1 Jy; modern surveys reach microjanskys. A mobile phone on the Moon would be one of the brighter radio sources in the sky.'),
        example('How much power does a 1 Jy source deliver to the 100 m Effelsberg dish (A ≈ 7850 m², efficiency ~0.6) in a 10 MHz band? P = 10⁻²⁶ × 0.6 × 7850 × 10⁷ ≈ 5 × 10⁻¹⁶ W. The total energy collected by every radio telescope in history is less than that of a falling snowflake. Detection is possible only because the receiver is cooled to 15 K and the signal is integrated for minutes to hours; the figure of merit is the <em>system temperature</em> T_sys, the temperature of a resistor that would produce the same noise.', 'One jansky in watts'),
        p('In the widget set the dish diameter and the wavelength: the wavefronts converge on the feed, the beam pattern narrows or broadens, and the readout gives the beam width, the collecting area and the power from a source of chosen flux density. Try 21 cm with a 25 m VLA-type dish, then 1.3 mm with a 12 m ALMA antenna.'),
      ],
    },
    {
      id: 'interferometry',
      kicker: 'Interactive · the trick',
      title: 'Interferometry: an aperture the size of the Earth',
      widget: { type: 'interferometer' },
      scene: [goto('b0', 'blackhole'), rate(1)],
      body: [
        p('A single dish cannot be made large enough: a 1″ beam at 21 cm would need a dish 50 km wide. The solution, worked out by Martin Ryle and colleagues at Cambridge in the 1950s (Nobel Prize 1974), is to not build the middle. Two antennas separated by a <em>baseline</em> B, with their signals combined, respond to the sky like Young\'s two slits in reverse: the output oscillates — produces <em>fringes</em> — as a source moves through the pattern, with an angular fringe spacing of λ/B. The pair resolves structure on the scale'),
        eq('\\theta \\approx \\frac{\\lambda}{B}', 'Resolution of an interferometer. Two 25 m dishes 35 km apart (the VLA in its widest configuration) at 21 cm: 1.2″ — the same as a 35 km dish, with a millionth of the collecting area. The sensitivity is that of the dishes; the resolution is that of the baseline.'),
        p('One baseline measures one <em>spatial frequency</em> of the sky brightness — one Fourier component. Many baselines, of different lengths and orientations, measure many components; and the Earth\'s rotation slowly swings every baseline around as seen from the source, sweeping out arcs in the "uv plane". Record for twelve hours, Fourier-transform the lot, and you have an image as though from a filled dish the size of the array: <em>aperture synthesis</em>. This is how the VLA, ALMA, MeerKAT and LOFAR make pictures.'),
        p('The widget starts with two dishes. Change the baseline and the wavelength and watch the fringe pattern on the sky tighten; move the source and watch the fringes shift; make the source larger than a fringe and the fringes wash out — that is how Michelson measured the diameter of Betelgeuse in 1920 with two mirrors on a beam across the 2.5 m Hooker telescope. Then press play to let the Earth rotate and watch the uv coverage fill in.'),
        p('With atomic clocks the signals need not even be combined in real time. In <em>very long baseline interferometry</em> (VLBI) each station records the raw voltages with a hydrogen-maser timestamp; the tapes — now disks — are correlated later. Baselines become intercontinental, and the resolution reaches milli- and micro-arcseconds. The Event Horizon Telescope joined eight millimetre-wave observatories from Hawaii to the South Pole into an Earth-sized aperture at 1.3 mm: θ ≈ λ/B = 1.3×10⁻³/1.3×10⁷ ≈ 10⁻¹⁰ rad = 20 micro-arcseconds, enough to resolve the 50 µas shadow of the black hole at the centre of the scene.'),
        key('Resolution comes from the <em>longest</em> separation between collecting elements, not from their size. That principle — the same wave physics as diffraction, run backwards — is why radio astronomy, which started with the worst resolution of any branch of astronomy, now has the best. Optical interferometers (VLTI, CHARA) do the same with baselines of a few hundred metres, limited by the difficulty of keeping optical paths equal to a fraction of a micron.'),
      ],
    },
    {
      id: 'radio-summary',
      kicker: 'Summary',
      title: 'Radio astronomy in brief',
      scene: [backdrop()],
      body: [
        table(
          ['Facility', 'Type', 'λ / ν', 'Resolution', 'Known for'],
          [
            ['Green Bank (GBT)', '100 m single dish', '3 mm – 3 m', '~9′ at 21 cm', 'Pulsars, molecules, HI'],
            ['FAST (China)', '500 m fixed dish', '10 cm – 4 m', '~3′', 'Pulsars, fast radio bursts'],
            ['VLA', '27 × 25 m, 36 km', '0.7 – 400 cm', '0.04″ – 1′', 'Imaging of jets, SNRs, HI in galaxies'],
            ['ALMA', '66 × 12/7 m, 16 km', '0.3 – 3.6 mm', '0.01″', 'Protoplanetary discs, molecular gas'],
            ['LOFAR', '~50 000 dipoles, 2000 km', '1.3 – 30 m', '~1″', 'Low-frequency sky, pulsars'],
            ['EHT', '8+ sites, Earth-size', '1.3 mm', '20 µas', 'Black-hole shadows'],
            ['SKA (building)', '~200 dishes + 130 000 dipoles', '2 cm – 6 m', '< 0.1″', 'Cosmic dawn, HI surveys'],
          ],
          'A selection of radio observatories. Resolution follows λ/B; sensitivity follows collecting area and system temperature.',
        ),
        summary(
          'Jansky (1932): Galactic radio noise with a 23 h 56 m period — the sidereal clue to an extraterrestrial source.',
          'Dishes focus like mirrors; the surface need only be good to λ/20; beam width ≈ 1.2 λ/D is poor for a single dish.',
          'Spectral flux density S_ν in janskys: 1 Jy = 10⁻²⁶ W m⁻² Hz⁻¹; P = S_ν A Δν. Receivers are cooled; T_sys is the figure of merit.',
          'Interferometry: θ ≈ λ/B; aperture synthesis uses many baselines and the Earth\'s rotation to make images; VLBI reaches micro-arcseconds.',
        ),
      ],
    },
  ],
};

const S6_4: Section = {
  id: 'beyond-visible',
  number: '6.4',
  title: 'Infrared, Ultraviolet, X-ray and Gamma-Ray Astronomy',
  summary: 'The atmosphere lets through only two windows; opening the rest meant mountains, balloons, aircraft and finally orbit — and a different kind of telescope for every band.',
  minutes: 30,
  steps: [
    {
      id: 'atmosphere',
      kicker: 'Interactive · the problem',
      title: 'Windows in the atmosphere',
      widget: { type: 'atmwindow' },
      scene: [goto('earth'), rate(1)],
      body: [
        p('The air is transparent to the light our eyes evolved in and to radio waves between about 1 cm and 10 m. For everything else it is a wall. Ozone, 20–30 km up, absorbs the ultraviolet below 300 nm; molecular oxygen and nitrogen take everything shortward of 100 nm, X-rays and gamma rays included. Water vapour and carbon dioxide blanket most of the infrared from 1 µm to 1 mm, leaving a few narrow windows — the J, H, K, L, M, N and Q bands of infrared astronomers — that depend on how dry the air above you is. Below 10–15 MHz (λ > 20–30 m) the ionosphere reflects radio waves back into space.'),
        p('The widget plots the transmission from the top of the atmosphere to an altitude you choose. Climb from sea level to Mauna Kea (4200 m, above 40% of the air and 90% of the water vapour), to an aircraft at 13 km (SOFIA flew a 2.7 m telescope through a hole in a Boeing 747), to a balloon at 40 km (above 99.7% of the atmosphere; good enough for hard X-rays and the far infrared), and finally to orbit. Watch the windows open one by one. Note which bands open last: only space works for the far ultraviolet, soft X-rays and gamma rays — and for the long-wavelength radio sky that the ionosphere hides.'),
        table(
          ['Band', 'Wavelength / energy', 'Blocked by', 'Where to observe'],
          [
            ['Radio', '1 cm – 10 m', 'Ionosphere below 10 MHz; water vapour above 20 GHz', 'Ground (dry high sites for mm)'],
            ['Far infrared / sub-mm', '30 µm – 1 mm', 'Water vapour', 'Aircraft, balloon, space (Herschel, Spitzer)'],
            ['Near / mid infrared', '1 – 30 µm', 'H₂O, CO₂ (windows at 1.25, 1.65, 2.2, 3.5, 10, 20 µm)', 'High mountains; space for the gaps (JWST)'],
            ['Visible', '300 – 1100 nm', 'Clouds, seeing, light pollution', 'Ground; space for sharpness'],
            ['Ultraviolet', '10 – 300 nm', 'Ozone (< 300 nm), O₂, N₂ (< 200 nm)', 'Space only (Hubble, GALEX, FUSE)'],
            ['X-ray', '0.1 – 100 keV', 'Whole atmosphere (a few g cm⁻² is opaque)', 'Space (Chandra, XMM, NuSTAR); balloons above 20 keV'],
            ['Gamma', '> 100 keV', 'Atmosphere; but air showers are visible from the ground above ~50 GeV', 'Space (Fermi, INTEGRAL); ground Cherenkov arrays (H.E.S.S., CTA)'],
          ],
        ),
        key('Where you observe from is as much a part of the telescope as its mirror. The Earth in the scene, seen from outside, has a transparent skin a few tens of kilometres thick; most of the electromagnetic spectrum never reaches the ground, and most of the history of astronomy was done through two narrow windows in it.'),
      ],
    },
    {
      id: 'infrared',
      kicker: 'Interactive · heat',
      title: 'Infrared: a telescope that glows',
      widget: { type: 'irthermal' },
      scene: [goto('jwst'), rate(1)],
      body: [
        p('William Herschel discovered infrared light in 1800 with a thermometer placed beyond the red end of a solar spectrum. The band is where cool things shine: Wien\'s law puts the peak of a 300 K body at 10 µm, of a 30 K dust cloud at 100 µm, of a protostar still wrapped in its envelope at a few microns. It is also where dust stops hiding things — the grains that blacken the Milky Way in visible light are smaller than infrared wavelengths and let it pass — and where the light of the first galaxies, redshifted by a factor of ten or more, has ended up.'),
        p('The difficulty is built into the first sentence: everything at 300 K glows at 10 µm, including the telescope, the dome, the air and the detector. Observing a faint infrared source from the ground is like observing a faint star in daylight with a luminous telescope. The widget shows the Planck curve of the telescope beside that of a target; slide the telescope temperature down and watch its own emission drop out of the band of interest.'),
        eq('\\lambda_{\\max} T = 2.898 \\times 10^{-3}\\ \\text{m K}', 'Wien\'s law. 300 K → 9.7 µm; 77 K (liquid nitrogen) → 38 µm; 40 K (JWST passive) → 72 µm; 4 K (liquid helium) → 0.7 mm. To push the telescope\'s own glow out of the mid-infrared it must be cooled to tens of kelvin; the detectors must be colder still, 7 K for JWST\'s MIRI.'),
        list(
          '<b>Ground</b>: near-infrared through the atmospheric windows, with the telescope at ambient temperature and the sky background subtracted by rapidly "chopping" between source and blank sky. Adaptive optics works best here (r₀ grows as λ^(6/5)).',
          '<b>Cooled space telescopes</b>: IRAS (1983) surveyed the whole sky at 12–100 µm in ten months with 73 kg of superfluid helium; Spitzer (2003) and Herschel (2009, 3.5 m, the largest mirror in space until JWST) did the same, each until its coolant ran out.',
          '<b>JWST</b> (2022), in the scene: a 6.5 m gold-coated segmented mirror kept at 40 K not by cryogen but by a five-layer sunshield the size of a tennis court, parked at the Sun–Earth L₂ point 1.5 million km away so that Sun, Earth and Moon are always on the same side. It covers 0.6–28 µm and sees galaxies at z > 13.',
        ),
        p('Detectors differ too. Visible CCDs are silicon, which goes transparent beyond 1.1 µm. The infrared uses mercury-cadmium-telluride (to 5 µm) and arsenic-doped silicon (to 28 µm) arrays, and in the far infrared and sub-millimetre, <em>bolometers</em> — tiny absorbers whose temperature rise is read out by superconducting thermometers at 0.1 K.'),
        note('Herschel\'s original thermometer was a detector with a time constant of minutes and a sensitivity of a few millikelvin. JWST\'s MIRI detects a change of a few electrons per hour per pixel, corresponding to a temperature contrast between pixels of micro-kelvin. The physics of the measurement — a warm thing radiates — has not changed since 1800; the engineering has gained about fifteen orders of magnitude.', 'From thermometer to MIRI'),
      ],
    },
    {
      id: 'ultraviolet',
      kicker: 'Concept · hot',
      title: 'Ultraviolet: the hot universe, from orbit only',
      scene: [goto('l-30dor', 'landmark'), rate(1)],
      body: [
        p('Shortward of 300 nm nothing reaches the ground; shortward of 91.2 nm — the Lyman limit, the energy that ionises hydrogen (Chapter 5) — the interstellar gas itself becomes opaque and even space telescopes see only a few hundred light-years. Between those limits lies the band where the hottest stars put out most of their light: O and B stars of 20 000–50 000 K, white dwarfs, accretion discs around compact objects, the coronae of stars like the Sun. The Tarantula Nebula in the scene, lit by the most massive stars known, is at its most luminous here.'),
        p('The ultraviolet is also the spectroscopist\'s band. The resonance lines of the common ions — C IV, Si IV, N V, O VI, Mg II, the Lyman series of hydrogen — are all between 100 and 300 nm. They trace the hot gas in stellar winds, the warm gas in the halo of the Milky Way seen in absorption against quasars, and the chemistry of the intergalactic medium along every sightline through the universe.'),
        timeline([
          { when: '1946', title: 'V-2 rockets', text: 'First ultraviolet spectrum of the Sun, from a captured German rocket over New Mexico. A few minutes above the ozone per flight.' },
          { when: '1972–81', title: 'Copernicus (OAO-3)', text: 'UV spectroscopy of interstellar molecular hydrogen and deuterium.' },
          { when: '1978–96', title: 'IUE', text: 'The International Ultraviolet Explorer: 18 years in geosynchronous orbit, 104 000 spectra, the most productive astronomical satellite of its era.' },
          { when: '1990–', title: 'Hubble', text: 'Imaging and spectroscopy from 115 nm; the COS and STIS spectrographs are its most oversubscribed instruments.' },
          { when: '1999–2007', title: 'FUSE', text: 'Far ultraviolet, 90–120 nm; O VI in the Galactic halo, deuterium abundances.' },
          { when: '2003–13', title: 'GALEX', text: 'All-sky survey at 150 and 230 nm: star formation histories of a billion galaxies.' },
        ]),
        p('Ultraviolet optics are conventional — mirrors work, down to about 100 nm with special coatings (aluminium with a thin layer of magnesium fluoride or lithium fluoride; bare aluminium oxidises within minutes and goes blind in the far UV). Lenses do not: glass is opaque below 350 nm, and only exotic crystals (CaF₂, LiF) transmit further. Detectors are photocathodes and microchannel plates counting individual photons, or CCDs thinned and coated to respond at short wavelengths. The problem with the ultraviolet was never the instrument; it was the 20 km of ozone between the instrument and the sky.'),
        key('Each band selects a temperature. Radio: cold gas and relativistic electrons. Infrared: dust, protostars, 10–1000 K. Visible: stellar photospheres, 3000–10 000 K. Ultraviolet: the hottest stars and accretion, 10⁴–10⁵ K. X-rays: gas at millions of kelvin. The full spectrum is a thermometer running from 3 K to 10⁹ K, and no single telescope reads more than two or three decades of it.'),
      ],
    },
    {
      id: 'xray',
      kicker: 'Interactive · grazing',
      title: 'X-rays: mirrors that light skims like a stone',
      widget: { type: 'grazing' },
      scene: [goto('l-m1', 'landmark'), rate(1)],
      body: [
        p('X-ray photons of 0.1–10 keV are absorbed within a few microns of any solid, and pass through a mirror hit face-on as if it were not there. Ordinary focusing is impossible. The first X-ray astronomy, from rockets (Giacconi, 1962: Scorpius X-1, and a bright X-ray background nobody expected) and from the Uhuru satellite (1970), used no optics at all: collimators that restricted the field of view to a degree or so, and proportional counters behind them.'),
        p('There is one way to make X-rays reflect. At very shallow <em>grazing incidence</em> — less than a degree from the surface — the index of refraction of a metal for X-rays is slightly <em>less</em> than one, and total external reflection occurs, as it does for light leaving glass. The critical angle depends on the density of the coating and falls with photon energy:'),
        eq('\\theta_c \\approx 3.6^\\circ\\,\\sqrt{\\frac{\\rho}{19\\ \\text{g cm}^{-3}}}\\;\\frac{1\\ \\text{keV}}{E}', 'Critical grazing angle for a gold or iridium coating. About 3.6° at 1 keV, 0.5° at 7 keV. Harder X-rays need shallower angles — or multilayer coatings that reflect by Bragg interference, which is how NuSTAR reaches 79 keV.'),
        p('Hans Wolter showed in 1952 how to make an image with two such reflections: a paraboloid followed by a hyperboloid, both shaped like the inside of a slightly tapered tube, so that light grazing the first is brought to a focus by the second. Because each shell collects only a thin annulus, many shells are nested one inside another like Russian dolls. The widget fires photons at a nested Wolter mirror; change the energy and the angle and watch the reflectivity collapse past the critical angle. The readout gives the fraction of photons that make it to the focus.'),
        list(
          '<b>Chandra</b> (1999): four nested iridium-coated shells, the largest 1.2 m, polished to 0.3 nm roughness — the smoothest mirrors ever made — giving 0.5″ images, as sharp as a ground-based optical telescope. Collecting area only 0.08 m².',
          '<b>XMM-Newton</b> (1999): three modules of 58 thin gold-coated nickel shells each; 15″ images but 0.43 m² — five times Chandra\'s area, for spectroscopy.',
          '<b>NuSTAR</b> (2012): 133 shells of multilayer-coated glass per module, on a 10 m mast, focusing 3–79 keV for the first time.',
          '<b>eROSITA</b> (2019): seven mirror modules; mapped the whole sky in X-rays eight times deeper than ROSAT.',
        ),
        p('The Crab Nebula in the scene is the X-ray astronomer\'s standard candle: so steady that fluxes are quoted in "milliCrab". Its X-rays are synchrotron radiation from electrons accelerated by the pulsar at its centre — the same mechanism as the radio emission of Section 6.3, from the same object, five decades of wavelength apart.'),
        note('Behind the mirror sit CCDs much like optical ones but operated so that each X-ray photon releases hundreds of electrons: the charge measures the photon\'s <em>energy</em>. An X-ray CCD is thus imager and spectrometer at once — every photon comes with its colour. The next step, flown on XRISM (2023), is the microcalorimeter: a pixel cooled to 50 mK whose temperature jumps when a single photon lands, giving the energy to 1 part in a thousand.', 'Detectors that count photons'),
      ],
    },
    {
      id: 'gamma',
      kicker: 'Interactive · particles',
      title: 'Gamma rays: when the telescope is a particle detector',
      widget: { type: 'gammadetect' },
      scene: [goto('b0', 'blackhole'), rate(1)],
      body: [
        p('Above about 100 keV even grazing incidence fails; a gamma-ray photon does not reflect, it collides. The "telescope" becomes a particle physics experiment that records what the photon does to matter — the interactions of Chapter 5 — and reconstructs its direction from the debris. Which interaction depends on the energy, so there are four quite different instruments. The widget animates each; set the energy and see which technique the photon selects.'),
        terms(
          ['Coded mask (0.02–10 MeV)', 'A pinhole camera for the hard X-ray / soft gamma sky: a patterned mask of tungsten tiles casts a shadow on a position-sensitive detector; the shadow pattern is decoded to find the sources. INTEGRAL, Swift-BAT (which locates gamma-ray bursts within seconds, and triggered the 2017 kilonova follow-up).'],
          ['Compton telescope (0.3–30 MeV)', 'The photon Compton-scatters in a first detector layer, depositing some energy, and is absorbed in a second. The scattering angle follows from the energies (Compton\'s formula), constraining the source to a circle on the sky; many photons, many circles, one intersection. COMPTEL on CGRO; the planned COSI mission.'],
          ['Pair-conversion (20 MeV–300 GeV)', 'Above 1.022 MeV the photon can turn into an electron–positron pair in a thin tungsten foil; the pair\'s tracks through layers of silicon strips point back to the source, and a calorimeter below measures their total energy. Fermi-LAT (2008–) scans the whole sky every three hours and has catalogued 6000 sources: pulsars, blazars, supernova remnants, and the "Fermi bubbles" blown out of the Galactic Centre in the scene.'],
          ['Atmospheric Cherenkov (50 GeV–100 TeV)', 'At the highest energies photons are too rare for a satellite — one per square metre per year — but each one striking the upper atmosphere makes a shower of billions of particles, which emit a 5-nanosecond flash of blue Cherenkov light over a 250 m-wide pool on the ground. Arrays of 10–28 m mirrors with fast cameras (H.E.S.S., MAGIC, VERITAS, and the coming Cherenkov Telescope Array) image the flash and reconstruct the primary\'s direction to 0.1°. The atmosphere, the enemy of every other band, has become the detector.'],
        ),
        p('Gamma-ray astronomy began as a by-product of the Cold War: the Vela satellites, launched in 1967 to detect clandestine nuclear tests, instead recorded brief flashes of gamma rays from random directions in the sky — <em>gamma-ray bursts</em>, declassified in 1973 and traced thirty years later to the collapse of massive stars and the merger of neutron stars in galaxies billions of light-years away. For a few seconds a burst outshines the rest of the gamma-ray universe combined.'),
        key('Angular resolution degrades steadily up the spectrum — 0.5″ for Chandra, arcminutes for INTEGRAL, 0.1–1° for Fermi — because the instruments no longer focus; they reconstruct. In exchange they see the most violent processes in the universe directly: particle acceleration, antimatter, nuclear lines from freshly made radioactive elements. The thermometer of the previous step runs off its scale here; gamma rays are not about temperature at all.'),
      ],
    },
    {
      id: 'multiwavelength',
      kicker: 'Interactive · synthesis',
      title: 'One galaxy, seven skies',
      widget: { type: 'multiview' },
      scene: [backdrop()],
      body: [
        p('Put the bands together and the same object becomes several. The widget shows a schematic spiral galaxy as each kind of telescope sees it. In radio continuum, a smooth disc of synchrotron emission from cosmic-ray electrons spiralling in the galaxy\'s magnetic field, with jets if the central black hole is active; at 21 cm, the cold atomic hydrogen extending far beyond the stars. In the far infrared, the dust lanes that were dark in visible light are the brightest feature, re-radiating the light of hidden young stars. In the near infrared, the old stars that hold most of the mass, with the dust transparent. In the visible, the familiar picture. In the ultraviolet, only the knots of hot young stars in the arms. In X-rays, a halo of million-degree gas and a sprinkle of accreting binaries. In gamma rays, almost nothing — a few pulsars and the diffuse glow of cosmic rays hitting gas.'),
        p('No single picture is "what the galaxy looks like". Each is a map of one physical process — one temperature, one population, one mechanism — and the astrophysics of Chapters 24–26 is read off by comparing them pixel by pixel.'),
        table(
          ['Observatory', 'Band', 'Aperture / technique', 'Launched', 'Resolution'],
          [
            ['Hubble', 'UV – near IR, 115 nm – 2.5 µm', '2.4 m Ritchey–Chrétien', '1990', '0.05″'],
            ['Chandra', 'X-ray, 0.1 – 10 keV', '4 nested Wolter-I shells, 1.2 m', '1999', '0.5″'],
            ['XMM-Newton', 'X-ray, 0.1 – 12 keV', '3 × 58 nested shells', '1999', '6″ (15″ HEW)'],
            ['Spitzer', 'IR, 3.6 – 160 µm', '0.85 m, He-cooled to 5.5 K', '2003 (–2020)', '2″'],
            ['Fermi', 'Gamma, 20 MeV – 300 GeV', 'Pair-conversion tracker', '2008', '0.1 – 1°'],
            ['Herschel', 'Far IR, 55 – 672 µm', '3.5 m, He-cooled', '2009 (–2013)', '6″'],
            ['Planck', 'Microwave, 0.3 – 10 mm', '1.5 m off-axis Gregorian', '2009 (–2013)', '5′'],
            ['Gaia', 'Visible, astrometry', '2 × 1.45 × 0.5 m', '2013 (–2025)', '20 µas positions'],
            ['JWST', 'IR, 0.6 – 28 µm', '6.5 m segmented, 40 K', '2021', '0.07″'],
            ['Euclid', 'Visible + near IR survey', '1.2 m Korsch', '2023', '0.2″'],
          ],
          'The current fleet of space observatories. Note how aperture, cooling and technique change across the spectrum.',
        ),
        summary(
          'Two atmospheric windows (visible, radio); the rest needs altitude or orbit.',
          'Infrared: cool objects and dust; the telescope glows and must be cooled (JWST: 40 K passive, L₂, sunshield).',
          'Ultraviolet: hot stars and resonance lines; conventional mirrors, special coatings, space only.',
          'X-ray: grazing-incidence Wolter mirrors (θ_c ∝ 1/E), nested shells; photon-counting CCDs give energy for free.',
          'Gamma: no focusing — coded masks, Compton telescopes, pair trackers, and Cherenkov arrays that use the atmosphere.',
        ),
      ],
    },
  ],
};

const S6_5: Section = {
  id: 'surveys',
  number: '6.5',
  title: 'All-Sky Surveys and Virtual Observatories',
  summary: 'From glass plates to petabytes: how the whole sky came to be mapped at every wavelength, and how the archives became a telescope in their own right.',
  minutes: 20,
  steps: [
    {
      id: 'all-sky',
      kicker: 'Interactive · the whole sky',
      title: 'Mapping everything',
      widget: { type: 'skymap' },
      scene: [backdrop()],
      body: [
        p('Targeted observations answer questions you already have. Surveys find the questions. The first was photographic: the Palomar Observatory Sky Survey (1949–58) covered the northern sky on 1872 pairs of 14-inch glass plates with the 1.2 m Schmidt, reaching 21st magnitude; astronomers worked from its prints for forty years, and quasars, dwarf galaxies and the first brown-dwarf candidates were found by people staring at them. Its digitised successor and the southern surveys from Siding Spring and ESO became the first all-sky image database.'),
        p('Since then the whole sky has been surveyed in almost every band, and the widget lets you page through them in galactic coordinates — the Mollweide oval with the plane of the Milky Way across the middle and its centre at the origin. Each map is a different universe: synchrotron and HI in the radio, dust in the far infrared, stars in the near infrared, hot gas in X-rays, cosmic-ray collisions in gamma rays. Move the cursor across to compare the same direction in each.'),
        table(
          ['Survey', 'Band', 'Years', 'Yield'],
          [
            ['POSS I / II, ESO-SRC', 'Photographic, blue & red', '1949–2000', 'Whole sky to m ≈ 21–22 on plates'],
            ['Haslam 408 MHz; HI4PI', 'Radio continuum; 21 cm', '1982; 2016', 'Synchrotron sky; Galactic hydrogen in 3-D'],
            ['IRAS; AKARI', 'Infrared 12–100 µm', '1983; 2006', '350 000 sources; the dust "cirrus"'],
            ['ROSAT; eROSITA', 'Soft X-ray', '1990–91; 2019–22', '150 000 → ~1 million X-ray sources'],
            ['2MASS', 'Near IR, J H K', '1997–2001', '470 million point sources; 1.6 million galaxies'],
            ['SDSS', 'Optical ugriz + spectra', '2000–', '1/3 of the sky; > 4 million spectra; the cosmic web'],
            ['WMAP; Planck', 'Microwave', '2001–10; 2009–13', 'The cosmic microwave background to 5′'],
            ['WISE', 'Mid IR 3.4–22 µm', '2010–', '750 million sources; brown dwarfs, luminous dusty galaxies'],
            ['Fermi-LAT', 'Gamma, 20 MeV – 300 GeV', '2008–', 'Whole sky every 3 h; 6000+ sources'],
            ['Gaia', 'Astrometry, photometry, spectra', '2014–25', 'Positions, motions and distances of ~2 billion stars'],
            ['Pan-STARRS; ZTF', 'Optical, time-domain', '2010–; 2018–', 'The variable sky nightly; asteroids, supernovae'],
            ['Rubin / LSST', 'Optical ugrizy, time-domain', '2025–35', '20 TB per night; 37 billion objects; 10 million alerts a night'],
            ['SKA', 'Radio', '2029–', 'HI to z ~ 2; 600 PB per year'],
          ],
          'All-sky and large-area surveys, band by band.',
        ),
        key('Surveys change the <em>kind</em> of astronomy that is done. Once every object in the sky has a measured brightness, colour, position and motion, questions are answered by querying rather than observing: how many white dwarfs are there within 100 pc? Which stars share Gaia\'s velocities with the Hyades? What fraction of galaxies at z = 0.5 are red? The telescope has become a database, and the database a telescope.'),
      ],
    },
    {
      id: 'data',
      kicker: 'Interactive · scale',
      title: 'The data deluge',
      widget: { type: 'datagrowth' },
      scene: [goto('earth'), rate(1)],
      body: [
        p('A photographic plate holds the equivalent of a gigabyte and took a night to expose and a day to develop. A modern survey camera reads out a few gigabytes every fifteen seconds. The widget plots the data volume of major surveys against time, on a logarithmic axis: the slope is roughly a factor of ten per decade, matching the growth of detector pixels and of the computers needed to digest them. Slide the year marker; the readout tells you how long it would take to move each archive over a connection of your choosing.'),
        list(
          '<b>SDSS</b> (2000–): 40 TB of images and spectra after a decade; its public data releases are the most cited data set in astronomy.',
          '<b>Pan-STARRS</b> (2010–): 2 PB; 1.6 billion objects; the first catalogue that would not fit on any single institute\'s disk.',
          '<b>Gaia</b> (2014–25): 1 PB of raw telemetry processed by a consortium of 450 people into a catalogue of 1.8 billion stars with positions to 20 micro-arcseconds.',
          '<b>Rubin Observatory</b> (2025–): 20 TB per night, 500 PB over the ten-year survey; each image compared with a template within 60 seconds to issue up to 10 million alerts a night for anything that moved or changed.',
          '<b>SKA</b> (2029–): raw data rates of petabits per second at the antennas, reduced on site to ~600 PB per year of archive — more than the global internet carried in 2000.',
        ),
        p('The consequence is that the data cannot be looked at. Every object in Rubin\'s sky will be measured a thousand times, and no human will see most of the images. Classification, outlier detection, the triage of alerts, and the photometric redshifts of billions of galaxies are done by software — increasingly by machine-learning models trained on the surveys themselves. The astronomer\'s craft is shifting from observing to <em>asking the right question of the archive</em>, and to writing code that can be trusted on data it has never seen.'),
        think('A survey measures everything in its footprint to its limiting magnitude, with no selection by a human. That removes one kind of bias (you no longer study only the objects that interested you) and introduces others (flux limits, resolution limits, crowding, the seasons and latitude of the site). Malmquist bias — the preferential inclusion of luminous objects at large distances in any flux-limited sample — was named in 1922 and is as dangerous in a petabyte catalogue as in a plate. Before trusting any statistic from a survey, ask: what could this survey <em>not</em> have seen?', 'Selection effects'),
      ],
    },
    {
      id: 'virtual-observatory',
      kicker: 'Interactive · the archive as telescope',
      title: 'The Virtual Observatory',
      widget: { type: 'crossmatch' },
      scene: [goto('l-47tuc', 'landmark'), rate(1)],
      body: [
        p('Every survey is a different format, a different coordinate convention, a different photometric system, on a different server. By 2000 it was clear that the science lay in combining them — an infrared colour with an X-ray flux with a Gaia distance — and that this would not happen unless the archives agreed on how to talk. The International Virtual Observatory Alliance (2002) defined the standards: FITS and VOTable for data, Simple Cone Search and TAP/ADQL for queries, SAMP for passing results between tools, and registries that let a program discover every catalogue covering a given point of sky.'),
        p('The practical result is that a student at a laptop can, in an afternoon, retrieve every observation ever archived of a given object across the spectrum (SIMBAD, VizieR, NED, MAST, ESASky), plot them together (Aladin, TOPCAT), and cross-match million-row catalogues on the CDS servers in seconds. The "Virtual Observatory" is not a place; it is the set of protocols that makes the world\'s archives behave like one instrument — and a good fraction of today\'s papers are written without anyone applying for telescope time.'),
        p('The elementary operation is the <em>cross-match</em>, and it is less trivial than it sounds. The widget shows two catalogues of the same field — say Chandra X-ray sources (yellow, with their larger position errors) and Gaia stars (blue) in the globular cluster of the scene, 47 Tucanae. Drag the match radius: too small and real counterparts are missed; too large and every X-ray source finds a chance star. The readout counts true matches, false matches and the completeness, and the right radius depends on the positional errors <em>and</em> on the source density, which in a cluster core is ferocious. A careful astronomer quotes the probability of a chance match, not just the match.'),
        eq('P_{\\text{chance}} \\approx 1 - e^{-\\pi r^2 \\Sigma} \\approx \\pi r^2 \\Sigma', 'Probability that an unrelated source of surface density Σ lies within radius r of a given position. With Σ = 10 stars per square arcminute and r = 1″, P ≈ 0.9%; in a cluster core with Σ = 1000, P ≈ 60% — a match is nearly meaningless without more information (colour, variability, proper motion).'),
        key('Data from telescopes are now a permanent public resource; by policy nearly all space-mission and most ground-based data become public within a year. The Virtual Observatory makes that resource usable, and in doing so has made the archive the most productive telescope on Earth: more Hubble papers are now written from archival data than from new observations.'),
      ],
    },
    {
      id: 'telescopes-close',
      kicker: 'Chapter close',
      title: 'Telescopes in one page',
      scene: [backdrop()],
      body: [
        summary(
          'Aperture gathers light ∝ D² and sets the diffraction limit θ = 1.22 λ/D; focal length sets the image scale 206 265/f ″/mm; magnification is an afterthought.',
          'Refraction (Snell) and reflection build lenses and mirrors; chromatic aberration doomed the big refractor; Cassegrain-type reflectors on alt-az mounts with active and adaptive optics are the modern form.',
          'The atmosphere blurs (seeing, ~1″) and blocks (two windows). Adaptive optics, mountain sites and space are the answers.',
          'Radio: dishes with poor single-dish resolution; interferometry θ ≈ λ/B and aperture synthesis; flux density in janskys.',
          'Infrared telescopes must be cold; ultraviolet needs orbit; X-rays need grazing incidence; gamma rays need particle detectors or the atmosphere itself.',
          'Surveys at every wavelength and the Virtual Observatory have turned the archive into an instrument; the limiting factor is increasingly software, not glass.',
        ),
        key('For the rest of this course, when a measurement is quoted — a parallax, a spectrum, a light curve, a radio map — ask which telescope made it and what that telescope could and could not do. The resolution, the depth, the wavelength and the selection of every data set are set in this chapter, and so are the error bars.'),
        { kind: 'callout', tone: 'history', title: 'Suggested reading', html: 'Harland & Miller (eds.), <em>Telescopes and Techniques</em>; Ian S. McLean, <em>Electronic Imaging in Astronomy</em> (2nd ed., 2008) for detectors; Kitchin, <em>Astrophysical Techniques</em> (7th ed., 2020) for everything; Burke, Graham-Smith & Wilkinson, <em>An Introduction to Radio Astronomy</em> (4th ed., 2019); Hardy, <em>Adaptive Optics for Astronomical Telescopes</em>. For history: Henry C. King, <em>The History of the Telescope</em> (1955, Dover); Ronald Florence, <em>The Perfect Machine</em> (1994) on the building of the 200-inch; Woodruff Sullivan, <em>Cosmic Noise</em> (2009) on the birth of radio astronomy; Robert Zimmerman, <em>The Universe in a Mirror</em> (2008) on Hubble. The ESO, NASA and NRAO web sites document every current facility.' },
        { kind: 'callout', tone: 'think', title: 'Problems to try', html: '(1) Compare the light-gathering power of the 39 m ELT with that of the dark-adapted eye, and with Hubble. Express the gain over the eye in magnitudes. (2) Find the diffraction-limited resolution of the ELT at 550 nm and at 2.2 µm, and compare with the 0.6″ seeing at Cerro Armazones. How large must r₀ be for the ELT to be seeing-limited at 2.2 µm? (3) A 28 cm f/10 Schmidt–Cassegrain has a focal length of 2800 mm. Find the plate scale, the field of view on a 4.8 mm × 3.6 mm planetary camera sensor, and the magnification with a 9 mm eyepiece. Is the latter useful? (4) The Arecibo dish was 305 m across but only ~220 m was illuminated at any time. Find the beam width at 21 cm and at 12.6 cm (the planetary radar). (5) A quasar has a flux density of 2 Jy at 1.4 GHz. Compute the power collected by a VLA dish (D = 25 m, efficiency 0.5) in a 50 MHz band, and the energy collected in a 12-hour track. (6) The EHT baseline from Hawaii to Spain is 10 700 km. Find its resolution at 1.3 mm and at 0.87 mm, and compare with the 42 µas shadow of M87*. (7) Chandra\'s iridium mirrors work to 10 keV. Using the critical-angle formula, estimate the grazing angle needed, and hence the maximum radius of a shell whose focal length is 10 m. (8) A one-degree Cherenkov air shower is seen by a telescope 120 m from the shower axis; estimate the time delay of the Cherenkov front across a 12 m mirror and comment on the camera speed required. (9) Rubin issues 10 million alerts a night. If a human spends 10 seconds on each, how many astronomers are needed working full-time? What does this imply about how alerts are handled?' },
      ],
    },
  ],
};

/* ================================================================================ */
/*  CHAPTER 7 — BINARY SYSTEMS AND STELLAR PARAMETERS                                */
/* ================================================================================ */

const S7_1: Section = {
  id: 'binary-classification',
  number: '7.1',
  title: 'The Classification of Binary Stars',
  summary: 'Why the mass of a star can only be weighed with a second star; and the six kinds of double star — optical, visual, astrometric, eclipsing, spectrum and spectroscopic — sorted by what the telescope can actually see.',
  minutes: 26,
  steps: [
    {
      id: 'why-binaries',
      kicker: 'Interactive · the problem',
      title: 'Mass is the master parameter — and the hardest to measure',
      widget: { type: 'twobody' },
      scene: [goto('Rigil Kentaurus', 'star'), rate(1)],
      body: [
        p('Chapters 3 and 5 gave us a surprising amount about a star from its light alone: distance from parallax, luminosity from distance and flux, temperature from colour and lines, radius from luminosity and temperature, composition from the strengths of the lines. One quantity resists all of it. Nothing in a star\'s spectrum says plainly how much matter it contains — and <b>mass</b>, as later chapters will show, is the single number that decides a star\'s structure, its luminosity, its lifetime and its death.'),
        p('There is only one direct way to weigh anything in astronomy: watch it pull on something else. Newton\'s form of Kepler\'s third law (Section 2.3) turns an orbit — a period and a size — into the sum of the two masses. A lone star offers no orbit. A star with a companion offers one, and the two stars pull on each other in proportion to their masses, so the companion is a scale. That is why this chapter, which is really about <em>stellar parameters</em>, is written around double stars.'),
        p('Happily the universe is generous. Roughly half of all Sun-like stars live in binary or multiple systems; among the massive O and B stars the fraction is higher still, and the Sun\'s nearest neighbour in the scene behind the panel — α Centauri — is a triple. The widget shows the essential geometry: two stars orbiting their common <em>centre of mass</em>. Change the mass ratio and watch the heavier star move on the smaller orbit; the two orbits are always similar ellipses, sharing a focus at the centre of mass, traversed in step.'),
        eq('m_1 r_1 = m_2 r_2 \\qquad\\Longrightarrow\\qquad \\frac{m_1}{m_2} = \\frac{r_2}{r_1} = \\frac{a_2}{a_1}', 'The centre-of-mass condition. The star that moves less is the heavier one, in exact inverse proportion: a ratio of orbit sizes <em>is</em> a ratio of masses, no units required.'),
        key('Everything we know about stellar masses — the mass–luminosity relation, the masses of white dwarfs and neutron stars, the proof that black holes exist — traces back to binary stars. There is no spectroscopic mass. There is only gravity.'),
      ],
    },
    {
      id: 'optical-doubles',
      kicker: 'Interactive · telling them apart',
      title: 'Optical doubles and the proper-motion test',
      widget: { type: 'doubletest' },
      scene: [goto('Mizar', 'star'), rate(1)],
      body: [
        p('Two stars close together on the sky are not necessarily close together in space. The sky is a projection; a bright nearby star and a faint distant one can fall within a few arcseconds of each other by chance. Such a pair is an <b>optical double</b>: it tells us nothing about masses, because the two stars do not orbit each other at all. The task of Section 7.1 is to sort the pairs that are merely aligned from the pairs that are gravitationally bound — and then to sort the bound ones by how their binarity reveals itself.'),
        p('The oldest test is motion. Every star drifts across the sky with its own <em>proper motion</em> (Chapter 1). Two unrelated stars drift in different directions at different rates, and over a few decades the pair simply comes apart along two straight lines. Two bound stars share the proper motion of their centre of mass, and on top of it they circle each other: their separation and position angle change, but in a curve that closes on itself. In the widget, play forty years of observations for a chance alignment and for a bound pair and watch how differently the two histories look — the first a pair of straight lines, the second a shared drift with an orbit drawn on it.'),
        p('Mizar and Alcor, the "horse and rider" in the handle of the Big Dipper behind the panel, show how subtle this can be. For centuries they were the textbook optical double: 12 arcminutes apart, far too wide to orbit in any human lifetime. Modern parallaxes and proper motions put them at nearly the same distance (about 83 light-years) and moving together through the Ursa Major stream; they are probably bound after all, a quarter of a light-year apart. Mizar itself, meanwhile, is a genuine visual binary — the first double star ever seen in a telescope, by Benedetto Castelli in 1617 — and each of its two components is in turn a spectroscopic binary. One naked-eye "star": six suns.'),
        terms(
          ['Optical double', 'Two stars that appear close on the sky but lie at different distances and are not bound. No orbital motion; the proper motions are unrelated.'],
          ['Common proper motion pair', 'Two stars sharing the same proper motion and parallax — almost certainly bound, even if the orbit is far too slow to see.'],
          ['Physical binary', 'Two stars orbiting a common centre of mass. Everything that follows in this chapter concerns these.'],
          ['Hierarchical multiple', 'Three or more stars arranged as nested binaries (a close pair orbited by a distant third, as in α Centauri); stable only when the orbits are well separated in size.'],
        ),
        history('William Herschel began cataloguing double stars in 1779 for a different purpose: he hoped to measure parallax by watching a near star shift relative to a far one. By 1803, after a quarter-century of measurements, he found instead that several pairs — Castor, γ Virginis, 70 Ophiuchi — had swung around each other. It was the first proof that Newton\'s gravity operates beyond the solar system, and it turned the double-star catalogue from a parallax tool into the foundation of stellar astrophysics.', 'Herschel\'s accidental discovery'),
      ],
    },
    {
      id: 'visual-binaries',
      kicker: 'Interactive · class 1',
      title: 'Visual binaries: the orbit drawn on the sky',
      widget: { type: 'visualorbit', mode: 'observe' },
      scene: [goto('Alula Australis', 'star'), rate(1)],
      body: [
        p('When both stars are bright enough and far enough apart to be separated in the telescope, the pair is a <b>visual binary</b>. The observer measures, night after night and year after year, two numbers: the angular <em>separation</em> ρ of the fainter star from the brighter, and the <em>position angle</em> θ of the line joining them, counted from north through east. Plotted on the sky, the points trace an ellipse — the <em>apparent orbit</em> of the secondary about the primary. The widget is such a measurement series: press play and watch the data accumulate; change the eccentricity, the inclination and the orientation and watch how the apparent ellipse changes shape — and how the primary slides away from its focus.'),
        p('That last point matters. The true relative orbit is an ellipse with the primary at one focus (Kepler\'s first law). Its projection onto the sky is still an ellipse, but projection does not preserve foci: the primary sits at the focus only if the orbit is seen face-on. The displacement of the primary from the apparent focus is exactly what encodes the inclination, and Section 7.2 shows how to use it. For now, notice that the <em>shape</em> of the apparent orbit says nothing by itself: a circular orbit seen at 60° looks like an e = 0.5 ellipse.'),
        p('Visual binaries are, by selection, wide and slow: a separation of 1 arcsecond at 10 parsecs is 10 AU, and such an orbit around two solar masses takes about 22 years. The shortest-period visual orbits (a few years) belong to the nearest stars; many catalogued pairs have periods of centuries and have not yet completed a single revolution since Herschel. The star behind the panel, ξ Ursae Majoris, was the first binary whose orbit was computed — by Félix Savary in 1827, period 59.8 years — and it has since gone around more than three times.'),
        eq('\\rho(t),\\ \\theta(t) \\;\\longrightarrow\\; P,\\ a,\\ e,\\ i,\\ \\Omega,\\ \\omega,\\ T', 'Seven orbital elements from the apparent orbit: period, angular semi-major axis, eccentricity, inclination, position angle of the ascending node, argument of periastron and time of periastron passage. Only P and a enter the mass; i enters through the projection.'),
        note('Speckle interferometry and adaptive optics (Section 6.1) have pushed the resolvable separation from about 1 arcsecond to 0.03″; long-baseline optical interferometers (CHARA, VLTI) reach a milliarcsecond and now resolve the orbits of spectroscopic binaries that were, by definition, unresolvable a generation ago. The classes in this section are defined by the instrument as much as by the star.', 'The boundary moves'),
      ],
    },
    {
      id: 'astrometric-binaries',
      kicker: 'Interactive · class 2',
      title: 'Astrometric binaries: the wobble of a lone star',
      widget: { type: 'astrometric' },
      scene: [goto('Sirius', 'star'), rate(1)],
      body: [
        p('Suppose the companion is too faint to see — a white dwarf next to a brilliant main-sequence star, or a brown dwarf, or a planet. The visible star still orbits the centre of mass, and the centre of mass still moves in a straight line across the sky. So the visible star\'s path is a straight line with a periodic wobble sewn onto it. A binary detected only through this wobble is an <b>astrometric binary</b>. In the widget, the proper-motion path of a single star is shown against the background; dial in an unseen companion and watch the path begin to oscillate — then increase its mass, or shorten the period, and notice which makes the wobble larger and which makes it faster.'),
        p('The classic case is behind the panel. In 1844 Friedrich Bessel, who had measured the first stellar parallax six years earlier, announced that Sirius and Procyon both followed wavy paths with periods of about fifty and forty years, and concluded that each was accompanied by an invisible body of roughly solar mass: "the existence of numberless visible stars can prove nothing against the existence of numberless invisible ones." Sirius B was found in 1862 by Alvan Graham Clark while testing a new 18-inch objective, exactly where Bessel\'s orbit put it; Procyon B waited until 1896. Both turned out to be white dwarfs — the first known — ten thousand times fainter than their primaries.'),
        p('The amplitude of the wobble is the visible star\'s own semi-major axis, a₁ = a m₂/(m₁+m₂), projected onto the sky at the star\'s distance. For a companion of one solar mass around Sirius the wobble is a few arcseconds; for Jupiter around the Sun seen from 10 parsecs it is 0.5 milliarcseconds; for the Earth, half a <em>micro</em>arcsecond. Hence astrometric detection of planets had to wait for the Gaia mission (Section 3.1), whose fourth data release is expected to deliver thousands of astrometric planets around nearby stars — the <em>same</em> method, four orders of magnitude finer.'),
        eq('\\alpha_1 = \\frac{a_1}{d} = \\frac{m_2}{m_1 + m_2}\\,\\frac{a}{d}', 'Angular wobble of the visible star: the fraction of the relative orbit it occupies, divided by the distance. Measured α₁ with a known distance and primary mass gives the companion\'s mass — if the inclination is known.'),
        think('Bessel could see Sirius wobble but not its companion. From the wobble alone he could state the period and the size of Sirius\'s orbit about the centre of mass. Which single extra piece of information did he need to turn that into a mass for the companion, and why could he not get it from the astrometry itself? (Hint: look at the formula above and count the unknowns.)'),
      ],
    },
    {
      id: 'eclipsing-spectroscopic',
      kicker: 'Interactive · classes 3, 4 and 5',
      title: 'Eclipsing, spectrum and spectroscopic binaries',
      widget: { type: 'binaryclassify' },
      scene: [goto('Algol', 'star'), rate(1)],
      body: [
        p('The remaining classes are defined by binaries that cannot be resolved at all: the two stars are so close that even the largest telescope sees one point of light. Their double nature leaks out in other ways.'),
        list(
          '<b>Eclipsing binary.</b> If the orbit happens to lie nearly edge-on to us (inclination close to 90°), each star passes in front of the other once per revolution and the total light dips periodically. Algol — "the demon\'s head", behind the panel — fades by more than a magnitude for ten hours every 2.867 days; John Goodricke, aged 18, proposed the eclipse explanation in 1783. Eclipses give the inclination almost for free, and Section 7.3 shows how the shape of the <em>light curve</em> yields the stars\' radii and the ratio of their temperatures.',
          '<b>Spectrum binary.</b> A single unresolved image whose spectrum is plainly the superposition of two different spectral types — say, the broad hydrogen lines of an A star with the molecular bands of a K giant — even when no motion has been seen. The light itself is double.',
          '<b>Spectroscopic binary.</b> As the two stars circle, each one alternately approaches and recedes from us. Their spectral lines shift by the Doppler effect (Section 5.1), periodically splitting apart and merging back together. If both spectra are seen the system is <em>double-lined</em> (SB2); if the companion is too faint and only one set of lines swings back and forth, <em>single-lined</em> (SB1). Edward Pickering found the first — Mizar A, period 20.5 days — in 1889 from Harvard objective-prism plates, the same year Hermann Vogel saw Algol\'s lines shift in time with its eclipses, proving that eclipse and orbit were one.',
        ),
        p('The classes overlap, and the overlaps are where the physics is. A binary that is <em>both</em> eclipsing and double-lined spectroscopic yields everything: masses, radii, temperatures, luminosities, distance — without a parallax. Those systems, a few hundred of them measured to a few per cent, are the calibrators of all stellar astrophysics. The widget is a sorting game: for each system you are shown what the observations actually look like — an image, a light curve, a spectrum, a proper-motion track — and asked which class it belongs to. Several belong to more than one.'),
        table(
          ['Class', 'What is observed', 'Typical separation', 'What it yields'],
          [
            ['Optical double', 'Two stars; unrelated proper motions', '—', 'Nothing about masses'],
            ['Visual', 'Both resolved; orbit traced on sky', '1–1000 AU; P = years–centuries', 'm₁ + m₂ (with d); m₁/m₂ (with CM motion)'],
            ['Astrometric', 'One star on a wavy path', 'as visual', 'Companion mass (with i)'],
            ['Spectrum', 'Two spectral types in one spectrum', 'any unresolved', 'Existence; luminosity ratio'],
            ['Spectroscopic', 'Lines Doppler-shift with period P', '0.01–1 AU; P = hours–years', 'Mass function; m sin³ i'],
            ['Eclipsing', 'Periodic dips in brightness', 'close; i ≈ 90°', 'i, R₁/a, R₂/a, T₂/T₁'],
          ],
          'The classes are observational, not physical: the same pair of stars can be in several at once, and which one depends on distance, orientation and instrument.',
        ),
      ],
    },
    {
      id: 'classification-summary',
      kicker: 'Summary',
      title: 'The classification in brief',
      scene: [backdrop()],
      body: [
        summary(
          'Mass is the parameter that decides a star\'s life and cannot be read from its spectrum; it is weighed only through gravity, hence through binaries. About half of all stars have companions.',
          'Optical doubles are chance alignments: unrelated proper motions, no orbit. Bound pairs share a proper motion and curve around each other.',
          'Visual binaries are resolved; the apparent orbit (ρ, θ against time) gives P and the angular semi-major axis, but projection moves the primary off the focus.',
          'Astrometric binaries betray an unseen companion by the wobble of the visible star\'s path (Bessel, Sirius, 1844). Spectrum binaries show two spectral types in one light.',
          'Spectroscopic binaries show Doppler-shifting lines, double- or single-lined; eclipsing binaries show periodic dips and must be nearly edge-on.',
          'Eclipsing + double-lined spectroscopic = everything: masses, radii, temperatures, luminosities, distance.',
        ),
        key('Read the classes as a list of <em>which measurements are available</em>. The next two sections take the lists one at a time and show how far each gets toward the two numbers we want for every star: m₁ and m₂.'),
      ],
    },
  ],
};

const S7_2: Section = {
  id: 'visual-binary-masses',
  number: '7.2',
  title: 'Mass Determination Using Visual Binaries',
  summary: 'From a resolved orbit to two masses: the centre of mass gives the ratio, Kepler\'s third law with a parallax gives the sum, the apparent orbit must be un-projected first — and the result, collected over two centuries, is the mass–luminosity relation.',
  minutes: 27,
  steps: [
    {
      id: 'mass-ratio',
      kicker: 'Interactive · step 1',
      title: 'The mass ratio from the centre of mass',
      widget: { type: 'massratio' },
      scene: [goto('70 Oph', 'star'), rate(1)],
      body: [
        p('Start with what a visual binary gives most cheaply. If the <em>absolute</em> positions of both stars are measured against the distant background — not merely one relative to the other — each is seen to trace its own ellipse about a common point, and that point, the centre of mass, drifts across the sky in a straight line at the system\'s proper motion. Taking the centre of mass as origin, the two stars are always on opposite sides of it, at distances in a fixed ratio:'),
        eq('\\frac{m_1}{m_2} = \\frac{r_2}{r_1} = \\frac{a_2}{a_1} = \\frac{\\alpha_2}{\\alpha_1}', 'Because both stars are at the same distance d from us, the ratio of linear semi-major axes equals the ratio of angular ones, α = a/d. The mass ratio needs <em>no</em> parallax and no knowledge of the inclination: projection shrinks both orbits by the same factor.'),
        p('In the widget both stars are tracked against the background for several decades. Drag the mass ratio and watch the two ellipses change size in opposite directions while the straight dashed line — the centre of mass — stays put. Then tilt the system: the ellipses flatten, but the ratio of their sizes, read out below, does not change. That is the whole point: the ratio is a <em>relative</em> measurement, and relative measurements survive projection.'),
        p('The practical difficulty is finding the centre of mass at all. Its position is not marked; it must be inferred as the point whose motion is uniform while the stars curve about it. That requires absolute astrometry over a good fraction of a period, against reference stars that have proper motions of their own. Before photography it took decades of micrometer measurements; today Gaia provides the reference frame and the proper motions, and for the 70 Ophiuchi pair behind the panel — Herschel\'s binary, period 88 years — the ratio is 0.78: a 0.9 and a 0.7 solar-mass star.'),
        note('If only the relative orbit (secondary about primary) is measured, as is common, the ratio is simply not available from the visual data; it must come from spectroscopy (Section 7.3) or be guessed from the luminosities. The sum of the masses, however, needs only the relative orbit — which is why the next step is the important one.', 'Relative versus absolute orbits'),
      ],
    },
    {
      id: 'kepler-mass',
      kicker: 'Interactive · step 2',
      title: 'The total mass from Kepler\'s third law',
      widget: { type: 'binarymass' },
      scene: [goto('Sirius', 'star'), rate(1)],
      body: [
        p('Newton\'s generalisation of Kepler\'s third law (Section 2.3) relates the period of the relative orbit, its semi-major axis a = a₁ + a₂, and the <em>sum</em> of the masses:'),
        eq('P^2 = \\frac{4\\pi^2}{G\\,(m_1 + m_2)}\\,a^3 \\qquad\\Longrightarrow\\qquad m_1 + m_2 = \\frac{4\\pi^2}{G}\\,\\frac{a^3}{P^2}', 'In solar-system units — a in AU, P in years, masses in solar masses — the constants vanish: m₁ + m₂ = a³/P². The Earth\'s orbit (a = 1, P = 1) gives exactly 1 M☉.'),
        p('The period is read directly from the apparent orbit. The semi-major axis is where the parallax enters: a visual binary provides the angular semi-major axis α (in arcseconds), and the linear one follows from the distance, a = α d. With the distance written through the parallax p (Section 3.1), d = 1/p parsecs, and since 1 AU subtends exactly 1 arcsecond at 1 parsec,'),
        eq('a\\,[\\text{AU}] = \\frac{\\alpha\\,[\\text{arcsec}]}{p\\,[\\text{arcsec}]} \\qquad\\Longrightarrow\\qquad m_1 + m_2 = \\frac{\\alpha^3}{p^3 P^2}\\ \\text{M}_\\odot', 'The mass of a visual binary in one line. Note the cubes: a 10 % error in the parallax is a 30 % error in the mass. Until Hipparcos and Gaia, this term dominated every stellar mass.'),
        p('The widget is this formula with error bars. Enter α, p and P for a real system — Sirius, α Centauri, Procyon, 70 Ophiuchi are preset — and read off the sum of the masses; then nudge the parallax by its quoted uncertainty and watch the mass respond three times as hard. Combine the sum with the ratio of the previous step, m₁/m₂ = q, and the individual masses follow: m₂ = (m₁+m₂)/(1+q), m₁ = q m₂. For Sirius behind the panel: P = 50.1 yr, α = 7.50″, p = 0.379″ → a = 19.8 AU → m₁ + m₂ = 3.1 M☉; with the ratio 2.0 from the centre of mass, Sirius A ≈ 2.06 M☉ and the white dwarf Sirius B ≈ 1.02 M☉, packed into a sphere the size of the Earth.'),
        example('α Centauri AB: P = 79.9 yr, α = 17.57″, p = 0.747″. Then a = 17.57/0.747 = 23.5 AU and m₁ + m₂ = 23.5³/79.9² = 12 980/6384 = 2.03 M☉. The centre-of-mass ratio is 1.23, giving 1.12 and 0.91 M☉ for A and B — a star slightly heavier than the Sun and one slightly lighter, 4.3 light-years away. Proxima, the third member, orbits the pair every half-million years and contributes 0.12 M☉ that the AB orbit cannot feel.', 'The nearest system'),
      ],
    },
    {
      id: 'inclination',
      kicker: 'Interactive · step 3',
      title: 'Un-projecting the apparent orbit',
      widget: { type: 'visualorbit', mode: 'deproject' },
      scene: [goto('Porrima', 'star'), rate(1)],
      body: [
        p('One correction was skipped. The angular semi-major axis that enters the mass is that of the <em>true</em> relative orbit; what is measured is the <em>apparent</em> one, foreshortened by the inclination i between the orbital plane and the plane of the sky. For a circular orbit the correction is simple — the apparent orbit is an ellipse whose minor axis is a cos i and whose major axis is the true a, so the true size is the apparent major axis and the inclination follows from the axis ratio. For an eccentric orbit the apparent ellipse is a genuine ellipse too, but its major axis is generally neither the true major axis nor along it, and its foci are in the wrong place.'),
        p('That misplaced focus is the key. The primary must lie at a focus of the true orbit; in the apparent orbit it lies at the projection of that focus, which is in general <em>not</em> a focus of the apparent ellipse. Measure where the primary sits inside the apparent ellipse, relative to its centre and axes, and the inclination, the node and the orientation of periastron can all be recovered. In the simplest textbook case — line of nodes along the true major axis — the apparent semi-major axis ã is related to the true one by'),
        eq('\\tilde{\\alpha} = \\alpha\\cos i \\qquad\\text{(special case: nodes along the major axis)}', 'Here the apparent major axis itself is shortened by cos i. In general the relation is a rotation followed by a cos i compression along one direction; the Thiele–Innes method solves it with four linear constants fitted to the measured positions.'),
        p('The widget takes the deprojection view. The true orbit is drawn in grey; the apparent one, in colour, is what the telescope sees. Drag the inclination toward 90° and watch the apparent ellipse collapse to a line — an eclipsing configuration. Drag the node and the periastron angle and watch the primary wander away from the apparent focus. The readout gives the error you would make in the mass by ignoring the inclination: (ã/α)³ = cos³ i. At 60° that is a factor of 8.'),
        p('The pair behind the panel, γ Virginis (Porrima), is a near-perfect demonstration: two nearly identical F stars, period 169 years, eccentricity 0.88, seen at 148° inclination. At periastron in 2005 the pair closed to 0.4″, barely resolvable; at apastron they are 6″ apart. Observers of the 1830s watched the stars rush around each other and then slow down, exactly as Kepler\'s second law requires — a convincing early test of gravity outside the solar system.'),
        think('Suppose a visual binary\'s apparent orbit is a perfect circle with the primary exactly at the centre. What can you conclude about the true orbit\'s eccentricity and inclination? Now suppose it is a circle with the primary off-centre. What then?'),
      ],
    },
    {
      id: 'visual-results',
      kicker: 'Results',
      title: 'What two centuries of visual binaries gave',
      scene: [goto('Procyon', 'star'), rate(1)],
      body: [
        p('The method is slow — orbits take decades, and seven elements must be fitted to measurements scattered over them — but it is honest: the only physics involved is Newton\'s. From Savary\'s first orbit in 1827 to Gaia, visual binaries have yielded a few hundred reliable masses, concentrated among the nearest stars because only there are the orbits both wide enough to resolve and short enough to complete. The table collects a handful.'),
        table(
          ['System', 'P (yr)', 'α (″)', 'p (″)', 'a (AU)', 'm₁ + m₂ (M☉)', 'm₁, m₂ (M☉)', 'Types'],
          [
            ['α Centauri AB', '79.9', '17.57', '0.747', '23.5', '2.03', '1.12, 0.91', 'G2 V + K1 V'],
            ['Sirius AB', '50.1', '7.50', '0.379', '19.8', '3.1', '2.06, 1.02', 'A1 V + white dwarf'],
            ['Procyon AB', '40.8', '4.3', '0.285', '15.1', '2.1', '1.50, 0.60', 'F5 IV + white dwarf'],
            ['70 Ophiuchi', '88.4', '4.55', '0.196', '23.2', '1.6', '0.90, 0.70', 'K0 V + K4 V'],
            ['61 Cygni', '678', '24.3', '0.286', '85', '1.3', '0.70, 0.63', 'K5 V + K7 V'],
            ['Castor A–B', '467', '6.8', '0.064', '106', '5.5', '2.8, 2.7 (each a close pair)', 'A1 V + A2 V'],
          ],
          'Representative visual binaries. Parallaxes from Hipparcos/Gaia; the totals follow from α³/(p³P²) and the splits from centre-of-mass or spectroscopic ratios. Castor\'s "two" stars are themselves spectroscopic binaries, and a third pair (YY Gem) orbits far outside — six stars.',
        ),
        p('Three lessons stand out. First, the masses of ordinary stars span a narrow range — tenths of a solar mass to a few solar masses — while their luminosities span many orders of magnitude; the next step makes this quantitative. Second, the white dwarfs in Sirius and Procyon have about a solar mass in a body the size of the Earth: densities of a tonne per cubic centimetre, which no physics known in 1862 could explain and which quantum mechanics (Chapter 5) eventually did. Third, the precision of the whole enterprise rested on the parallax until the 1990s; Hipparcos reduced the typical parallax error from 10 % to 1 %, and Gaia to 0.01 % for these stars, so the limiting errors are now in the orbits themselves.'),
        history('Procyon B was predicted by Bessel in 1844 and sought for fifty years. The Lick 36-inch found it in 1896, 13th magnitude and 5 arcseconds from a star of magnitude 0.4 — ten thousand times fainter. Its mass, 0.6 M☉, came from the astrometric orbit decades before any spectrum could be taken; the spectrum, when it came, showed a white dwarf cooler and older than Sirius B. The star behind the panel is that 1896 discovery, still only resolved with great care.', 'A fifty-year search'),
      ],
    },
    {
      id: 'mass-luminosity',
      kicker: 'Interactive · the pay-off',
      title: 'The mass–luminosity relation',
      widget: { type: 'massluminosity' },
      scene: [goto('Capella', 'star'), rate(1)],
      body: [
        p('Put the masses from visual and spectroscopic binaries on one axis and the luminosities — from distance and flux — on the other, both logarithmic, and the main-sequence stars fall on a strikingly tight line. This is the <b>mass–luminosity relation</b>, first assembled by Hertzsprung and by Russell around 1913 and explained by Eddington in 1924 before the energy source of stars was even known: the luminosity of a star in radiative equilibrium is set by how fast heat leaks out of a gravitationally bound ball of gas, which depends on its mass far more steeply than on anything else.'),
        eq('\\frac{L}{L_\\odot} \\approx \\left(\\frac{M}{M_\\odot}\\right)^{3.5} \\qquad (0.4 \\lesssim M/M_\\odot \\lesssim 10)', 'The exponent is about 2.3 below 0.4 M☉, about 4 between 0.4 and 2 M☉, 3.5 for 2–20 M☉, and flattens toward 1 for the most massive stars where radiation pressure dominates. A star of 10 M☉ shines about 3000 times as brightly as the Sun; one of 0.1 M☉, about one thousandth.'),
        p('The widget plots the real calibrators — detached eclipsing binaries and visual pairs with masses and luminosities known to a few per cent — and lets you fit a power law through them. Slide the exponent and watch the residuals; switch the mass range and see the slope change. Then notice the stars that lie <em>off</em> the line: the white dwarfs of Sirius and Procyon far below it, the giants above. They are not on the main sequence, and the relation does not apply to them; indeed their departure from it is one of the first clues to stellar evolution.'),
        p('The relation has an immediate consequence for lifetimes. A star\'s fuel supply is proportional to its mass, and its burn rate to its luminosity, so its main-sequence lifetime goes as M/L ∝ M⁻²·⁵: a 10 M☉ star lives about 30 million years, the Sun 10 billion, a 0.1 M☉ red dwarf several trillion — longer than the present age of the universe, so no red dwarf has yet died. And it has a practical use in the other direction: for a single main-sequence star whose luminosity is known, the relation provides a mass to perhaps 10 % — the only "spectroscopic mass" there is, and it exists only because binaries calibrated it.'),
        key('Stellar masses span a factor of about a thousand (0.08 to 100 M☉); stellar luminosities span a factor of a hundred billion. The mass–luminosity relation is the bridge, and every mass on it was weighed by a companion star.'),
      ],
    },
    {
      id: 'visual-summary',
      kicker: 'Summary',
      title: 'Visual-binary masses in brief',
      scene: [backdrop()],
      body: [
        summary(
          'Centre of mass: m₁/m₂ = a₂/a₁ = α₂/α₁. Needs absolute astrometry of both stars; independent of distance and inclination.',
          'Kepler III: m₁ + m₂ = a³/P² (AU, yr, M☉), with a = α/p. A parallax error is tripled in the mass.',
          'Projection: the apparent orbit is foreshortened and its focus displaced; the inclination is recovered from where the primary sits, and the mass is wrong by cos³ i if it is ignored.',
          'Results: a few hundred masses, 0.1–10 M☉, nearest stars first; white dwarfs of ~1 M☉ and Earth size.',
          'Mass–luminosity relation L ∝ M^3.5 on the main sequence; lifetime ∝ M⁻²·⁵; the only route to the mass of a single star.',
        ),
        key('Visual binaries supply the sum of the masses; the ratio and the inclination come harder. The next section turns to the close binaries, where the Doppler effect gives velocities instead of angles — and eclipses give the inclination for nothing.'),
      ],
    },
  ],
};

const S7_3: Section = {
  id: 'eclipsing-spectroscopic',
  number: '7.3',
  title: 'Eclipsing and Spectroscopic Binaries',
  summary: 'Radial-velocity curves and what their shape and amplitude say; the sin i degeneracy and the mass function; and how an eclipsing light curve hands over the inclination, the radii and the temperature ratio — the complete solution for a star.',
  minutes: 34,
  steps: [
    {
      id: 'radial-velocity-curves',
      kicker: 'Interactive · velocities instead of angles',
      title: 'Radial-velocity curves',
      widget: { type: 'specbinary' },
      scene: [goto('Mizar', 'star'), rate(1)],
      body: [
        p('A spectroscopic binary gives no picture of the orbit, only the component of each star\'s velocity along the line of sight, read from the Doppler shift of its lines (Section 5.1): v_r = c Δλ/λ. Plotted against time these <em>radial-velocity curves</em> are the spectroscopist\'s version of the apparent orbit. For a circular orbit of inclination i they are two sinusoids in antiphase, crossing at the systemic velocity of the centre of mass, with amplitudes'),
        eq('K_1 = v_1 \\sin i = \\frac{2\\pi a_1 \\sin i}{P}, \\qquad K_2 = v_2 \\sin i = \\frac{2\\pi a_2 \\sin i}{P}', 'Semi-amplitudes of the two radial-velocity curves. The orbital speeds v₁, v₂ are projected by sin i — a face-on binary (i = 0) shows no Doppler shift at all — and the same sin i multiplies both, so their ratio is clean.'),
        eq('\\frac{m_1}{m_2} = \\frac{a_2}{a_1} = \\frac{v_2}{v_1} = \\frac{K_2}{K_1}', 'The mass ratio of a double-lined spectroscopic binary, with no distance and no inclination needed — the spectroscopic twin of the centre-of-mass argument.'),
        p('The widget, which you met in Chapter 5, is worth revisiting with this chapter\'s eyes. Set the mass ratio and watch the two curves: the lighter star swings farther and faster. Then lower the inclination and watch both amplitudes shrink together while their ratio holds. Finally watch the spectrum at the bottom: at the crossings the two sets of lines merge into one, and an observer with a single spectrum at that moment would see no binary at all. Spectroscopic binaries must be followed over a full period; the first, Mizar A behind the panel, was caught because its K line was double on some Harvard plates and single on others.'),
        p('Spectroscopy favours exactly the binaries that visual astrometry cannot touch: the close, fast ones. The orbital speed scales as v ∝ (M/a)^½, so a pair of solar-mass stars 0.1 AU apart circles at about 95 km/s and completes an orbit in 12 days, with Doppler shifts of a few ångströms — easy. The same pair 20 AU apart (a typical visual binary) moves at 7 km/s with a period of 63 years: its radial velocity barely changes within a career. The two methods meet only at a few AU, and the systems in the overlap are precious.'),
        terms(
          ['Systemic velocity γ', 'The radial velocity of the centre of mass; the line about which both curves oscillate. Gives the binary\'s space motion.'],
          ['SB1, SB2', 'Single-lined: only the brighter star\'s lines are measurable (companion more than ~5 times fainter). Double-lined: both.'],
          ['Semi-amplitude K', 'Half the peak-to-peak swing of a radial-velocity curve; written K₁ for the primary.'],
          ['Cross-correlation', 'How velocities are actually measured: the whole spectrum is slid against a template until the lines match, averaging thousands of lines at once; reaches metres per second.'],
        ),
      ],
    },
    {
      id: 'eccentric-orbits',
      kicker: 'Interactive · shape',
      title: 'What eccentricity does to the curve',
      widget: { type: 'rvshape' },
      scene: [goto('Spica', 'star'), rate(1)],
      body: [
        p('Real orbits are rarely circular, and an eccentric orbit makes the radial-velocity curve distinctly lopsided. Near periastron the star moves fastest (Kepler\'s second law), so the velocity swings through its extreme quickly; near apastron it lingers. The result is a curve with a sharp peak and a broad trough — or the reverse — whose exact shape depends on two elements: the eccentricity e and the <em>argument of periastron</em> ω, the angle in the orbital plane from the line of nodes to periastron, which decides whether the fast part of the orbit is coming toward us, going away, or crossing sideways.'),
        eq('v_r = \\gamma + K\\,\\big[\\cos(\\theta + \\omega) + e\\cos\\omega\\big], \\qquad K = \\frac{2\\pi a \\sin i}{P\\sqrt{1 - e^2}}', 'The radial velocity of one component in a Keplerian orbit; θ is the true anomaly (the angle from periastron), which advances non-uniformly in time. Note the factor (1 − e²)^−½ in K and the constant offset e cos ω that shifts the curve off γ.'),
        p('Drag e and ω in the widget. At e = 0 the curve is a pure sinusoid whatever ω is; as e grows the peak sharpens and moves. With ω = 90° the curve is symmetric but with a narrow maximum; with ω = 0 it is skewed, rising slowly and falling fast. The orbit on the left shows why: the observer\'s direction is fixed, and periastron rotates around it. Fitting the curve therefore yields P, K, e, ω and γ — five of the seven elements. The two missing ones are the inclination, buried in K, and the node, which radial velocities cannot sense at all.'),
        p('The shape matters practically. Fitting a sinusoid to an eccentric binary biases the amplitude and hence the mass; and a single star with a planet on an eccentric orbit (Section 7.4) looks, in a sparsely sampled curve, much like a star with two planets on circular ones. Spica behind the panel is a double-lined spectroscopic binary — two hot B stars, 4.01 days, e = 0.13, 10 and 7 solar masses — close enough that each is tidally distorted into an egg and the orbit precesses in 124 years, measurable in the changing ω.'),
        note('Mizar A\'s lines were double on some plates and single on others. If a fifty-day orbit is sampled once a week, how many weeks of data would you need to be reasonably sure of the period? Now imagine the orbit is eccentric with e = 0.7: where in the orbit would you most need extra observations, and why do many long-period spectroscopic orbits have poorly measured eccentricities?', 'Sampling'),
      ],
    },
    {
      id: 'mass-function',
      kicker: 'Interactive · the sin i problem',
      title: 'The sum of the masses and the mass function',
      widget: { type: 'massfunction' },
      scene: [goto('Sheliak', 'star'), rate(1)],
      body: [
        p('With both velocity amplitudes measured, the relative orbit is in hand up to the inclination: a sin i = a₁ sin i + a₂ sin i = P (K₁ + K₂)/2π for a circular orbit. Substituting into Kepler\'s third law:'),
        eq('m_1 + m_2 = \\frac{P}{2\\pi G}\\,\\frac{(K_1 + K_2)^3}{\\sin^3 i}', 'The total mass of a double-lined spectroscopic binary. Everything on the right is measured except sin i — and it enters <em>cubed</em>. A circular orbit is assumed; for an eccentric one multiply by (1 − e²)^3/2.'),
        p('Without the inclination, then, spectroscopy delivers only lower limits: m sin³ i for each star. If the binary also eclipses, i is close to 90° and the limit becomes the mass. If it does not, the astronomer either finds i some other way (an interferometric orbit, polarimetry, the shape of ellipsoidal light variations) or settles for statistics: for randomly oriented orbits the average of sin³ i is 3π/16 ≈ 0.59, and since large-amplitude systems are easier to discover, the average over a real catalogue is nearer 2/3.'),
        p('For a single-lined system it is worse. Only K₁ is known; K₂, hence the ratio, is not. Rearranging the mass equation so that every unknown is on one side gives a quantity called the <b>mass function</b>, which can be computed from P and K₁ alone:'),
        eq('f(m) \\equiv \\frac{m_2^3 \\sin^3 i}{(m_1 + m_2)^2} = \\frac{P\\,K_1^3}{2\\pi G}', 'The mass function of a single-lined spectroscopic binary. It is a strict lower limit on m₂: whatever i and m₁ may be, m₂ ≥ f(m). To get m₂ itself one must assume i and estimate m₁ from the primary\'s spectral type.'),
        p('The widget lets you feel the degeneracy. Fix P and K₁ — a measured curve — and move the inclination and the assumed primary mass: the companion mass that satisfies the equation changes by large factors, but never drops below f(m). The mass function is how the masses of invisible companions are bounded: when f(m) alone exceeds 3 M☉ for a companion that emits no light, as for the X-ray binary Cygnus X-1 (f = 0.25 M☉, but the primary is a 20 M☉ supergiant, giving m₂ ≈ 15 M☉), the invisible object is heavier than any neutron star can be — a black hole, weighed by the same equation that weighs Sirius B.'),
        example('A star of 1.0 M☉ (from its spectrum) shows a single-lined orbit with P = 10 days and K₁ = 20 km/s. Then f(m) = P K₁³/(2πG) = (8.64×10⁵ s)(2×10⁴ m/s)³/(2π × 6.67×10⁻¹¹) = 1.65×10²⁹ kg = 0.083 M☉. Solving m₂³ sin³ i = 0.083 (1 + m₂)² with sin i = 1 gives m₂ ≈ 0.52 M☉ (a K dwarf, plausibly hidden in the glare); with i = 30°, m₂ ≈ 1.3 M☉ — heavier than the primary, which would then not be the primary. The spectrum should have shown a second set of lines; the low-inclination solution is disfavoured.', 'Bounding an unseen companion'),
      ],
    },
    {
      id: 'eclipse-geometry',
      kicker: 'Interactive · the light curve',
      title: 'Eclipsing binaries: geometry of the light curve',
      widget: { type: 'eclipse', mode: 'animate' },
      scene: [goto('Algol', 'star'), rate(1)],
      body: [
        p('When the inclination is close to 90°, each star in turn passes in front of the other and the combined light dips. A plot of brightness against time — the <b>light curve</b> — shows two minima per orbit. The deeper, <em>primary</em> minimum occurs when the hotter star is hidden: per unit area it emits more, so covering it costs more light, even if it is the smaller star. The shallower <em>secondary</em> minimum is the cooler star being hidden, half a period later for a circular orbit (displaced for an eccentric one — a free measure of e cos ω).'),
        p('The widget animates the geometry. Set the two radii, the two temperatures and the inclination, and watch the orbit edge-on above the light curve. Reduce i and watch the eclipses become partial, then shallower, then vanish: the condition for any eclipse is that the projected separation at conjunction, a cos i, be less than R₁ + R₂. Make the smaller star much smaller and the minima acquire flat bottoms — <em>total</em> and <em>annular</em> eclipses — during which the small star is entirely hidden or entirely in front.'),
        eq('\\cos i < \\frac{R_1 + R_2}{a}', 'Condition for eclipses. For two Sun-sized stars 0.1 AU apart, i must exceed 84.7°; for a Jupiter 0.05 AU from a Sun-like star, 87.3°. Eclipsing systems are a small, biased sample — close pairs, large stars — and that bias must be remembered when using them.'),
        p('The light curve is a time series, not an image, and that is its strength: photometry can be done on faint stars with small telescopes, every night, by anyone. Goodricke measured Algol by eye against neighbouring stars in 1782–83 and got the period right to a minute. Today robotic surveys and the Kepler and TESS satellites (Section 7.4) have recorded the light curves of millions of eclipsing binaries to parts per million — and the method for reading them is the subject of the next step.'),
        terms(
          ['Primary / secondary minimum', 'The deeper dip (hotter star eclipsed) and the shallower dip (cooler star eclipsed).'],
          ['Contacts', 'The four instants at which the stars\' limbs touch: first (eclipse begins), second (totality or annularity begins), third (ends), fourth (eclipse ends).'],
          ['Total, annular, partial', 'Whether the smaller star is completely hidden, completely silhouetted, or only partly overlapped at mid-eclipse.'],
          ['Phase', 'Time since primary minimum divided by the period; light curves are plotted against phase so that many orbits fold onto one.'],
        ),
      ],
    },
    {
      id: 'radii-temperatures',
      kicker: 'Interactive · reading the curve',
      title: 'Radii from the timing, temperatures from the depths',
      widget: { type: 'eclipse', mode: 'measure' },
      scene: [goto('Almaaz', 'star'), rate(1)],
      body: [
        p('Take the simplest case: a circular orbit seen exactly edge-on, i = 90°, with a smaller star of radius R_s and a larger one of radius R_l. The relative velocity of the two stars across our line of sight is v = v_s + v_l, known from the spectroscopic curves. The eclipse begins at first contact t_a, the small star is fully in front (or behind) at second contact t_b, starts to emerge at t_c and is clear at t_d. Between t_a and t_b the small star moves its own diameter; between t_a and t_c it moves the diameter of the large one. Hence'),
        eq('R_s = \\frac{v}{2}\\,(t_b - t_a), \\qquad R_l = \\frac{v}{2}\\,(t_c - t_a) = R_s + \\frac{v}{2}\\,(t_c - t_b)', 'Stellar radii from eclipse timing. This is the only direct measurement of a stellar radius other than interferometry — and it works on stars thousands of light-years away.'),
        p('The depths give temperatures. Let B₀ be the brightness outside eclipse, B_p at primary minimum (small hot star behind the large one, totally hidden), B_s at secondary minimum (small star in front, blocking a patch of the large one of the same area πR_s²). Writing the surface flux of each star as σT⁴ and dividing, the stellar radii and the distance all cancel:'),
        eq('\\frac{B_0 - B_p}{B_0 - B_s} = \\frac{\\pi R_s^2\\,\\sigma T_s^4}{\\pi R_s^2\\,\\sigma T_l^4} = \\left(\\frac{T_s}{T_l}\\right)^4', 'Ratio of the eclipse depths = fourth power of the temperature ratio, when the small star is the hotter one and the eclipses are total/annular. Limb darkening — the edge of a stellar disc is cooler and fainter than its centre — modifies the shape of the dips and is fitted for.'),
        p('The widget is in measuring mode: the light curve is drawn with the four contacts marked, and the readout computes R_s, R_l and T_s/T_l from the timings and depths with v taken from the velocity curves. Move the sliders and check that the formulas recover the inputs; then tilt the inclination away from 90° and watch the contacts blur and the simple formulas start to err — the real analysis fits a full geometric model to the curve (the Wilson–Devinney code and its successors) with i, R₁/a, R₂/a, T₂/T₁, limb darkening and e as free parameters.'),
        p('Combine this with the spectroscopy of the same system and the solution is complete: K₁ and K₂ give the mass ratio and (with i from the eclipses) the masses and a; the timings give the radii in kilometres; the depths give the temperature ratio and the spectrum gives one absolute temperature; L = 4πR²σT⁴ gives both luminosities; and comparing them with the observed fluxes gives the distance — no parallax needed. Eclipsing binaries have been used this way to measure the distance to the Large Magellanic Cloud to 1 %.'),
        history('ε Aurigae, behind the panel, is the longest-period eclipsing binary known: every 27.1 years the F supergiant fades by 0.8 magnitudes for nearly two years. The eclipsing body is not a star but a vast opaque disc of dust around an unseen companion, seen almost edge-on; the 2009–2011 eclipse was imaged directly by the CHARA interferometer, showing the dark disc crossing the star. The light curve had been puzzling astronomers since 1821.', 'The strangest eclipse'),
      ],
    },
    {
      id: 'lightcurve-types',
      kicker: 'Interactive · the zoo',
      title: 'Algol, β Lyrae and W Ursae Majoris: shapes that tell the physics',
      widget: { type: 'lcgallery' },
      scene: [goto('Sheliak', 'star'), rate(1)],
      body: [
        p('Real light curves are classified by their shape, and the shape is a map of how close the two stars are to each other relative to their sizes. In the widget, switch between the three classical types and watch the geometry morph alongside the curve.'),
        list(
          '<b>Algol type (EA).</b> The stars are well separated and nearly spherical; the light is constant between eclipses and the minima are sharp, with the secondary often much shallower. Algol itself: a 3.7 M☉ B8 main-sequence star and a 0.8 M☉ K subgiant, period 2.87 days.',
          '<b>β Lyrae type (EB).</b> The stars are so close that their shapes are stretched into ellipsoids by each other\'s tides; as they rotate the projected area changes continuously, so the light curve varies smoothly all the way around with no flat portions, and both minima are deep. Sheliak behind the panel — period 12.9 days and lengthening by 19 seconds a year as gas streams from one star onto a thick disc around the other.',
          '<b>W Ursae Majoris type (EW).</b> Contact binaries: two stars sharing a common envelope, periods of hours, equal minima, continuous variation. The stars touch; there are tens of thousands known.',
        ),
        p('Beyond the eclipses the curve carries smaller signatures. The <em>ellipsoidal variation</em> just described; the <em>reflection effect</em>, where each star heats the facing hemisphere of the other, brightening the curve just outside secondary minimum; <em>limb darkening</em>, which rounds the bottoms of partial eclipses; starspots, which drift the curve from season to season; and, in the most precise space photometry, the <em>Doppler beaming</em> of the moving stars at the part-per-thousand level. Each effect is a free lesson in stellar atmospheres, and all of them are modelled when a modern light curve is fitted.'),
        p('Algol also poses a puzzle that this chapter cannot solve but should flag. The less massive star, the K subgiant, is the more evolved — it has already left the main sequence — while the heavier B star is still on it. Since (Chapter 13 will show) heavier stars evolve <em>faster</em>, this is backwards. The resolution, the <em>Algol paradox</em>, is that the subgiant was once the heavier star, evolved first, swelled up and poured most of its mass onto its companion. Close binaries do not merely let us weigh stars; they let stars exchange mass, and that reshapes their lives — novae, X-ray binaries, Type Ia supernovae and gravitational-wave mergers all begin here.'),
        key('A light curve is a one-dimensional record of a three-dimensional system, and yet from it — with a spectrum — come radii to 1 %, temperatures, the inclination that spectroscopy lacks, and a distance. The "Algol type / β Lyrae type / W UMa type" vocabulary is really a statement about the ratio R/a: detached, semi-detached, contact.'),
      ],
    },
    {
      id: 'close-binary-summary',
      kicker: 'Summary',
      title: 'Eclipsing and spectroscopic binaries in brief',
      scene: [backdrop()],
      body: [
        summary(
          'Radial-velocity curves: K₁ = 2πa₁ sin i/P, K₂ likewise; m₁/m₂ = K₂/K₁ without distance or inclination.',
          'Eccentricity skews the curve; fitting it gives P, K, e, ω and γ — but never i or the node.',
          'm₁ + m₂ = P (K₁+K₂)³/(2πG sin³ i): only lower limits unless i is known. Single-lined: the mass function f(m) = PK₁³/2πG, a strict lower limit on the companion.',
          'Eclipses require cos i < (R₁+R₂)/a; the light curve gives the inclination and, from the contact times and the relative velocity, both radii: R_s = v(t_b − t_a)/2, R_l = v(t_c − t_a)/2.',
          'Depths give the temperature ratio: (B₀ − B_p)/(B₀ − B_s) = (T_s/T_l)⁴. Eclipsing + double-lined = masses, radii, temperatures, luminosities, distance.',
          'Light-curve types (Algol, β Lyrae, W UMa) encode R/a: detached, semi-detached, contact — and mass transfer, which rewrites the stars\' evolution.',
        ),
        key('Every number in a table of stellar masses and radii — the inputs to all of stellar structure — was obtained by one of the methods on this page. They are not many, and none is easy; that is why there are only a few hundred stars whose masses are known to better than three per cent.'),
      ],
    },
  ],
};

const S7_4: Section = {
  id: 'extrasolar-planets',
  number: '7.4',
  title: 'The Search for Extrasolar Planets',
  summary: 'A planet is the extreme single-lined binary: the same Doppler and eclipse methods, pushed four orders of magnitude further, found the first worlds around other suns in 1995 and nearly six thousand since — and are now closing in on Earth-sized planets in habitable orbits.',
  minutes: 32,
  steps: [
    {
      id: 'first-exoplanets',
      kicker: 'Interactive · 1995',
      title: 'A planet is a very small companion',
      widget: { type: 'planetrv' },
      scene: [goto('Helvetios', 'star'), rate(1)],
      body: [
        p('Everything in Section 7.3 applies without change when the companion is a planet. The star still orbits the centre of mass; its lines still shift; the amplitude is still K₁ = 2πa₁ sin i/P. The only difference is scale. For a companion of mass m_p ≪ M★ the star\'s reflex velocity is'),
        eq('K = \\left(\\frac{2\\pi G}{P}\\right)^{1/3}\\frac{m_p \\sin i}{M_\\star^{2/3}} \\;\\approx\\; 28.4\\ \\text{m s}^{-1}\\,\\left(\\frac{P}{1\\ \\text{yr}}\\right)^{-1/3}\\frac{m_p \\sin i}{M_J}\\left(\\frac{M_\\star}{M_\\odot}\\right)^{-2/3}', 'The radial-velocity semi-amplitude induced by a planet (circular orbit). Jupiter moves the Sun by 12.5 m/s with a period of 11.9 years; the Earth by 9 cm/s — a slow walking pace and a gentle crawl, in a star whose surface churns at kilometres per second.'),
        p('That is why the first discoveries waited for spectrographs stable to metres per second. In 1992 Aleksander Wolszczan and Dale Frail found two Earth-mass bodies orbiting the millisecond pulsar PSR B1257+12, using the pulse arrival times as the clock — planets, but around a dead star. The breakthrough for ordinary stars came on 6 October 1995: Michel Mayor and Didier Queloz, with the ELODIE spectrograph at Haute-Provence, reported that the Sun-like star 51 Pegasi — behind the panel, 50 light-years away — swings back and forth by 56 m/s every 4.23 days. The companion has at least half the mass of Jupiter and orbits at 0.05 AU, eight times closer than Mercury: a <em>hot Jupiter</em>, which no theory had predicted. Mayor and Queloz shared the 2019 Nobel Prize in Physics.'),
        p('The widget is a star with one planet. Set the planet\'s mass and period and the star\'s mass, and watch the star\'s tiny orbit and its velocity curve; the horizontal bands mark the precision of successive generations of instruments — 10 m/s in 1995, 1 m/s for HARPS in 2003, 0.3 m/s for ESPRESSO today — and the readout says whether the planet is detectable. Try Jupiter, then Earth. Then set a 10-day period and see why hot Jupiters were found first: short periods and large masses make large K, and short periods need only weeks of data.'),
        p('As with any single-lined binary, only m_p sin i is measured, and the orbit\'s inclination is unknown — so radial velocities give a <em>minimum</em> mass. Statistically the correction is small (the average of sin i over random orientations is π/4 ≈ 0.79); for an individual planet the degeneracy is broken only by a transit, by astrometry, or by resolving the orbit.'),
        history('51 Pegasi b was announced in Florence on 6 October 1995 and confirmed within a week by Geoffrey Marcy and Paul Butler at Lick, who had been surveying for years with a precision good enough to see it — but had assumed, as everyone did, that giant planets lived on decade-long orbits like Jupiter and had not yet analysed their short-period data. Within months they found 70 Virginis b and 47 Ursae Majoris b in their archives. The lesson about assumptions is often repeated.', 'The week the field began'),
      ],
    },
    {
      id: 'transits',
      kicker: 'Interactive · eclipses again',
      title: 'Transits: an eclipsing binary with a very small secondary',
      widget: { type: 'transit' },
      scene: [goto('Helvetios', 'star'), rate(1)],
      body: [
        p('If a planet\'s orbit is nearly edge-on it crosses the face of its star once per period, and the star dims — a <em>transit</em>, the planetary form of the primary eclipse. The planet emits no significant light, so the depth is purely geometric:'),
        eq('\\delta = \\frac{\\Delta F}{F} = \\left(\\frac{R_p}{R_\\star}\\right)^2', 'Transit depth. Jupiter in front of the Sun: (0.10)² = 1 %. Earth: (0.0092)² = 84 parts per million — the brightness change of a city street when one window-blind closes. The depth gives the planet\'s radius in units of the star\'s.'),
        eq('p_{\\rm transit} \\approx \\frac{R_\\star}{a}, \\qquad T_{\\rm dur} \\approx \\frac{P}{\\pi}\\,\\frac{R_\\star}{a}', 'Probability that a randomly inclined orbit transits, and the transit duration for a central crossing. Earth seen from afar: a 0.5 % chance, 13 hours once a year. A hot Jupiter at 0.05 AU: 10 %, 3 hours every few days.'),
        p('Drag the planet radius, the orbital distance and the inclination in the widget; the light curve below responds, and the readout gives depth, duration and the geometric probability. Note the shape: a flat bottom with rounded shoulders set by limb darkening, and ingress/egress times that measure the planet\'s size directly in units of the crossing speed, exactly as the contacts did for eclipsing binaries. The ratio of the ingress duration to the total duration gives the <em>impact parameter</em> — how far from the star\'s centre the chord lies — and with it the inclination.'),
        p('The first transiting planet, HD 209458 b, was caught in 1999 by two groups who knew from its radial-velocity orbit exactly when to look. The low probability means that to find transits in bulk one must watch many stars at once — which is what the Kepler space telescope did from 2009 to 2013, staring at 150 000 stars in Cygnus with a precision of 20 parts per million, and what TESS has done over the whole sky since 2018. Kepler alone found more than 2 700 confirmed planets and showed that small planets outnumber giants and that most Sun-like stars have at least one planet.'),
        p('Transit and velocity together break the sin i degeneracy: a transiting planet has i ≈ 90°, so m_p sin i is m_p. Radius from the depth and mass from the velocity give the <em>density</em> — the first clue to what a planet is made of. And during transit, starlight filtering through the planet\'s atmosphere imprints its spectrum: <em>transmission spectroscopy</em>, first done for sodium in HD 209458 b in 2002 and now done routinely with JWST for water, carbon dioxide, methane and clouds.'),
        think('Kepler found that about one star in two hundred showed a transiting planet with a period under a year. Using the transit probability above, roughly what fraction of those stars actually have such a planet? What does this say about the number of planets in the Galaxy?'),
      ],
    },
    {
      id: 'detection-methods',
      kicker: 'Interactive · five techniques',
      title: 'The five ways to find a planet',
      widget: { type: 'methods' },
      scene: [goto('Fomalhaut', 'star'), rate(1)],
      body: [
        p('Radial velocities and transits account for most known planets, but neither can find everything: velocities fade for long periods and light stars, transits for wide orbits. Five independent techniques are in regular use, and each sees a different corner of the planet population. The widget draws that population: planet mass against orbital distance, with the discovery method as colour and the regions each method can reach outlined. Switch methods on and off and notice how little they overlap — and where the solar system\'s planets would fall.'),
        list(
          '<b>Radial velocity.</b> The star\'s Doppler wobble (previous steps). Best for massive planets on short orbits around quiet, bright stars; gives m sin i, P, e. About 1 100 planets.',
          '<b>Transit.</b> The periodic dip (previous step). Best for short periods; gives R_p/R★, P, i; needs follow-up to confirm. More than 4 300 planets — the great majority, thanks to Kepler and TESS.',
          '<b>Direct imaging.</b> Blocking the star with a coronagraph and adaptive optics to photograph the planet itself. Only young, hot, massive planets far from their stars: the four giants of HR 8799 (2008), β Pictoris b. Fomalhaut, behind the panel, hosts the famous "Fomalhaut b" of 2008, now thought to be an expanding dust cloud from a collision — a reminder that images, too, need interpretation. A few dozen planets.',
          '<b>Gravitational microlensing.</b> When a foreground star drifts in front of a background star, its gravity magnifies the background light for weeks (Chapter 17); a planet around the lens adds a brief spike. Sensitive to cool planets at a few AU around distant, faint stars, each event seen once and never again. About 200 planets; the Roman Space Telescope will find thousands.',
          '<b>Astrometry.</b> The star\'s wobble on the sky — Bessel\'s method. Sensitive to massive planets on long orbits around nearby stars; gives the true mass, not m sin i. Hard: microarcseconds. Gaia\'s coming data releases are expected to yield thousands.',
        ),
        p('A sixth, timing, found the very first planets (pulsar planets, 1992) and finds others through variations in the times of transits or eclipses caused by additional bodies (<em>transit timing variations</em>, which also give masses without spectroscopy). As of 2025 nearly six thousand planets are confirmed; the count was zero thirty years earlier.'),
        table(
          ['Method', 'Measures', 'Sensitive to', 'Blind to', 'Planets (approx.)'],
          [
            ['Radial velocity', 'm sin i, P, e', 'massive, close, bright quiet stars', 'face-on orbits, active stars, long P', '1 100'],
            ['Transit', 'R_p/R★, P, i', 'close orbits, any mass', 'wide orbits (probability ∝ 1/a)', '4 300'],
            ['Direct imaging', 'brightness, separation, spectrum', 'young, massive, wide (> 10 AU)', 'old, small, close', '70'],
            ['Microlensing', 'm_p/M★, projected separation', 'cool planets at 1–10 AU, far away', 'anything needing follow-up', '200'],
            ['Astrometry', 'true mass, full orbit', 'massive, long-period, nearby', 'small, short-period', 'few, rising with Gaia'],
          ],
          'Order-of-magnitude counts as of 2025 (NASA Exoplanet Archive). The biases are as important as the numbers: the known population is what the methods can see, not what exists.',
        ),
      ],
    },
    {
      id: 'mass-radius',
      kicker: 'Interactive · what they are made of',
      title: 'Mass, radius, density: from detection to composition',
      widget: { type: 'density' },
      scene: [goto('neptune'), rate(1)],
      body: [
        p('A planet with both a transit and a velocity curve has a radius and a true mass, and therefore a mean density ρ = 3m/4πR³. Density is the first word about composition: the Earth\'s 5.5 g/cm³ is rock and iron, Jupiter\'s 1.33 is hydrogen and helium compressed by its own gravity, Saturn\'s 0.69 is less than water. The widget is the mass–radius diagram: every planet with both quantities measured, over theoretical curves for pure iron, rock, water and hydrogen–helium worlds. Drag the test planet and read its implied composition; add the solar-system planets for scale.'),
        p('Three features of the diagram organise the field. First, below about 1.6 Earth radii most planets are dense enough to be rocky; above it, nearly all are too light and must carry thick envelopes of gas or water — the boundary between <em>super-Earths</em> and <em>sub-Neptunes</em>. Second, the <em>radius valley</em>: Kepler found far fewer planets of 1.5–2 Earth radii than on either side, apparently because planets born near that size either keep their hydrogen envelope and sit above the gap or have it stripped by the young star\'s X-rays and ultraviolet and sit below. Third, giant planets stop growing: adding mass to a Jupiter compresses it, so from Saturn to 80 Jupiter masses — the edge of the stars — the radius barely changes, which is why a brown dwarf is Jupiter-sized.'),
        eq('\\rho = \\frac{3\\,m_p}{4\\pi R_p^3}, \\qquad m_p\\ \\text{from}\\ K,\\ \\ R_p\\ \\text{from}\\ \\delta^{1/2} R_\\star', 'Density requires both methods — and a good star. Since m_p ∝ M★^2/3 and R_p ∝ R★, a 10 % error in the stellar radius is a 30 % error in the planet\'s density. The stellar parameters of this chapter are the planet\'s error bars.'),
        p('There are surprises on the diagram that still lack a settled explanation: <em>inflated hot Jupiters</em>, too large for their mass, apparently heated from within by their star\'s irradiation; <em>super-puffs</em>, Neptune-mass planets the size of Jupiter with densities of cotton candy; and the simple fact that the most common kind of planet in the Galaxy — between the sizes of the Earth and Neptune — does not exist in the solar system at all.'),
        key('Detection methods find planets; stellar parameters make them meaningful. Every planet radius is a stellar radius times a square root of a depth; every planet mass is a stellar mass to the two-thirds times a velocity. Characterising the planets of a star begins by characterising the star — with everything in Chapters 3, 5 and 7.'),
      ],
    },
    {
      id: 'earth-like',
      kicker: 'Interactive · the goal',
      title: 'Toward Earth-like planets',
      widget: { type: 'habitable' },
      scene: [goto('Proxima Centauri', 'star'), rate(1)],
      body: [
        p('The question behind the whole enterprise is whether planets like ours — rocky, temperate, with liquid water — are common, and whether any shows signs of life. The first part has an answer in sight. Define the <em>habitable zone</em> as the range of orbits in which a planet with an atmosphere could keep liquid water on its surface: close enough that it does not freeze, far enough that a runaway greenhouse does not boil the oceans away, as happened to Venus. For the Sun the conservative limits are about 0.95 and 1.7 AU; a planet\'s equilibrium temperature'),
        eq('T_{\\rm eq} = T_\\star\\sqrt{\\frac{R_\\star}{2a}}\\,(1 - A)^{1/4}', 'Equilibrium temperature of a rapidly rotating planet with Bond albedo A, ignoring greenhouse warming (which adds 33 K for the Earth). For the Earth, A = 0.3 gives 255 K. The zone scales with the square root of the stellar luminosity, so for a red dwarf of 0.01 L☉ it lies at 0.1 AU — periods of weeks.'),
        p('The widget draws the habitable zone around a star of chosen type and lets you place a planet in it; the readout gives T_eq, the period, and — the point of the exercise — the size of the signals that star–planet pair would produce: the radial-velocity amplitude, the transit depth and probability, the astrometric wobble. Try an Earth around the Sun and then an Earth around a 0.3 M☉ red dwarf like Proxima behind the panel. The red dwarf\'s planet gives a signal ten to a hundred times larger in every method. That is why the first temperate Earth-sized planets were all found around red dwarfs: Proxima b (2016, 1.1 Earth masses, 11.2 days, 0.05 AU), the seven planets of TRAPPIST-1 (2017, three of them in the zone), and others.'),
        p('Around Sun-like stars the signals are at the edge of the possible — 9 cm/s, 84 ppm once a year — and the Kepler estimate that 10–50 % of such stars have a rocky planet in the habitable zone rests on a few dozen candidates. Closing that gap is the programme of the next two decades: ESPRESSO and its successors pushing velocities toward 10 cm/s against the star\'s own noise; the PLATO mission (2026) staring at bright stars for years; the Roman Space Telescope\'s coronagraph; the 39 m ELT (Section 6.2) attempting to image Proxima b directly; and the Habitable Worlds Observatory, planned for the 2040s, designed to take spectra of two dozen Earth-like planets and look for oxygen, ozone, methane and water in their atmospheres — the <em>biosignatures</em>.'),
        p('Whether a biosignature is a sign of life is a separate and hard question; oxygen can be made without biology, and a single molecule will never settle it. But note what the chapter has accomplished. The technique that let Herschel see Castor swing around its companion, that let Bessel infer Sirius B, that let Goodricke time Algol, is the same technique — refined by a factor of a million — now being pointed at planets the mass of the Earth. Binary stars taught us how to weigh the universe; the lesson is being used to find other Earths.'),
        note('Proxima Centauri, behind the panel, is 4.24 light-years away and 0.12 solar masses. Its habitable zone lies at 0.03–0.09 AU, and Proxima b at 0.049 AU receives 65 % of the Earth\'s sunlight. The star flares violently, and whether a planet so close can keep an atmosphere is unknown. The planet\'s radial-velocity signal is 1.4 m/s — found after 16 years of data; it does not transit; and the ELT is expected to image its reflected light. If it does, that will be the first picture of a temperate rocky world beyond the solar system.', 'The nearest case'),
      ],
    },
    {
      id: 'chapter-close',
      kicker: 'Chapter close',
      title: 'Binary systems and stellar parameters in one page',
      scene: [backdrop()],
      body: [
        summary(
          'Mass is weighed only by gravity: binaries are the scale. Classes by what is observed — optical (unbound), visual, astrometric, spectrum, spectroscopic, eclipsing.',
          'Visual binaries: m₁/m₂ = α₂/α₁ from the centre of mass; m₁ + m₂ = α³/(p³P²) from Kepler III and the parallax; deproject the apparent orbit (cos³ i).',
          'Spectroscopic binaries: m₁/m₂ = K₂/K₁; m₁ + m₂ = P(K₁+K₂)³/(2πG sin³ i); single-lined → the mass function, a lower limit on the unseen companion.',
          'Eclipsing binaries: light curve → i, radii from contact times (R = v Δt/2), temperature ratio from depths; with spectroscopy, the complete solution and a distance.',
          'Mass–luminosity relation L ∝ M^3.5, lifetime ∝ M⁻²·⁵; the Algol paradox and mass transfer.',
          'Planets are tiny companions: K = 28 m/s per Jupiter at 1 yr; δ = (R_p/R★)²; five methods, ~6 000 planets, biases in each; density → composition; habitable zone and the push toward Earth analogues.',
        ),
        key('The chapter\'s methods are few — an orbit on the sky, a velocity curve, a light curve — and they recur throughout astrophysics: the same equations weigh white dwarfs, neutron stars, black holes, the dark matter in galaxies and the planets of other suns. When a mass is quoted anywhere in this course, ask which of these three curves it came from.'),
        { kind: 'callout', tone: 'history', title: 'Suggested reading', html: 'Carroll & Ostlie, <em>An Introduction to Modern Astrophysics</em>, Chapter 7, which this chapter follows; R. W. Hilditch, <em>An Introduction to Close Binary Stars</em> (2001) for the full treatment of light- and velocity-curve analysis; A. Tokovinin\'s reviews on multiplicity statistics; G. Torres, J. Andersen & A. Giménez, "Accurate masses and radii of normal stars" (2010) for the calibrating sample; M. Perryman, <em>The Exoplanet Handbook</em> (2nd ed., 2018) for Section 7.4; Mayor & Queloz, <em>Nature</em> 378, 355 (1995), four pages that started a field. The NASA Exoplanet Archive and the Washington Double Star Catalog are the living data.' },
        { kind: 'callout', tone: 'think', title: 'Problems to try', html: '(1) Sirius: P = 50.13 yr, α = 7.50″, p = 0.3792″, and the primary\'s orbit about the centre of mass has semi-major axis 2.5″. Find the total mass and the individual masses. (2) A visual binary\'s apparent orbit is a circle of radius 1″ with the primary at the centre, P = 30 yr, p = 0.05″. Find the mass. Now you learn the primary is actually 0.3″ off-centre along one axis; what changes? (3) An SB2 has P = 5.00 d, K₁ = 60 km/s, K₂ = 90 km/s, e = 0. Find the mass ratio, m₁ sin³ i and m₂ sin³ i, and a sin i. If it eclipses, what are the masses? (4) An SB1 with a G2 V primary shows P = 100 d, K₁ = 12 km/s. Find f(m) and the minimum companion mass; if the companion\'s lines are not seen, what does that imply about i? (5) An eclipsing binary (i = 90°, circular) has v₁ + v₂ = 200 km/s and contacts at 0, 0.60, 4.20 and 4.80 hours. Find both radii in solar units. The primary minimum is 0.90 and the secondary 0.30 of the depth scale; find T_s/T_l. (6) Compute K for a Jupiter at 5.2 AU and an Earth at 1 AU around a 1 M☉ star; around a 0.3 M☉ star with the planets scaled to the same stellar flux. (7) Kepler monitored 150 000 stars and found about 3 000 transiting candidates with P < 1 yr. Estimate, with the transit probability, the mean number of such planets per star. (8) For TRAPPIST-1 (T = 2 560 K, R = 0.12 R☉, L = 5.5×10⁻⁴ L☉) find the habitable-zone distances and the corresponding periods, and the transit depth of an Earth-sized planet. (9) Show that for a given m_p the transit depth and the velocity amplitude both favour small stars, but by different powers of R★ and M★; which method gains more by moving to red dwarfs?' },
      ],
    },
  ],
};

/* =============================================================== chapter 8 ===== */

const S8_1: Section = {
  id: 'spectral-line-formation',
  number: '8.1',
  title: 'The Formation of Spectral Lines',
  summary: 'How a roomful of Harvard "computers" sorted a quarter of a million spectra into the sequence O B A F G K M, why that sequence turned out to be a thermometer, and the two pieces of statistical physics — Boltzmann and Saha — that explain which lines a star of a given temperature can show. With a detour through the spectra of the planets, which borrow their lines from the Sun.',
  minutes: 30,
  steps: [
    {
      id: 'harvard-classification',
      kicker: 'Interactive · the sequence',
      title: 'O B A F G K M: a sequence found before it was understood',
      widget: { type: 'spectralseq' },
      scene: [goto('Vega', 'star'), rate(1)],
      body: [
        p('By the 1880s two instruments had changed what a star <em>was</em> to an astronomer. Photometry (Section 3.2) turned brightness into a number; the objective prism, a thin wedge of glass placed over the front of a telescope, turned every star in the field into a tiny spectrum on the same photographic plate. Suddenly a single exposure yielded hundreds of spectra, and the obvious thing to do with hundreds of anything is to sort them. The question was: sort by what?'),
        p('Edward Pickering, director of the Harvard College Observatory, chose the strength of the hydrogen absorption lines — the Balmer series (Section 5.3), which is conspicuous in almost every stellar spectrum. Williamina Fleming assigned letters A through Q, A for the strongest hydrogen lines. Antonia Maury, looking at higher-dispersion spectra, noticed that the line <em>widths</em> also varied and proposed a parallel scheme. Then Annie Jump Cannon, between 1911 and 1915, classified 225 300 stars for the Henry Draper Catalogue at a pace of up to three stars a minute, and in doing so pruned and reordered Fleming\'s letters into the sequence still used today: <b>O B A F G K M</b>, each class divided into tenths (B0, B1, … B9, A0). The mnemonic is older than the explanation.'),
        p('What Cannon had done, without any theory to guide her, was to arrange the stars by surface temperature. The hottest, O stars above 30 000 K, show lines of ionised helium; A stars near 10 000 K have the strongest hydrogen lines of all; the Sun is a G2 star at 5 800 K with a forest of metal lines and the two violet lines of ionised calcium dominating; M stars below 3 700 K are striped with the bands of titanium oxide molecules. The widget runs along the sequence. Drag from O5 to M8 and watch the continuum redden, the hydrogen lines grow and then fade, the helium lines vanish, the metals and finally the molecular bands take over. The star behind the panel, Vega, is the A0 V standard against which every other class is placed.'),
        table(
          ['Class', 'T (K)', 'Colour', 'Defining lines', 'Example'],
          [
            ['O', '> 30 000', 'blue', 'He II, weak H, highly ionised metals', 'ζ Puppis, Mintaka'],
            ['B', '10 000–30 000', 'blue-white', 'He I strongest at B2, H growing', 'Rigel, Spica'],
            ['A', '7 500–10 000', 'white', 'H strongest at A0, Ca II appearing', 'Vega, Sirius'],
            ['F', '6 000–7 500', 'yellow-white', 'H weakening, Ca II strong, neutral metals', 'Procyon, Canopus'],
            ['G', '5 200–6 000', 'yellow', 'Ca II H & K dominate, many metals, CH band', 'Sun, Capella'],
            ['K', '3 700–5 200', 'orange', 'neutral metals strong, TiO beginning', 'Arcturus, Aldebaran'],
            ['M', '< 3 700', 'red', 'TiO and VO bands, Ca I, neutral metals', 'Betelgeuse, Proxima'],
          ],
          'The Harvard sequence with its modern temperature calibration. In 1999 two classes were added below M for brown dwarfs — L (1 300–2 400 K) and T (< 1 300 K) — and in 2011 a Y class for the coldest objects known; Step 7 takes the story there.',
        ),
        history('Cannon received no Harvard appointment until 1938, two years before her retirement, though she had by then classified more stars than anyone in history and been elected an honorary member of the Royal Astronomical Society. The Henry Draper Catalogue — nine volumes, 1918–1924 — remains in use: the HD numbers in this program\'s catalogue are hers.', 'The woman who sorted the sky'),
      ],
    },
    {
      id: 'sun-spectrum',
      kicker: 'Interactive · a G2 V star up close',
      title: 'The Sun\'s spectrum as a specimen of the class',
      widget: { type: 'fraunhofer' },
      scene: [goto('sun'), rate(1)],
      body: [
        p('Before asking why the sequence is a thermometer, it is worth looking closely at the one star whose spectrum can be recorded at any resolution we please. The Sun\'s spectrum — Fraunhofer\'s dark lines, revisited from Section 5.1 — is a typical G2 spectrum, and everything in it has to be explained by the same rules that will later explain Vega or Betelgeuse. The widget lets you drag along the solar spectrum and name the lines: the Balmer lines are present but modest (Hα at 656 nm is strong, Hβ, Hγ, Hδ progressively weaker); the two strongest lines in the whole visible spectrum are H and K of <em>singly ionised calcium</em> at 397 and 393 nm; the sodium D pair at 589 nm, the magnesium b triplet at 518 nm, and hundreds of iron lines fill the rest.'),
        p('That ranking is the puzzle in miniature. In the Sun there are roughly half a million hydrogen atoms for every calcium atom, yet the calcium lines are far darker than the hydrogen lines. If line strength simply measured abundance, the Sun would be a calcium star. Cecilia Payne showed in her 1925 thesis that it does not and the Sun is not: the strength of a line measures the number of atoms <em>in the particular state able to absorb it</em>, and that number depends overwhelmingly on temperature. Steps 4 to 6 build that argument piece by piece.'),
        p('Two things in the solar spectrum are not solar. The broad diffuse bands near 690 and 760 nm, and a comb of fine lines between 720 and 830 nm, are produced by oxygen and water vapour in the Earth\'s atmosphere — <em>telluric</em> lines, which appear in every ground-based spectrum of every star and strengthen toward the horizon. They are Kirchhoff\'s third law (Section 5.1) performed by our own air: a cool gas in front of a hot source. The spectroscopist either models them out or observes from space; either way, the first skill in reading a spectrum is knowing which lines were made where.'),
        key('A spectral line\'s strength depends on three things: how many atoms of the element there are, what fraction of them are in the right ionisation stage, and what fraction of <em>those</em> are in the right energy level to absorb that line. Only the first is composition. The other two are temperature — and they are usually the ones that dominate.'),
      ],
    },
    {
      id: 'reflected-light',
      kicker: 'Interactive · the planets borrow a spectrum',
      title: 'What a planet\'s spectrum is made of',
      widget: { type: 'planetspectrum' },
      scene: [goto('saturn'), rate(1)],
      body: [
        p('Point a spectrograph at Saturn, behind the panel, and the first thing you see is the Sun. All of Fraunhofer\'s lines are there — H and K, the D lines, the Balmer series — at exactly their solar strengths, because a planet in visible light is a mirror, and a mirror does not edit the light it returns. This was understood early: in the 1860s William Huggins and Angelo Secchi used the presence of the solar lines in the spectra of the Moon and planets as the proof that they shine by reflection, and the <em>absence</em> of them in the spectra of nebulae as the first hint that nebulae are something else entirely.'),
        p('On top of the borrowed spectrum each planet writes its own signature in two ways. First, its surface or atmosphere reflects some wavelengths better than others — that is simply its colour. Mars is red because iron oxides absorb blue; Earth\'s oceans and air scatter blue; the ice of Enceladus reflects everything. Second, if the planet has an atmosphere, the sunlight passes through it twice, down and back up, and the molecules absorb at their characteristic wavelengths. Jupiter and Saturn show a set of deep bands at 619, 727, 790 and especially 890 nm that puzzled observers for decades until Rupert Wildt identified them in 1932 as <em>methane</em>; Venus shows carbon dioxide; the Earth, seen from afar, shows the oxygen A-band at 760 nm, water vapour, and a sudden rise in reflectivity beyond 700 nm — the "red edge" of chlorophyll, the most conspicuous sign of life on the only planet known to have it.'),
        p('The widget assembles a planet\'s spectrum from these parts: the solar spectrum, multiplied by the planet\'s reflectivity curve with its molecular bands, plus — switch to the infrared — the planet\'s <em>own</em> thermal emission, a Planck curve (Section 3.4) at a temperature of a few hundred kelvin or less. Notice where the two cross. In the visible every planet is a reflector; beyond about 4 µm Jupiter and Saturn, and beyond 3 µm Venus, radiate more than they reflect. Jupiter in fact emits 1.7 times the power it receives from the Sun, the leftover heat of its formation leaking out; that single number is the first clue that giant planets and the faintest stars form one continuous family, which Step 7 and Section 8.2 pursue.'),
        compare(
          { title: 'A star\'s spectrum', items: ['Continuum from its own hot photosphere', 'Absorption lines formed in its own atmosphere', 'Line pattern set by its temperature (this section)', 'Peak wavelength from Wien\'s law: visible for most stars'] },
          { title: 'A planet\'s spectrum', items: ['Reflected sunlight: the solar lines copied unchanged', 'Extra molecular bands from the planet\'s atmosphere', 'Colour from surface and atmospheric scattering', 'Thermal emission of its own in the infrared, peaking at 10–100 µm'] },
        ),
        note('Exoplanet spectroscopy (Section 7.4) is this step at a distance of light-years. During a transit, starlight filtered through the planet\'s atmosphere carries the planet\'s molecular bands; at secondary eclipse the planet\'s thermal emission disappears behind the star and can be measured by subtraction. JWST has recorded water, carbon dioxide, methane and sulphur dioxide in exoplanet atmospheres by exactly the two mechanisms the widget shows.', 'Across the light-years'),
      ],
    },
    {
      id: 'boltzmann-levels',
      kicker: 'Interactive · ingredient one',
      title: 'Boltzmann: which level is an atom in?',
      widget: { type: 'boltzmann' },
      scene: [goto('Sirius', 'star'), rate(1)],
      body: [
        p('A Balmer absorption line is made when a hydrogen atom <em>already sitting in the second energy level</em> absorbs a photon and jumps higher. An atom in the ground state cannot do it; the photon energies that would lift it from n = 1 lie in the ultraviolet Lyman series. So the strength of the Balmer lines is not proportional to the amount of hydrogen but to the amount of hydrogen in level 2 — and that is a question of temperature.'),
        p('In a gas at temperature T, atoms are constantly knocked up and down their energy ladders by collisions. Statistical mechanics gives the resulting steady state: the ratio of the number of atoms in two levels depends only on the energy difference between them compared with the typical thermal energy kT, and on how many distinct quantum states each level contains (its <em>statistical weight</em> g). This is the Boltzmann equation. Its exponential is unforgiving: at the Sun\'s photospheric temperature, kT is about half an electron-volt, while the gap from n = 1 to n = 2 in hydrogen is 10.2 eV. Only one atom in a hundred million is in level 2. The Sun\'s Balmer lines are made by that tiny minority.'),
        eq('\\frac{N_b}{N_a} = \\frac{g_b}{g_a}\\,e^{-(E_b - E_a)/kT}', 'The Boltzmann equation. For hydrogen g_n = 2n², so g₂/g₁ = 4; the exponential wins by many orders of magnitude at any stellar temperature. The widget plots the populations of the first few levels as bars and the ratio N₂/N₁ against T.', 'Boltzmann'),
        p('Raise the temperature in the widget and watch level 2 fill. At 10 000 K — Sirius, behind the panel, is close to this — N₂/N₁ has climbed to about 3 × 10⁻⁵, three hundred times the solar value; at 20 000 K it is 1 × 10⁻², and the curve is still rising steeply. If Boltzmann were the whole story, the Balmer lines would simply keep strengthening with temperature and O stars would have the darkest hydrogen lines in the sky. They have almost none. Something else must be removing the hydrogen atoms faster than heat can excite them.'),
        example('At what temperature are there as many hydrogen atoms in n = 2 as in n = 1? Set N₂/N₁ = 1: 4 exp(−10.2 eV/kT) = 1, so kT = 10.2 eV / ln 4 = 7.36 eV, T ≈ 85 000 K. No normal stellar photosphere is that hot — and as the next step shows, hydrogen would not survive as neutral atoms long before reaching it.', 'A temperature that stars never reach'),
      ],
    },
    {
      id: 'saha-ionization',
      kicker: 'Interactive · ingredient two',
      title: 'Saha: is the atom still an atom?',
      widget: { type: 'saha' },
      scene: [goto('Rigel', 'star'), rate(1)],
      body: [
        p('The missing piece is ionisation. A sufficiently energetic collision, or a photon, can remove an electron altogether; the atom becomes an ion, with a different and usually much sparser set of spectral lines, and the free electron joins a gas of electrons that is itself trying to recombine with ions. In 1920 the Indian physicist Meghnad Saha applied the same statistical reasoning as Boltzmann to this balance between ionisation and recombination and obtained the equation that bears his name. It is the equation that made the spectral sequence a thermometer.'),
        eq('\\frac{N_{i+1}}{N_i} = \\frac{2\\,Z_{i+1}}{n_e\\,Z_i}\\left(\\frac{2\\pi m_e kT}{h^2}\\right)^{3/2} e^{-\\chi_i/kT}', 'The Saha equation. χ_i is the ionisation energy (13.6 eV for hydrogen), Z the partition functions (sums over the levels of each stage, weighted by Boltzmann factors), n_e the free-electron density. Higher T pushes toward ionisation; higher electron density pushes back, because recombination needs an electron to catch.', 'Saha'),
        p('Two features of the equation shape the whole of stellar spectroscopy. First, it is sharp: because of the exponential combined with the T^{3/2} factor, an element goes from almost wholly neutral to almost wholly ionised over a temperature range of only a few thousand kelvin. For hydrogen in a stellar atmosphere the transition sits near 10 000 K: half the hydrogen is ionised at about 9 600 K, 95 per cent by 11 000 K. Second, it depends on the electron density. A tenuous atmosphere, where electrons are scarce, ionises at a <em>lower</em> temperature than a dense one — which is why, as Section 8.2 will show, a giant star and a dwarf star of the same temperature do not have the same spectrum.'),
        p('In the widget choose an element and an electron pressure and watch the ionisation fraction switch on. Calcium, with an ionisation energy of only 6.1 eV, is already mostly Ca II at the Sun\'s temperature — which is why the Sun\'s strongest lines belong to ionised calcium, and why those lines fade in A stars, where calcium goes on to lose a second electron. Helium needs 24.6 eV and stays neutral until the B stars; its ionised lines mark the O stars, where Rigel\'s neighbours in Orion, behind the panel, live. Every boundary in Cannon\'s sequence is a Saha transition for some element.'),
        history('Saha, working in Calcutta with few resources and no spectroscope of his own, published the theory in the <em>Philosophical Magazine</em> in 1920 and applied it at once to the Harvard sequence, correctly placing the classes in temperature order and predicting where each element\'s lines should appear and disappear. Ralph Fowler and E. A. Milne refined the method in 1923–24; Cecilia Payne used it in 1925 to show that all stars have essentially the same composition and that hydrogen is overwhelmingly the most abundant element — a result so contrary to expectation that she was persuaded to call it "almost certainly not real" in her own thesis. Within four years it was accepted.', 'From Calcutta to the composition of the stars'),
      ],
    },
    {
      id: 'balmer-peak',
      kicker: 'Interactive · the two combined',
      title: 'Why the hydrogen lines peak at A0',
      widget: { type: 'balmerpeak' },
      scene: [goto('Altair', 'star'), rate(1)],
      body: [
        p('Now put the two ingredients together. The number of hydrogen atoms able to absorb a Balmer line is the number of <em>neutral</em> atoms (Saha) times the fraction of those that are in level 2 (Boltzmann). The first factor falls off a cliff above 10 000 K; the second climbs steeply with temperature throughout. Their product rises, peaks, and falls — and the peak sits at about 9 900 K, almost exactly the temperature of an A0 star. The Balmer-line maximum that Pickering used as the anchor of his classification is the point where the gas is hot enough to populate level 2 but not yet hot enough to strip the electrons away.'),
        eq('\\frac{N_2}{N_{\\rm total}} = \\left(\\frac{N_2}{N_1 + N_2}\\right)\\left(\\frac{N_{\\rm I}}{N_{\\rm I} + N_{\\rm II}}\\right)', 'The fraction of all hydrogen that can absorb a Balmer photon. The first bracket is Boltzmann (ignoring the tiny populations of n ≥ 3), the second is Saha. Even at the peak only about one hydrogen atom in 200 000 is in level 2 — enough, because there is so much hydrogen.'),
        p('The widget draws both factors and their product against temperature, with the Harvard classes marked along the top. Move the electron-pressure slider: a lower pressure shifts the Saha cliff to lower temperature and the peak slides with it, slightly cooler. The same logic, with different ionisation energies and level spacings, places every line in the sequence. Neutral helium lines peak at B2 (22 000 K); ionised calcium peaks at K0 and vanishes by F0; neutral iron lines strengthen all the way down to the K stars; titanium oxide can only survive as a molecule below about 4 000 K, so its bands define class M. Cannon\'s letters are a table of Saha–Boltzmann maxima, one per element.'),
        think('Altair, behind the panel, is an A7 star rotating so fast — about 290 km/s at the equator — that it is visibly flattened and its poles are some 1 500 K hotter than its equator. Its spectral lines are broad, smeared by the Doppler shifts of the approaching and receding limbs. Which parts of this section\'s argument are unaffected by rotation, and which measurement (line strength, line width, line position) would you distrust? This is the kind of "other influence" that a careful classifier learns to recognise and set aside — not a failure of the physics, but an extra parameter.'),
      ],
    },
    {
      id: 'cool-end',
      kicker: 'Interactive · beyond M',
      title: 'Molecules, brown dwarfs and the planets again',
      widget: { type: 'coolspectra' },
      scene: [goto('Proxima Centauri', 'star'), rate(1)],
      body: [
        p('Below about 4 000 K the photosphere is cool enough for atoms to stay bound together, and the spectrum stops being a set of lines and becomes a set of <em>bands</em>: a molecule has vibrational and rotational levels packed between its electronic ones, so a single electronic transition fans out into hundreds of closely spaced lines that blend into a broad trough. Titanium oxide and vanadium oxide bands cut the red spectrum of an M star like Proxima, behind the panel, into a saw-tooth; the continuum is scarcely recognisable. The Sun has a few molecules too — the CH band at 430 nm, faint CN — in its cooler sunspots and upper photosphere.'),
        p('Keep cooling and even the oxides condense out into dust grains. Below about 2 400 K the TiO bands weaken and vanish, replaced by metal hydrides (FeH, CrH) and enormously broadened lines of neutral sodium and potassium: this is class <b>L</b>, defined in 1999 when the 2MASS and DENIS infrared surveys began to find objects fainter and redder than any M dwarf. Below 1 300 K methane appears — the same molecule, with the same bands, that Wildt found in Jupiter — and water vapour dominates the infrared: class <b>T</b>, whose prototype Gliese 229 B was imaged in 1995. Below about 500 K ammonia joins in: class <b>Y</b>, whose coolest member, WISE 0855−0714 at about 250 K, is colder than a summer day on Earth and was found in 2014.'),
        p('Most of these objects are <em>brown dwarfs</em>: bodies of 13 to 80 Jupiter masses that formed like stars but never grew massive enough to sustain hydrogen fusion, and have been cooling ever since. Their spectral class is therefore a function of age as well as mass — a 0.05 M☉ brown dwarf is an L dwarf at 100 million years and a T dwarf at a few billion. And at the bottom of the sequence the brown dwarfs meet the planets. Jupiter, at 125 K with methane and ammonia bands, would be classified as a late Y dwarf if it shone by its own light; in the infrared, where its own heat dominates (Step 3), it very nearly does. The widget lines up an M dwarf, an L, a T, a Y and Jupiter: the same sequence of absorbers appears in order, and Jupiter is simply its last entry.'),
        terms(
          ['Molecular band', 'An absorption feature made of many blended rotational–vibrational lines of one electronic transition; sharp on one side (the band head), fading on the other.'],
          ['Brown dwarf', 'An object between ~13 and ~80 Jupiter masses: too light to fuse hydrogen steadily, massive enough to fuse deuterium briefly. Cools through M, L, T and Y with age.'],
          ['L, T, Y classes', 'Extensions of the Harvard sequence below M, defined in 1999 (L, T) and 2011 (Y) from infrared surveys; marked by hydrides and alkalis (L), methane (T), ammonia (Y).'],
          ['Condensation', 'Below ~2 000 K refractory molecules form dust grains, removing their bands from the spectrum and veiling the continuum — the main reason L spectra differ from M.'],
        ),
        key('Temperature decides what can exist in a photosphere: ions, atoms, molecules or dust, in that order as the gas cools. The spectral sequence from O to Y — and on to Jupiter — is a single tour down that ladder.'),
      ],
    },
    {
      id: 'lines-summary',
      kicker: 'Summary',
      title: 'Spectral lines in brief',
      scene: [backdrop()],
      body: [
        summary(
          'Harvard (Pickering, Fleming, Maury, Cannon) sorted stellar spectra by hydrogen-line strength and arrived at O B A F G K M — later understood as a temperature sequence from 40 000 K to 2 500 K, extended to L, T and Y.',
          'A line\'s strength measures the number of atoms in the right ionisation stage and energy level, not the element\'s abundance: in the Sun, Ca II H and K outdo the Balmer lines despite calcium being 500 000 times rarer.',
          'Boltzmann: N_b/N_a = (g_b/g_a) e^{−ΔE/kT}. Only ~1 in 10⁸ solar hydrogen atoms is in n = 2.',
          'Saha: N_{i+1}/N_i ∝ (T^{3/2}/n_e) e^{−χ/kT}. Ionisation switches on over a few thousand kelvin; lower electron density ionises sooner.',
          'Their product puts the Balmer maximum at ~9 900 K (A0). Each element\'s lines peak where it is just hot enough to excite and not yet hot enough to ionise.',
          'Below 4 000 K molecules (TiO, VO), then dust, hydrides, methane and ammonia take over; brown dwarfs cool through M → L → T → Y, and Jupiter is the sequence\'s last entry.',
          'Planets reflect the solar spectrum with its lines intact, add their own molecular bands, and emit thermally in the infrared.',
        ),
        key('Two equations — Boltzmann and Saha — turned a filing system into physics. With them a spectrum read in a few minutes gives a star\'s temperature to a few per cent; Section 8.2 shows what happens when that temperature is plotted against luminosity.'),
      ],
    },
  ],
};

const S8_2: Section = {
  id: 'hr-diagram',
  number: '8.2',
  title: 'The Hertzsprung–Russell Diagram',
  summary: 'Plot luminosity against temperature for a few hundred stars and the points refuse to scatter: a diagonal main sequence, a clump of giants, a sprinkling of white dwarfs. Why the diagram has that shape, how mass runs along the main sequence, where the planets would fall, how the width of a line reveals a star\'s size, and how the whole thing becomes a distance indicator.',
  minutes: 30,
  steps: [
    {
      id: 'two-astronomers',
      kicker: 'Interactive · the diagram appears',
      title: 'Hertzsprung, Russell, and a plot that would not scatter',
      widget: { type: 'hrbuild' },
      scene: [goto('Alcyone', 'star'), rate(1)],
      body: [
        p('Around 1905 the Danish chemist-turned-astronomer Ejnar Hertzsprung, working with Maury\'s "c" stars — the ones with unusually narrow lines — noticed that they had vanishingly small proper motions and were therefore far away and intrinsically very bright, while other stars of the same colour were nearby and faint. The same colour, two wildly different luminosities: there had to be two kinds of red star. By 1911 he had plotted colour against apparent magnitude for the Pleiades (Alcyone, their brightest member, is behind the panel) and the Hyades — clusters whose stars all lie at the same distance, so that apparent magnitude stands in for luminosity — and found that the points fell along a narrow band.'),
        p('Independently, at Princeton, Henry Norris Russell gathered every star with a measured parallax, converted apparent to absolute magnitude, and in 1913 plotted absolute magnitude against Harvard spectral class. His diagram showed the same band running from bright blue to faint red — he called its stars <em>dwarfs</em> — and a second group of bright red stars above it, the <em>giants</em>. Russell published first and with the larger sample; the Dutch astronomer Bengt Strömgren named it the Hertzsprung–Russell diagram in 1933. The widget rebuilds it. Press play and watch the stars accumulate; switch the horizontal axis between spectral class, colour index and temperature and the vertical between absolute magnitude and luminosity — the shape never changes, because they are all the same two physical quantities in different clothes.'),
        p('What the shape says is this. If a star could have any luminosity at any temperature, the diagram would be a uniform cloud. It is not: some 85 to 90 per cent of stars fall on the diagonal <b>main sequence</b>, a few per cent form the giant branch at the upper right, a sparse scattering of supergiants runs across the top, and a tail of faint hot stars — the <b>white dwarfs</b>, first recognised when Sirius B turned out to be an A star ten thousand times too faint — sits at the lower left. Stars, evidently, are not free to be anything; a star of a given temperature can have only a few possible luminosities. Explaining why occupies the rest of this course. Here we read the map.'),
        timeline([
          { when: '1905–07', title: 'Hertzsprung: two kinds of red star', text: 'Narrow-lined (Maury "c") red stars are distant and luminous; broad-lined ones are near and faint. Published in an obscure photography journal and ignored.' },
          { when: '1911', title: 'Cluster colour–magnitude diagrams', text: 'Hertzsprung plots the Pleiades and Hyades; a narrow sequence appears because all members share one distance.' },
          { when: '1913', title: 'Russell\'s diagram', text: 'Absolute magnitude against spectral class for parallax stars, shown at the Royal Astronomical Society; dwarfs and giants named.' },
          { when: '1914–24', title: 'Eddington', text: 'Shows that main-sequence luminosity is set by mass; the mass–luminosity relation of Section 7.2 explains the main sequence as a mass sequence.' },
          { when: '1943', title: 'MK luminosity classes', text: 'Morgan, Keenan and Kellman add a second coordinate to spectral classification (Step 5).' },
        ]),
      ],
    },
    {
      id: 'main-sequence',
      kicker: 'Interactive · the diagonal',
      title: 'The main sequence is a mass sequence',
      widget: { type: 'hrmass' },
      scene: [goto('Spica', 'star'), rate(1)],
      body: [
        p('Run along the main sequence from lower right to upper left and one quantity changes monotonically: mass. The binary-star masses of Chapter 7, plotted against position on the main sequence, show it directly. Red M dwarfs at the bottom have a tenth of a solar mass; the Sun sits in the middle; Spica\'s primary, behind the panel, is a B1 star of eleven solar masses; the O stars at the top reach 50 to 100. Luminosity rises with mass roughly as M^3.5 (Section 7.2), temperature more gently as about M^0.5, and radius as M^0.8 or so — a 10 M☉ star is only about six times the Sun\'s diameter but five thousand times its luminosity. The widget\'s single slider is mass: watch the star slide along the sequence, change colour and size, and read off its properties.'),
        p('Why a <em>sequence</em> at all? Because a main-sequence star is a hydrogen-burning object in equilibrium, and for a given mass and composition there is exactly one structure that balances gravity against pressure while radiating what the core produces. The mass fixes the central temperature and pressure, these fix the fusion rate, and the fusion rate is the luminosity. Composition shifts the sequence slightly — metal-poor stars are a little bluer and brighter — and that small shift is what gives the main sequence its width. The sequence is not a track that stars move along; a star arrives at its place when fusion begins and stays very nearly there until the hydrogen in its core is spent.'),
        eq('\\tau_{\\rm MS} \\approx 10^{10}\\,{\\rm yr}\\;\\frac{M/M_\\odot}{L/L_\\odot} \\approx 10^{10}\\,{\\rm yr}\\,\\left(\\frac{M}{M_\\odot}\\right)^{-2.5}', 'Main-sequence lifetime: fuel ∝ M, consumption rate ∝ L. Spica\'s 11 M☉ primary has perhaps 20 million years; a 0.2 M☉ red dwarf will last a trillion. No M dwarf has yet left the main sequence anywhere in the universe.'),
        p('The lifetime formula explains the census. Massive stars are rare partly because star formation makes few of them and partly because those it makes die quickly; faint red dwarfs make up three quarters of all stars in the Galaxy yet not one is visible to the naked eye. The bright stars behind the panel are a sample biased toward the luminous: of the hundred brightest stars in the sky, not a single one is less massive than the Sun, while of the hundred <em>nearest</em>, more than seventy are M dwarfs.'),
        note('The lower end of the main sequence is at about 0.08 M☉ (75 Jupiter masses), below which the core never gets hot enough for sustained hydrogen fusion and the object is a brown dwarf. The upper end is less sharp — radiation pressure disrupts stars above roughly 150 M☉ — and the most massive stars known, in the R136 cluster of the Large Magellanic Cloud, are near 200 M☉ and probably formed by mergers.', 'The ends of the sequence'),
      ],
    },
    {
      id: 'giants-and-dwarfs',
      kicker: 'Interactive · reading radius off the diagram',
      title: 'Giants, supergiants and white dwarfs: the radius lines',
      widget: { type: 'hrradius' },
      scene: [goto('Betelgeuse', 'star'), rate(1)],
      body: [
        p('The stars off the main sequence are what give the diagram its interpretive power. Luminosity depends on only two things — surface area and surface temperature — through the Stefan–Boltzmann law (Section 3.4). Two stars of the same temperature emit the same power <em>per square metre</em>; if one is ten thousand times more luminous it must have ten thousand times the area, a hundred times the radius. That is Hertzsprung\'s two kinds of red star: the faint ones are dwarfs a little smaller than the Sun, the bright ones are giants tens of solar radii across and supergiants hundreds.'),
        eq('L = 4\\pi R^2 \\sigma T^4 \\qquad\\Longrightarrow\\qquad \\log L = 2\\log R + 4\\log T + {\\rm const}', 'On a log–log H–R diagram lines of constant radius are straight, sloping down to the right. The widget draws them; drag the star anywhere on the diagram and its radius is read off at once — and shown to scale against the Sun.'),
        p('Betelgeuse, behind the panel, is an M2 supergiant: about 3 600 K, cooler than the Sun, but some 100 000 times more luminous, which requires a radius near 900 R☉ — placed at the Sun it would swallow Mars and reach most of the way to Jupiter. At the other corner Sirius B is hotter than Sirius A yet 400 times fainter than the Sun; its radius comes out at 0.008 R☉, roughly the Earth\'s. A solar mass packed into the Earth\'s volume is a million times the density of water, and in 1926 Eddington remarked that the message of the companion of Sirius, when decoded, ran: "I am composed of material 3 000 times denser than anything you have ever come across." White dwarfs were the first objects to show that matter has states not found on Earth.'),
        table(
          ['Region', 'Typical R', 'Typical L', 'What they are'],
          [
            ['Main sequence (dwarfs, V)', '0.1–15 R☉', '10⁻⁴–10⁶ L☉', 'Core hydrogen burning; most stars'],
            ['Subgiants (IV)', '2–5 R☉', '3–30 L☉', 'Core hydrogen exhausted, beginning to expand'],
            ['Giants (III)', '10–100 R☉', '10²–10³ L☉', 'Shell hydrogen or core helium burning'],
            ['Supergiants (I)', '100–1 500 R☉', '10⁴–10⁶ L☉', 'Massive stars in late evolution; rare'],
            ['White dwarfs', '~0.01 R☉', '10⁻⁴–10⁻² L☉', 'Dead cores, no fusion, cooling for ever'],
          ],
          'The H–R diagram\'s neighbourhoods, with the Roman-numeral luminosity classes that Step 5 introduces.',
        ),
        think('Two stars have the same apparent brightness and the same spectral class. One is a giant, one a dwarf. Which is farther away, and by roughly what factor if the giant is 100 times more luminous? Now suppose you could not tell which was which: how large would your distance error be? That problem is exactly what Step 5 was invented to solve.'),
      ],
    },
    {
      id: 'planets-on-hr',
      kicker: 'Interactive · the bottom right corner',
      title: 'Where the planets fall on the diagram',
      widget: { type: 'hrextended' },
      scene: [goto('jupiter'), rate(1)],
      body: [
        p('The H–R diagram is usually drawn to end at the coolest M dwarfs, around 2 500 K and 10⁻⁴ L☉. Nothing in the physics stops there. Any body with a temperature radiates according to Planck\'s law, and any body with a radius has a luminosity L = 4πR²σT⁴ — so Jupiter, behind the panel, has a place on the diagram as surely as Betelgeuse does. Its effective temperature is 125 K; its radius is a tenth of the Sun\'s; its thermal luminosity works out at 8 × 10¹⁷ W, about 2 × 10⁻⁹ L☉. On an extended diagram it lies far below and to the right of the last star, on the same line of constant radius as the brown dwarfs, because a brown dwarf and Jupiter are nearly the same size: above about one Jupiter mass, adding mass compresses the body rather than enlarging it.'),
        p('The widget extends both axes down to the planets. Along the way it passes the brown dwarfs, whose positions drift with time — unlike main-sequence stars they have no fusion to hold them steady, so they slide down and to the right as they cool, and the slider for age moves them. Jupiter itself is on such a track: four and a half billion years ago it was several times more luminous and perhaps 600 K at the surface, a respectable T dwarf. Saturn follows, dimmer and cooler; the Earth, radiating as a 255 K body from the top of its atmosphere, sits at 3 × 10⁻¹⁰ L☉; Venus, hotter in its clouds than the Earth despite its brilliant albedo, is nearby. None of them is a star, but all of them obey the law that draws the radius lines, and the diagram makes that continuity plain.'),
        eq('L_{\\rm Jup} = 4\\pi R_{\\rm Jup}^2 \\sigma T_{\\rm eff}^4 = 4\\pi(7.15\\times10^7\\,{\\rm m})^2\\,\\sigma\\,(125\\,{\\rm K})^4 \\approx 8.9\\times10^{17}\\,{\\rm W}', 'Jupiter\'s own luminosity — about 1.7 times the sunlight it absorbs. The excess is gravitational energy from its continuing slow contraction, a few centimetres a year, exactly the energy source Kelvin and Helmholtz once proposed for the Sun.'),
        p('There is a lesson in the comparison. On the diagram a planet differs from a star only in degree — a lower temperature, a smaller luminosity, the same radius law. What makes the Sun a star and Jupiter a planet is not on the diagram at all: it is mass, which decides whether the core can ignite. The H–R diagram displays the <em>consequences</em> of mass with great clarity and never displays mass itself; the connection between the two is the subject of Chapter 7 behind us and of stellar structure ahead.'),
        note('Directly imaged exoplanets (Section 7.4) are placed on exactly this extended diagram. Young giant planets such as those of HR 8799, a few tens of millions of years old, are still at 800–1 100 K and 10⁻⁵ L☉ — bright enough to photograph next to their star — and their colours and spectra are compared with brown-dwarf cooling tracks to estimate their masses. The planets of other suns are studied with the same diagram as the stars of our own sky.', 'Imaged planets on the diagram'),
      ],
    },
    {
      id: 'mk-classes',
      kicker: 'Interactive · the second coordinate',
      title: 'Morgan–Keenan: luminosity from the width of a line',
      widget: { type: 'luminosityclass' },
      scene: [goto('Deneb', 'star'), rate(1)],
      body: [
        p('Hertzsprung\'s original clue was that Maury\'s narrow-lined stars were the giants, and the reason follows from Section 8.1. A giant and a dwarf of the same spectral class have the same temperature but radically different sizes; the giant\'s gravity at the surface is hundreds or thousands of times weaker, so its atmosphere is far more tenuous. Two consequences. First, with fewer electrons about, the Saha equation ionises each element at a lower temperature, so the ratios of ionised to neutral lines are subtly different. Second, and more visibly, spectral lines are broadened by collisions and by the electric fields of neighbouring charged particles (<em>pressure</em> or <em>Stark broadening</em>); in a dense dwarf atmosphere the hydrogen lines are smeared into broad wings, in a giant\'s they are sharp.'),
        p('In 1943 William Morgan, Philip Keenan and Edith Kellman at Yerkes Observatory turned this into a system: alongside the Harvard temperature class, a Roman-numeral <b>luminosity class</b> from Ia (the most luminous supergiants) through Ib, II, III (giants), IV (subgiants) to V (main sequence, "dwarfs"), each defined by the appearance of specific line ratios and widths on standard spectra. The Sun is G2 V; Deneb, behind the panel, is A2 Ia, an A star like Vega in temperature but 200 000 times the Sun\'s luminosity with hydrogen lines as thin as pencil strokes; Aldebaran is K5 III; Sirius B, a white dwarf, is written DA2, a separate notation. Every star in this program\'s information panel carries an MK type.'),
        p('The widget shows the physics. Choose a temperature class and slide the surface gravity from a supergiant\'s log g ≈ 0 to a dwarf\'s log g ≈ 4.5: the same Balmer line narrows or broadens, the luminosity class changes, and the star moves vertically on the inset H–R diagram. The horizontal coordinate of the diagram is temperature; the MK class supplies the vertical one from the spectrum alone, with no need to know the distance. That last phrase is the point of the next step.'),
        table(
          ['Class', 'Name', 'log g (cgs)', 'Line appearance', 'Examples'],
          [
            ['Ia, Iab, Ib', 'Supergiants', '0–1.5', 'Very narrow H; strong ionised lines', 'Deneb (A2 Ia), Betelgeuse (M2 Iab), Rigel (B8 Ia)'],
            ['II', 'Bright giants', '1.5–2.5', 'Narrow', 'Canopus (A9 II)'],
            ['III', 'Giants', '2–3', 'Moderately narrow; CN, Sr II strong in cool stars', 'Arcturus (K1.5 III), Aldebaran (K5 III), Capella (G8 III)'],
            ['IV', 'Subgiants', '3–4', 'Intermediate', 'Procyon (F5 IV–V), Altair (A7 IV–V)'],
            ['V', 'Dwarfs (main sequence)', '4–5', 'Broad H wings; strong neutral lines', 'Sun (G2 V), Sirius (A1 V), Vega (A0 V), Proxima (M5.5 V)'],
          ],
          'The MK luminosity classes. Surface gravity g = GM/R² is the physical variable; at fixed temperature it tracks radius and hence luminosity.',
        ),
        history('Antonia Maury\'s 1897 catalogue, with its "a, b, c" line-width subdivisions, was the first to encode luminosity in a spectral type. Pickering disliked the complication and the Harvard system dropped it; Hertzsprung wrote to him in 1908 that ignoring the c-stars was "nearly the same thing as if a zoologist, who has detected the deciding differences between a whale and a fish, would continue in classifying them together." Maury\'s insight waited forty-six years for Morgan and Keenan to make it official.', 'The whale and the fish'),
      ],
    },
    {
      id: 'spectroscopic-parallax',
      kicker: 'Interactive · a distance from a spectrum',
      title: 'Spectroscopic parallax: the diagram as a ruler',
      widget: { type: 'specparallax' },
      scene: [goto('Antares', 'star'), rate(1)],
      body: [
        p('Here is the payoff. A star\'s spectrum, classified on the MK system, places it at a definite point on the H–R diagram — and the vertical coordinate of that point is an absolute magnitude. Compare it with the apparent magnitude and the distance modulus (Section 3.2) gives the distance. The method is called <em>spectroscopic parallax</em>, though no parallax is measured; it was, before Gaia, the only way to reach stars beyond a few hundred parsecs individually, and it remains the way to reach them in other galaxies.'),
        eq('m - M_V = 5\\log_{10}\\!\\left(\\frac{d}{10\\,{\\rm pc}}\\right) \\qquad\\Longrightarrow\\qquad d = 10^{(m - M_V + 5)/5}\\ {\\rm pc}', 'The distance modulus with M_V supplied by the MK class. An uncertainty of ±0.5 magnitude in M_V — typical for a careful classification — is an uncertainty of ±25 per cent in distance; the main sequence\'s intrinsic width adds about as much again.'),
        p('In the widget, pick a star, read its spectral type from the (simulated) spectrum, choose the luminosity class, and the distance follows; the catalogue\'s Gaia distance is shown for comparison once you commit. Try Antares, behind the panel: M1.5 with razor-thin lines — class Iab, M_V about −5.3, apparent magnitude 1.0, so a distance near 180 pc, which Gaia confirms within the errors. Now deliberately misclassify it as a dwarf, M_V = +9.5: the distance collapses to 0.2 pc, closer than Proxima, which is absurd. The absurdity is the point. The luminosity class is worth a factor of a thousand in distance, and it is read from the width of a few lines.'),
        p('The method has known failure modes, and a good astronomer lists them before trusting a number. Interstellar dust dims and reddens starlight, making a star look fainter (and therefore farther) and cooler than it is; the correction requires the colour excess, measured by comparing the observed colour index with the one the spectral type demands (Section 3.6). Unresolved binaries are brighter than single stars of their class. Rapid rotators, metal-poor stars and chemically peculiar stars sit off the standard sequences. None of this breaks the method; it bounds it. Spectroscopic parallaxes of individual stars are good to 20–30 per cent, and for clusters, where hundreds of stars can be fitted to the main sequence at once, to a few per cent — the technique that calibrated the Cepheids that calibrated the galaxies.'),
        example('Spica appears at V = 0.98. Its spectrum is B1 with broad lines: class V, for which the calibration gives M_V ≈ −3.6. Then m − M = 4.6, so d = 10^{(4.6+5)/5} = 10^{1.92} ≈ 83 pc. The Hipparcos parallax gives 77 ± 4 pc. Spica is in fact a close binary (Section 7.3) whose companion adds about 0.3 magnitude; correcting for it moves the spectroscopic estimate to 72 pc, within the error either way.', 'Spica by two routes'),
      ],
    },
    {
      id: 'chapter-close',
      kicker: 'Chapter close',
      title: 'The classification of stellar spectra in one page',
      scene: [backdrop()],
      body: [
        summary(
          'The Harvard sequence O B A F G K M (+ L T Y) is a temperature sequence, found empirically by Cannon and explained by Saha and Boltzmann: each element\'s lines peak where it is excited but not yet ionised; the Balmer peak at A0 (~9 900 K) anchors the scheme.',
          'Line strength measures atoms in the right state, not abundance; the Sun\'s strongest visible lines are from ionised calcium, half a million times rarer than hydrogen.',
          'Planets reflect the solar spectrum with its lines intact, add their own molecular bands (CH₄ on Jupiter and Saturn, CO₂ on Venus, O₂ and the red edge on Earth) and emit their own heat in the infrared; Jupiter radiates 1.7× what it receives.',
          'The H–R diagram (Hertzsprung 1911, Russell 1913) plots L against T: ~90 % of stars on a main sequence that is a mass sequence (L ∝ M^3.5, τ ∝ M^−2.5), with giants, supergiants and white dwarfs set apart by radius (L = 4πR²σT⁴).',
          'Extended downward, the diagram reaches brown dwarfs and the planets along the same radius lines; what separates a star from a planet is mass, which the diagram shows only indirectly.',
          'MK luminosity classes Ia–V read surface gravity from line widths and ratios (pressure broadening, Saha at lower n_e), giving a second coordinate from the spectrum alone.',
          'Spectroscopic parallax: MK type → M_V, with m → distance; good to ~25 % per star, a few per cent for clusters; beware reddening, binaries and peculiar stars.',
        ),
        key('Chapter 8 is where a star stops being a point of light and becomes a physical object with a temperature, a size and — by inference — a mass and an age. Every later chapter on stellar structure and evolution is an attempt to explain the H–R diagram: why the main sequence is where it is, why giants exist, why white dwarfs are left behind. Keep the diagram in mind as the map on which all of that will be drawn.'),
        { kind: 'callout', tone: 'think', title: 'Critical interpretation', html: 'The spectral sequence and the H–R diagram are models, and it is fair to ask what they leave out. They do: rotation (Altair), magnetic activity, binarity (Spica), metallicity, interstellar reddening and departures from thermal equilibrium in tenuous atmospheres all displace a star from its textbook position, and a classifier who ignores them will misjudge a temperature or a distance. But notice the form of each exception: it is an <em>additional parameter</em> acting on top of the Saha–Boltzmann physics, not a rival to it. The same equations describe the plasma in a laboratory arc and the ionosphere of the Earth; their predictions for stellar line strengths have been tested against tens of millions of spectra. The diagram\'s "simplification" is likewise its strength — it reduces a star to the two quantities, luminosity and temperature, that are both measurable and physically decisive, and then invites every other parameter to explain the residuals. A fair critique therefore targets specific calibrations (the M_V of a given MK class, the temperature scale of M dwarfs, the treatment of convection in model atmospheres), where real revisions continue, rather than the framework. Popular cosmology texts are not the place to look for these; the technical literature of model atmospheres is.' },
        { kind: 'callout', tone: 'history', title: 'Suggested reading', html: 'Carroll & Ostlie, <em>An Introduction to Modern Astrophysics</em>, Chapter 8, which this chapter follows; D. F. Gray, <em>The Observation and Analysis of Stellar Photospheres</em> (3rd ed., 2005) for line formation in depth; R. O. Gray & C. J. Corbally, <em>Stellar Spectral Classification</em> (2009) for the MK system and its standards; C. Payne, <em>Stellar Atmospheres</em> (1925), the thesis that applied Saha to the sequence; D. Sobel, <em>The Glass Universe</em> (2016) on Fleming, Maury, Cannon and Payne; J. D. Kirkpatrick\'s 2005 review of the L and T dwarfs. The Gaia colour–magnitude diagram of two billion stars is the modern H–R diagram and can be browsed online.' },
        { kind: 'callout', tone: 'think', title: 'Problems to try', html: '(1) Find the temperature at which N₂/N₁ for hydrogen equals 10⁻², 10⁻⁴ and 10⁻⁶. (2) Using the Saha equation with n_e = 10²⁰ m⁻³, find the temperature at which hydrogen is 50 % ionised; repeat for n_e = 10¹⁸ m⁻³ and comment on giants versus dwarfs. (3) Show that the fraction of hydrogen in n = 2 peaks near 9 900 K for P_e = 20 N m⁻² and find the peak value. (4) Calcium has χ = 6.11 eV and partition functions Z_I = 1.32, Z_II = 2.30 at 5 800 K. Find Ca II/Ca I in the solar photosphere (n_e ≈ 1.9 × 10¹⁹ m⁻³) and compare with hydrogen; then compare the number of Ca II ions in the ground state with the number of H atoms in n = 2, given N(Ca)/N(H) = 2 × 10⁻⁶. (5) Jupiter: T_eff = 124 K, R = 7.15 × 10⁷ m. Compute its luminosity, its absorbed solar power (albedo 0.34, a = 5.2 AU) and their ratio; place it on an L–T diagram with the Sun and a 0.08 M☉ star (T = 2 500 K, R = 0.1 R☉). (6) Betelgeuse: T = 3 600 K, L = 1.2 × 10⁵ L☉. Find R in solar units and in AU. Sirius B: T = 25 000 K, L = 0.026 L☉; find R and the mean density for M = 1.0 M☉. (7) Deneb is A2 Ia with V = 1.25 and M_V ≈ −8.4; find its spectroscopic-parallax distance and compare with its Gaia distance of ~800 pc (strongly uncertain). What interstellar extinction A_V would reconcile a 10 % discrepancy? (8) A star is classified K0 and has V = 8.0. Compute its distance if it is a dwarf (M_V = +5.9) and if it is a giant (M_V = +0.7). What single extra measurement would decide? (9) Explain, using the Saha equation, why the Ca II H and K lines are strongest in K0 stars rather than in the Sun or in A stars.' },
      ],
    },
  ],
};

/* =============================================================== chapter 9 ===== */

const S9_1: Section = {
  id: 'radiation-field',
  number: '9.1',
  title: 'The Description of the Radiation Field',
  summary: 'Everything we know about a star arrives as light from its outermost layers. Before that light can be read, it has to be described: the specific intensity of a pencil of rays, its average over directions, the energy it stores in a cubic metre of gas, the net flow through a surface, and the push it exerts on matter.',
  minutes: 24,
  steps: [
    {
      id: 'specific-intensity',
      kicker: 'Interactive · the basic quantity',
      title: 'Specific intensity: light described one ray at a time',
      widget: { type: 'intensity' },
      scene: [goto('sun'), rate(1)],
      body: [
        p('A star\'s energy is made deep inside — by fusion, by slow contraction, by the cooling of a dead core — but none of that light reaches us directly. Every photon we receive was emitted, for the last time, by gas in the thin outer skin we call the <b>atmosphere</b>: the layers from which radiation can escape to space. Chapters 3, 5 and 8 drew conclusions from that light. This chapter asks how the light and the gas are coupled — how the atmosphere\'s temperature, density and composition shape the spectrum that leaves it — and the first step is simply to find the right words for "how much light".'),
        p('Brightness is not one number. Light at a point in a gas arrives from every direction, at every wavelength, and the quantity that captures all of it is the <b>specific intensity</b> I_λ: the energy per second, per unit wavelength interval, crossing a unit area perpendicular to a chosen direction, within a small cone of solid angle dΩ around that direction. The units — W m⁻² m⁻¹ sr⁻¹ — look forbidding, but the idea is just "the brightness of the sky in one direction at one colour". Point a telescope at the centre of the Sun\'s disc, behind the panel, and what you measure per pixel is I_λ.'),
        eq('E_\\lambda\\,d\\lambda = I_\\lambda\\,d\\lambda\\,dt\\,dA\\cos\\theta\\,d\\Omega', 'The defining relation. θ is the angle between the ray and the normal to dA; cos θ corrects for the foreshortened area the ray actually crosses. For a blackbody I_λ = B_λ(T), the Planck function of Section 3.4.'),
        p('Intensity has a property that makes it the natural currency of astrophysics: in empty space it does not change along a ray. Move away from the Sun and the disc shrinks, so you collect less total energy — but each square arcsecond of the disc is exactly as bright as before, because the number of photons per steradian and the solid angle per pixel fall together. The widget shows an observer backing away from a star: the <em>flux</em> drops as 1/r² while the <em>intensity</em> of the resolved disc stays fixed, until the disc becomes smaller than a pixel and the two notions merge. This is why a resolved object — the Sun, a planet, a nebula — is described by its intensity, and an unresolved star by its flux.'),
        key('Specific intensity is constant along a ray in vacuum. That is the reason surface brightness does not depend on distance, the reason the Sun looks the same brightness per unit area from Mercury and from Neptune, and the reason the transfer equation of Section 9.4 only has terms for emission and absorption — never for geometry.'),
      ],
    },
    {
      id: 'mean-intensity',
      kicker: 'Interactive · averaging over directions',
      title: 'Mean intensity and the shape of the radiation field',
      widget: { type: 'meanintensity' },
      scene: [goto('Arcturus', 'star'), rate(1)],
      body: [
        p('Deep inside a star the radiation is the same in every direction — <em>isotropic</em> — because every direction looks into gas of nearly the same temperature. Near the surface it is not: looking down you see hot, bright gas, looking up you see cold, empty space. The simplest summary of the field at a point is the <b>mean intensity</b>, the average of I_λ over all 4π steradians. For an isotropic field the average is just I_λ; for a blackbody cavity it is B_λ(T).'),
        eq('\\langle I_\\lambda\\rangle = \\frac{1}{4\\pi}\\int I_\\lambda\\,d\\Omega = \\frac{1}{4\\pi}\\int_0^{2\\pi}\\!\\!\\int_0^{\\pi} I_\\lambda \\sin\\theta\\,d\\theta\\,d\\phi', 'The mean intensity, written J_λ in much of the literature. It is the quantity that matters for heating a gas or exciting its atoms, because an atom does not care which direction a photon came from.'),
        p('The widget draws the intensity as a polar diagram — the length of each spoke is I in that direction — at a point whose depth you choose. Deep down the figure is a circle. Rise toward the surface and the upper half shrinks: fewer photons arrive from above. At the very top the field is a half-sphere of light from below and darkness above, and the mean intensity has fallen to less than half the Planck function at the effective temperature — a result Section 9.4 will derive. Arcturus, behind the panel, is a K giant whose atmosphere is so extended and tenuous that this anisotropic surface layer is a substantial fraction of its radius; for the Sun it is a few hundred kilometres thick, a thousandth of a per cent.'),
        note('Averaging I_λ over wavelength as well as direction gives the total mean intensity ⟨I⟩; for a blackbody ⟨I⟩ = σT⁴/π. Every "specific" quantity in this section (I_λ, ⟨I_λ⟩, u_λ, F_λ, P_rad,λ) has a total counterpart obtained by integrating over λ, and the blackbody value of each is a simple power of T.', 'Specific and total'),
      ],
    },
    {
      id: 'energy-density-flux',
      kicker: 'Interactive · storing and moving energy',
      title: 'Energy density and radiative flux',
      widget: { type: 'fluxcos' },
      scene: [goto('earth'), rate(1)],
      body: [
        p('Two further quantities follow from the intensity by integration. The <b>specific energy density</b> u_λ is the energy of radiation stored per cubic metre per unit wavelength — light in transit, counted while it is passing through. A photon moving at c spends a time dL/c crossing a length dL, so the energy present in a volume is the energy flow divided by c, summed over directions: u_λ = (4π/c)⟨I_λ⟩. For a blackbody the total energy density is u = aT⁴ with a = 4σ/c = 7.566 × 10⁻¹⁶ J m⁻³ K⁻⁴. At the centre of the Sun, 1.5 × 10⁷ K, that is 4 × 10¹³ J m⁻³ — about the energy of a litre of petrol in every cubic centimetre, stored as light.'),
        p('The <b>specific radiative flux</b> F_λ is the <em>net</em> energy per second crossing a unit area, counting rays going one way as positive and the other way as negative. Here the cos θ factor is essential: a ray at a grazing angle carries little energy through the surface, and a ray going back down subtracts. The widget integrates I cos θ over the sphere for a field you shape: for an isotropic field the up and down halves cancel exactly and the flux is zero however intense the light; for a field that is bright below and dark above, the net flow is upward; for the surface of a star, where I = B below and 0 above, the flux is πB_λ.'),
        eq('F_\\lambda = \\int I_\\lambda \\cos\\theta\\,d\\Omega \\qquad u_\\lambda = \\frac{4\\pi}{c}\\langle I_\\lambda\\rangle \\qquad F_{\\rm surf} = \\pi\\int B_\\lambda\\,d\\lambda = \\sigma T^4', 'Flux, energy density, and the surface flux of a blackbody — which is where the Stefan–Boltzmann law comes from. L = 4πR²σT⁴ is just this flux times the surface area.'),
        p('Flux is what an unresolved star delivers. The Earth, behind the panel, intercepts the Sun\'s flux at 1 AU — 1 361 W m⁻², the solar constant — and that single number times the area of a sphere of radius 1 AU is the Sun\'s luminosity. The Sun\'s surface flux is the same luminosity spread over the Sun\'s own area, 6.3 × 10⁷ W m⁻², from which T_eff = 5 772 K. Intensity does not change with distance; flux falls as the inverse square; the two are related, for a star of angular radius α, by F = π I sin²α — the geometric fact that unites Section 3.2\'s magnitudes with this section\'s intensities.'),
        think('Inside a star at radius r the radiation is <em>almost</em> isotropic: the outward intensity exceeds the inward by one part in 10¹⁰ or so. Yet the net flux through a sphere at r must carry the whole luminosity. How can a tiny anisotropy move 4 × 10²⁶ W? (Hint: compare σT⁴ at 10⁷ K with the Sun\'s surface flux.) This is why the deep interior can be treated as a blackbody to high precision and still have an energy current flowing through it.'),
      ],
    },
    {
      id: 'radiation-pressure',
      kicker: 'Interactive · light pushes',
      title: 'Radiation pressure: from comet tails to supergiants',
      widget: { type: 'radpressure' },
      scene: [goto('halley'), rate(1)],
      body: [
        p('A photon of energy E carries momentum E/c (Section 5.2). A gas bathed in radiation therefore feels a pressure, exactly as it feels the pressure of its own atoms\' momenta: the rate at which photon momentum is transported across a unit area, per unit solid angle, integrated with a factor cos²θ — one cosine for the projected area, one for the component of momentum normal to the surface. For an isotropic field the result is one third of the energy density, just as for an ideal gas of particles moving at c.'),
        eq('P_{\\rm rad} = \\frac{1}{c}\\int I\\cos^2\\theta\\,d\\Omega = \\frac{4\\pi}{3c}\\langle I\\rangle = \\frac{1}{3}u = \\frac{1}{3}aT^4', 'Radiation pressure of an isotropic field. At the solar centre it is 1.3 × 10¹³ Pa — enormous, yet only 0.06 % of the gas pressure there. At the centre of a 60 M☉ star the two are comparable.'),
        p('In the solar system radiation pressure is small but never negligible. At 1 AU the Sun\'s light exerts 4.6 µPa on a perfectly absorbing surface, twice that on a mirror; on a square kilometre of sail that is ten newtons, enough to drive the <em>IKAROS</em> and <em>LightSail</em> spacecraft. On a dust grain a micrometre across the force rivals the Sun\'s gravity on it, because both fall as 1/r² while one scales with the grain\'s area and the other with its volume: dust released by a comet is swept straight out into the curved <em>dust tail</em>, the broad yellow plume of Halley behind the panel, while the ion tail is blown by the solar wind. The widget balances the two forces: change the grain size and watch which wins, then move the "star" up the main sequence and watch radiation take over in the atmosphere of the star itself.'),
        p('That last regime is where this chapter is heading. In a hot, luminous star the outward flux is so large that the pressure of light on the gas competes with gravity. The ratio of radiation to gas pressure in a star\'s interior grows roughly as its mass squared; by 100 M☉ the two are equal, and above that the star cannot hold itself together — the <em>Eddington limit</em>, which sets the upper end of the main sequence and powers the winds of O stars and the outbursts of luminous blue variables. Radiation is not only the messenger from the atmosphere; in the biggest stars it is a structural force.'),
        example('Force of sunlight on a black sphere of radius s at distance r: F_rad = (L/4πr²c) πs². Gravity: F_g = GM m/r² with m = (4/3)πs³ρ. The ratio F_rad/F_g = 3L/(16πGMc ρ s) is independent of r. For ρ = 2 000 kg m⁻³ the two are equal at s = 0.6 µm: smaller grains are expelled from the solar system outright, whatever their orbit. This is why the zodiacal dust must be continually resupplied by comets and asteroid collisions.', 'The critical grain'),
      ],
    },
    {
      id: 'field-summary',
      kicker: 'Summary',
      title: 'The radiation field in brief',
      scene: [backdrop()],
      body: [
        summary(
          'Starlight comes from the atmosphere, the thin outer layers from which photons can escape; reading it requires describing light at a point in a gas.',
          'Specific intensity I_λ: energy per time, area, wavelength and solid angle in a direction; constant along a ray in vacuum, so resolved sources keep their surface brightness at any distance. Blackbody: I_λ = B_λ(T).',
          'Mean intensity ⟨I_λ⟩ = (1/4π)∫I_λ dΩ: the directional average, which governs heating and excitation. Isotropic deep inside a star; well below the Planck value at T_eff at the surface.',
          'Energy density u_λ = (4π/c)⟨I_λ⟩; blackbody u = aT⁴. Flux F_λ = ∫I_λ cos θ dΩ: the net flow, zero for an isotropic field, πB_λ at a stellar surface; F = σT⁴ integrated.',
          'Radiation pressure P_rad = (1/c)∫I cos²θ dΩ = u/3 = aT⁴/3 for isotropic light: blows comet dust tails, drives solar sails, and competes with gravity in the most massive stars.',
        ),
        key('Intensity, mean intensity, energy density, flux and pressure are five moments of one function, I_λ(direction). The rest of the chapter is about what the gas does to that function as light passes through it.'),
      ],
    },
  ],
};

const S9_2: Section = {
  id: 'stellar-opacity',
  number: '9.2',
  title: 'Stellar Opacity',
  summary: 'Why no star is quite a blackbody and no single temperature describes one; how absorption and scattering are measured by opacity and optical depth; the sunset as an optical-depth experiment; the four ways a gas takes photons out of a beam, the H⁻ ion that makes the Sun opaque, and the Rosseland mean that stellar-structure calculations actually use.',
  minutes: 30,
  steps: [
    {
      id: 'which-temperature',
      kicker: 'Interactive · a star is not a blackbody',
      title: 'Effective, colour, excitation, ionisation: which temperature?',
      widget: { type: 'colortemp' },
      scene: [goto('Vega', 'star'), rate(1)],
      body: [
        p('Chapter 8 spoke freely of a star\'s "temperature". The atmosphere forces more care. A star is not in thermodynamic equilibrium — energy flows through it and leaves — so its radiation is not a Planck curve, and different measurements that would agree for a blackbody give different answers for a star. The widget lays a real stellar energy distribution over a blackbody and lets you fit the blackbody in different ways. Fit the total power and you get the <b>effective temperature</b>, defined by L = 4πR²σT_eff⁴. Fit the slope between two colours and you get a <b>colour temperature</b>, which depends on which two colours. Fit the shape near the Balmer jump at 364.6 nm — the step where hydrogen in n = 2 begins to absorb everything bluer — and you get something else again.'),
        p('Inside the gas there are still more. The <b>excitation temperature</b> is the T that reproduces the observed ratio of level populations through the Boltzmann equation; the <b>ionisation temperature</b>, the T that reproduces the ionisation ratios through Saha; the <b>kinetic temperature</b>, the T of the Maxwell–Boltzmann distribution of the atoms\' speeds. In a gas in thermal equilibrium all of these coincide. In a stellar atmosphere, where the temperature changes with depth and the radiation field is not the local Planck function, they differ by a few per cent for a star like the Sun and by much more in extended, tenuous atmospheres.'),
        terms(
          ['Effective temperature', 'The blackbody temperature with the star\'s total surface flux: σT_eff⁴ = F_surf. A global property, exact by definition.'],
          ['Colour temperature', 'Blackbody temperature matching the spectrum\'s slope in a chosen wavelength range; depends on the range.'],
          ['Excitation / ionisation temperature', 'T that reproduces measured level or ionisation ratios via Boltzmann / Saha; probes the layer where those lines form.'],
          ['Kinetic temperature', 'T of the particles\' velocity distribution; the "temperature" of a thermometer in the gas. Equal to the others in local thermodynamic equilibrium (Section 9.3).'],
        ),
        p('Vega, behind the panel, illustrates the cost of carelessness. Its effective temperature is 9 600 K; a colour temperature from the visible slope gives about 10 500 K; its Balmer-jump temperature is lower; and because the star is a rapid rotator seen pole-on, the pole we look at is some 2 000 K hotter than the equator we barely see. Every one of these numbers is a true measurement of something. The art of stellar atmospheres is knowing which layer, and which process, each one describes — and a model that reproduces them all at once is the goal of the rest of this chapter.'),
      ],
    },
    {
      id: 'optical-depth',
      kicker: 'Interactive · opacity and optical depth',
      title: 'How far can a photon see?',
      widget: { type: 'opticaldepth' },
      scene: [goto('titan'), rate(1)],
      body: [
        p('Send a beam of intensity I_λ through a slab of gas of density ρ and thickness ds. A fraction of the photons is absorbed or scattered out of the beam, and that fraction is proportional to the mass of gas traversed: dI_λ = −κ_λ ρ I_λ ds. The constant κ_λ is the <b>opacity</b> — the absorption cross-section per kilogram of gas, in m² kg⁻¹ — and it depends on wavelength, on temperature, on density, and on what the gas is made of. The product κ_λ ρ is the absorption coefficient per metre; its reciprocal is the <em>mean free path</em> of a photon of that wavelength.'),
        eq('\\tau_\\lambda = \\int_0^s \\kappa_\\lambda\\,\\rho\\,ds\' \\qquad\\Longrightarrow\\qquad I_\\lambda = I_{\\lambda,0}\\,e^{-\\tau_\\lambda}', 'Optical depth and the exponential attenuation of a beam that is only absorbed (no emission). τ counts the number of mean free paths along the path: τ = 1 means the beam is reduced to e⁻¹ = 37 %. A medium with τ ≪ 1 is optically thin — transparent — and one with τ ≫ 1 optically thick.'),
        p('The widget sends a beam through a slab and lets you set density, opacity and thickness independently; only their product matters, and the transmitted fraction tracks e^{−τ} whatever combination you choose. Watch τ pass 1: the slab goes from a haze to a wall. In a stellar atmosphere optical depth is measured <em>inward</em> from the top, τ = 0 at the outside, and the surface we "see" is roughly where τ_λ ≈ 1 along our line of sight — Section 9.4 refines this to 2/3 — which is why the star has a sharp edge even though its gas thins out gradually, and why a star has a different radius at every wavelength.'),
        p('Titan, behind the panel, is the solar system\'s demonstration of optical thickness. Its atmosphere is only ten times the mass of the Earth\'s per unit area, but a photochemical haze of hydrocarbons gives it an optical depth of several at visible wavelengths: from orbit the surface is invisible and the moon is a featureless orange ball. At 938 nm, in a window between methane bands, τ drops below 1 and Cassini could map the lakes and dunes; the <em>Huygens</em> probe, descending through the haze, watched the sky brighten from murky orange to a view of the ground only in the last tens of kilometres. Same atmosphere, different τ_λ, different surface.'),
        note('Opacity in m² kg⁻¹ times density in kg m⁻³ gives an inverse length, so τ is dimensionless; that is why the same τ = 1 criterion applies to a sunset, to Titan\'s haze, to a stellar photosphere and to the early universe. In some books κ is defined per unit volume or per atom; the physics is unchanged, only the bookkeeping.', 'Units'),
      ],
    },
    {
      id: 'sunset',
      kicker: 'Interactive · an experiment you can do at home',
      title: 'The sunset as an optical-depth measurement',
      widget: { type: 'sunset' },
      scene: [goto('mars'), rate(1)],
      body: [
        p('The Earth\'s atmosphere is a slab whose optical depth we can vary just by waiting. Overhead, a clear sky has τ ≈ 0.1 in the green: 90 per cent of the sunlight comes through. The path length through the air grows as 1/cos z with the zenith angle z — the <em>air mass</em> — until near the horizon it is forty times the vertical column. Because the molecular scattering that dominates the optical depth is Rayleigh scattering, τ ∝ λ⁻⁴: the blue optical depth is five times the red. At sunset the blue is extinguished long before the red, and the disc reddens and dims exactly as e^{−τ_λ X} prescribes. The widget plots the transmitted solar spectrum as the Sun sinks; the swatch beside it is the disc\'s colour.'),
        p('Astronomers correct for this every night. The <em>extinction coefficient</em> k_λ is measured by observing standard stars at several air masses and fitting m_obs = m_0 + k_λ X; typical values at a good site are 0.5 mag per air mass in the ultraviolet, 0.2 in blue, 0.1 in red. Below about 350 nm ozone adds a wall, and at 760 nm the oxygen A-band of Section 8.1 reappears. The ground-based magnitude system of Section 3.2 is defined <em>above</em> the atmosphere, and every published magnitude has had this correction applied.'),
        p('Mars, behind the panel, inverts the colours. Its thin CO₂ atmosphere scatters little by itself, but it carries fine dust whose grains are comparable in size to the wavelength of light. Such grains scatter red light broadly in all directions and blue light preferentially forward, into a narrow cone around the Sun. The daytime sky is therefore butterscotch — red light scattered everywhere — while the disc of the setting Sun is surrounded by a <em>blue</em> glow, as the rovers\' cameras have shown. Same transfer equation, different scattering law: the wavelength dependence of κ_λ is written in the colour of the sky.'),
        compare(
          { title: 'Earth: Rayleigh scattering', items: ['Molecules ≪ λ: κ_λ ∝ λ⁻⁴', 'Blue scattered out of the beam, in all directions', 'Blue sky, red sunset, τ_V ≈ 0.1 overhead', 'Extinction ≈ 0.1–0.5 mag per air mass'] },
          { title: 'Mars: dust (Mie) scattering', items: ['Grains ≈ λ: κ_λ nearly grey, strongly forward-peaked', 'Red scattered to large angles, blue kept near the Sun', 'Butterscotch sky, blue halo around the setting Sun', 'τ ≈ 0.3–1 normally; > 5 in a global dust storm'] },
        ),
      ],
    },
    {
      id: 'opacity-sources',
      kicker: 'Interactive · four ways to remove a photon',
      title: 'The sources of opacity and the H⁻ ion',
      widget: { type: 'opacitysources' },
      scene: [goto('sun'), rate(1)],
      body: [
        p('Opacity is the sum of every process by which a photon can be taken out of a beam. There are four. <b>Bound–bound</b> transitions lift an electron between two levels: they absorb only at the line wavelengths, and they are the spectral lines themselves. <b>Bound–free</b> absorption (photoionisation) strips an electron off altogether: it operates at every wavelength shorter than the ionisation edge, so it produces a continuous opacity with sharp steps — the Lyman, Balmer and Paschen edges at 91.2, 364.6 and 820.4 nm — and the inverse process, recombination, emits continuously. <b>Free–free</b> absorption occurs when a free electron passing an ion absorbs a photon and speeds up; it works at all wavelengths and grows toward the infrared. <b>Electron scattering</b> deflects a photon without changing its energy; it is wavelength-independent and, per electron, tiny — the Thomson cross-section is 6.65 × 10⁻²⁹ m² — but it is the only opacity left in a fully ionised gas.'),
        p('For the Sun a fifth entry dominates the visible continuum, and its identity was a puzzle until 1939. Neutral hydrogen cannot do it: at 5 800 K almost every H atom is in the ground state, whose bound–free edge is in the far ultraviolet. Rupert Wildt proposed, and Subrahmanyan Chandrasekhar then calculated, that the culprit is the <b>negative hydrogen ion</b> H⁻ — a proton with two electrons, bound by only 0.754 eV. Any photon with λ < 1 640 nm can detach the extra electron, giving a smooth bound–free opacity across the visible and near infrared, and free–free H⁻ absorption takes over beyond. Only one hydrogen atom in a hundred million carries the extra electron, but that is enough: H⁻ is the reason the Sun\'s visible continuum is so nearly a blackbody, and the reason we see down to the depth we do.'),
        p('The widget plots κ_λ against wavelength for a gas at the temperature and density you choose and separates the contributions. At solar temperature H⁻ is the broad hump with its edge at 1.64 µm; raise T to 10 000 K and neutral hydrogen takes over with its Balmer and Paschen edges, the jumps that give A stars their characteristic ultraviolet deficit; raise it further and the gas ionises, the edges fade and electron scattering sets a flat floor. The sources of opacity change with spectral type as surely as the lines do, and for the same reason: Saha and Boltzmann decide what is there to absorb.'),
        table(
          ['Process', 'Wavelength dependence', 'Dominates in', 'Signature'],
          [
            ['Bound–bound', 'only at line wavelengths', 'all photospheres', 'the spectral lines; "line blanketing" in cool stars'],
            ['Bound–free (H, He, metals)', 'λ³ below each edge, zero above', 'A and B stars (H); O stars (He)', 'Balmer jump at 364.6 nm, Lyman at 91.2 nm'],
            ['H⁻ bound–free and free–free', 'smooth, edge at 1.64 µm', 'F, G, K stars', 'near-blackbody visible continuum'],
            ['Free–free', '∝ λ³ (grows to the IR)', 'hot stars in the IR, radio', 'radio continuum of H II regions'],
            ['Electron scattering', 'grey (none)', 'O stars, stellar interiors', 'polarised, line-free continuum'],
          ],
          'The main sources of continuous and line opacity in stellar atmospheres. Each one is the inverse of an emission process, which is what will let us write a source function in Section 9.3.',
        ),
      ],
    },
    {
      id: 'rosseland-mean',
      kicker: 'Interactive · one number for all wavelengths',
      title: 'Kramers\' law and the Rosseland mean opacity',
      widget: { type: 'rosseland' },
      scene: [goto('Rigel', 'star'), rate(1)],
      body: [
        p('Inside a star the detailed wavelength dependence of κ_λ is more than a structure calculation can afford, and more than it needs: the radiation deep down is nearly a blackbody, and what governs the energy flow is an appropriately averaged opacity. The right average is the <b>Rosseland mean</b> κ̄, a harmonic mean of κ_λ weighted by the temperature derivative of the Planck function — harmonic because energy escapes preferentially through the wavelengths where the gas is most transparent, so transparent windows count for more than opaque walls. One κ̄(ρ, T) replaces a function of three variables, and tables of it, computed from millions of atomic transitions by the OPAL and Opacity Project groups since the 1990s, are among the most-used numbers in astrophysics.'),
        eq('\\bar\\kappa_{\\rm bf} \\approx 4.3\\times10^{21}\\,\\frac{g_{\\rm bf}}{t}\\,Z(1+X)\\,\\frac{\\rho}{T^{3.5}} \\qquad \\bar\\kappa_{\\rm ff} \\approx 3.7\\times10^{18}\\,g_{\\rm ff}(1-Z)(1+X)\\,\\frac{\\rho}{T^{3.5}} \\qquad \\bar\\kappa_{\\rm es} = 0.02\\,(1+X)', 'Kramers\' approximations (SI units; X, Z the hydrogen and metal mass fractions, g the Gaunt factors near 1) and the electron-scattering floor. Bound–free and free–free opacity rise with density and fall steeply with temperature; scattering is independent of both. In the cool outer layers an H⁻ term ∝ ρ^{1/2} T⁹ Z takes over.'),
        p('The widget draws κ̄ against temperature for several densities. The curve has a shape worth memorising. At low temperature the opacity climbs steeply as H⁻ forms and then as hydrogen begins to ionise; it peaks near 10⁴–10⁵ K, where partially ionised hydrogen and helium absorb ferociously — the region responsible for the convection zones of cool stars and for the pulsation of Cepheids; it then falls as T⁻³·⁵ along Kramers\' law; and in a hot, fully ionised gas it bottoms out at the electron-scattering value, 0.02(1+X) ≈ 0.034 m² kg⁻¹ for solar composition. Rigel, behind the panel, is a B supergiant whose atmosphere is already in that last regime: hot enough that scattering competes with absorption, which is one reason its spectrum shows weak lines on a smooth continuum.'),
        history('Svein Rosseland proposed his mean in 1924, the same year Eddington published <em>The Internal Constitution of the Stars</em>; Hendrik Kramers had derived the T⁻³·⁵ form of the free–free and bound–free opacities semi-classically in 1923. Between them they turned opacity from a catalogue of atomic data into two numbers in an equation of stellar structure — and Eddington immediately noticed that the resulting models predicted the mass–luminosity relation of Section 7.2 before it had been fully measured.', 'Two numbers from 1923–24'),
      ],
    },
    {
      id: 'opacity-summary',
      kicker: 'Summary',
      title: 'Opacity in brief',
      scene: [backdrop()],
      body: [
        summary(
          'A star is not a blackbody; effective, colour, excitation, ionisation and kinetic temperatures all differ, and each probes a different layer or process. T_eff, defined by σT_eff⁴ = F_surf, is the one global number.',
          'Opacity κ_λ (m² kg⁻¹) and optical depth τ_λ = ∫κ_λρ ds: a pure absorber attenuates a beam as e^{−τ}. τ ≈ 1 marks the visible surface; optically thin ≪ 1, thick ≫ 1. Titan\'s haze, Earth\'s sunset and the solar photosphere are all τ ≈ 1 surfaces.',
          'Rayleigh τ ∝ λ⁻⁴ reddens the setting Sun and sets the extinction coefficient astronomers subtract every night; Mars\'s dust, grey and forward-scattering, makes the opposite colours.',
          'Four sources of opacity: bound–bound (lines), bound–free (continuum with edges), free–free (grows to the infrared), electron scattering (grey floor). H⁻, bound by 0.754 eV, is the Sun\'s visible continuum opacity.',
          'The Rosseland mean κ̄(ρ, T) is a harmonic, Planck-weighted average: Kramers κ̄ ∝ ρT⁻³·⁵ for bf and ff, 0.02(1+X) for scattering, an H⁻ rise at low T; a peak near 10⁴–10⁵ K where H and He are partly ionised.',
        ),
        key('Opacity is what couples the radiation field of Section 9.1 to the gas. With it we can now follow a beam through an atmosphere that absorbs <em>and emits</em> — radiative transfer.'),
      ],
    },
  ],
};

const S9_3: Section = {
  id: 'radiative-transfer',
  number: '9.3',
  title: 'Radiative Transfer',
  summary: 'A photon leaving the Sun\'s core takes a hundred thousand years to reach the surface, not two seconds; why, and what that random walk implies. Then the heart of the chapter: a gas that both absorbs and emits, the source function, why the deep gas radiates like a blackbody and the surface does not, and how absorption and emission lines fall out of one equation.',
  minutes: 26,
  steps: [
    {
      id: 'random-walk',
      kicker: 'Interactive · the drunkard\'s photon',
      title: 'A random walk to the surface',
      widget: { type: 'randomwalk' },
      scene: [goto('sun'), rate(1)],
      body: [
        p('In a star\'s interior a photon travels, on average, one mean free path ℓ = 1/κ̄ρ before it is absorbed or scattered and re-emitted in a random new direction. Averaged over the solar interior ℓ is about a millimetre. The photon\'s path is therefore a <em>random walk</em>: N steps of length ℓ in random directions. The displacement after N steps is not Nℓ — the steps mostly cancel — but, by the elementary statistics of adding random vectors, about ℓ√N. To cross a distance d thus takes N = (d/ℓ)² steps, and the photon covers a total path Nℓ = d²/ℓ.'),
        eq('d = \\ell\\sqrt{N} \\qquad\\Longrightarrow\\qquad N = \\left(\\frac{d}{\\ell}\\right)^2 = \\tau^2, \\quad t \\approx \\frac{d^2}{\\ell c}', 'Random-walk displacement. The number of steps to escape from optical depth τ is τ²: a photon at τ = 1 needs about one more step, which is the real meaning of "we see down to τ ≈ 1". The transit time of energy through the Sun, with d = R☉ and ℓ ≈ 1 mm, is of order 10⁵ years — against 2.3 seconds in a straight line.'),
        p('The widget runs the walk: set the number of steps and watch the path tangle, then compare the net displacement with ℓ√N over many trials. Two lessons. First, the photon that finally leaves a star is not the photon that was made in its core; the energy has been absorbed and re-emitted billions of times, each time by gas at the local temperature, and all memory of the fusion reaction is gone. The light we receive carries the temperature of the <em>last</em> gas it touched — the atmosphere — which is why this chapter concerns itself with that thin layer and not with the interior. Second, the sunlight on your face left the solar surface eight minutes ago but was generated, as energy, in the Middle Ages or earlier.'),
        think('The Sun\'s luminosity could switch off at the core today and the surface would shine unchanged for tens of thousands of years. The solar neutrinos of Chapter 11, by contrast, leave the core at the speed of light in two seconds, unimpeded. In 1968 the first neutrino experiment found only a third of the expected flux. List the possible explanations an astrophysicist of that year could have offered, including one based on this step — and which of them turned out to be right.'),
      ],
    },
    {
      id: 'limb-darkening',
      kicker: 'Interactive · seeing to τ ≈ 1',
      title: 'Limb darkening: the Sun\'s edge is cooler because it is higher',
      widget: { type: 'limbdark', mode: 'observe' },
      scene: [goto('sun'), rate(1)],
      body: [
        p('Any photograph of the Sun in white light shows the disc brightest at the centre and fading toward the edge — <b>limb darkening</b>, visible to the eye through a filter and measured by every solar telescope since Secchi in the 1860s. The explanation follows at once from the random-walk picture. Along any line of sight we see to about one optical depth. Looking at the disc centre that line goes straight down, and τ = 1 lies at a certain geometric depth where the gas is hot. Looking near the limb the line enters at a slant: it reaches τ = 1 after the same path length through gas, but that path is nearly horizontal, so it ends at a <em>shallower</em> geometric depth, where the gas is cooler and shines less brightly. The limb is darker because it shows us a higher, cooler layer.'),
        p('The widget\'s left panel is the solar disc with a cursor you can drag from centre to limb; the right panel shows the slanted line of sight and the depth at which it reaches τ = 1. The brightness profile depends on wavelength — the darkening is strong in the blue and weak in the infrared, because the temperature gradient matters more where the Planck function is steeper — and on the star: in a planet-transit light curve (Section 7.4) the rounded bottom of the dip is the planet crossing a limb-darkened disc, and such light curves are now a routine way to measure limb darkening for stars other than the Sun.'),
        eq('\\frac{I(\\theta)}{I(0)} \\approx 1 - u\\,(1 - \\cos\\theta), \\qquad u_{\\rm Sun}(550\\,{\\rm nm}) \\approx 0.6', 'The linear limb-darkening law, θ the angle between the line of sight and the local vertical. Section 9.4 derives I(θ)/I(0) = (2 + 3 cos θ)/5 from the gray-atmosphere model and compares it with the measurements.'),
        note('Measuring the temperature at several depths from limb darkening at several wavelengths was the first way the Sun\'s temperature stratification was mapped, decades before model atmospheres: the brightness at the limb in the red gives the temperature at one depth, the brightness at the centre in the blue another. Section 9.4\'s Eddington–Barbier relation makes this quantitative.', 'Limb darkening as a thermometer'),
      ],
    },
    {
      id: 'source-function',
      kicker: 'Interactive · emission joins absorption',
      title: 'Emission, absorption and the source function',
      widget: { type: 'transfer' },
      scene: [goto('jupiter'), rate(1)],
      body: [
        p('Section 9.2 followed a beam that was only absorbed. A real gas also emits: the same atoms that remove photons add them back, by spontaneous emission, by recombination, by bremsstrahlung, and by scattering light in from other directions. Define the <b>emission coefficient</b> j_λ as the energy added to the beam per unit volume, time, wavelength and solid angle. Then along a path element ds the intensity changes by the emission minus the absorption, dI_λ = j_λ ds − κ_λ ρ I_λ ds, and dividing by the absorption term turns this into the <b>transfer equation</b>, with the ratio of the two coefficients given its own name: the <b>source function</b> S_λ = j_λ/κ_λρ.'),
        eq('\\frac{dI_\\lambda}{d\\tau_\\lambda} = I_\\lambda - S_\\lambda \\qquad\\text{with}\\qquad S_\\lambda \\equiv \\frac{j_\\lambda}{\\kappa_\\lambda\\rho}', 'The equation of radiative transfer, with τ measured along the ray in the direction the light travels (the sign is reversed in the convention of Section 9.4). Read it as: the intensity relaxes toward the source function, with one optical depth as the relaxation length.'),
        p('That last sentence is the whole of radiative transfer. If I > S the beam loses more than it gains and I falls; if I < S it rises; after a few optical depths I has forgotten where it started and equals S. For a slab of uniform source function the equation integrates to I = I₀e^{−τ} + S(1 − e^{−τ}), and the widget lets you set I₀, S and τ and watch the two terms trade places. Kirchhoff\'s three laws of Section 5.1 fall out as special cases: a thick slab (τ ≫ 1) shows I = S, a continuous spectrum; a thin slab with nothing behind it (I₀ = 0) shows I ≈ Sτ_λ, bright where τ_λ is large — emission lines; a thin slab in front of a brighter source (I₀ > S) shows dips where τ_λ is large — absorption lines. Whether a line appears bright or dark depends only on whether the source function in the gas is above or below the intensity behind it.'),
        p('Jupiter, behind the panel, is a textbook of source functions. Its visible clouds are a thick slab at about 130 K; where they part, the 5-µm cameras of Galileo and Juno see down to gas at 250–300 K glowing brightly — "hot spots" that are simply holes to a higher source function. In the methane bands at 890 nm the overlying gas is so opaque that only the highest hazes are visible, and the Great Red Spot, which towers above the cloud deck, stands out bright against a dark planet. Each wavelength chooses its own τ = 1 surface; each surface has its own S_λ; the image is the map of the two.'),
      ],
    },
    {
      id: 'lte',
      kicker: 'Interactive · when the gas glows like a blackbody',
      title: 'Local thermodynamic equilibrium and the approach to the Planck function',
      widget: { type: 'thermalize' },
      scene: [goto('Antares', 'star'), rate(1)],
      body: [
        p('What is the source function? In a gas whose atoms are excited and de-excited mainly by collisions, the level populations follow Boltzmann\'s law at the local kinetic temperature, and the ratio of emission to absorption is then fixed by Kirchhoff\'s law to be the Planck function: S_λ = B_λ(T). This is <b>local thermodynamic equilibrium</b> (LTE) — "local" because T varies from place to place, "equilibrium" because at each place the matter is as it would be in a blackbody cavity at that T. LTE is a property of the <em>gas</em>; it says nothing about the radiation, which may still be far from B_λ.'),
        p('How far, and where, is the point of the widget. Start a beam at the surface of a slab with S = B(T) and follow the mean intensity inward. Near the top the radiation is a mixture of light from below and darkness from above, and ⟨I⟩ is well below B; by τ ≈ 2 the field has thermalised and ⟨I⟩ ≈ B to a few per cent; deep down the two are indistinguishable. Now switch the gas to a scattering atmosphere, in which photons are redirected rather than destroyed: each scattering keeps the photon\'s "memory" of where it came from, S follows ⟨I⟩ rather than B, and the radiation can stay out of equilibrium with the gas for tens or hundreds of optical depths. The thermalisation length is 1/√ε for a destruction probability ε per scattering — the reason the cores of strong lines, formed high up where collisions are rare, are the first place LTE fails.'),
        eq('S_\\lambda = (1-\\epsilon)\\,\\langle I_\\lambda\\rangle + \\epsilon\\,B_\\lambda(T), \\qquad \\text{thermalisation depth } \\tau_{\\rm th} \\approx 1/\\sqrt{\\epsilon}', 'The source function with scattering: a fraction ε of absorptions destroys the photon and re-emits thermally; the rest scatter. ε → 1 is LTE. In the solar photosphere ε is near 1 for the continuum (H⁻ absorbs, it does not scatter) and ≪ 1 in the cores of the Ca II H and K lines.'),
        p('For most of the atmosphere of most stars LTE is an excellent approximation, and the classical model atmospheres built on it reproduce the continuum and the weak lines to a per cent. It fails where densities are low and radiation fields intense: in the extended envelopes of supergiants like Antares, behind the panel, where collisions are too rare to enforce Boltzmann populations; in the winds of O stars; in the chromosphere and corona of the Sun, whose emission lines come from gas at a million kelvin that no local Planck function describes. "Non-LTE" modelling — solving the rate equations for the level populations together with the transfer equation — is the standard tool for those regimes and has been since the 1970s.'),
      ],
    },
    {
      id: 'transfer-summary',
      kicker: 'Summary',
      title: 'Radiative transfer in brief',
      scene: [backdrop()],
      body: [
        summary(
          'Photons random-walk through a star: displacement ℓ√N, escape from optical depth τ takes τ² steps; energy takes ~10⁵ yr to cross the Sun. The light we see remembers only the last gas it touched — the atmosphere.',
          'Limb darkening: along a slanted line of sight τ = 1 is reached at a shallower, cooler depth; stronger in the blue; measured for other stars by planetary transits.',
          'Emission coefficient j_λ, source function S_λ = j_λ/κ_λρ; the transfer equation dI/dτ = I − S says intensity relaxes toward S over one optical depth. Slab solution I = I₀e^{−τ} + S(1 − e^{−τ}) yields Kirchhoff\'s laws: emission lines when S > I₀, absorption lines when S < I₀.',
          'Local thermodynamic equilibrium: collisions keep the gas Boltzmann/Saha at the local T, so S_λ = B_λ(T). The radiation thermalises to B within a few τ for pure absorption, within 1/√ε for scattering; LTE fails in line cores, tenuous envelopes, chromospheres and winds.',
        ),
        key('The transfer equation is a single statement: the intensity along a ray is driven toward the source function. Every spectral feature — continuum, absorption line, emission line, limb darkening — is a question of how S_λ varies along the line of sight and how far in we can see.'),
      ],
    },
  ],
};

const S9_4: Section = {
  id: 'transfer-equation',
  number: '9.4',
  title: 'The Transfer Equation',
  summary: 'Solving the transfer equation in the one geometry that matters for a star: flat layers, a temperature that rises inward, and rays leaving at every angle. The plane-parallel and gray approximations, Eddington\'s solution for the temperature against depth, the derived limb darkening tested against the Sun, and the Eddington–Barbier relation that tells us what depth we are looking at.',
  minutes: 26,
  steps: [
    {
      id: 'plane-parallel',
      kicker: 'Interactive · flattening the star',
      title: 'The plane-parallel atmosphere',
      widget: { type: 'planeparallel' },
      scene: [goto('sun'), rate(1)],
      body: [
        p('The Sun\'s photosphere is about 500 km thick on a sphere of radius 696 000 km: curvature is irrelevant over any distance a photon travels before it is absorbed. We may therefore treat the atmosphere as a stack of flat, horizontal layers in which temperature, density and opacity depend only on depth. Measure <em>vertical</em> optical depth τ_v inward from the top. A ray leaving the surface at angle θ to the vertical traverses a slant path ds = dz/cos θ through each layer, so the optical depth along it is τ_v/cos θ — larger by the air-mass factor of the sunset. The transfer equation becomes a one-dimensional problem with θ as a parameter.'),
        eq('\\cos\\theta\\,\\frac{dI_\\lambda}{d\\tau_{\\lambda,v}} = I_\\lambda - S_\\lambda', 'The plane-parallel transfer equation, with τ_v measured downward (hence the sign change from Section 9.3). Writing μ = cos θ, each value of μ gives an ordinary differential equation along one family of parallel rays; the full field is the set of solutions for all μ.'),
        p('The widget shows the geometry: layers of increasing optical depth, rays emerging at the angle you choose, and the point along each ray at which the <em>slant</em> optical depth reaches 2/3 — the depth whose source function, as the last step of this section shows, the emergent intensity most nearly reports. Tilt the ray toward the horizon and that point climbs: at μ = 1 it sits at τ_v = 2/3, at μ = 0.3 at τ_v = 0.2. The limb of the Sun shows us gas three times higher than the centre does.'),
        p('Two further simplifications make the problem tractable by hand. Assume the opacity is independent of wavelength — a <b>gray atmosphere</b> — so that a single τ serves for all λ and the equation can be integrated over wavelength; and assume radiative equilibrium — all the energy is carried by radiation, none by convection — so that the total flux F = σT_eff⁴ is the same at every depth. Neither is exactly true of any star. Both are good enough to produce, in the next step, a temperature structure within a few per cent of the modern solar model.'),
        terms(
          ['Plane-parallel', 'Flat layers, properties depending on depth only. Valid when the atmosphere is thin compared with the radius; fails for extended supergiant envelopes and winds.'],
          ['Gray atmosphere', 'Opacity independent of wavelength. Permits integration over λ; the Rosseland mean of Section 9.2 is the physically motivated gray opacity.'],
          ['Radiative equilibrium', 'No net energy absorbed or emitted by the gas at any depth: the integrated flux is constant with depth and equals σT_eff⁴.'],
          ['μ = cos θ', 'Direction cosine of a ray relative to the vertical. μ = 1 straight up (disc centre), μ → 0 grazing (limb).'],
        ),
      ],
    },
    {
      id: 'gray-atmosphere',
      kicker: 'Interactive · temperature against depth',
      title: 'Eddington\'s gray atmosphere: T(τ)',
      widget: { type: 'grayatm' },
      scene: [goto('Procyon', 'star'), rate(1)],
      body: [
        p('Take moments of the plane-parallel equation — multiply by 1 and by μ and integrate over all directions — and two exact relations appear: in radiative equilibrium the mean intensity equals the source function, ⟨I⟩ = S, and the radiation pressure rises linearly with depth, dP_rad/dτ = F/c. The second says that the pressure of light at depth τ is just the pressure at the surface plus (F/c)τ. To close the system one needs a relation between P_rad and ⟨I⟩, and Eddington\'s approximation supplies it: take the field to be isotropic enough that P_rad = (4π/3c)⟨I⟩, as it would be exactly deep inside. With the boundary condition that no light comes in from above, the result is a closed formula.'),
        eq('T^4 = \\tfrac{3}{4}\\,T_{\\rm eff}^4\\left(\\tau + \\tfrac{2}{3}\\right)', 'The gray-atmosphere temperature structure in the Eddington approximation. At τ = 0 the gas is at T = 0.841 T_eff; at τ = 2/3 the gas has exactly the effective temperature; deep down T rises as τ^{1/4}. The exact gray solution (Hopf, 1934) replaces 2/3 by a function q(τ) running from 0.577 to 0.710.'),
        p('The widget plots the curve and compares it with an empirical solar model: the agreement is within a few per cent through the photosphere. Three features deserve emphasis. The surface is not at T_eff but cooler, because the outer gas is heated by radiation from one side only — ⟨I⟩ there is less than half the Planck value at T_eff, as Section 9.1 anticipated. The effective temperature is reached at τ = 2/3, which is why that number, rather than 1, labels "the" photosphere. And the slope is steep: between τ = 0.1 and τ = 2 the solar temperature rises from 4 800 K to 7 000 K across a few hundred kilometres. Procyon, behind the panel, is an F5 subgiant hotter than the Sun by 800 K; its gray structure is the same curve scaled by its T_eff, and the departures from it — a shallower gradient in the ultraviolet, a convection zone that becomes important below τ ≈ 1 — are what full model atmospheres add.'),
        table(
          ['τ (vertical)', 'T_gray / T_eff', 'T_gray (Sun)', 'Empirical solar model', 'Depth below τ = 1 (km)'],
          [
            ['0', '0.841', '4 850 K', '≈ 4 400 K (temperature minimum region)', '≈ +500'],
            ['0.1', '0.880', '5 080 K', '5 000 K', '≈ +250'],
            ['2/3', '1.000', '5 772 K', '5 780 K', '≈ +40'],
            ['1', '1.057', '6 100 K', '6 150 K', '0'],
            ['2', '1.188', '6 860 K', '7 000 K', '≈ −70'],
            ['10', '1.683', '9 710 K', '≈ 9 500 K (below the visible layers)', '≈ −250'],
          ],
          'Eddington\'s gray atmosphere against a modern empirical model of the quiet Sun. The gray model is poorest at the very top, where the real temperature keeps falling to a minimum near 4 400 K before the chromosphere reverses the trend.',
        ),
      ],
    },
    {
      id: 'limb-darkening-derived',
      kicker: 'Interactive · a prediction tested',
      title: 'Limb darkening from the gray atmosphere',
      widget: { type: 'limbdark', mode: 'eddington' },
      scene: [goto('sun'), rate(1)],
      body: [
        p('With T(τ) in hand, the emergent intensity in any direction follows from the formal solution of the transfer equation: integrate the source function along the slanted ray, weighting each depth by the probability e^{−τ/μ} that light from there escapes. For the gray atmosphere S = σT⁴/π = (3F/4π)(τ + 2/3), a linear function of τ, and the integral is elementary. The result depends on direction only through μ and predicts the whole limb-darkening curve with no free parameter.'),
        eq('I(\\theta) = \\frac{3F}{4\\pi}\\left(\\cos\\theta + \\frac{2}{3}\\right) \\qquad\\Longrightarrow\\qquad \\frac{I(\\theta)}{I(0)} = \\frac{3}{5}\\cos\\theta + \\frac{2}{5}', 'Limb darkening of a gray atmosphere in the Eddington approximation. At the extreme limb (θ = 90°) the intensity falls to 40 % of the central value; at θ = 60° (two thirds of the way out in projected radius) to 70 %.'),
        p('The widget overlays this prediction on the measured solar profile at several wavelengths. In the visible the match is close — the solar limb at 550 nm is about 0.42 of the centre, against 0.40 predicted — and the residuals have the sign the gray assumption dictates: the real Sun darkens more in the blue, where the opacity is lower and we see deeper into a steeper part of the temperature gradient, and less in the infrared. A one-line model built from flat layers, a single opacity and an isotropy assumption reproduces a century of solar photometry to a few per cent. That is why Eddington\'s approximation is still the first thing a student is taught to do with the transfer equation.'),
        history('Arthur Eddington worked out the gray atmosphere around 1916–17 and used it, with Karl Schwarzschild\'s earlier radiative-equilibrium models of 1906, to argue that the Sun\'s outer layers are in radiative rather than convective equilibrium; the later discovery of the solar convection zone just below the photosphere did not overturn the result for the layers we see. Schwarzschild, in 1906, had already used limb darkening to decide between the two: he showed that an adiabatic (convective) atmosphere would darken too little and the radiative one about right.', 'Schwarzschild and Eddington'),
      ],
    },
    {
      id: 'eddington-barbier',
      kicker: 'Interactive · what depth are we looking at?',
      title: 'The Eddington–Barbier relation',
      widget: { type: 'barbier' },
      scene: [goto('sun'), rate(1)],
      body: [
        p('The formal solution contains a result of great practical value. The emergent intensity along a ray is a weighted average of the source function, with weight e^{−τ_s}dτ_s over slant optical depth τ_s. That weight is largest at τ_s = 0 and falls off with scale 1, so the average "sees" chiefly the first optical depth; and if S is linear in τ the average is exactly S evaluated at τ_s = 1 — that is, at vertical optical depth τ_v = μ. In words: <em>the intensity we observe in a given direction is the source function at slant optical depth unity</em>. Looking at the disc centre we see S at τ_v = 1; at the limb, at τ_v → 0; and the flux, which averages over the disc, comes from τ_v ≈ 2/3.'),
        eq('I_\\lambda(0,\\mu) = \\int_0^\\infty S_\\lambda(\\tau_v)\\,e^{-\\tau_v/\\mu}\\,\\frac{d\\tau_v}{\\mu} \\;\\approx\\; S_\\lambda(\\tau_v = \\mu), \\qquad F_\\lambda \\approx \\pi S_\\lambda(\\tau_v = 2/3)', 'The formal solution and the Eddington–Barbier relation (Eddington 1926, Daniel Barbier 1943). Exact for a source function linear in τ; a good approximation otherwise, because the weighting function is sharply peaked.'),
        p('The widget lets you shape S(τ) — a gradient, a hump, a step — and shows the escape-probability weighting for the μ you choose, the exact integral, and the Eddington–Barbier estimate. For a smooth S the two agree closely; for a step or a spike the estimate degrades, which tells you where the relation can be trusted. Its uses are everywhere. It converts limb-darkening measurements directly into S(τ), hence T(τ) (Section 9.3). It explains spectral lines in one sentence: at a line wavelength κ_λ is large, so τ_λ = 2/3 is reached high up where T is low and B_λ(T) is small — the flux is reduced, and we see an absorption line; in an emission-line star the temperature rises outward and the same argument gives a bright line. And it tells the observer, for any wavelength, the depth whose conditions a measurement reports.'),
        think('In the core of the Hα line the solar opacity is so high that τ = 2/3 lies in the chromosphere, where the temperature is <em>rising</em> outward again — yet Hα is still seen in absorption against the disc. Use the Eddington–Barbier relation together with the LTE discussion of Section 9.3 to say why. (Hint: is S_λ = B_λ(T) in the Hα core?)'),
      ],
    },
    {
      id: 'transfer-eq-summary',
      kicker: 'Summary',
      title: 'The transfer equation in brief',
      scene: [backdrop()],
      body: [
        summary(
          'Plane-parallel atmosphere: flat layers, vertical optical depth τ_v, μ = cos θ; μ dI/dτ_v = I − S. Slant depth = τ_v/μ.',
          'Gray (λ-independent opacity) and radiative equilibrium (constant flux) let the equation be integrated over wavelength. Moments give ⟨I⟩ = S and dP_rad/dτ = F/c.',
          'Eddington approximation P_rad = (4π/3c)⟨I⟩ closes the system: T⁴ = (3/4)T_eff⁴(τ + 2/3). T = T_eff at τ = 2/3; the surface is at 0.84 T_eff; matches the empirical Sun to a few per cent.',
          'Predicted limb darkening I(θ)/I(0) = (3cos θ + 2)/5 — 40 % at the limb — agrees with the Sun at visible wavelengths; residuals reflect the non-gray opacity.',
          'Eddington–Barbier: I(μ) ≈ S(τ_v = μ), F ≈ πS(τ_v = 2/3). The observed intensity reports the source function one slant optical depth in; this explains absorption lines (τ_λ = 2/3 reached where T is lower) and makes limb darkening a thermometer.',
        ),
        key('Everything in this section rests on one integral — the formal solution — and one approximation about isotropy. The reward is a quantitative photosphere: temperatures, depths and a limb-darkening law from first principles, with the real Sun following to within a few per cent.'),
      ],
    },
  ],
};

const S9_5: Section = {
  id: 'line-profiles',
  number: '9.5',
  title: 'The Profiles of Spectral Lines',
  summary: 'What a spectral line looks like up close and why: the natural width set by the uncertainty principle, the Doppler core from thermal motion, the pressure-broadened wings, rotation and turbulence; the Voigt profile that combines them; the curve of growth that turns a line\'s strength into a number of atoms; and the composition of the Sun — which the meteorites confirm.',
  minutes: 30,
  steps: [
    {
      id: 'line-anatomy',
      kicker: 'Interactive · reading a profile',
      title: 'The anatomy of a spectral line',
      widget: { type: 'lineprofile' },
      scene: [goto('Sirius', 'star'), rate(1)],
      body: [
        p('At the resolution of a classification spectrum a line is a dark stroke. At high resolution it is a shape: a deep <b>core</b> at the central wavelength λ₀ flanked by <b>wings</b> that merge gradually into the continuum. The depth of the core, the width at half depth (the <em>full width at half maximum</em>), and the extent of the wings each encode different physics, and the whole shape is called the <b>line profile</b>. The widget draws one and lets you adjust its depth and width independently; the readouts below are the measurements a spectroscopist would make.'),
        p('The single most useful measurement collapses the shape to one number. Replace the line by a rectangle that removes the same total amount of light from the continuum and has the full depth of the continuum; the rectangle\'s width is the <b>equivalent width</b> W. Being an integral, it is immune to the instrument\'s blurring — a spectrograph that smears the profile wider and shallower leaves W unchanged — and it is the quantity that connects, through the curve of growth of Step 4, to the number of absorbing atoms. The strongest lines in the solar spectrum, Ca II H and K, have W ≈ 2 nm; a typical weak iron line, 0.001 nm.'),
        eq('W = \\int \\frac{F_c - F_\\lambda}{F_c}\\,d\\lambda', 'Equivalent width, usually quoted in picometres or milliångströms. F_c is the continuum flux interpolated across the line. Sirius\'s Balmer lines, behind the panel, have W of several nanometres and wings spanning tens: pressure broadening at its most extreme in an A dwarf.'),
        p('Where in the atmosphere does a line form? By the Eddington–Barbier argument, each wavelength across the profile is seen to a different depth. In the far wings the extra opacity is small, τ = 2/3 lies almost as deep as in the continuum, and the intensity is only slightly reduced. Toward the core the line opacity grows, the τ = 2/3 surface rises through cooler layers, and the intensity falls. The core itself forms highest of all. A strong line is therefore a stratified probe: its wings report the deep photosphere, its core the top of it or, for the strongest lines, the chromosphere above. That is why line profiles, not just line strengths, are the data from which model atmospheres are built.'),
      ],
    },
    {
      id: 'broadening',
      kicker: 'Interactive · why lines have width',
      title: 'Natural, Doppler and pressure broadening: the Voigt profile',
      widget: { type: 'broadening' },
      scene: [goto('Capella', 'star'), rate(1)],
      body: [
        p('An atom\'s energy levels are not infinitely sharp, so no line can be. Three mechanisms set the width. The first is <b>natural broadening</b>: an excited level lives only a time Δt ≈ 10⁻⁸ s before decaying, and the uncertainty principle ΔE Δt ≳ ħ smears its energy by ΔE, hence the photon\'s wavelength by Δλ ≈ λ²/(2πcΔt) — about 2 × 10⁻⁵ nm for Hα, tiny. Its profile is Lorentzian: a narrow core with wings that fall only as 1/(Δλ)², very slowly.'),
        p('The second is <b>Doppler broadening</b>. The atoms move with the Maxwell–Boltzmann distribution of speeds, each shifting its absorption by Δλ = λ v_r/c, and the line is the sum: a Gaussian whose full width at half maximum is Δλ = (2λ/c)√(2kT ln 2/m). For hydrogen at 5 800 K that is 0.04 nm at Hα, two thousand times the natural width; for iron, 56 times heavier, seven times less. Turbulent motions of the gas add in quadrature as an extra velocity. The Gaussian core is narrow in velocity but its wings die off as e^{−(Δλ)²}, extremely fast.'),
        p('The third is <b>pressure broadening</b>, also called collisional: the electric fields of passing ions and electrons, or collisions with neutral atoms, perturb the levels and shorten their effective lifetimes, so the natural Lorentzian is widened by a factor that grows with the density of perturbers — in the solar photosphere, by about a thousand. For hydrogen the linear Stark effect makes the broadening enormous and proportional to the electron density, which is why the Balmer wings in an A dwarf span tens of nanometres and in a supergiant almost nothing: the luminosity classification of Section 8.2 is pressure broadening read backwards.'),
        eq('\\Delta\\lambda_{\\rm nat} \\approx \\frac{\\lambda^2}{2\\pi c\\,\\Delta t_0}, \\qquad (\\Delta\\lambda)_{1/2,\\,{\\rm Doppler}} = \\frac{2\\lambda}{c}\\sqrt{\\frac{2kT\\ln 2}{m}\\,}\\ \\Big(+\\,v_{\\rm turb}^2\\Big)^{1/2}, \\qquad \\Delta\\lambda_{\\rm press} \\approx \\frac{\\lambda^2}{c}\\,\\frac{n\\sigma}{\\pi}\\sqrt{\\frac{2kT}{m}}', 'Widths of the three mechanisms: natural (Lorentzian), Doppler (Gaussian), pressure (Lorentzian, n the perturber density, σ the collision cross-section). The convolution of a Gaussian core with Lorentzian wings is the Voigt profile: Doppler decides the core, damping decides the wings.'),
        p('The widget convolves the pieces. Raise the temperature and the Gaussian core widens; raise the pressure and the Lorentzian wings spread while the core hardly moves; the composite is the <b>Voigt profile</b> that real lines follow. Capella, behind the panel, is a pair of G giants whose lines are narrower than the Sun\'s of the same strength — lower gravity, lower density, weaker damping wings — and whose Doppler cores are broadened by macroturbulence of several km/s in their convective envelopes. Every term in the formula is a measurable property of the star.'),
      ],
    },
    {
      id: 'rotation',
      kicker: 'Interactive · the star as a spinning disc',
      title: 'Rotational broadening and the shape of a line',
      widget: { type: 'rotation' },
      scene: [goto('Altair', 'star'), rate(1)],
      body: [
        p('One more broadening is not atomic at all. A rotating star presents one limb approaching and the other receding; every point on the disc contributes a narrow line shifted by its own projected velocity, and the sum is the intrinsic profile smeared by a characteristic kernel — nearly a half-ellipse — of half-width λ v_eq sin i / c. The quantity measured is <b>v sin i</b>: the equatorial speed times the sine of the inclination of the rotation axis, because a star seen pole-on shows no rotational shift at all. Altair, behind the panel, has v sin i ≈ 240 km/s and a true equatorial speed near 290 — fast enough to flatten it by 20 per cent and darken its equator — and its lines are shallow, broad bowls rather than sharp dips.'),
        p('The widget draws the disc colour-coded by line-of-sight velocity and builds the profile strip by strip. Two things to notice. The rotational kernel has a shape that no atomic mechanism produces — flat-bottomed and sharp-edged rather than peaked — so rotation can be separated from thermal and pressure broadening by the profile\'s form, not just its width. And because every point on the disc is affected equally, rotation conserves the equivalent width while reducing the depth: a rapidly rotating star of a given spectral type has weaker-looking lines, which misled early classifiers into assigning it a later type.'),
        p('Statistics of v sin i across the H–R diagram carry a story of their own. O, B and A stars spin fast, typically 100–300 km/s; at about spectral type F5 the average speed drops abruptly to a few km/s and stays low through G, K and M. The break coincides with the appearance of a deep convective envelope, which drives a magnetised wind that carries away angular momentum over the star\'s life — the reason the Sun, 4.6 billion years old, rotates once a month rather than once a day. Rotation is thus both a nuisance to the spectroscopist and a clock.'),
        note('Other velocity fields leave their own marks. <em>Macroturbulence</em> — convective cells larger than a photon\'s mean free path — broadens lines with a Gaussian-like kernel of a few km/s in dwarfs and ten or more in supergiants. <em>Pulsation</em> moves whole lines back and forth in time (Cepheids, RR Lyrae). The <em>Zeeman effect</em> splits lines in a magnetic field, by 0.01 nm per tesla at 500 nm; it is how sunspot fields of 0.3 T and the kilogauss fields of Ap stars are measured, and in circular polarisation it reveals fields far too weak to split a line visibly.', 'Beyond rotation'),
      ],
    },
    {
      id: 'curve-of-growth',
      kicker: 'Interactive · from a line to a number of atoms',
      title: 'The curve of growth',
      widget: { type: 'curveofgrowth' },
      scene: [goto('sun'), rate(1)],
      body: [
        p('The purpose of all this is to count atoms. The equivalent width of a line depends on the number of absorbers per unit area along the line of sight, N_a, in a way that goes through three regimes, and the plot of log W against log N_a — the <b>curve of growth</b> — has a shape that is the same for every line, once the axes are scaled. The widget builds it: slide the column density upward and watch the profile and its equivalent width respond.'),
        list(
          '<b>Linear part.</b> For a weak line the profile is optically thin everywhere, each atom removes the same amount of light, and W ∝ N_a. The line deepens without changing shape.',
          '<b>Flat (saturated) part.</b> Once the Doppler core has absorbed all the light at its centre — the core is "black" — adding atoms cannot deepen it further; W grows only as the core widens into the steep Gaussian flanks, roughly as √(ln N_a). Lines here are almost useless for abundances: a factor of ten more atoms barely changes W.',
            '<b>Damping (square-root) part.</b> At still higher N_a the Lorentzian wings, weak but slow to fall off, become optically thick and the line grows outward again as W ∝ √N_a. The Balmer lines and Ca II H and K in the Sun are here.',
        ),
        eq('W \\propto N_a \\;\\;(\\text{weak}), \\qquad W \\propto \\sqrt{\\ln N_a}\\;\\;(\\text{saturated}), \\qquad W \\propto \\sqrt{N_a}\\;\\;(\\text{damped})', 'The three regimes of the curve of growth. The scaled abscissa is N_a f λ, with f the oscillator strength (the quantum-mechanical probability of the transition, measured in the laboratory) — so lines of the same element with different f fall on one curve, and that is how the curve is traced empirically.'),
        p('To use it, measure W for several lines of one element with different f, shift their points horizontally until they lie on the theoretical curve, and read off N_a for the level each line starts from. Boltzmann and Saha (Section 8.1) then convert the population of one level of one ionisation stage into the total number of atoms of the element — which also, as a check, yields the excitation temperature and electron pressure that make all the lines agree. Done for sodium in the Sun, this gives N(Na) column densities of order 10²³ m⁻² for the D lines; done for every element with measurable lines, it gives the composition of the solar photosphere, the subject of the next step.'),
      ],
    },
    {
      id: 'abundances',
      kicker: 'Interactive · the composition of the Sun',
      title: 'Abundances: the Sun, the meteorites and the three letters X, Y, Z',
      widget: { type: 'abundances' },
      scene: [goto('vesta'), rate(1)],
      body: [
        p('A century of curve-of-growth analysis, refined by non-LTE and three-dimensional model atmospheres, has produced the solar abundance table: the number of atoms of each element relative to hydrogen, conventionally written as log ε = log(N/N_H) + 12. Hydrogen is 12 by definition; helium is 10.93; oxygen, the third most abundant element, 8.69; carbon 8.43; iron 7.50 — one iron atom for every thirty thousand hydrogens. By mass, hydrogen is X = 0.74, helium Y = 0.25, and everything heavier together — which astronomers, to the dismay of chemists, call the <em>metals</em> — Z = 0.013. Cecilia Payne\'s 1925 conclusion that stars are made overwhelmingly of hydrogen and helium is the single most important fact in this table.'),
        p('The widget shows the table as a bar chart, element by element, and lets you overlay a second set of numbers: the composition of the <em>CI carbonaceous chondrites</em>, the most primitive meteorites, measured in the laboratory to far better precision than any spectral line. For every element that is not a gas or highly volatile, the two agree to within about ten per cent across ten orders of magnitude in abundance. That is as it should be — the meteorites are leftover material from the same cloud that made the Sun, never melted or differentiated — and the agreement is both the best check on stellar spectroscopy and the reason a pebble from the asteroid belt can calibrate the composition of the stars. Vesta, behind the panel, is a differentiated body and not a CI source; the Dawn mission\'s spectra of its surface, matched to the HED meteorites in our collections, tie a specific class of rocks to a specific parent in the same spirit.'),
        p('The agreement also exposes the exceptions. Lithium is forty times rarer in the Sun than in the meteorites: it is destroyed by nuclear reactions at 2.5 million kelvin, and the Sun\'s convection has carried its surface lithium down to that depth and back over billions of years — a diagnostic of mixing used for every solar-type star. The noble gases and the most volatile elements never condensed into the meteorites and are known only from the Sun. And the pattern itself, with its sawtooth of even elements more abundant than odd, its iron peak and its steady fall toward the heavy end, is a record of nucleosynthesis that Chapter 13 and its successors will decode: the elements in the widget were made in stars, and the lines in the solar spectrum are their census.'),
        table(
          ['Element', 'log ε (photosphere)', 'log ε (CI meteorites)', 'Mass fraction', 'Note'],
          [
            ['H', '12.00', '—', '0.738', 'by definition'],
            ['He', '10.93', '—', '0.249', 'from helioseismology; no usable photospheric lines'],
            ['O', '8.69', '8.40', '5.7 × 10⁻³', 'partly volatile in meteorites'],
            ['C', '8.43', '7.39', '2.4 × 10⁻³', 'mostly lost from meteorites as gas'],
            ['Ne', '7.93', '—', '1.3 × 10⁻³', 'noble gas; solar wind and corona'],
            ['Fe', '7.50', '7.45', '1.3 × 10⁻³', 'hundreds of measurable lines'],
            ['Si', '7.51', '7.51', '7.0 × 10⁻⁴', 'the meteoritic normalisation element'],
            ['Li', '1.05', '3.26', '1 × 10⁻⁸', 'depleted in the Sun by burning at the base of the convection zone'],
          ],
          'Solar photospheric and CI-chondrite abundances (Asplund et al. 2009 scale). Refractory elements agree; volatiles are deficient in the meteorites; lithium is deficient in the Sun.',
        ),
      ],
    },
    {
      id: 'chapter-close',
      kicker: 'Chapter close',
      title: 'Stellar atmospheres in one page',
      scene: [backdrop()],
      body: [
        summary(
          'Radiation field: specific intensity I_λ (constant along a ray), mean intensity ⟨I_λ⟩, energy density u = aT⁴, flux F = ∫I cos θ dΩ (σT⁴ at the surface), radiation pressure aT⁴/3 — the force on comet dust and the structural force in the most massive stars.',
          'Opacity κ_λ and optical depth τ_λ; e^{−τ} attenuation; τ ≈ 2/3 is the surface we see. Sources: bound–bound, bound–free, free–free, electron scattering; H⁻ for the Sun; the Rosseland mean and Kramers\' ρT⁻³·⁵.',
          'Transfer: photons random-walk (ℓ√N; 10⁵ yr through the Sun); dI/dτ = I − S with S = j/κρ; LTE gives S = B(T); slab solution reproduces Kirchhoff\'s laws; thermalisation within a few τ for absorption, 1/√ε for scattering.',
          'Plane-parallel gray atmosphere: T⁴ = (3/4)T_eff⁴(τ + 2/3); limb darkening (3cos θ + 2)/5 matches the Sun; Eddington–Barbier I(μ) ≈ S(τ = μ) tells which depth a measurement reports and why lines are dark.',
          'Line profiles: natural (Lorentz), Doppler (Gauss), pressure (Lorentz) → Voigt; rotation (v sin i), turbulence, Zeeman; equivalent width; curve of growth (linear, flat, √N) → column densities → abundances: X = 0.74, Y = 0.25, Z = 0.013, confirmed by the CI meteorites.',
        ),
        key('Chapter 9 closes the loop opened in Chapter 3. There, light told us a star\'s temperature; here, the physics of how that light escapes tells us where in the star the temperature was measured, what the gas is made of and how it moves. A model atmosphere — opacity, transfer equation, line formation, solved together — is the instrument through which every stellar spectrum in this program is read.'),
        { kind: 'callout', tone: 'history', title: 'Suggested reading', html: 'Carroll & Ostlie, <em>An Introduction to Modern Astrophysics</em>, Chapter 9, which this chapter follows; D. Mihalas, <em>Stellar Atmospheres</em> (2nd ed., 1978) and Hubeny & Mihalas (3rd ed., 2014), the standard treatise; D. F. Gray, <em>The Observation and Analysis of Stellar Photospheres</em> (3rd ed., 2005) for line profiles and the curve of growth in practice; G. B. Rybicki & A. P. Lightman, <em>Radiative Processes in Astrophysics</em> (1979) for the radiation field and opacities; A. S. Eddington, <em>The Internal Constitution of the Stars</em> (1926), Chapter XII, for the gray atmosphere in its author\'s words; M. Asplund et al., <em>Astronomy & Astrophysics</em> 653, A141 (2021) for the solar abundances; K. Lodders on the meteoritic table.' },
        { kind: 'callout', tone: 'think', title: 'Problems to try', html: '(1) Show that for a blackbody u = aT⁴ and P_rad = aT⁴/3, and evaluate both at the solar centre (1.57 × 10⁷ K) and at the photosphere. (2) Compute the radiation pressure of sunlight at Mercury, Earth and Neptune for an absorbing and a reflecting surface; find the force on a 20 m × 20 m sail at 1 AU and its acceleration if the sail masses 10 kg. (3) For a grain of density 3 000 kg m⁻³, find the radius at which solar radiation pressure equals solar gravity; show the ratio is independent of distance. (4) The solar photosphere has ρ ≈ 2 × 10⁻⁴ kg m⁻³ and κ₅₀₀ ≈ 0.03 m² kg⁻¹; find the photon mean free path and compare with the 500-km photosphere. (5) On a night with k_V = 0.15 mag per air mass, by how much is a star dimmed at zenith angles 0°, 60° and 80°? Explain why τ_V ≈ 0.14 corresponds to k_V = 0.15. (6) Using N = τ² and ℓ = 1 mm, estimate the time for energy to random-walk from the Sun\'s centre to its surface; repeat for a red giant with R = 100 R☉ and ℓ = 1 m. (7) From T⁴ = (3/4)T_eff⁴(τ + 2/3) find τ where T = T_eff, T = 0.9 T_eff and T = 1.2 T_eff for the Sun. (8) Compute I(θ)/I(0) for θ = 30°, 60°, 80°, 89° from the gray formula and compare with the linear law with u = 0.6. (9) Evaluate the Doppler width of Hα and of the Na D lines at 5 800 K and at 3 000 K; add 2 km/s of turbulence and comment. (10) Two sodium D lines have equivalent widths 0.075 and 0.056 nm with f-values 0.645 and 0.325. Decide from the ratio which part of the curve of growth they occupy and estimate the relative column density implied. (11) The lithium 670.8 nm line is undetectable in the Sun (log ε = 1.05) but strong in young solar-type stars (log ε ≈ 3.3). By what factor does the number of lithium atoms differ, and what does the Sun\'s value tell you about the depth of its convection zone?' },
      ],
    },
  ],
};

export const COURSE: Course = {
  id: 'astrophysics',
  title: 'Introduction to Astrophysics',
  subtitle: 'From the celestial sphere to the structure of the universe — with the universe itself as the blackboard.',
  chapters: [
    {
      id: 'ch1',
      number: 1,
      title: 'The Celestial Sphere',
      summary: 'How humanity learned to map the sky, moved the Earth out of the centre, and began to explain what it saw.',
      sections: [S1_1, S1_2, S1_3, S1_4],
    },
    {
      id: 'ch2',
      number: 2,
      title: 'Celestial Mechanics',
      summary: 'Kepler\'s laws of planetary motion, Newton\'s laws and gravity, how the one set follows from the other, and the virial theorem that weighs the universe.',
      sections: [S2_1, S2_2, S2_3, S2_4],
    },
    {
      id: 'ch3',
      number: 3,
      title: 'The Continuous Spectrum of Light',
      summary: 'Distance from parallax, brightness from magnitudes, temperature from colour: the physics of light that turns a point in the sky into a star with a size and a luminosity.',
      sections: [S3_1, S3_2, S3_3, S3_4, S3_5, S3_6],
    },
    {
      id: 'ch4',
      number: 4,
      title: 'The Theory of Special Relativity',
      summary: 'The ether that could not be found, Einstein\'s two postulates, what they do to time and space, and the equation that makes stars shine.',
      sections: [S4_1, S4_2, S4_3, S4_4],
    },
    {
      id: 'ch5',
      number: 5,
      title: 'The Interaction of Light and Matter',
      summary: 'Spectral lines and Kirchhoff\'s laws, the photon, Bohr\'s atom, and the quantum mechanics that explains why every element has its own fingerprint in the light.',
      sections: [S5_1, S5_2, S5_3, S5_4],
    },
    {
      id: 'ch6',
      number: 6,
      title: 'Telescopes',
      summary: 'Light buckets and their limits; lenses, mirrors and mounts; radio dishes and interferometers; the infrared, ultraviolet, X-ray and gamma-ray sky from above the air; and the surveys and archives that now map everything.',
      sections: [S6_1, S6_2, S6_3, S6_4, S6_5],
    },
    {
      id: 'ch7',
      number: 7,
      title: 'Binary Systems and Stellar Parameters',
      summary: 'Why a star can only be weighed by a companion; the classes of double star; masses from visual orbits, velocity curves and eclipses; the mass–luminosity relation; and the same methods, pushed a million times further, finding planets around other suns.',
      sections: [S7_1, S7_2, S7_3, S7_4],
    },
    {
      id: 'ch8',
      number: 8,
      title: 'The Classification of Stellar Spectra',
      summary: 'How the Harvard sequence was found and why it is a thermometer; Boltzmann and Saha; the spectra of the planets; the Hertzsprung–Russell diagram, its main sequence, giants, white dwarfs and planets; luminosity classes and distances from a spectrum.',
      sections: [S8_1, S8_2],
    },
    {
      id: 'ch9', number: 9,
      title: 'Stellar Atmospheres',
      summary: 'How light escapes a star and what it carries: the radiation field, opacity and optical depth, the random walk of photons, the transfer equation and its gray solution, limb darkening, and the profiles of spectral lines that reveal temperature, pressure, rotation and the composition of the Sun.',
      sections: [S9_1, S9_2, S9_3, S9_4, S9_5],
    },
  ],
};
