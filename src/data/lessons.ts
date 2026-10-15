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
  | { type: 'pauli' };

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
  ],
};
