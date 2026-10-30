/**
 * The Great Expedition campaign graph: 70 destinations in five chapters, Earth → the
 * observable-universe horizon. Edges are learning progression, not flight paths.
 * Public data (no answers): shared by the cockpit and the crew phones.
 */

export type ChapterId = 'solar' | 'interstellar' | 'milkyway' | 'localgroup' | 'frontier';
export type NodeKind = 'OBJECT' | 'REGION' | 'CONCEPT';

export interface Chapter {
  id: ChapterId;
  title: string;
  scale: string;
  /** node that must be discovered, plus how many of the chapter's nodes, to open the next one */
  finale: string;
  needed: number;
}

export interface ExpeditionNode {
  id: string;
  chapter: ChapterId;
  title: string;
  kind: NodeKind;
  /** discovered any one of these (root: none) */
  after: string[];
  focus: string;
  /** playable in this build (target audited, three gates authored) */
  available: boolean;
  /** scene body the camera flies to */
  body?: string;
  /** or: a catalogue star (exact name) whose system the camera flies into */
  star?: string;
  /** or: a nebula / cluster landmark id */
  landmark?: string;
  /** or: a galaxy by catalogue name ('#0' = the Milky Way) */
  galaxy?: string;
  /** or: a black hole by universal id (b0 = Sgr A*, cygx1, …) */
  blackhole?: string;
  /** or: pulled back this many parsecs from the Sun, for scales no single object shows */
  vista?: number;
  /** a vista framing home and this galaxy together */
  aim?: string;
  /** a galaxy shot this many times wider than usual */
  zoom?: number;
  /** or: inside a galaxy cluster, framed on these catalogued members */
  cluster?: string[];
  /** a region is shown from above its orbit instead of up close */
  overview?: string;
  summary?: string;
  facts?: string[];
  sources?: string[];
}

export const CHAPTERS: Chapter[] = [
  { id: 'solar', title: 'Solar System', scale: 'light-hours', finale: 'S15', needed: 10 },
  { id: 'interstellar', title: 'Interstellar Journey', scale: 'light-years', finale: 'I15', needed: 10 },
  { id: 'milkyway', title: 'Milky Way', scale: 'thousands of light-years', finale: 'G20', needed: 12 },
  { id: 'localgroup', title: 'Local Group', scale: 'millions of light-years', finale: 'L10', needed: 7 },
  { id: 'frontier', title: 'Cosmic Frontier', scale: 'billions of light-years', finale: 'C10', needed: 7 },
];

const N = (id: string, chapter: ChapterId, title: string, kind: NodeKind, after: string[], focus: string, extra: Partial<ExpeditionNode> = {}): ExpeditionNode =>
  ({ id, chapter, title, kind, after, focus, available: false, ...extra });

const NASA = (p: string) => `https://science.nasa.gov/${p}`;
const WIKI = (p: string) => `https://en.wikipedia.org/wiki/${p}`;

export const NODES: ExpeditionNode[] = [
  // ── I · Solar System ──────────────────────────────────────────────
  N('S01', 'solar', 'Earth — Home', 'OBJECT', [], 'Solar System scale, Earth rotation', {
    available: true, body: 'earth',
    summary: 'Every expedition starts at home. A short practice run teaches the crew how Knowledge Gates work. Nothing is locked here.',
    facts: ['The only world known to host life', 'Our day is slowly lengthening because of the Moon\'s tides', 'Closest to the Sun in early January'],
    sources: [NASA('earth/')],
  }),
  N('S02', 'solar', 'The Moon', 'OBJECT', ['S01'], 'Tidal locking, craters, lunar phases', {
    available: true, body: 'moon',
    summary: 'Our closest neighbour, 384,400 km away. Its dark seas are ancient lava, and twelve people have walked on it.',
    facts: ['Spins exactly once per orbit, so one face always points at Earth', 'Drifts ~3.8 cm farther from Earth every year', 'Bootprints from 1969–1972 are still there'],
    sources: [NASA('moon/'), NASA('moon/facts/')],
  }),
  N('S03', 'solar', 'Venus', 'OBJECT', ['S01'], 'Greenhouse effect, atmosphere, rotation', {
    available: true, body: 'venus',
    summary: 'Earth\'s "twin" in size, but with an atmosphere that turned it into the hottest planet, and it spins backwards.',
    facts: ['Surface ~465 °C, hot enough to melt lead', 'A day (243 Earth days) is longer than its year (225)', 'Clouds of sulfuric acid droplets'],
    sources: [NASA('venus/'), NASA('venus/venus-facts/')],
  }),
  N('S04', 'solar', 'Mars', 'OBJECT', ['S01'], 'Rust, thin atmosphere, Martian day', {
    available: true, body: 'mars',
    summary: 'A cold desert world with the tallest volcano in the Solar System, blue sunsets and a whole fleet of robots on its surface.',
    facts: ['A sol lasts 24 h 39 min', 'Atmosphere ~95% carbon dioxide, under 1% of Earth\'s pressure', 'Home of the first powered flight on another world (Ingenuity, 2021)'],
    sources: [NASA('mars/'), NASA('mars/facts/')],
  }),
  N('S05', 'solar', 'Phobos', 'OBJECT', ['S04'], 'Martian moons, low gravity, orbit', {
    available: true, body: 'phobos',
    summary: 'A lumpy 22-km moon that circles Mars three times a day, and is slowly spiralling in to its doom.',
    facts: ['Orbits Mars in 7 h 39 min, only ~6,000 km above the surface', 'Its biggest crater, Stickney, is ~9 km across', 'Expected to crash or shatter into a ring in ~50 million years'],
    sources: [NASA('mars/moons/phobos/')],
  }),
  N('S06', 'solar', 'Ceres', 'OBJECT', ['S04'], 'Asteroid belt, dwarf-planet classification', {
    available: true, body: 'ceres',
    summary: 'The largest object in the asteroid belt: once called a planet, then an asteroid, now a dwarf planet with salty bright spots.',
    facts: ['Discovered by Giuseppe Piazzi on 1 January 1801', 'About a quarter of the asteroid belt\'s total mass', 'Orbited by NASA\'s Dawn from 2015 to 2018'],
    sources: [NASA('dwarf-planets/ceres/'), NASA('mission/dawn/')],
  }),
  N('S07', 'solar', 'Jupiter', 'OBJECT', ['S04', 'S06'], 'Gas giants, Great Red Spot, magnetosphere', {
    available: true, body: 'jupiter',
    summary: 'The king of the planets: more than twice the mass of all the others combined, with a storm wider than Earth.',
    facts: ['A day lasts just under 10 hours', 'The Great Red Spot is a centuries-old anticyclone', 'Its magnetosphere is the largest structure in the Solar System after the heliosphere'],
    sources: [NASA('jupiter/'), NASA('jupiter/jupiter-facts/')],
  }),
  N('S08', 'solar', 'Europa', 'OBJECT', ['S07'], 'Icy shell, subsurface ocean evidence', {
    available: true, body: 'europa',
    summary: 'An ice-covered moon of Jupiter hiding a global salty ocean, one of the best places to look for life beyond Earth.',
    facts: ['Slightly smaller than our Moon', 'Its ocean may hold about twice the water of Earth\'s oceans', 'NASA\'s Europa Clipper arrives in 2030'],
    sources: [NASA('jupiter/jupiter-moons/europa/'), NASA('mission/europa-clipper/')],
  }),
  N('S09', 'solar', 'Saturn', 'OBJECT', ['S07'], 'Rings, density, icy particles', {
    available: true, body: 'saturn',
    summary: 'The ringed giant: a planet less dense than water, crowned by a hexagon-shaped jet stream at its north pole.',
    facts: ['Average density ~0.69 g/cm³, less than water', 'Main rings are hundreds of thousands of km wide but typically ~10 m thick', 'Cassini studied it for 13 years (2004–2017)'],
    sources: [NASA('saturn/'), NASA('mission/cassini/')],
  }),
  N('S10', 'solar', 'Titan', 'OBJECT', ['S09'], 'Nitrogen atmosphere, methane lakes', {
    available: true, body: 'titan',
    summary: 'A moon bigger than Mercury with a thick orange sky, methane rain and seas of liquid hydrocarbons.',
    facts: ['The only moon with a dense atmosphere', 'Surface pressure ~1.5 times Earth\'s', 'Huygens landed here in 2005; Dragonfly is next'],
    sources: [NASA('saturn/moons/titan/'), NASA('mission/dragonfly/')],
  }),
  N('S11', 'solar', 'Uranus', 'OBJECT', ['S09'], 'Axis tilt, ice-giant composition', {
    available: true, body: 'uranus',
    summary: 'The sideways planet: tipped over by ~98°, so each pole spends 42 years in sunlight and 42 in darkness.',
    facts: ['First planet discovered with a telescope (Herschel, 1781)', 'Visited only once, by Voyager 2 in 1986', 'Its moons are named after Shakespeare and Pope characters'],
    sources: [NASA('uranus/'), NASA('uranus/uranus-facts/')],
  }),
  N('S12', 'solar', 'Neptune', 'OBJECT', ['S11'], 'Winds, orbit, ice giants', {
    available: true, body: 'neptune',
    summary: 'The windiest world, found with mathematics before anyone saw it in a telescope.',
    facts: ['Winds faster than 2,000 km/h', 'One orbit takes ~165 years: it completed its first since discovery in 2011', 'Its big moon Triton orbits backwards'],
    sources: [NASA('neptune/'), NASA('neptune/neptune-facts/')],
  }),
  N('S13', 'solar', 'Pluto', 'OBJECT', ['S12'], 'Kuiper Belt objects, dwarf planets', {
    available: true, body: 'pluto',
    summary: 'The dwarf planet with a heart of nitrogen ice, revealed by New Horizons in 2015.',
    facts: ['Named in 1930 by 11-year-old Venetia Burney', 'Reclassified as a dwarf planet in 2006', 'Sunlight takes ~5.5 hours to get there'],
    sources: [NASA('dwarf-planets/pluto/'), NASA('mission/new-horizons/')],
  }),
  N('S14', 'solar', 'Kuiper Belt Survey', 'REGION', ['S13'], 'Distant small bodies and belt structure', {
    available: true, body: 'haumea', overview: 'pluto',
    summary: 'A vast ring of icy leftovers beyond Neptune, 30–50 times Earth\'s distance from the Sun, home to Pluto, Haumea, Makemake and Arrokoth.',
    facts: ['First object after Pluto found in 1992 (nicknamed "Smiley")', 'Haumea spins in under 4 hours', 'Arrokoth is the most distant world ever visited (2019)'],
    sources: [NASA('solar-system/kuiper-belt/'), NASA('dwarf-planets/haumea/')],
  }),
  N('S15', 'solar', 'Voyager 1 Frontier', 'OBJECT', ['S14'], 'Heliosphere, interstellar medium', {
    available: true, body: 'voyager1',
    summary: 'The farthest human-made object, in interstellar space since 2012 and still talking to Earth.',
    facts: ['Launched 5 September 1977', 'Crossed the heliopause on 25 August 2012', 'Reaches one light-day from Earth around November 2026'],
    sources: [NASA('mission/voyager/voyager-1/'), 'https://voyager.jpl.nasa.gov/'],
  }),

  // ── II · Interstellar ─────────────────────────────────────────────
  N('I01', 'interstellar', 'Proxima Centauri', 'OBJECT', ['S15'], 'Nearest known star, red dwarf', {
    available: true, star: 'Proxima Centauri',
    summary: 'The closest star to the Sun, 4.24 light-years away: a small, cool red dwarf with at least two planets, one in its habitable zone.',
    facts: ['Too faint to see without a telescope', 'Proxima b orbits it every 11.2 days', 'Prone to violent flares that can briefly multiply its brightness'],
    sources: [WIKI('Proxima_Centauri'), 'https://www.eso.org/public/news/eso1629/'],
  }),
  N('I02', 'interstellar', 'Alpha Centauri System', 'REGION', ['I01'], 'Binary / triple-star context', {
    available: true, star: 'Rigil Kentaurus',
    summary: 'Two Sun-like stars waltzing around each other every 80 years, with little Proxima circling far outside: our nearest stellar family.',
    facts: ['Alpha Centauri A and B orbit each other every ~79.9 years', 'Together the third-brightest point in the night sky', 'Proxima is ~13,000 times Earth\'s distance from the pair'],
    sources: [WIKI('Alpha_Centauri')],
  }),
  N('I03', 'interstellar', 'Barnard\'s Star', 'OBJECT', ['I01'], 'Proper motion, red dwarfs', {
    available: true, star: 'Barnard\'s Star',
    summary: 'The fastest-moving star across our sky: an ancient red dwarf 6 light-years away that crosses a Moon-width every ~180 years.',
    facts: ['Discovered moving by E. E. Barnard in 1916', 'Proper motion ~10.3 arcseconds per year', 'Four small rocky planets confirmed in 2024–2025'],
    sources: [WIKI('Barnard%27s_Star')],
  }),
  N('I04', 'interstellar', 'Sirius System', 'REGION', ['I02'], 'Binary system, white dwarf Sirius B', {
    available: true, star: 'Sirius',
    summary: 'The brightest star in the night sky, 8.6 light-years away, with a hidden companion: an Earth-sized white dwarf as heavy as the Sun.',
    facts: ['Apparent magnitude −1.46, the brightest after the Sun', 'Sirius B was predicted from a wobble in 1844 and seen in 1862', 'The two orbit each other every ~50 years'],
    sources: [WIKI('Sirius')],
  }),
  N('I05', 'interstellar', 'Epsilon Eridani', 'OBJECT', ['I02'], 'Young nearby star, debris disk', {
    available: true, star: 'Ran',
    summary: 'A young, restless orange star 10.5 light-years away, wrapped in belts of dust and rock like an early Solar System.',
    facts: ['Officially named Ran, after the Norse sea goddess, in 2015', 'Its giant planet is named AEgir', 'Only a few hundred million years old'],
    sources: [WIKI('Epsilon_Eridani')],
  }),
  N('I06', 'interstellar', 'Tau Ceti', 'OBJECT', ['I03'], 'Nearby Sun-like stars', {
    available: true, star: 'τ Cet',
    summary: 'The nearest single Sun-like star you can see with the naked eye, 11.9 light-years away and a long-time favourite of science fiction.',
    facts: ['About 78% of the Sun\'s mass', 'One of the first two targets of a radio search for aliens (1960)', 'Surrounded by about ten times more dust than our Solar System'],
    sources: [WIKI('Tau_Ceti')],
  }),
  N('I07', 'interstellar', '61 Cygni', 'REGION', ['I03'], 'Parallax and stellar distances', {
    available: true, star: '61 Cyg',
    summary: 'A pair of orange dwarfs that made history: in 1838 it became the first star whose distance was ever measured.',
    facts: ['Friedrich Bessel measured its parallax in 1838', 'About 11.4 light-years away', 'Nicknamed "Piazzi\'s Flying Star" for its fast motion'],
    sources: [WIKI('61_Cygni')],
  }),
  N('I08', 'interstellar', 'Vega', 'OBJECT', ['I04'], 'Stellar colour and luminosity', {
    available: true, star: 'Vega',
    summary: 'A brilliant blue-white star 25 light-years away: the yardstick of stellar brightness and a former and future North Star.',
    facts: ['The first star other than the Sun ever photographed (1850)', 'Was the pole star around 12,000 BC and will be again', 'About 40 times as luminous as the Sun'],
    sources: [WIKI('Vega')],
  }),
  N('I09', 'interstellar', 'Altair', 'OBJECT', ['I04'], 'Rotation and stellar shape', {
    available: true, star: 'Altair',
    summary: 'A star spinning so fast it is squashed: Altair turns in about nine hours, and its equator bulges about 20% wider than its poles.',
    facts: ['About 16.7 light-years away', 'In 2007 one of the first stars beyond the Sun with an imaged surface', 'The cowherd star of the Tanabata legend'],
    sources: [WIKI('Altair')],
  }),
  N('I10', 'interstellar', 'Fomalhaut', 'OBJECT', ['I05'], 'Circumstellar dust, evidence quality', {
    available: true, star: 'Fomalhaut',
    summary: 'A young star 25 light-years away inside a giant dusty ring, and the scene of a planet that may never have existed.',
    facts: ['Its sharp dust ring earned the nickname "the Eye of Sauron"', 'A 2008 "planet" image turned out to be a fading dust cloud', 'The name means "mouth of the fish" in Arabic'],
    sources: [WIKI('Fomalhaut'), WIKI('Fomalhaut_b')],
  }),
  N('I11', 'interstellar', 'Betelgeuse', 'OBJECT', ['I08'], 'Red supergiants, variability', {
    available: true, star: 'Betelgeuse',
    summary: 'Orion\'s red shoulder: a dying supergiant so huge that, in the Sun\'s place, it would swallow the orbits of Mercury, Venus, Earth and Mars.',
    facts: ['Roughly 550 light-years away', 'Dimmed dramatically in 2019–2020 behind a cloud of its own dust', 'Will explode as a supernova, probably within 100,000 years'],
    sources: [WIKI('Betelgeuse'), WIKI('Great_Dimming_of_Betelgeuse')],
  }),
  N('I12', 'interstellar', 'Rigel', 'OBJECT', ['I11'], 'Blue supergiants, stellar life cycle', {
    available: true, star: 'Rigel',
    summary: 'Orion\'s blue-white foot: a young supergiant tens of thousands of times more luminous than the Sun, burning through its fuel fast.',
    facts: ['About 860 light-years away', 'Usually the brightest star in Orion', 'Its name comes from the Arabic word for "foot"'],
    sources: [WIKI('Rigel')],
  }),
  N('I13', 'interstellar', 'Deneb', 'OBJECT', ['I09'], 'Stellar luminosity and distances', {
    available: true, star: 'Deneb',
    summary: 'The tail of the Swan: one of the most luminous stars we can see with the naked eye, so far away that its distance is still debated.',
    facts: ['Distance estimates range from ~1,400 to ~2,600 light-years', 'The farthest of the 1st-magnitude stars', 'Corner of the Summer Triangle with Vega and Altair'],
    sources: [WIKI('Deneb')],
  }),
  N('I14', 'interstellar', 'Pleiades Cluster', 'REGION', ['I12', 'I13'], 'Star clusters and shared origin', {
    available: true, landmark: 'l-pleiades',
    summary: 'The Seven Sisters: a family of more than a thousand young stars born together about 100 million years ago, 444 light-years away.',
    facts: ['Catalogued as Messier 45', 'Its Japanese name, Subaru, is on the car maker\'s logo', 'The blue haze is a passing dust cloud, not its birth nebula'],
    sources: [WIKI('Pleiades')],
  }),
  N('I15', 'interstellar', 'Orion Nebula', 'REGION', ['I14'], 'Star formation and nebulae', {
    available: true, landmark: 'l-m42',
    summary: 'The nearest big stellar nursery, about 1,340 light-years away: a glowing cloud 24 light-years wide where thousands of stars are being born.',
    facts: ['Visible to the naked eye in Orion\'s sword', 'Lit by the hot young stars of the Trapezium', 'Hubble found dozens of planet-forming discs inside it'],
    sources: [WIKI('Orion_Nebula')],
  }),

  // ── III · Milky Way ───────────────────────────────────────────────
  N('G01', 'milkyway', 'Milky Way Survey', 'CONCEPT', ['I15'], 'Galactic structure and scale', {
    available: true, galaxy: '#0',
    summary: 'Our home galaxy: a barred spiral about 100,000 light-years across, holding hundreds of billions of stars in a thin, slowly turning disc.',
    facts: ['Roughly 100–400 billion stars', 'The disc is only about 1,000 light-years thick', 'A bar of old stars crosses its central bulge'],
    sources: [WIKI('Milky_Way'), NASA('universe/galaxies/')],
  }),
  N('G02', 'milkyway', 'Orion Arm', 'REGION', ['G01'], 'Our place in the galaxy', {
    available: true, vista: 4000,
    summary: 'A modest spiral arm about 26,000 light-years from the galactic centre, home to the Sun, the Orion Nebula and most stars you see at night.',
    facts: ['Also called the Local Arm or Orion–Cygnus Arm', 'Lies between the Sagittarius and Perseus arms', 'The Sun circles the galaxy once every ~230 million years'],
    sources: [WIKI('Orion_Arm'), WIKI('Galactic_year')],
  }),
  N('G03', 'milkyway', 'Crab Nebula', 'OBJECT', ['G02'], 'Supernova remnant', {
    available: true, landmark: 'l-m1',
    summary: 'The glowing wreck of a star whose explosion lit up the daytime sky in 1054, still expanding at about 1,500 km per second.',
    facts: ['Number 1 in Charles Messier\'s catalogue (M1)', 'About 6,500 light-years away in Taurus', 'Roughly 11 light-years across'],
    sources: [WIKI('Crab_Nebula'), NASA('mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-1/')],
  }),
  N('G04', 'milkyway', 'Crab Pulsar', 'OBJECT', ['G03'], 'Neutron stars and pulsar beams', {
    available: true, landmark: 'l-crabpsr',
    summary: 'A city-sized neutron star at the heart of the Crab Nebula, spinning about 30 times a second and powering the whole cloud around it.',
    facts: ['Spins once every ~33 milliseconds', 'Discovered in 1968', 'First pulsar seen flashing in visible light (1969)'],
    sources: [WIKI('Crab_Pulsar')],
  }),
  N('G05', 'milkyway', 'Geminga', 'OBJECT', ['G02'], 'Pulsars, gamma-ray emission', {
    available: true, landmark: 'l-geminga',
    summary: 'A nearby dead star that blazes in gamma rays yet is nearly silent in radio, so mysterious that its name means "it isn\'t there".',
    facts: ['Roughly 800 light-years away, towards Gemini', 'Spins about 4 times a second', 'Found as a gamma-ray source in 1972'],
    sources: [WIKI('Geminga')],
  }),
  N('G06', 'milkyway', 'Vela Pulsar', 'OBJECT', ['G02'], 'Rapid rotation, beam geometry', {
    available: true, landmark: 'l-vela',
    summary: 'A neutron star spinning about 11 times a second inside the shredded remains of a supernova seen by our Ice Age ancestors.',
    facts: ['About 1,000 light-years away in Vela, the Sails', 'One of the brightest gamma-ray sources in the sky', 'Famous for sudden spin-up "glitches"'],
    sources: [WIKI('Vela_Pulsar'), WIKI('Vela_Supernova_Remnant')],
  }),
  N('G07', 'milkyway', 'Cassiopeia A', 'OBJECT', ['G02'], 'Supernova debris', {
    available: true, landmark: 'l-casa',
    summary: 'A bubble of star guts about 11,000 light-years away, whose light reached Earth around 1680, and one of the brightest radio sources in the sky.',
    facts: ['About 10 light-years across', 'A neutron star hides at its centre', 'Rich in silicon, sulfur and iron forged by the dead star'],
    sources: [WIKI('Cassiopeia_A'), 'https://chandra.harvard.edu/photo/2017/casa_life/'],
  }),
  N('G08', 'milkyway', 'PSR B1919+21', 'OBJECT', ['G02'], 'First discovered pulsar', {
    available: true, landmark: 'l-b1919',
    summary: 'The first pulsar ever found: a ticking radio signal so regular in 1967 that it was jokingly nicknamed "Little Green Men 1".',
    facts: ['Pulses every ~1.337 seconds', 'Discovered by Jocelyn Bell Burnell in 1967', 'Its pulse plot became a famous album cover'],
    sources: [WIKI('PSR_B1919%2B21'), WIKI('Jocelyn_Bell_Burnell')],
  }),
  N('G09', 'milkyway', 'PSR B1257+12', 'OBJECT', ['G08'], 'Pulsar planets', {
    available: true, landmark: 'l-lich',
    summary: 'A dead star named Lich with three planets in tow: the first worlds ever confirmed beyond our Solar System, announced in 1992.',
    facts: ['Planets named Draugr, Poltergeist and Phobetor', 'Spins about 160 times a second', 'Found with the Arecibo radio telescope'],
    sources: [WIKI('PSR_B1257%2B12'), 'https://www.iau.org/public/themes/naming_exoworlds/'],
  }),
  N('G10', 'milkyway', 'PSR J0437−4715', 'OBJECT', ['G08'], 'Millisecond pulsars', {
    available: true, landmark: 'l-j0437',
    summary: 'The nearest and brightest millisecond pulsar, about 500 light-years away, spinning about 174 times a second with a white dwarf partner.',
    facts: ['In the southern constellation Pictor', 'Its white dwarf companion orbits every ~5.7 days', 'NICER measured its radius at about 11 km'],
    sources: [WIKI('PSR_J0437%E2%88%924715'), 'https://www.nasa.gov/mission/nicer/'],
  }),
  N('G11', 'milkyway', 'PSR J1748−2446ad', 'OBJECT', ['G08'], 'Extreme stellar rotation', {
    available: true, landmark: 'l-j1748',
    summary: 'The fastest-spinning star known: a city-sized neutron star in the globular cluster Terzan 5 that turns 716 times every second.',
    facts: ['Spins 716 times per second', 'Lives in the crowded globular cluster Terzan 5', 'Found with the Green Bank Telescope, announced in 2006'],
    sources: [WIKI('PSR_J1748%E2%88%922446ad'), WIKI('Terzan_5')],
  }),
  N('G12', 'milkyway', 'Cygnus X-1', 'OBJECT', ['G02'], 'Stellar-mass black holes', {
    available: true, blackhole: 'cygx1',
    summary: 'About 7,000 light-years away in Cygnus, a black hole of about 21 Suns tears gas from a blue supergiant and glows fiercely in X-rays.',
    facts: ['The first object widely accepted as a black hole', 'Its companion star circles it every 5.6 days', 'Subject of a famous 1974 bet by Stephen Hawking'],
    sources: [WIKI('Cygnus_X-1')],
  }),
  N('G13', 'milkyway', 'Carina Nebula', 'REGION', ['G02'], 'Massive stars, stellar nurseries', {
    available: true, landmark: 'l-carina',
    summary: 'One of the biggest, brightest stellar nurseries in our galaxy, about 7,500–8,500 light-years away, where monster stars carve towering pillars.',
    facts: ['Catalogued as NGC 3372', 'Larger and brighter in our sky than the Orion Nebula', 'Home of Hubble\'s "Mystic Mountain" and Webb\'s "Cosmic Cliffs"'],
    sources: [WIKI('Carina_Nebula'), NASA('missions/webb/')],
  }),
  N('G14', 'milkyway', 'Eta Carinae', 'OBJECT', ['G13'], 'Massive unstable stars', {
    available: true, landmark: 'l-etacar',
    summary: 'A restless giant pair of stars, together more than 100 times the Sun\'s mass, wrapped in the glowing double cloud it blasted out in the 1840s.',
    facts: ['Briefly the second-brightest star in the sky in 1843', 'Hidden inside the two-lobed Homunculus Nebula', 'Two huge stars orbit each other every 5.5 years'],
    sources: [WIKI('Eta_Carinae'), WIKI('Homunculus_Nebula')],
  }),
  N('G15', 'milkyway', 'Omega Centauri', 'REGION', ['G14', 'G02'], 'Globular star clusters', {
    available: true, landmark: 'l-omegacen',
    summary: 'The Milky Way\'s largest globular cluster: about 10 million ancient stars in a glittering ball, possibly the leftover heart of a swallowed galaxy.',
    facts: ['About 17,000 light-years away, visible to the naked eye', 'Ptolemy catalogued it as a single star', 'Hubble found signs of a middle-weight black hole in 2024'],
    sources: [WIKI('Omega_Centauri')],
  }),
  N('G16', 'milkyway', 'Galactic Halo', 'CONCEPT', ['G15'], 'Halo and globular clusters', {
    available: true, galaxy: '#0', zoom: 1.6,
    summary: 'A vast, faint sphere around the bright disc, scattered with ancient stars and globular clusters and filled with invisible dark matter.',
    facts: ['Holds more than 150 globular clusters', 'Its stars are old and poor in heavy elements', 'Dark matter here outweighs all the stars'],
    sources: [WIKI('Galactic_halo'), WIKI('Globular_cluster')],
  }),
  N('G17', 'milkyway', 'Galactic Center Survey', 'REGION', ['G12', 'G16'], 'Dense galactic centre', {
    available: true, galaxy: '#0', zoom: 0.15,
    summary: 'About 26,000 light-years away in Sagittarius, the galaxy\'s crowded core hides behind dust, revealed only in infrared, radio and X-rays.',
    facts: ['Lies in the direction of Sagittarius', 'Dust blocks almost all of its visible light', 'Home to one of the densest star clusters known'],
    sources: [WIKI('Galactic_Center')],
  }),
  N('G18', 'milkyway', 'Sagittarius A*', 'OBJECT', ['G17'], 'Supermassive black hole', {
    available: true, blackhole: 'b0',
    summary: 'The supermassive black hole at the heart of the Milky Way: about 4 million times the Sun\'s mass, first pictured by the Event Horizon Telescope in 2022.',
    facts: ['About 4 million times the Sun\'s mass', 'First image released in May 2022', 'Its discovery earned a share of the 2020 Nobel Prize'],
    sources: [WIKI('Sagittarius_A*'), NASA('resource/sagittarius-a/')],
  }),
  N('G19', 'milkyway', 'S2 Orbit', 'REGION', ['G18'], 'Stellar orbits around Sgr A*', {
    available: true, blackhole: 'b0', overview: 's2',
    summary: 'The star S2 swings around Sagittarius A* every 16 years, diving close enough to put Einstein\'s gravity to the test.',
    facts: ['Completes one orbit in about 16 years', 'Passed about 120 AU from the black hole in 2018', 'Next closest approach expected around 2034'],
    sources: [WIKI('S2_(star)'), 'https://www.eso.org/public/news/eso1825/'],
  }),
  N('G20', 'milkyway', 'Milky Way Exterior', 'CONCEPT', ['G19'], 'Galaxy-wide view, size comparison', {
    available: true, galaxy: '#0', zoom: 3,
    summary: 'Our home from outside: a barred spiral about 100,000 light-years wide with hundreds of billions of stars, and the Sun just one of them.',
    facts: ['The disc is about 100,000 light-years across', 'The Sun circles the centre in about 230 million years', 'Gaia mapped nearly 2 billion of its stars'],
    sources: [WIKI('Milky_Way'), 'https://www.esa.int/Science_Exploration/Space_Science/Gaia'],
  }),

  // ── IV · Local Group ──────────────────────────────────────────────
  N('L01', 'localgroup', 'Local Group Panorama', 'CONCEPT', ['G20'], 'Our galactic neighbourhood', {
    available: true, vista: 1.2e6, aim: 'Andromeda',
    summary: 'Our galactic home town: the Milky Way, Andromeda, Triangulum and dozens of small dwarf galaxies, all held together by gravity across ~10 million light-years.',
    facts: ['More than 80 known member galaxies, most of them dwarfs', 'Andromeda and the Milky Way hold most of its mass', 'Gravity keeps it together while the universe expands around it'],
    sources: [WIKI('Local_Group')],
  }),
  N('L02', 'localgroup', 'Andromeda (M31)', 'OBJECT', ['L01'], 'Galaxy scale, approaching motion', {
    available: true, galaxy: 'Andromeda',
    summary: 'The nearest big spiral galaxy, 2.5 million light-years away and about a trillion stars strong, falling toward the Milky Way at ~110 km/s.',
    facts: ['The most distant thing most people can see with the naked eye', 'Edwin Hubble proved it is a separate galaxy in the 1920s', 'Spans about six full Moons across the sky in long exposures'],
    sources: [WIKI('Andromeda_Galaxy'), NASA('mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/')],
  }),
  N('L03', 'localgroup', 'M31*', 'OBJECT', ['L02'], 'Andromeda\'s central black hole', {
    available: true, blackhole: 'm31star',
    summary: 'Andromeda\'s hidden giant: a black hole of more than 100 million Suns, sitting quietly inside a strange "double" nucleus of stars.',
    facts: ['Tens of times heavier than the Milky Way\'s Sagittarius A*', 'Hubble saw the nucleus split into two bright lumps, P1 and P2', 'Very faint in X-rays, because it is barely feeding'],
    sources: [WIKI('Andromeda_Galaxy'), WIKI('Supermassive_black_hole')],
  }),
  N('L04', 'localgroup', 'Triangulum (M33)', 'OBJECT', ['L01'], 'Spiral galaxies', {
    available: true, galaxy: 'Üçgen',
    summary: 'The Local Group\'s third-largest galaxy: a loose, star-forming spiral about 2.7 million light-years away, at the very edge of naked-eye vision.',
    facts: ['Catalogued as Messier 33 in the constellation Triangulum', 'Home to NGC 604, a giant glowing nursery ~1,500 light-years wide', 'Has no detectable supermassive black hole at its centre'],
    sources: [WIKI('Triangulum_Galaxy'), NASA('mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-33/')],
  }),
  N('L05', 'localgroup', 'M33 X-7', 'OBJECT', ['L04'], 'Massive stellar black hole', {
    available: true, blackhole: 'm33x7',
    summary: 'A black hole of ~16 Suns locked in a 3.45-day eclipsing dance with a monster star of ~70 Suns, 3 million light-years away.',
    facts: ['Its weighing was announced in 2007 using Chandra and Gemini', 'The companion star passes in front of it every orbit', 'At the time, the heaviest stellar black hole known in a binary'],
    sources: [WIKI('M33_X-7'), 'https://chandra.harvard.edu/photo/2007/m33x7/'],
  }),
  N('L06', 'localgroup', 'Large Magellanic Cloud', 'OBJECT', ['L01'], 'Satellite galaxies', {
    available: true, galaxy: 'Büyük Macellan',
    summary: 'The Milky Way\'s biggest satellite galaxy, 160,000 light-years away: a glowing cloud in the southern sky packed with nebulae and young stars.',
    facts: ['Visible to the naked eye from the southern hemisphere', 'Named after Ferdinand Magellan\'s 1519–1522 voyage', 'Trailed by the Magellanic Stream, a long ribbon of gas'],
    sources: [WIKI('Large_Magellanic_Cloud'), NASA('universe/galaxies/large-magellanic-cloud/')],
  }),
  N('L07', 'localgroup', 'Tarantula Nebula', 'REGION', ['L06'], 'Extreme star formation', {
    available: true, landmark: 'l-30dor',
    summary: 'The most active star factory in the Local Group: a glowing web of gas in the LMC so bright you can see it with the naked eye from 160,000 light-years.',
    facts: ['Also called 30 Doradus', 'Its spidery filaments gave it the name Tarantula', 'Imaged in stunning detail by JWST in 2022'],
    sources: [WIKI('Tarantula_Nebula'), 'https://esawebb.org/news/weic2212/'],
  }),
  N('L08', 'localgroup', 'R136a1', 'OBJECT', ['L07'], 'The most massive stars', {
    available: true, landmark: 'l-r136a1',
    summary: 'The heaviest star known: a blazing blue giant of roughly 200 Suns in the cluster R136, shining millions of times brighter than the Sun.',
    facts: ['Lies in the heart of the Tarantula Nebula', 'Mass estimates were revised down from ~315 to ~200 Suns in 2022', 'Blows off its outer layers in fierce stellar winds'],
    sources: [WIKI('R136a1'), 'https://noirlab.edu/public/news/noirlab2214/'],
  }),
  N('L09', 'localgroup', 'SN 1987A', 'OBJECT', ['L06'], 'A supernova seen in our lifetime', {
    available: true, landmark: 'l-sn1987a',
    summary: 'The closest supernova seen since 1604: a blue supergiant exploded in the LMC and lit up southern skies in February 1987.',
    facts: ['About 168,000 light-years away', 'A burst of neutrinos arrived hours before the light', 'JWST found strong evidence of a neutron star inside in 2024'],
    sources: [WIKI('SN_1987A'), 'https://esawebb.org/news/weic2404/'],
  }),
  N('L10', 'localgroup', 'Local Group Scale Finale', 'CONCEPT', ['L03', 'L05', 'L08'], 'Relative galaxy sizes and distances', {
    available: true, vista: 2.5e6, aim: 'Andromeda',
    summary: 'Galaxies are huge but packed close: shrink the Milky Way to a dinner plate and Andromeda is only a few metres away.',
    facts: ['Andromeda is about 25 Milky Way widths away', 'Andromeda\'s light left it about 2.5 million years ago', 'The Local Group lies inside the Laniakea Supercluster'],
    sources: [WIKI('Local_Group'), WIKI('Laniakea_Supercluster')],
  }),

  // ── V · Cosmic Frontier ───────────────────────────────────────────
  N('C01', 'frontier', 'Virgo Cluster', 'REGION', ['L10'], 'Clusters of galaxies', {
    available: true, cluster: ['M87', 'M86', 'M84', 'M49', 'M60', 'M100', 'M99'],
    summary: 'The nearest big city of galaxies, about 54 million light-years away: up to 2,000 galaxies swarming around the giant M87, held together by dark matter.',
    facts: ['Contains roughly 1,300–2,000 galaxies', 'Heart of the Virgo Supercluster, which includes the Milky Way', 'More than a dozen of its galaxies are in Messier\'s catalogue'],
    sources: [WIKI('Virgo_Cluster'), WIKI('Virgo_Supercluster')],
  }),
  N('C02', 'frontier', 'M87 Galaxy', 'OBJECT', ['C01'], 'Giant elliptical galaxy', {
    available: true, galaxy: 'M87',
    summary: 'A colossal ball of stars at the centre of the Virgo Cluster, about 53 million light-years away, firing a jet thousands of light-years long from its black hole.',
    facts: ['Also known as Virgo A, a powerful radio source', 'Has around 12,000 globular clusters', 'Its jet is about 5,000 light-years long'],
    sources: [WIKI('Messier_87'), NASA('mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-87/')],
  }),
  N('C03', 'frontier', 'M87*', 'OBJECT', ['C02'], 'Black-hole images, lensing', {
    available: true, blackhole: 'b1',
    summary: 'The first black hole ever photographed: a monster of about 6.5 billion Suns, its shadow ringed by glowing gas, imaged by an Earth-sized virtual telescope.',
    facts: ['Image released by the Event Horizon Telescope in April 2019', 'Observed in radio waves at a wavelength of 1.3 mm', 'Its shadow is wider than the event horizon, thanks to bent light'],
    sources: [WIKI('Messier_87*'), 'https://eventhorizontelescope.org/press-release-april-10-2019-astronomers-capture-first-image-black-hole'],
  }),
  N('C04', 'frontier', 'Centaurus A', 'OBJECT', ['C01'], 'Active galactic nucleus', {
    available: true, galaxy: 'Centaurus A',
    summary: 'The nearest radio galaxy, about 12 million light-years away: a dusty wreck from an ancient merger, with jets and lobes that span many full Moons in our sky.',
    facts: ['Also catalogued as NGC 5128', 'Its dark dust lane is the remains of a swallowed galaxy', 'Its radio lobes stretch across more sky than many full Moons'],
    sources: [WIKI('Centaurus_A'), 'https://www.eso.org/public/news/eso0903/'],
  }),
  N('C05', 'frontier', 'Coma Cluster', 'REGION', ['C01'], 'Cluster mass, dark matter', {
    available: true, vista: 1.2e8,
    summary: 'A giant cluster of 1,000+ galaxies, about 320 million light-years away, where Fritz Zwicky first noticed in 1933 that most of the mass is missing from view.',
    facts: ['Dominated by two giant ellipticals, NGC 4889 and NGC 4874', 'Filled with hot gas that glows in X-rays', 'Zwicky called the hidden mass "dunkle Materie": dark matter'],
    sources: [WIKI('Coma_Cluster'), WIKI('Dark_matter')],
  }),
  N('C06', 'frontier', 'Laniakea', 'CONCEPT', ['C05'], 'Superclusters and cosmic flows', {
    available: true, vista: 2.5e8,
    summary: 'Our home supercluster, "immense heaven" in Hawaiian: about 100,000 galaxies spread over some 520 million light-years, all flowing toward the Great Attractor.',
    facts: ['Defined in 2014 by Brent Tully and colleagues', 'Its borders are drawn from how galaxies move', 'The Virgo Supercluster is just one lobe of it'],
    sources: [WIKI('Laniakea_Supercluster'), 'https://www.nature.com/articles/nature13674'],
  }),
  N('C07', 'frontier', 'Cosmic Filaments', 'CONCEPT', ['C06'], 'The cosmic web (illustrative)', {
    available: true, vista: 6e8,
    summary: 'On the grandest scales galaxies line up along threads and sheets, the cosmic web. The strands drawn in this game are illustrative, not a real map.',
    facts: ['Clusters form where filaments meet', 'The Sloan Great Wall is over a billion light-years long', 'Thin, hot gas fills the space along the filaments'],
    sources: [WIKI('Galaxy_filament'), WIKI('Observable_universe#Large-scale_structure')],
  }),
  N('C08', 'frontier', 'Cosmic Voids', 'CONCEPT', ['C07'], 'Low-density regions', {
    available: true, vista: 1.5e9,
    summary: 'Vast bubbles with very few galaxies. Voids fill most of the universe\'s volume; the Boötes Void alone is about 330 million light-years across.',
    facts: ['The Boötes Void was discovered in 1981', 'Voids hold a few galaxies and very thin gas, not nothing', 'Matter drains out of voids toward the denser walls'],
    sources: [WIKI('Void_(astronomy)'), WIKI('Boötes_Void')],
  }),
  N('C09', 'frontier', 'Looking Back in Time', 'CONCEPT', ['C08'], 'Redshift and lookback time', {
    available: true, vista: 5e9,
    summary: 'Light takes time to travel, so the deeper we look the further back we see, all the way to galaxies born a few hundred million years after the Big Bang.',
    facts: ['Expanding space stretches light toward the red', 'Hubble showed in 1929 that distant galaxies recede faster', 'The oldest light we see left ~380,000 years after the Big Bang'],
    sources: [WIKI('Redshift'), WIKI('Hubble\'s_law'), NASA('mission/webb/')],
  }),
  N('C10', 'frontier', 'Observable Universe Horizon', 'CONCEPT', ['C09'], 'An observational limit, not an edge', {
    available: true, vista: 3.2e10,
    summary: 'The end of the journey is not an edge: it is as far as light has had time to reach us in 13.8 billion years. The universe beyond may go on forever.',
    facts: ['The universe is about 13.8 billion years old', 'The observable universe reaches ~46 billion light-years in every direction', 'The cosmic microwave background is the farthest light we can see'],
    sources: [WIKI('Observable_universe'), WIKI('Cosmic_microwave_background'), 'https://www.esa.int/Science_Exploration/Space_Science/Planck'],
  }),
];

export const NODE = new Map(NODES.map((n) => [n.id, n]));
export const ROOT = 'S01';

/** Chapter `i` is open when the previous chapter's finale and enough of its nodes are discovered. */
export function chapterOpen(ch: ChapterId, discovered: ReadonlySet<string>): boolean {
  const i = CHAPTERS.findIndex((c) => c.id === ch);
  if (i <= 0) return true;
  const prev = CHAPTERS[i - 1];
  const count = NODES.filter((n) => n.chapter === prev.id && discovered.has(n.id)).length;
  return discovered.has(prev.finale) && count >= prev.needed;
}

export type NodeState = 'discovered' | 'assisted' | 'reachable' | 'locked' | 'unavailable';

export function nodeState(n: ExpeditionNode, discovered: ReadonlySet<string>, assisted: ReadonlySet<string>): NodeState {
  if (discovered.has(n.id)) return assisted.has(n.id) ? 'assisted' : 'discovered';
  const prereq = n.after.length === 0 || n.after.some((a) => discovered.has(a));
  if (!prereq || !chapterOpen(n.chapter, discovered)) return 'locked';
  return n.available ? 'reachable' : 'unavailable';
}

/** Plain-language unlock rule shown on locked nodes. */
export function unlockHint(n: ExpeditionNode, discovered: ReadonlySet<string>): string {
  const ch = CHAPTERS.find((c) => c.id === n.chapter)!;
  const i = CHAPTERS.indexOf(ch);
  if (!n.available && i > 0) return `${ch.title} is still being charted. It opens in a later season.`;
  if (i > 0 && !chapterOpen(n.chapter, discovered)) {
    const prev = CHAPTERS[i - 1];
    return `Discover ${NODE.get(prev.finale)!.title} and at least ${prev.needed} ${prev.title} destinations to unlock ${ch.title}.`;
  }
  const names = n.after.map((a) => NODE.get(a)!.title);
  return names.length > 1 ? `Discover ${names.slice(0, -1).join(', ')} or ${names[names.length - 1]} first.` : `Discover ${names[0]} first.`;
}
