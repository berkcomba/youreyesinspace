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
  | { type: 'spectrum' };

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
      kicker: 'Where it begins',
      title: 'What the ancients actually saw',
      scene: [goto('earth'), rate(1)],
      body: [
        p('Before telescopes, before physics, there was only the naked eye and a dark sky. Watch it for a few nights and you notice patterns that are almost suspiciously regular. The whole dome of stars turns once a night around a fixed point in the north. The Sun drifts eastward against the stars and comes back to the same place after a year. The Moon changes shape on a 29½-day cycle.'),
        p('And then there are five lights that refuse to behave. They look like stars but they wander among the constellations, speed up, slow down, and sometimes stop and go <em>backwards</em> for a few weeks. The Greeks called them <em>planētai</em> — wanderers. We still do.'),
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
  ],
};
