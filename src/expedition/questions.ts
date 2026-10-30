/**
 * Knowledge Gate question bank: host-only. Must never be imported by the crew bundle,
 * since it carries the correct answers.
 *
 * Every gate has at least two variants on the same learning objective so a retry does not
 * replay a leaked answer. `right` is the correct choice; `wrong` the three distractors (the
 * order is shuffled per attempt). Facts are checked against the sources on the node.
 */

export interface Variant {
  q: string;
  right: string;
  wrong: [string, string, string];
  why: string;
}

/** [orientation, science, discovery] → variants */
export type GateBank = [Variant[], Variant[], Variant[]];

export const BANK: Record<string, GateBank> = {
  // Earth: the practice run
  S01: [
    [{
      q: 'Earth\'s day is getting slightly longer every century. What is mostly to blame?',
      right: 'The Moon\'s tides acting as a brake',
      wrong: ['Melting glaciers', 'The solar wind pushing on Earth', 'Big earthquakes'],
      why: 'Tidal friction transfers Earth\'s spin to the Moon\'s orbit: the day grows by roughly 2 milliseconds per century, and the Moon slowly moves away.',
    }],
    [{
      q: 'When in the year is Earth closest to the Sun?',
      right: 'Early January',
      wrong: ['Late June', 'The March equinox', 'Late September'],
      why: 'Perihelion falls around 3–4 January. Seasons come from Earth\'s 23.4° tilt, not from distance: northern winter happens when we are closest.',
    }],
    [{
      q: 'Which planet\'s name does NOT come from Greek or Roman mythology?',
      right: 'Earth',
      wrong: ['Mars', 'Saturn', 'Uranus'],
      why: '"Earth" comes from Old English and Germanic words for ground or soil. Every other planet is named after a Greek or Roman god.',
    }],
  ],

  S02: [
    [{
      q: 'The Moon is slowly moving away from Earth. By roughly how much each year?',
      right: 'About 3.8 centimetres',
      wrong: ['About 3.8 millimetres', 'About 38 centimetres', 'About 3.8 metres'],
      why: 'Lasers fired at the retroreflectors left by Apollo astronauts measure the distance to millimetres: the Moon recedes ~3.8 cm a year, about as fast as fingernails grow.',
    }, {
      q: 'We always see the same face of the Moon. How many times does it spin on its axis per orbit around Earth?',
      right: 'Exactly once',
      wrong: ['Zero, it doesn\'t spin', 'Twice', 'About 27 times'],
      why: 'Tidal locking: Earth\'s gravity long ago slowed the Moon until one spin matched one orbit (~27.3 days). It does rotate, just in step.',
    }],
    [{
      q: 'The dark patches on the Moon\'s near side are called "maria" (seas). What are they really?',
      right: 'Ancient plains of solidified lava',
      wrong: ['Dried-up ocean beds', 'Shadows cast by huge mountains', 'Fields of dark ice'],
      why: 'The maria are basalt that flooded giant impact basins 3–3.5 billion years ago. Early astronomers mistook them for seas, and the name stuck.',
    }, {
      q: 'Why can the Apollo bootprints last for millions of years?',
      right: 'There is no wind or water to erode them',
      wrong: ['Lunar soil is magnetic', 'Low gravity freezes the dust in place', 'Sunlight bakes them into rock'],
      why: 'With essentially no atmosphere there is no weather. Only micrometeorites and slow "gardening" by impacts will eventually blur the prints.',
    }],
    [{
      q: 'On Apollo 14, Alan Shepard did something on the Moon that nobody had done before. What?',
      right: 'Hit golf balls',
      wrong: ['Planted a tree', 'Played a harmonica', 'Rode a bicycle'],
      why: 'In February 1971 Shepard attached a 6-iron head to a sample-collection tool and hit two golf balls, one of which went "miles and miles", he joked.',
    }, {
      q: 'On Apollo 15, David Scott dropped a falcon feather together with another object to prove Galileo right. What was the other object?',
      right: 'A geologist\'s hammer',
      wrong: ['A moon rock', 'A camera', 'A wrench'],
      why: 'Without air resistance the hammer and the feather hit the ground at the same moment, live on TV in 1971. "Mr Galileo was correct," Scott said.',
    }],
  ],

  S03: [
    [{
      q: 'Venus spins so slowly that its day is longer than its year. How long is one full rotation?',
      right: 'About 243 Earth days',
      wrong: ['About 24 hours', 'About 59 Earth days', 'About 1,000 Earth days'],
      why: 'Venus turns once every ~243 Earth days but circles the Sun in ~225. (Mercury\'s rotation is the 59-day one.)',
    }, {
      q: 'If you could see the Sun from Venus\'s surface, where would it rise?',
      right: 'In the west',
      wrong: ['In the east', 'In the north', 'It would never rise'],
      why: 'Venus rotates backwards (retrograde) compared with most planets, so the Sun rises in the west and sets in the east, very slowly.',
    }],
    [{
      q: 'Venus\'s surface is around 465 °C, hotter than Mercury\'s. Why?',
      right: 'A runaway greenhouse effect in its thick CO₂ atmosphere',
      wrong: ['It is closer to the Sun than Mercury', 'Lava covers the whole surface', 'Its core is much hotter than Earth\'s'],
      why: 'A carbon-dioxide atmosphere ~90 times heavier than Earth\'s traps heat so well that night and day, poles and equator are all about equally scorching.',
    }, {
      q: 'Standing on Venus, the air pressure would feel like being how deep in Earth\'s ocean?',
      right: 'About 900 metres',
      wrong: ['About 9 metres', 'About 90 metres', 'About 9 kilometres'],
      why: 'Surface pressure is ~92 bar, similar to ~900 m under the sea, deep enough to crush many submarines.',
    }],
    [{
      q: 'The Soviet lander Venera 13 photographed Venus\'s surface in colour in 1982. How long did it survive?',
      right: 'About 2 hours',
      wrong: ['About 2 minutes', 'About 2 days', 'About 2 weeks'],
      why: 'Venera 13 lasted 127 minutes in the heat and pressure, far beyond its 32-minute design life, and sent back the first colour pictures from the surface.',
    }, {
      q: 'Venus\'s brilliant clouds are made mostly of droplets of what?',
      right: 'Sulfuric acid',
      wrong: ['Water', 'Liquid methane', 'Ammonia'],
      why: 'The cloud decks, ~50–70 km up, are sulfuric-acid droplets. They reflect ~75% of sunlight, which is why Venus is the brightest planet in our sky.',
    }],
  ],

  S04: [
    [{
      q: 'A Martian solar day is called a "sol". How long is it?',
      right: '24 hours 39 minutes',
      wrong: ['12 hours 20 minutes', '37 hours', '10 hours'],
      why: 'A sol is only ~40 minutes longer than our day. Rover teams on "Mars time" shift their schedules later every day.',
    }, {
      q: 'Mars\'s two small moons are named Phobos and Deimos. What do the names mean?',
      right: 'Fear and Dread',
      wrong: ['Day and Night', 'Fire and Ice', 'Hunter and Hound'],
      why: 'In Greek myth Phobos (fear/panic) and Deimos (dread) were the sons of Ares, the god of war, whose Roman name is Mars.',
    }],
    [{
      q: 'What gives Mars much of its reddish appearance?',
      right: 'Iron oxides in its dust and rocks',
      wrong: ['Methane in the atmosphere', 'Sulfur crystals covering the planet', 'Its distance from the Sun'],
      why: 'Iron-bearing minerals have oxidised (basically rusted), and fine red dust coats much of the planet and hangs in the air.',
    }, {
      q: 'Mars\'s thin atmosphere is made mostly of which gas?',
      right: 'Carbon dioxide',
      wrong: ['Nitrogen', 'Oxygen', 'Argon'],
      why: 'It is ~95% CO₂, with a few percent nitrogen and argon, at less than 1% of Earth\'s surface pressure.',
    }],
    [{
      q: 'What colour is a sunset on Mars?',
      right: 'Blue',
      wrong: ['Red', 'Green', 'Purple'],
      why: 'Fine Martian dust scatters blue light forward, close to the Sun\'s direction, so the sky around the setting Sun glows blue. Rovers have photographed it.',
    }, {
      q: 'Ingenuity, the first aircraft to fly on another planet, carried a tiny swatch of fabric. Where did it come from?',
      right: 'The Wright brothers\' 1903 Flyer',
      wrong: ['The Apollo 11 flag', 'Lindbergh\'s Spirit of St. Louis', 'Amelia Earhart\'s plane'],
      why: 'A stamp-sized piece of the Flyer\'s wing fabric rode under Ingenuity\'s solar panel: the first powered flight on Earth honoured by the first on Mars (2021).',
    }],
  ],

  S05: [
    [{
      q: 'Seen from the Martian surface, where does Phobos rise?',
      right: 'In the west',
      wrong: ['In the east', 'In the north', 'It never rises'],
      why: 'Phobos orbits faster than Mars rotates, so it overtakes the sky: it rises in the west and sets in the east, two or three times a day.',
    }, {
      q: 'How long does Phobos take to orbit Mars once?',
      right: 'About 7.7 hours',
      wrong: ['About 1 day', 'About 1 week', 'About 1 month'],
      why: 'Phobos circles Mars in 7 h 39 min, only ~6,000 km above the surface, closer than any other moon to its planet.',
    }],
    [{
      q: 'Phobos is spiralling slowly toward Mars. What is its likely fate in ~50 million years?',
      right: 'Crash into Mars or break apart into a ring',
      wrong: ['Escape into space', 'Settle into a stable, distant orbit', 'Merge with Deimos'],
      why: 'Tides from Mars drag Phobos inward by about 1.8 m per century. Eventually it will be torn apart into a ring or hit the surface.',
    }, {
      q: 'Phobos\'s largest crater, about 9 km wide, is named "Stickney". Who was Stickney?',
      right: 'The discoverer\'s wife, Angeline Stickney Hall',
      wrong: ['A Mars rover engineer', 'A Greek war god', 'The telescope that found Phobos'],
      why: 'Asaph Hall found both moons in 1877. Angeline Stickney encouraged him to keep looking, and the crater bears her maiden name.',
    }],
    [{
      q: 'Phobos\'s gravity is tiny. A person weighing 70 kg on Earth would weigh about as much as…',
      right: 'A chocolate bar (~40 g)',
      wrong: ['A house cat (~4 kg)', 'A medium dog (~10 kg)', 'A child (~25 kg)'],
      why: 'Surface gravity is about 0.06% of Earth\'s (and varies over its lumpy shape): a good jump could send you a long way.',
    }, {
      q: 'In 1959 a Soviet astrophysicist, Iosif Shklovsky, made a startling suggestion about Phobos. What was it?',
      right: 'That it might be hollow and artificial',
      wrong: ['That it was made of solid ice', 'That it was a piece of Earth', 'That it had its own moon'],
      why: 'He misread early orbit-decay data as Phobos being very light. Better measurements and spacecraft photos showed an ordinary rubble-rich rocky moon.',
    }],
  ],

  S06: [
    [{
      q: 'For about half a century after its discovery in 1801, astronomy books listed Ceres as…',
      right: 'A planet',
      wrong: ['A comet', 'A moon of Mars', 'A distant star'],
      why: 'Ceres was counted among the planets until so many similar bodies turned up that "asteroid" became a class. Since 2006 it is a dwarf planet.',
    }, {
      q: 'Roughly what share of the whole asteroid belt\'s mass is in Ceres alone?',
      right: 'About a quarter',
      wrong: ['About 1%', 'About three-quarters', 'About 99%'],
      why: 'Ceres (~940 km across) holds roughly a quarter of the belt\'s total mass; all the asteroids together would still weigh less than our Moon.',
    }],
    [{
      q: 'NASA\'s Dawn found dazzling bright spots in Ceres\'s Occator crater. What are they mostly made of?',
      right: 'Salts left by briny water',
      wrong: ['Fresh water ice', 'Diamonds', 'Exposed metal'],
      why: 'They are mostly sodium carbonate deposited when salty water from below reached the surface and evaporated, hinting at brine deep inside.',
    }, {
      q: 'Ahuna Mons is a lonely 4-km-tall mountain on Ceres. What is it thought to be?',
      right: 'A cryovolcano, an ice volcano',
      wrong: ['The central peak of an impact', 'A giant fallen boulder', 'A lava volcano'],
      why: 'It seems to have been built by salty mud and ice pushed up from inside, quite recently in geological terms.',
    }],
    [{
      q: 'The element cerium is named after Ceres. Which element was named after a newly found asteroid in the same era?',
      right: 'Palladium, after Pallas',
      wrong: ['Uranium, after Uranus', 'Titanium, after Titan', 'Plutonium, after Pluto'],
      why: 'William Wollaston named palladium in 1802 after the asteroid Pallas, discovered just months earlier. Uranium and plutonium are named after planets.',
    }, {
      q: 'Dawn was the first spacecraft to orbit two different worlds beyond Earth. Which two?',
      right: 'Vesta and Ceres',
      wrong: ['The Moon and Mars', 'Ceres and Pallas', 'Mars and Phobos'],
      why: 'Its ion engines let Dawn orbit Vesta (2011–12), leave, and then orbit Ceres (2015–18), where it remains, silent.',
    }],
  ],

  S07: [
    [{
      q: 'Jupiter has the shortest day of any planet. About how long is it?',
      right: 'About 10 hours',
      wrong: ['About 3 hours', 'About 24 hours', 'About 40 hours'],
      why: 'Jupiter spins in 9 h 56 min. The fast spin flattens it visibly: it\'s ~7% wider at the equator than pole to pole.',
    }, {
      q: 'Jupiter and the Sun orbit their common centre of mass. Where is that point?',
      right: 'Just outside the Sun\'s surface',
      wrong: ['At the centre of the Sun', 'Inside Jupiter', 'Halfway between them'],
      why: 'Jupiter is so massive that the Sun–Jupiter balance point lies ~1.07 solar radii from the Sun\'s centre, so the Sun wobbles around it.',
    }],
    [{
      q: 'Which statement about the Great Red Spot is true?',
      right: 'It is a storm wider than Earth that has been shrinking',
      wrong: ['It is a giant volcano', 'It is the shadow of a moon', 'It is a hole showing Jupiter\'s core'],
      why: 'The anticyclone has been watched since at least 1831. It was once ~3 Earths wide; today it\'s about 1.3 and shrinking.',
    }, {
      q: 'If we could see Jupiter\'s magnetosphere from Earth, how big would it look in our sky?',
      right: 'Bigger than the full Moon',
      wrong: ['Smaller than a star', 'The same size as Jupiter\'s disk', 'Exactly half the sky'],
      why: 'It stretches millions of kilometres, with a tail beyond Saturn\'s orbit, so it would span more sky than the full Moon.',
    }],
    [{
      q: 'NASA\'s Juno carried three aluminium LEGO figures to Jupiter. Who were they?',
      right: 'Galileo, Jupiter and Juno',
      wrong: ['Three Apollo astronauts', 'Newton, Einstein and Hawking', 'Copernicus, Kepler and Brahe'],
      why: 'Galileo held a telescope, Jupiter a lightning bolt and Juno a magnifying glass, "searching for the truth".',
    }, {
      q: 'Galileo discovered Jupiter\'s four big moons in 1610. What did he first call them?',
      right: 'The Medicean Stars, after his patrons',
      wrong: ['The Children of Zeus', 'Names of his daughters', 'The Four Seasons'],
      why: 'He honoured the Medici family of Florence. The names Io, Europa, Ganymede and Callisto, proposed by Simon Marius, came into use much later.',
    }],
  ],

  S08: [
    [{
      q: 'Io, Europa and Ganymede move in a rhythm. For each orbit Ganymede makes, how many does Europa make?',
      right: '2',
      wrong: ['1', '3', '4'],
      why: 'It\'s a 1:2:4 resonance (Laplace resonance): Io orbits 4 times, Europa 2, Ganymede 1. The regular tugs keep their orbits stretched and their interiors heated.',
    }, {
      q: 'Compared with Earth\'s Moon, Europa is…',
      right: 'Slightly smaller',
      wrong: ['About twice as large', 'Ten times larger', 'Exactly the same size'],
      why: 'Europa is ~3,120 km across, about 90% of our Moon\'s diameter, yet it may hide more water than Earth.',
    }],
    [{
      q: 'Europa\'s hidden ocean may hold how much water compared with all of Earth\'s oceans?',
      right: 'About twice as much',
      wrong: ['About half as much', 'About the same', 'A hundred times more'],
      why: 'A salty ocean perhaps 60–150 km deep lies under an ice shell. Even on a small moon, that adds up to roughly twice Earth\'s seawater.',
    }, {
      q: 'What keeps Europa\'s subsurface ocean from freezing solid?',
      right: 'Tidal flexing by Jupiter\'s gravity',
      wrong: ['Sunlight through the ice', 'A thick greenhouse atmosphere', 'Hot springs fed by lava oceans on the surface'],
      why: 'As Europa moves along its slightly elliptical orbit, Jupiter squeezes and relaxes it, and the friction heats the interior.',
    }],
    [{
      q: 'NASA\'s Europa Clipper carries an engraved poem by U.S. Poet Laureate Ada Limón. What is it called?',
      right: '"In Praise of Mystery"',
      wrong: ['"Ode to Jupiter"', '"The Frozen Sea"', '"Pale Blue Dot"'],
      why: '"In Praise of Mystery: A Poem for Europa" is engraved on the spacecraft along with 2.6 million names sent by the public. Clipper launched in October 2024.',
    }, {
      q: 'Hubble has seen tentative signs of what erupting from Europa?',
      right: 'Plumes of water vapour',
      wrong: ['Lava fountains', 'Sulfur geysers like Io\'s', 'Dust storms'],
      why: 'Hubble observations in 2012 and 2016 hinted at water plumes near the south pole. Not yet confirmed, they\'re a key target for Europa Clipper.',
    }],
  ],

  S09: [
    [{
      q: 'Saturn\'s average density is lower than that of…',
      right: 'Water',
      wrong: ['Air', 'Cork', 'Hydrogen gas'],
      why: 'At ~0.69 g/cm³ Saturn is the only planet less dense than water. In a big enough bathtub (and ignoring everything else) it would float.',
    }, {
      q: 'Saturn\'s main rings are hundreds of thousands of kilometres wide. How thick are they in most places?',
      right: 'About 10 metres',
      wrong: ['About 10 kilometres', 'About 1,000 kilometres', 'As thick as Earth'],
      why: 'Typically ~10 m, and at most about a kilometre. For their width, they\'re thousands of times thinner than a sheet of paper.',
    }],
    [{
      q: 'What are Saturn\'s rings mostly made of?',
      right: 'Chunks of water ice',
      wrong: ['Rocky dust', 'Glowing gas', 'Metal fragments'],
      why: 'More than 95% water ice, in pieces from dust grains to house-sized boulders, which is why they shine so brightly.',
    }, {
      q: 'Where on Saturn is there a giant hexagon-shaped cloud pattern?',
      right: 'Around the north pole',
      wrong: ['Along the equator', 'Around the south pole', 'In the rings'],
      why: 'A six-sided jet stream ~30,000 km across circles the north pole. First seen by Voyager, it was studied in detail by Cassini.',
    }],
    [{
      q: 'How did the Cassini mission end in 2017?',
      right: 'It dove into Saturn on purpose',
      wrong: ['It landed on Titan', 'It flew on toward Uranus', 'It crashed into Enceladus by accident'],
      why: 'Low on fuel, Cassini was steered into Saturn so it could never contaminate potentially habitable moons like Enceladus and Titan.',
    }, {
      q: 'Saturn\'s moon Mimas has a giant crater, Herschel, that makes it look like…',
      right: 'The Death Star',
      wrong: ['A golf ball', 'A human eye', 'A pumpkin'],
      why: 'Herschel is ~130 km wide, a third of Mimas\'s diameter. The impact nearly shattered the moon.',
    }],
  ],

  S10: [
    [{
      q: 'Titan is the only moon in the Solar System with…',
      right: 'A thick atmosphere',
      wrong: ['Rings', 'Its own moon', 'Active lava volcanoes'],
      why: 'Titan\'s nitrogen atmosphere is denser than Earth\'s. Io has the lava volcanoes, and no moon is known to have rings or moons of its own.',
    }, {
      q: 'Titan is larger than which planet?',
      right: 'Mercury',
      wrong: ['Mars', 'Venus', 'Earth'],
      why: 'Titan is ~5,150 km across versus Mercury\'s ~4,880 km, though Mercury is about twice as massive.',
    }],
    [{
      q: 'Titan\'s lakes and seas are filled with liquid…',
      right: 'Methane and ethane',
      wrong: ['Water', 'Sulfuric acid', 'Lava'],
      why: 'At about −180 °C, hydrocarbons are liquid: it rains methane, and seas like Kraken Mare are bigger than Earth\'s Caspian Sea.',
    }, {
      q: 'Titan has dense air and low gravity. What could a human do there?',
      right: 'Fly by flapping wings strapped to their arms',
      wrong: ['Breathe without a suit', 'Walk on the lakes', 'Float like a balloon without any gear'],
      why: 'With ~1.5 times Earth\'s air pressure and only 14% of its gravity, human-powered flight would be easy, though you\'d still need oxygen and a heated suit.',
    }],
    [{
      q: 'ESA\'s Huygens probe landed on Titan in 2005. Its surface photo showed rounded "pebbles" made of…',
      right: 'Water ice',
      wrong: ['Diamond', 'Salt', 'Iron'],
      why: 'At Titan\'s temperatures water ice is hard as rock. The rounded cobbles suggest they were tumbled by flowing liquid.',
    }, {
      q: 'NASA\'s next Titan mission, Dragonfly, is what kind of vehicle?',
      right: 'A nuclear-powered rotorcraft (a flying drone)',
      wrong: ['A floating boat', 'A wheeled rover', 'A hot-air balloon'],
      why: 'Dragonfly will hop between sites by flying, taking advantage of the thick air and low gravity.',
    }],
  ],

  S11: [
    [{
      q: 'Uranus is tipped over by about 98°. What does that mean for its poles?',
      right: 'Each gets ~42 years of daylight, then ~42 of darkness',
      wrong: ['Six months of sun, six of night, like Earth\'s poles', 'They are always in darkness', 'They have no seasons'],
      why: 'Uranus orbits the Sun in 84 years while lying on its side, so each pole points at the Sun for half of that.',
    }, {
      q: 'Uranus was the first planet found with a telescope (1781). What did William Herschel want to name it?',
      right: 'Georgium Sidus, "George\'s Star"',
      wrong: ['Herschel', 'Minerva', 'Neptune'],
      why: 'He honoured King George III. Other astronomers preferred a mythological name, and "Uranus", suggested by Johann Bode, won out.',
    }],
    [{
      q: 'What gives Uranus its blue-green colour?',
      right: 'Methane gas absorbing red light',
      wrong: ['Oceans of liquid water', 'A surface of blue ice', 'Copper in the clouds'],
      why: 'Methane in the upper atmosphere absorbs red wavelengths, so the reflected sunlight we see is blue-green.',
    }, {
      q: 'Why are Uranus and Neptune called "ice giants"?',
      right: 'Most of their mass is water, ammonia and methane "ices"',
      wrong: ['They are frozen solid', 'They are covered in snow', 'They are the coldest planets'],
      why: 'Astronomers call those compounds "ices", but deep inside they\'re a hot, dense fluid, not frozen.',
    }],
    [{
      q: 'How many spacecraft have ever visited Uranus?',
      right: 'One',
      wrong: ['None', 'Three', 'Five'],
      why: 'Only Voyager 2, which flew past in January 1986. Everything else we know comes from telescopes.',
    }, {
      q: 'Uranus\'s moons (Miranda, Ariel, Titania, Oberon…) are named after characters from…',
      right: 'Shakespeare and Alexander Pope',
      wrong: ['Greek myths', 'Norse myths', 'Tolkien\'s books'],
      why: 'Uniquely, they come from English literature: Titania and Oberon from A Midsummer Night\'s Dream, Ariel and Umbriel from Pope\'s The Rape of the Lock.',
    }],
  ],

  S12: [
    [{
      q: 'How was Neptune discovered in 1846?',
      right: 'Mathematics predicted where it should be',
      wrong: ['A lucky photograph', 'A space probe', 'Radio signals'],
      why: 'Urbain Le Verrier calculated its position from irregularities in Uranus\'s orbit, and Johann Galle found it within a degree of the prediction.',
    }, {
      q: 'In what year did Neptune complete its first full orbit since its discovery?',
      right: '2011',
      wrong: ['1946', '2050', 'It hasn\'t yet'],
      why: 'A Neptunian year lasts ~165 Earth years: 1846 + 165 = 2011.',
    }],
    [{
      q: 'Neptune has the fastest winds in the Solar System. Roughly how fast?',
      right: 'Over 2,000 km/h',
      wrong: ['About 200 km/h', 'About 20,000 km/h', 'About 200,000 km/h'],
      why: 'Winds exceed 2,000 km/h, faster than the speed of sound on Earth, on a planet that gets very little energy from the distant Sun.',
    }, {
      q: 'Neptune\'s largest moon, Triton, is unusual because it…',
      right: 'Orbits backwards',
      wrong: ['Has rings of its own', 'Is bigger than Neptune', 'Is made of iron'],
      why: 'Triton circles Neptune opposite to the planet\'s spin, a strong sign it was a Kuiper Belt object captured by Neptune.',
    }],
    [{
      q: 'Voyager 2 photographed a giant storm on Neptune in 1989. What was it nicknamed?',
      right: 'The Great Dark Spot',
      wrong: ['The Great Red Spot', 'The Hexagon', 'The Great White Oval'],
      why: 'It was about Earth-sized. When Hubble looked in 1994 it had vanished; new dark spots have formed since.',
    }, {
      q: 'Galileo seems to have seen Neptune in 1612–1613, over 230 years before its discovery. Why doesn\'t he get credit?',
      right: 'He recorded it as a star',
      wrong: ['His telescope broke', 'The Church banned his notes', 'He only saw it in daylight'],
      why: 'His drawings of Jupiter show Neptune nearby. He noted it may have moved, but did not follow it up.',
    }],
  ],

  S13: [
    [{
      q: 'Why was Pluto reclassified as a dwarf planet in 2006?',
      right: 'It hasn\'t cleared its orbital neighbourhood',
      wrong: ['It isn\'t round', 'It doesn\'t orbit the Sun', 'It has moons'],
      why: 'The IAU definition requires a planet to orbit the Sun, be round, and dominate its orbit. Pluto shares its zone with many Kuiper Belt objects.',
    }, {
      q: 'Who suggested the name "Pluto" in 1930?',
      right: 'An 11-year-old schoolgirl from Oxford',
      wrong: ['Its discoverer, Clyde Tombaugh', 'Walt Disney', 'Percival Lowell\'s widow'],
      why: 'Venetia Burney suggested the Roman god of the underworld. The name also starts with P and L, Percival Lowell\'s initials. Disney\'s dog came later.',
    }],
    [{
      q: 'The left lobe of Pluto\'s "heart" (Sputnik Planitia) is a vast glacier made mostly of…',
      right: 'Nitrogen ice',
      wrong: ['Water ice', 'Frozen sulfur', 'Salt'],
      why: 'It\'s a 1,000-km basin of slowly churning nitrogen ice, divided into cells by convection: a living, young surface at −230 °C.',
    }, {
      q: 'Pluto\'s moon Charon is so large compared with Pluto that…',
      right: 'They both orbit a point in space between them',
      wrong: ['Pluto orbits Charon', 'Charon orbits backwards', 'Charon is bigger than Pluto'],
      why: 'Their balance point lies outside Pluto, so they\'re often called a double dwarf planet, and they\'re tidally locked to each other.',
    }],
    [{
      q: 'New Horizons is carrying some of the ashes of…',
      right: 'Clyde Tombaugh, Pluto\'s discoverer',
      wrong: ['Carl Sagan', 'Neil Armstrong', 'Percival Lowell'],
      why: 'Tombaugh found Pluto in 1930 and died in 1997. Part of his ashes flew past Pluto with New Horizons in 2015 and are leaving the Solar System.',
    }, {
      q: 'On average, how long does sunlight take to reach Pluto?',
      right: 'About 5.5 hours',
      wrong: ['About 8 minutes', 'About 45 minutes', 'About 3 days'],
      why: 'At ~39.5 times Earth\'s distance, light needs about 5.5 hours. Noon on Pluto is still about as bright as dusk on Earth.',
    }],
  ],

  S14: [
    [{
      q: 'The first Kuiper Belt object after Pluto and Charon was found in 1992. What did its discoverers nickname it?',
      right: '"Smiley"',
      wrong: ['"Xena"', '"Santa"', '"Easterbunny"'],
      why: '1992 QB1 was nicknamed after a John le Carré spy; today it is called Albion. Xena (Eris), Santa (Haumea) and Easterbunny (Makemake) were the others\' nicknames.',
    }, {
      q: 'How far from the Sun is the main Kuiper Belt?',
      right: 'About 30–50 times Earth\'s distance',
      wrong: ['About 1–5 times', 'About 300–500 times', 'About 50,000 times'],
      why: 'It starts near Neptune\'s orbit (~30 AU) and thins out around 50 AU. The far more distant Oort Cloud is the 50,000-AU one.',
    }],
    [{
      q: 'The dwarf planet Haumea has a strange, stretched egg shape. Why?',
      right: 'It spins very fast, once in under 4 hours',
      wrong: ['It was cut in half by an impact', 'It is hollow', 'It is two worlds glued together'],
      why: 'One of the fastest-spinning large bodies known, Haumea is pulled into an ellipsoid nearly twice as long as it is wide. It even has a ring.',
    }, {
      q: 'Which well-known world is thought to be a captured Kuiper Belt object?',
      right: 'Neptune\'s moon Triton',
      wrong: ['Earth\'s Moon', 'Saturn\'s Titan', 'Jupiter\'s Ganymede'],
      why: 'Triton\'s backwards orbit and its likeness to Pluto suggest Neptune captured it from the Kuiper Belt long ago.',
    }],
    [{
      q: 'Arrokoth, visited by New Horizons in 2019, is the most distant world ever explored up close. What does it look like?',
      right: 'A flattened snowman: two lobes stuck together',
      wrong: ['A perfect sphere', 'A ring', 'A long thin cigar'],
      why: 'Two flattened lobes gently merged early in the Solar System\'s history, a pristine "contact binary" that tells us how planets began.',
    }, {
      q: 'The 2005 discovery of Eris, a Kuiper-region world about as big as Pluto, directly led to…',
      right: 'Pluto\'s reclassification as a dwarf planet',
      wrong: ['The launch of New Horizons', 'The discovery of Neptune', 'The end of the Voyager missions'],
      why: 'If Pluto was a planet, so was Eris, and probably many more. In 2006 the IAU defined "planet", and both became dwarf planets.',
    }],
  ],

  S15: [
    [{
      q: 'Around November 2026, Voyager 1 becomes the first human-made object to reach a distance of one light-…',
      right: 'Day',
      wrong: ['Hour', 'Week', 'Year'],
      why: 'One light-day is ~173 AU (~26 billion km). Commands now take about a day to arrive, and the answer another day to come back.',
    }, {
      q: 'In 2012 Voyager 1 crossed the heliopause. What is that?',
      right: 'Where the Sun\'s solar wind gives way to interstellar space',
      wrong: ['The edge of the Oort Cloud', 'The orbit of the last planet', 'The point where the Sun\'s gravity ends'],
      why: 'Beyond it the plasma comes from other stars. The Sun\'s gravity still reaches much farther, out through the Oort Cloud.',
    }],
    [{
      q: 'Who pushed for Voyager 1 to turn around in 1990 and take the "Pale Blue Dot" photo of Earth?',
      right: 'Carl Sagan',
      wrong: ['Neil Armstrong', 'Stephen Hawking', 'Edwin Hubble'],
      why: 'From ~6 billion km away, Earth was a fraction of a pixel in a sunbeam. Sagan\'s reflection on it became one of the most famous texts in science.',
    }, {
      q: 'What keeps Voyager 1 powered, far beyond the reach of useful sunlight?',
      right: 'Heat from decaying plutonium-238',
      wrong: ['Huge solar panels', 'Batteries charged before launch', 'A tiny fusion reactor'],
      why: 'Radioisotope thermoelectric generators turn decay heat into electricity, but output drops a few watts a year, so instruments are switched off one by one.',
    }],
    [{
      q: 'The Golden Record on each Voyager carries spoken greetings in how many languages?',
      right: '55',
      wrong: ['5', '12', '200'],
      why: 'Fifty-five languages, ancient Akkadian to modern Wu Chinese, plus whale song, music and 115 images encoded for any finder.',
    }, {
      q: 'Which Chuck Berry song is on the Voyager Golden Record?',
      right: '"Johnny B. Goode"',
      wrong: ['"Roll Over Beethoven"', '"Maybellene"', '"Rock and Roll Music"'],
      why: 'It shares the record with Bach, Beethoven, Navajo night chant and Senegalese percussion, travelling at ~17 km/s.',
    }],
  ],

  // ── II · Interstellar Journey ──────────────────────────────────────

  I01: [
    [{
      q: 'Light from Proxima Centauri, the nearest star after the Sun, takes how long to reach us?',
      right: 'About 4.2 years',
      wrong: ['About 4.2 hours', 'About 42 days', 'About 420 years'],
      why: 'Proxima is 4.24 light-years away, about 40 trillion km. Voyager 1 would need more than 70,000 years to get there.',
    }, {
      q: 'Proxima Centauri is our closest star. Can you see it with the naked eye?',
      right: 'No, it is far too faint',
      wrong: ['Yes, it is the brightest star in the sky', 'Only during a solar eclipse', 'Only from the North Pole'],
      why: 'A red dwarf with a fraction of a percent of the Sun\'s light, Proxima shines at magnitude 11. You need a telescope, and the southern sky.',
    }],
    [{
      q: 'Proxima Centauri is a red dwarf. Compared with the Sun, how long will it shine?',
      right: 'Trillions of years, far longer than the Sun',
      wrong: ['Only a few million years', 'About the same, ~10 billion years', 'It has already burnt out'],
      why: 'Small red dwarfs sip their hydrogen and mix it through their whole interior. Proxima will outlive the Sun by a factor of hundreds.',
    }, {
      q: 'Proxima Centauri is a "flare star". What does that mean?',
      right: 'It erupts in sudden, powerful bursts of brightness',
      wrong: ['It flickers because of Earth\'s atmosphere', 'It is surrounded by burning gas', 'It pulses on a perfectly regular schedule'],
      why: 'Magnetic explosions can make Proxima many times brighter for minutes, blasting its planets with radiation, bad news for any life on Proxima b.',
    }],
    [{
      q: 'Proxima b, found in 2016, sits in its star\'s habitable zone. How long is its year?',
      right: 'About 11 days',
      wrong: ['About 11 hours', 'About 11 months', 'About 11 years'],
      why: 'Proxima is so dim that its habitable zone hugs the star: Proxima b orbits ~7.5 million km out, far closer than Mercury is to the Sun.',
    }, {
      q: 'The Breakthrough Starshot project hopes to reach the Alpha Centauri system within a human lifetime. With what?',
      right: 'Gram-scale chips on light sails pushed by lasers',
      wrong: ['A nuclear-powered crewed ship', 'A slingshot around Jupiter', 'A wormhole'],
      why: 'A ground-based laser array would accelerate tiny sails to ~20% of light speed, arriving in about 20 years. It is still a concept.',
    }],
  ],

  I02: [
    [{
      q: 'How many stars make up the Alpha Centauri system, Proxima included?',
      right: 'Three',
      wrong: ['One', 'Two', 'Seven'],
      why: 'Alpha Centauri A and B orbit each other closely; Proxima (sometimes called Alpha Centauri C) circles the pair from ~13,000 AU away.',
    }, {
      q: 'Alpha Centauri is the third-brightest star in the night sky. Where must you be to see it?',
      right: 'In the southern hemisphere or the tropics',
      wrong: ['Anywhere, all year round', 'Only near the North Pole', 'Only above the Arctic Circle in winter'],
      why: 'It sits far south, near the Southern Cross. From most of Europe, North America and Turkey it never rises above the horizon.',
    }],
    [{
      q: 'Alpha Centauri A and B orbit each other. How long does one full orbit take?',
      right: 'About 80 years',
      wrong: ['About 8 days', 'About 800 years', 'About 8,000 years'],
      why: 'Their separation swings between about 11 and 35 times the Earth–Sun distance over a 79.9-year orbit.',
    }, {
      q: 'Alpha Centauri A is the closest star that is…',
      right: 'Very similar to our Sun',
      wrong: ['A black hole', 'A neutron star', 'A red supergiant'],
      why: 'A is a G-type star like the Sun, slightly bigger; B is a slightly cooler orange K star. Together they make a near-twin of our system\'s star.',
    }],
    [{
      q: 'In 2018 the IAU gave Alpha Centauri B an official name. What is it?',
      right: 'Toliman',
      wrong: ['Hadar', 'Mira', 'Polaris'],
      why: 'Toliman comes from an old Arabic name for the pair, often read as "the ostriches". A itself is officially Rigil Kentaurus, "foot of the centaur".',
    }, {
      q: 'In the sci-fi novel "The Three-Body Problem", the alien Trisolarans come from a planet in which system?',
      right: 'Alpha Centauri',
      wrong: ['Sirius', 'Vega', 'Betelgeuse'],
      why: 'Liu Cixin chose our nearest neighbour: the chaotic dance of three suns makes the Trisolarans\' world almost unlivable, hence the invasion plot.',
    }],
  ],

  I03: [
    [{
      q: 'Barnard\'s Star is famous for one record. Which one?',
      right: 'It moves across our sky faster than any other star',
      wrong: ['It is the brightest star in the sky', 'It is the hottest star known', 'It is the youngest star near us'],
      why: 'It shifts ~10.3 arcseconds a year: in about 180 years it slides the width of the full Moon across the sky.',
    }, {
      q: 'Barnard\'s Star is about 6 light-years away. Where does it rank among the Sun\'s neighbours?',
      right: 'The closest single star, after the Alpha Centauri trio',
      wrong: ['The single closest star', 'About the hundredth closest', 'Outside our galaxy'],
      why: 'Only the three stars of the Alpha Centauri system are closer. Barnard\'s Star is the nearest star that lives alone.',
    }],
    [{
      q: 'Barnard\'s Star is slowly getting closer. Roughly when will it be at its nearest, about 3.8 light-years away?',
      right: 'Around the year 11,800',
      wrong: ['Next year', 'Around the year 2300', 'It never gets closer'],
      why: 'It is rushing toward us at ~110 km/s. Around AD 11,800 it will even be closer than Proxima is today, then it will move away.',
    }, {
      q: 'Barnard\'s Star is a red dwarf about 10 billion years old. How does that compare with the Sun?',
      right: 'It is about twice the Sun\'s age',
      wrong: ['It is much younger than the Sun', 'It is exactly the Sun\'s age', 'It is older than the universe'],
      why: 'The Sun is 4.6 billion years old. Barnard\'s Star is an ancient, quiet dwarf, still with trillions of years to go.',
    }],
    [{
      q: 'In the 1960s an astronomer claimed planets around Barnard\'s Star from a "wobble". What happened next?',
      right: 'The wobble came from his telescope, not the star',
      wrong: ['NASA confirmed them in 1970', 'One of them was photographed by Hubble', 'They turned out to be comets'],
      why: 'Peter van de Kamp\'s signal followed lens changes and maintenance on his telescope. Real planets were confirmed only in 2024–2025.',
    }, {
      q: 'In 2024–2025 astronomers confirmed four planets around Barnard\'s Star. What are they like?',
      right: 'Small rocky worlds, each smaller than Earth',
      wrong: ['Giant planets like Jupiter', 'Ice giants like Neptune', 'Rogue planets far from the star'],
      why: 'Tiny wobbles measured by ESPRESSO and MAROON-X revealed four sub-Earth planets hugging the star with orbits of only a few days.',
    }],
  ],

  I04: [
    [{
      q: 'Sirius is the brightest star in the night sky. Which constellation is it in?',
      right: 'Canis Major, the Great Dog',
      wrong: ['Orion, the Hunter', 'Leo, the Lion', 'Ursa Major, the Great Bear'],
      why: 'That\'s why it is called the Dog Star, and why the hot "dog days" of summer were named after its rising with the Sun.',
    }, {
      q: 'Why does Sirius look so bright from Earth?',
      right: 'It is both fairly luminous and very close, 8.6 light-years',
      wrong: ['It is the biggest star in the galaxy', 'It is the closest star to the Sun', 'It reflects the Sun\'s light'],
      why: 'Sirius A gives off about 25 times the Sun\'s light, and at 8.6 light-years it is one of our nearest neighbours.',
    }],
    [{
      q: 'Sirius B is a white dwarf with about the mass of the Sun. Roughly how big is it?',
      right: 'About the size of Earth',
      wrong: ['About the size of the Sun', 'About the size of Jupiter', 'About the size of a city'],
      why: 'A Sun\'s worth of matter packed into an Earth-sized ball: a teaspoon of it would weigh several tonnes.',
    }, {
      q: 'Sirius B was the first white dwarf ever discovered. What is a white dwarf?',
      right: 'The exposed hot core of a star that has died',
      wrong: ['A very young star still forming', 'A star made of ice', 'A planet heated by its star'],
      why: 'When a Sun-like star runs out of fuel it sheds its outer layers; the leftover core slowly cools for billions of years.',
    }],
    [{
      q: 'How was Sirius B first detected, years before anyone saw it?',
      right: 'Sirius wobbled as if pulled by an unseen companion',
      wrong: ['By its radio signals', 'It blocked starlight during an eclipse', 'Ancient Egyptians recorded it'],
      why: 'In 1844 Friedrich Bessel noticed Sirius weaving across the sky. In 1862 Alvan Graham Clark spotted the companion while testing a new telescope lens.',
    }, {
      q: 'Ancient Egyptians watched for Sirius to rise just before the Sun each summer. What did it announce?',
      right: 'The yearly flooding of the Nile',
      wrong: ['The start of winter', 'A solar eclipse', 'The Pharaoh\'s birthday'],
      why: 'Sirius (Sopdet) reappearing at dawn marked the coming flood and the Egyptian new year, one of the oldest astronomical calendars.',
    }],
  ],

  I05: [
    [{
      q: 'Epsilon Eridani\'s official IAU name, chosen in 2015, comes from Norse mythology. What is it?',
      right: 'Ran, the sea goddess',
      wrong: ['Odin, the all-father', 'Thor, the thunder god', 'Freya, the goddess of love'],
      why: 'Its giant planet got the name of her husband, AEgir, god of the sea. The names were chosen in a public contest.',
    }, {
      q: 'How far away is Epsilon Eridani?',
      right: 'About 10.5 light-years',
      wrong: ['About 1 light-year', 'About 100 light-years', 'About 1,000 light-years'],
      why: 'It is one of the closest stars visible to the naked eye, a modest orange star in the constellation Eridanus, the river.',
    }],
    [{
      q: 'Epsilon Eridani is only a few hundred million years old. What does that make it?',
      right: 'Young, like the Sun in its youth',
      wrong: ['Older than the Sun', 'A dying star', 'A newborn protostar'],
      why: 'At a fraction of the Sun\'s 4.6 billion years, it is still magnetically active, spotty and fast-spinning: a window on the young Solar System.',
    }, {
      q: 'Epsilon Eridani is surrounded by belts of dust and rock. What do they remind astronomers of?',
      right: 'Our own asteroid belt and Kuiper Belt',
      wrong: ['Saturn\'s rings', 'A galaxy\'s spiral arms', 'A black hole\'s disc'],
      why: 'Collisions between rocky and icy leftovers keep grinding out fresh dust, much as in our early Solar System.',
    }],
    [{
      q: 'In 1960, Epsilon Eridani was one of the first two targets of a radio search for aliens. What was the project called?',
      right: 'Project Ozma',
      wrong: ['Project Apollo', 'Project Blue Book', 'Project Gemini'],
      why: 'Frank Drake listened to Epsilon Eridani and Tau Ceti for about 150 hours. He named it after the princess of L. Frank Baum\'s Land of Oz.',
    }, {
      q: 'Which science-fiction TV space station orbits a planet of Epsilon Eridani?',
      right: 'Babylon 5',
      wrong: ['Deep Space Nine', 'The Death Star', 'Battlestar Galactica'],
      why: 'Babylon 5 orbits Epsilon III. Being close and Sun-like, the star became a sci-fi favourite long before its planet was found.',
    }],
  ],

  I06: [
    [{
      q: 'Tau Ceti is one of the closest stars that is…',
      right: 'Single and similar to the Sun',
      wrong: ['A black hole', 'A red supergiant', 'A pulsar'],
      why: 'At 11.9 light-years it is the nearest lone Sun-like (G-type) star, so it pops up again and again in searches for life.',
    }, {
      q: 'Tau Ceti is in the constellation Cetus. What creature is Cetus?',
      right: 'A sea monster, often drawn as a whale',
      wrong: ['A centaur', 'A scorpion', 'A dragon'],
      why: 'In myth Cetus was the monster sent to devour Andromeda, until Perseus stepped in.',
    }],
    [{
      q: 'Tau Ceti has less iron and other heavy elements than the Sun. What might that suggest?',
      right: 'Rocky planets may be less common or different there',
      wrong: ['It is a dying star', 'It cannot shine', 'It will become a black hole'],
      why: 'Planets form from a star\'s leftover dust, so a metal-poor star may have had fewer building blocks for rocky worlds.',
    }, {
      q: 'Tau Ceti is surrounded by about ten times as much dust as the Solar System. Why could that be bad news for planets?',
      right: 'More debris means more frequent big impacts',
      wrong: ['Dust makes planets freeze solid', 'Dust blocks all the starlight', 'Dust makes the star explode'],
      why: 'A dusty system usually has many more comets and asteroids, so any planet there may suffer far more collisions than Earth.',
    }],
    [{
      q: 'In the film "Barbarella" (1968), the heroine travels to a planet in which star system?',
      right: 'Tau Ceti',
      wrong: ['Sirius', 'Proxima Centauri', 'Vega'],
      why: 'She crash-lands on Lythion, in the Tau Ceti system. Its nearness and Sun-likeness made it a sci-fi favourite.',
    }, {
      q: 'What did Frank Drake\'s 1960 Project Ozma, which listened to Tau Ceti, find?',
      right: 'No alien signals',
      wrong: ['A repeating radio signal', 'A planet with oceans', 'A second Sun-like star'],
      why: 'There was one false alarm, a passing aircraft, but nothing from the stars. Ozma kicked off the modern SETI search all the same.',
    }],
  ],

  I07: [
    [{
      q: '61 Cygni made history in 1838. Why?',
      right: 'It was the first star whose distance was measured',
      wrong: ['It was the first star found to have a planet', 'It was the first supernova seen', 'It was the first star photographed'],
      why: 'Friedrich Bessel measured its parallax and showed it is about 10 light-years away, the first proof of how vast the gaps between stars are.',
    }, {
      q: '61 Cygni is actually…',
      right: 'Two orange dwarf stars orbiting each other',
      wrong: ['A single giant star', 'A star cluster of thousands', 'A nebula'],
      why: 'The two K-type dwarfs, 61 Cygni A and B, take roughly 680 years to orbit each other, about 11.4 light-years from us.',
    }],
    [{
      q: 'Parallax measures distance from a star\'s tiny shift in the sky. What causes the shift?',
      right: 'Earth moving around the Sun',
      wrong: ['The star\'s own spin', 'The turning of the Milky Way', 'Earth\'s atmosphere bending light'],
      why: 'Seen six months apart, from opposite sides of our orbit, a nearby star appears to move against far-off background stars. Closer stars shift more.',
    }, {
      q: 'Bessel\'s measured shift for 61 Cygni was about a third of an arcsecond. That is roughly…',
      right: 'The width of a coin seen from about 15 km away',
      wrong: ['The width of the full Moon', 'A tenth of the whole sky', 'Big enough to see with the naked eye'],
      why: 'An arcsecond is 1/3600 of a degree. Astronomers had chased stellar parallax for centuries because it is so incredibly small.',
    }],
    [{
      q: 'Why did Bessel choose 61 Cygni for his attempt?',
      right: 'It moved unusually fast across the sky, so it was probably close',
      wrong: ['It was the brightest star in the sky', 'It was right above his observatory', 'It had just exploded'],
      why: 'Giuseppe Piazzi had noticed its large motion, nicknaming it the "Flying Star". Fast-moving stars tend to be nearby.',
    }, {
      q: 'In which constellation does 61 Cygni lie?',
      right: 'Cygnus, the Swan',
      wrong: ['Cancer, the Crab', 'Columba, the Dove', 'Lyra, the Lyre'],
      why: 'The number 61 comes from John Flamsteed\'s catalogue, which numbered the stars of each constellation from west to east.',
    }],
  ],

  I08: [
    [{
      q: 'Vega is part of a well-known star pattern in summer skies. Which one?',
      right: 'The Summer Triangle',
      wrong: ['The Big Dipper', 'Orion\'s Belt', 'The Southern Cross'],
      why: 'Vega, Altair and Deneb form the Summer Triangle, high overhead on northern summer evenings.',
    }, {
      q: 'About 12,000 years ago, Vega played a role that Polaris plays today. Which?',
      right: 'It was the North Star',
      wrong: ['It was the brightest star in the sky', 'It was a supernova', 'It was part of the Big Dipper'],
      why: 'Earth\'s axis slowly wobbles (precession) over ~26,000 years. Around AD 13,700 the pole will point near Vega again.',
    }],
    [{
      q: 'Vega shines blue-white. What does that colour tell us?',
      right: 'Its surface is much hotter than the Sun\'s',
      wrong: ['It is cooler than the Sun', 'It is covered in ice', 'It is moving toward us at light speed'],
      why: 'Star colour is temperature: Vega\'s surface is ~9,600 K against the Sun\'s ~5,800 K. Red stars are the cool ones.',
    }, {
      q: 'Astronomers once defined the brightness scale using Vega. What is its magnitude on that scale?',
      right: 'About 0',
      wrong: ['About 100', 'About −27', 'About 6'],
      why: 'Vega was the zero point of the magnitude system. Bigger numbers mean fainter: the naked-eye limit is about 6, and the Sun is −27.',
    }],
    [{
      q: 'In 1850 Vega became the first star other than the Sun to be…',
      right: 'Photographed',
      wrong: ['Named', 'Visited by a probe', 'Seen through a telescope'],
      why: 'A daguerreotype taken at Harvard College Observatory captured it. In 1872 its spectrum was also the first stellar spectrum photographed.',
    }, {
      q: 'In Carl Sagan\'s novel and film "Contact", the alien signal comes from the direction of…',
      right: 'Vega',
      wrong: ['Sirius', 'Betelgeuse', 'Polaris'],
      why: 'Jodie Foster\'s character hears prime numbers coming from Vega, 25 light-years away. Sagan picked a bright, nearby, dusty star.',
    }],
  ],

  I09: [
    [{
      q: 'In the Japanese Tanabata festival, Altair is the cowherd. Who is his beloved, the weaver?',
      right: 'Vega',
      wrong: ['Sirius', 'The Moon', 'Polaris'],
      why: 'The lovers are separated by the Milky Way and may meet only once a year, on the 7th day of the 7th month.',
    }, {
      q: 'How far away is Altair?',
      right: 'About 17 light-years',
      wrong: ['About 1.7 light-years', 'About 170 light-years', 'About 1,700 light-years'],
      why: 'Altair is one of the closest naked-eye stars, which is why it looks so bright despite being only ~10 times as luminous as the Sun.',
    }],
    [{
      q: 'Altair spins once in about nine hours. What does such fast spinning do to a star?',
      right: 'It flattens it, so the equator bulges out',
      wrong: ['It makes it perfectly round', 'It turns it into a ring', 'It makes it shrink to a point'],
      why: 'Its equator is about 20% wider than the distance pole to pole. The Sun, which takes ~25 days to turn, is almost a perfect sphere.',
    }, {
      q: 'On a fast-spinning star like Altair, which part is hottest?',
      right: 'The poles',
      wrong: ['The equator', 'Everywhere is the same', 'The night side'],
      why: 'Gravity darkening: the bulging equator is farther from the centre, so it is cooler and dimmer. The poles shine brighter and hotter.',
    }],
    [{
      q: 'In 2007, what did astronomers achieve with Altair, a first for an ordinary star like it?',
      right: 'Took an image of its surface',
      wrong: ['Found it has a black hole inside', 'Sent a probe to it', 'Watched it explode'],
      why: 'Combining several telescopes at the CHARA array, they mapped its squashed shape and hot poles, the first image of a main-sequence star\'s surface beyond the Sun.',
    }, {
      q: 'Which classic 1956 science-fiction film is set on a planet orbiting Altair?',
      right: '"Forbidden Planet"',
      wrong: ['"2001: A Space Odyssey"', '"Star Wars"', '"Alien"'],
      why: 'Its crew lands on Altair IV, home of Robby the Robot. The story is loosely based on Shakespeare\'s "The Tempest".',
    }],
  ],

  I10: [
    [{
      q: 'Fomalhaut is called the "lonely star of autumn" by northern stargazers. Why?',
      right: 'It shines alone in a region with few bright stars',
      wrong: ['It has no planets', 'It is the farthest visible star', 'It appears only once every few years'],
      why: 'In autumn evenings it sits low in the south with almost no bright neighbours, making it easy to spot.',
    }, {
      q: 'The name Fomalhaut comes from Arabic. What does it mean?',
      right: 'Mouth of the fish',
      wrong: ['Eye of the bull', 'Tail of the swan', 'Heart of the lion'],
      why: 'It marks the mouth of Piscis Austrinus, the Southern Fish, which is often drawn drinking water poured by Aquarius.',
    }],
    [{
      q: 'Hubble pictures show Fomalhaut inside a sharp-edged ring, nicknamed "the Eye of Sauron". What is the ring made of?',
      right: 'Dust and debris from colliding comets and asteroids',
      wrong: ['Gas from a supernova', 'Ice crystals reflecting sunlight', 'Dark matter'],
      why: 'The ring lies ~140 times the Earth–Sun distance from the star. Its sharp edges may be shaped by unseen planets.',
    }, {
      q: 'Fomalhaut is only a few hundred million years old. How does that compare with the Sun?',
      right: 'Much younger',
      wrong: ['Much older', 'Exactly the same age', 'Older than the galaxy'],
      why: 'At ~440 million years it is a tenth the Sun\'s age, an infant star still clearing out its planet-building debris.',
    }],
    [{
      q: 'In 2008 Hubble images showed "Fomalhaut b", hailed as a directly imaged planet. What did later observations suggest?',
      right: 'It was likely an expanding cloud of dust from a collision',
      wrong: ['It was a second star', 'It was a camera defect', 'It was a moon of Earth'],
      why: 'By 2014 it had faded and spread out. A smash-up between two icy bodies fits better: a lesson in how evidence can overturn exciting claims.',
    }, {
      q: 'In 2023, which telescope revealed that Fomalhaut has not one but three belts of debris?',
      right: 'The James Webb Space Telescope',
      wrong: ['The Arecibo radio telescope', 'Galileo\'s telescope', 'The Kepler space telescope'],
      why: 'Webb\'s infrared view showed inner belts no one had seen, plus a "Great Dust Cloud" that might be another collision.',
    }],
  ],

  I11: [
    [{
      q: 'Where is Betelgeuse in the constellation Orion?',
      right: 'His shoulder',
      wrong: ['His belt', 'His foot', 'The tip of his sword'],
      why: 'It is the reddish star at Orion\'s upper left (from the northern hemisphere), opposite blue-white Rigel at his foot.',
    }, {
      q: 'If Betelgeuse replaced the Sun, how far out would its surface reach?',
      right: 'Past the orbit of Mars',
      wrong: ['Not even to Mercury', 'Halfway to the Moon', 'Beyond Neptune'],
      why: 'With a radius of hundreds of Sun radii, it would swallow Mercury, Venus, Earth and Mars.',
    }],
    [{
      q: 'Betelgeuse is a red supergiant. What will it most likely do at the end of its life?',
      right: 'Explode as a supernova',
      wrong: ['Quietly cool into a white dwarf', 'Turn into a planet', 'Become a new Sun'],
      why: 'Stars of ~15–20 Sun masses end with a core collapse. For weeks it may shine as bright as the half Moon, even in daylight.',
    }, {
      q: 'Betelgeuse looks red. What does that tell us about it?',
      right: 'Its surface is cooler than the Sun\'s',
      wrong: ['It is hotter than any other star', 'It is moving toward us', 'It is made of iron'],
      why: 'Around 3,500 K against the Sun\'s ~5,800 K. Yet being so enormous, it gives off around 100,000 times the Sun\'s light.',
    }],
    [{
      q: 'In late 2019 Betelgeuse faded dramatically, sparking supernova rumours. What caused the "Great Dimming"?',
      right: 'A dust cloud it puffed out, blocking part of its light',
      wrong: ['A planet passing in front of it', 'It had already exploded', 'Earth\'s atmosphere'],
      why: 'Hubble and VLT images showed the star ejected a big blob of gas that cooled into dust. It recovered its brightness in 2020.',
    }, {
      q: 'Betelgeuse\'s name comes from a misread Arabic phrase. What did it originally refer to?',
      right: 'The hand (or armpit) of a giant figure',
      wrong: ['A red apple', 'A burning lamp', 'The eye of a bull'],
      why: '"Yad al-Jawzāʾ", hand of al-Jawzāʾ, was garbled in medieval Latin translations: the "Y" was misread as a "B".',
    }],
  ],

  I12: [
    [{
      q: 'Rigel\'s name comes from Arabic. Which part of Orion does it mark?',
      right: 'His foot',
      wrong: ['His head', 'His shoulder', 'His belt'],
      why: '"Rijl" means foot. Rigel is the bright blue-white star at the bottom right of Orion, as seen from the northern hemisphere.',
    }, {
      q: 'Betelgeuse and Rigel are both in Orion. Which is usually the brighter in our sky?',
      right: 'Rigel',
      wrong: ['Betelgeuse, always', 'They are always exactly equal', 'Neither, they are invisible'],
      why: 'Rigel is usually the brighter of the two, though Betelgeuse varies and occasionally comes close.',
    }],
    [{
      q: 'Rigel shines blue-white. What kind of star is it?',
      right: 'A hot blue supergiant',
      wrong: ['A cool red dwarf', 'A white dwarf', 'A brown dwarf'],
      why: 'With a surface around 12,000 K and tens of thousands of times the Sun\'s light, it is burning through its fuel at a frantic rate.',
    }, {
      q: 'Rigel is about 21 times the Sun\'s mass. Compared with the Sun, how long will it live?',
      right: 'Far shorter, only about 10 million years',
      wrong: ['Far longer, trillions of years', 'Exactly as long', 'Forever'],
      why: 'Massive stars burn their fuel furiously. The Sun gets ~10 billion years; Rigel, about a thousandth of that.',
    }],
    [{
      q: 'Rigel lights up a faint nebula nearby that resembles a face in profile. What is it called?',
      right: 'The Witch Head Nebula',
      wrong: ['The Crab Nebula', 'The Eagle Nebula', 'The Cat\'s Eye Nebula'],
      why: 'IC 2118 is a cloud of dust that reflects Rigel\'s blue light, looking like a witch\'s face with a hooked nose.',
    }, {
      q: 'Rigel is not alone. How many stars does the Rigel system contain?',
      right: 'Probably four or more',
      wrong: ['Just one', 'Exactly two', 'Around one thousand'],
      why: 'Besides the supergiant, Rigel B is itself a pair, with possibly another companion: a tiny family dwarfed by its bright member.',
    }],
  ],

  I13: [
    [{
      q: 'Deneb marks the tail of which constellation?',
      right: 'Cygnus, the Swan',
      wrong: ['Leo, the Lion', 'Aquila, the Eagle', 'Draco, the Dragon'],
      why: '"Deneb" comes from the Arabic for "tail". Cygnus is also called the Northern Cross, with Deneb at its top.',
    }, {
      q: 'Deneb is the farthest of the 20 or so brightest stars in our sky. Why can we see it so well?',
      right: 'It is incredibly luminous',
      wrong: ['It is very close', 'It is a planet', 'It reflects the Sun\'s light'],
      why: 'It gives off perhaps 100,000–200,000 times the Sun\'s light. If it were as close as Vega, it would cast shadows.',
    }],
    [{
      q: 'How far is Deneb?',
      right: 'Uncertain: estimates range from ~1,400 to ~2,600 light-years',
      wrong: ['Exactly 25 light-years', 'About 4 light-years', 'Outside the Milky Way'],
      why: 'It is too far for a precise parallax, and different methods disagree. Its luminosity depends on the answer, a real headache for astronomers.',
    }, {
      q: 'Deneb is a white supergiant. What is likely to happen to it eventually?',
      right: 'It will probably explode as a supernova',
      wrong: ['It will become a planet', 'It will shrink into a red dwarf', 'Nothing, it lives forever'],
      why: 'At about 20 Sun masses it is burning out fast, and stars this massive usually end in a core-collapse supernova.',
    }],
    [{
      q: 'Deneb, Vega and Altair form the Summer Triangle. How do their distances compare?',
      right: 'Deneb is about a hundred times farther than the others',
      wrong: ['All three are the same distance', 'Deneb is the closest', 'Vega is the farthest'],
      why: 'Vega (25 ly) and Altair (17 ly) are neighbours; Deneb is over a thousand light-years away. Patterns in the sky are not real groupings.',
    }, {
      q: 'Thanks to the wobble of Earth\'s axis, Deneb will be a "pole star" around the year…',
      right: '9800',
      wrong: ['2050', '3000', '100,000'],
      why: 'Precession slowly swings the pole across the sky: from Polaris to Alderamin around AD 7500, near Deneb around 9800, then Vega.',
    }],
  ],

  I14: [
    [{
      q: 'The Pleiades are nicknamed the…',
      right: 'Seven Sisters',
      wrong: ['Three Kings', 'Twelve Apostles', 'Two Brothers'],
      why: 'In Greek myth they were the seven daughters of Atlas and Pleione. Most people see six stars with the naked eye.',
    }, {
      q: 'The Pleiades are known as Subaru in Japan. Where can you see them every day?',
      right: 'On the logo of the Subaru car company',
      wrong: ['On the Japanese flag', 'On Japanese banknotes', 'On a famous temple door'],
      why: 'The logo shows six stars, one big and five small, symbolizing the merger of companies that formed Subaru\'s parent.',
    }],
    [{
      q: 'The stars of the Pleiades share something. What?',
      right: 'They were born together from the same cloud',
      wrong: ['They orbit one planet', 'They are all the same distance from every star', 'They are the remains of one exploded star'],
      why: 'An open cluster is a family: same birthplace, same age (~100 million years), same composition, drifting apart over time.',
    }, {
      q: 'Photos show blue haze around the Pleiades. What is it?',
      right: 'A dust cloud the cluster is passing through',
      wrong: ['The gas cloud they were born in', 'Light from a nearby galaxy', 'An ocean of water vapour'],
      why: 'The stars are drifting through an unrelated dust cloud that reflects their blue light. Their birth cloud dispersed long ago.',
    }],
    [{
      q: 'In the 1990s the Hipparcos satellite measured the Pleiades\' distance and caused a controversy. How was it settled?',
      right: 'Radio telescopes showed Hipparcos was off, ~444 light-years is right',
      wrong: ['The cluster turned out to be in another galaxy', 'Hipparcos was proven right', 'It was never settled'],
      why: 'Hipparcos said ~390 light-years, clashing with stellar models. In 2014 radio telescopes (VLBI) confirmed ~444, vindicating the physics.',
    }, {
      q: 'The Pleiades were catalogued by Charles Messier in 1769. Which number did they get?',
      right: 'M45',
      wrong: ['M1', 'M31', 'M110'],
      why: 'Messier was a comet hunter listing fuzzy things to ignore. Odd that he included the naked-eye Pleiades, possibly to round out his list.',
    }],
  ],

  I15: [
    [{
      q: 'Where can you find the Orion Nebula in the night sky?',
      right: 'In Orion\'s sword, hanging below his belt',
      wrong: ['In Orion\'s head', 'Next to the North Star', 'Only with a space telescope'],
      why: 'The middle "star" of the sword looks fuzzy to the naked eye under dark skies: that is the nebula, about 1,340 light-years away.',
    }, {
      q: 'The Orion Nebula is about 24 light-years across. How big would it look in our sky?',
      right: 'Bigger than the full Moon in long-exposure photos',
      wrong: ['Smaller than a star point', 'Half the whole sky', 'Exactly as big as the Sun'],
      why: 'Long exposures reveal glowing gas over more than a degree, larger than the full Moon (half a degree).',
    }],
    [{
      q: 'What makes the Orion Nebula glow?',
      right: 'Ultraviolet light from hot young stars at its heart',
      wrong: ['It is on fire', 'Reflected sunlight', 'A black hole in its centre'],
      why: 'The four Trapezium stars blast the gas with ultraviolet light, making hydrogen glow, mostly red, and oxygen green.',
    }, {
      q: 'Hubble found more than a hundred "proplyds" inside the Orion Nebula. What are they?',
      right: 'Discs of gas and dust around young stars, where planets may form',
      wrong: ['Escaping comets', 'Small black holes', 'Alien spacecraft'],
      why: 'Protoplanetary discs: young solar systems caught in the act, some being eroded by the harsh light of the Trapezium.',
    }],
    [{
      q: 'In 1880 the Orion Nebula became the first nebula ever…',
      right: 'Photographed',
      wrong: ['Named', 'Seen through a telescope', 'Visited by a probe'],
      why: 'Henry Draper captured it with a 51-minute exposure. Astrophotography soon showed far more than the eye could see.',
    }, {
      q: 'Why do astronomers love studying star birth in the Orion Nebula?',
      right: 'It is the closest region forming massive stars',
      wrong: ['It is inside our Solar System', 'It is the oldest object in the universe', 'It is the only nebula there is'],
      why: 'At ~1,340 light-years it is a front-row seat: thousands of newborn stars, brown dwarfs and planet-forming discs.',
    }],
  ],
};

export function variantsFor(nodeId: string, gate: number): Variant[] {
  return BANK[nodeId]?.[gate] ?? [];
}
