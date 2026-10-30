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

  // ── Milky Way ──
  G01: [
    [{
      q: 'Roughly how wide is the disc of the Milky Way?',
      right: 'About 100,000 light-years',
      wrong: ['About 100 light-years', 'About 1,000 light-years', 'About 10 billion light-years'],
      why: 'Even light needs some 100,000 years to cross it. Yet the disc is thin, only about 1,000 light-years thick, like a giant pancake.',
    }, {
      q: 'From a dark site, the Milky Way looks like a pale band across the sky. Why a band?',
      right: 'We see our flat disc edge-on from inside it',
      wrong: ['It is a cloud in Earth\'s atmosphere', 'It is a ring of dust around the Sun', 'It is light from a nearby galaxy'],
      why: 'Looking along the disc we see countless distant stars blurred together; looking out of it, the sky is much emptier.',
    }],
    [{
      q: 'Astronomers classify the Milky Way\'s shape as a…',
      right: 'Barred spiral galaxy',
      wrong: ['Round elliptical galaxy', 'Shapeless irregular galaxy', 'Ring-shaped galaxy'],
      why: 'Spiral arms wind out from a central bulge crossed by a long bar of old stars, which infrared telescopes like Spitzer helped confirm.',
    }, {
      q: 'Roughly how many stars live in the Milky Way?',
      right: 'Somewhere around 100–400 billion',
      wrong: ['About 6,000', 'About 10 million', 'About 1 trillion trillion'],
      why: 'Only about 6,000 are visible to the naked eye. Most are faint red dwarfs, so the total is hard to count precisely.',
    }],
    [{
      q: 'In 1610, Galileo pointed his telescope at the Milky Way. What did he discover?',
      right: 'It is made of countless faint stars',
      wrong: ['It is a stream of glowing gas', 'It is a reflection of the oceans', 'It is a ring of comets around Earth'],
      why: 'His small telescope split the milky glow into stars too faint to see one by one. The word "galaxy" comes from the Greek for milk.',
    }, {
      q: 'Every picture showing the whole Milky Way spiral from above is…',
      right: 'An illustration built from measurements',
      wrong: ['A photo taken by the Voyager probes', 'A photo taken by the Hubble telescope', 'A photo taken from the Moon'],
      why: 'No spacecraft has left the disc; that would take tens of thousands of years even at light speed. Maps come from measuring stars and gas from inside.',
    }],
  ],
  G02: [
    [{
      q: 'Roughly how far is the Sun from the centre of the Milky Way?',
      right: 'About 26,000 light-years',
      wrong: ['About 26 light-years', 'About 2,600 light-years', 'About 2.6 million light-years'],
      why: 'We live about halfway out from the centre, in a quiet suburb. The galactic centre lies towards the constellation Sagittarius.',
    }, {
      q: 'Our spiral arm is called the Orion Arm. Why is it named after Orion?',
      right: 'Many of its bright stars and nebulae appear in Orion',
      wrong: ['Orion is the arm\'s brightest star', 'It is shaped like a hunter', 'It was discovered by a scientist named Orion'],
      why: 'Orion\'s bright stars and the Orion Nebula all lie in our arm. It is also called the Local Arm or the Orion–Cygnus Arm.',
    }],
    [{
      q: 'How long does the Sun take to circle the centre of the galaxy once?',
      right: 'About 230 million years',
      wrong: ['About 1 year', 'About 230 years', 'About 230 trillion years'],
      why: 'This "galactic year" means the Sun has gone around only about 20 times since it formed 4.6 billion years ago.',
    }, {
      q: 'The Sun races around the galaxy, carrying Earth along. Roughly how fast?',
      right: 'About 230 km per second',
      wrong: ['About 230 km per hour', 'About 2 km per second', 'Almost at the speed of light'],
      why: 'That is over 800,000 km/h, yet the galaxy is so huge that one lap still takes hundreds of millions of years.',
    }],
    [{
      q: 'Dust hides most of the galaxy from view. How did astronomers first map its spiral arms in the 1950s?',
      right: 'With radio waves given off by hydrogen gas',
      wrong: ['With photos from space telescopes', 'By counting stars by eye', 'With radar beams bounced off stars'],
      why: 'Cold hydrogen glows faintly at a 21-cm radio wavelength that passes through dust, revealing where gas piles up in the arms.',
    }, {
      q: 'In 1918 Harlow Shapley showed the Sun is far from the galaxy\'s centre. What did he study?',
      right: 'Globular clusters, great balls of old stars',
      wrong: ['The orbits of the planets', 'Sunspots and solar flares', 'Craters on the Moon'],
      why: 'The clusters swarm around a point in Sagittarius, far from us. He rightly concluded that point, not the Sun, is the galaxy\'s centre.',
    }],
  ],
  G03: [
    [{
      q: 'The Crab Nebula is entry number 1, "M1", in which famous catalogue?',
      right: 'Charles Messier\'s list of fuzzy objects',
      wrong: ['Ptolemy\'s list of constellations', 'NASA\'s list of space missions', 'Galileo\'s list of moons'],
      why: 'Messier hunted comets and listed fuzzy things that were NOT comets. The Crab, which fooled him, became the first entry.',
    }, {
      q: 'In which constellation can you find the Crab Nebula?',
      right: 'Taurus, the Bull',
      wrong: ['Cancer, the Crab', 'Scorpius, the Scorpion', 'Pisces, the Fishes'],
      why: 'It sits near the tip of one of the Bull\'s horns, about 6,500 light-years away. Its name comes from its look, not its constellation.',
    }],
    [{
      q: 'The Crab Nebula is still growing. Roughly how fast is it expanding?',
      right: 'About 1,500 km per second',
      wrong: ['About 15 km per hour', 'About 1 km per second', 'Faster than light'],
      why: 'At that speed you could cross Earth in under 10 seconds. Tracing the motion backwards points to an explosion about 1,000 years ago.',
    }, {
      q: 'What are the Crab Nebula\'s colourful tangled filaments made of?',
      right: 'Gas blasted out of the exploded star',
      wrong: ['Ice and dust from comets', 'Gas falling into a black hole', 'Light reflected from nearby stars'],
      why: 'Hydrogen, helium and heavier elements like oxygen and nitrogen, cooked inside the star, now glow as they fly into space.',
    }],
    [{
      q: 'The star that made the Crab exploded in 1054. Who left clear written records of it?',
      right: 'Chinese astronomers',
      wrong: ['Ancient Egyptian priests', 'Galileo Galilei', 'NASA scientists'],
      why: 'They saw a "guest star" bright enough to see in daylight for about 23 days, and at night for nearly two years.',
    }, {
      q: 'How did the Crab Nebula get its name?',
      right: 'An 1840s drawing of it looked like a crab',
      wrong: ['It lies in the constellation Cancer', 'It moves sideways like a crab', 'Sailors used it to find crabs'],
      why: 'Lord Rosse sketched it through his big telescope in Ireland; his drawing had crab-like legs, and the name stuck.',
    }],
  ],
  G04: [
    [{
      q: 'At the heart of the Crab Nebula lies the Crab Pulsar. What is it?',
      right: 'A rapidly spinning neutron star',
      wrong: ['A young Sun-like star', 'A giant planet', 'A swirling cloud of comets'],
      why: 'It is the crushed core of the star that exploded in 1054: more mass than the Sun, packed into a ball smaller than a city.',
    }, {
      q: 'A neutron star like the Crab Pulsar is heavier than the Sun. How big is it across?',
      right: 'About 20 km, the size of a city',
      wrong: ['About 20 m, the size of a house', 'About as wide as Earth', 'About as wide as the Sun'],
      why: 'Its matter is so dense that a teaspoon of it would weigh around a billion tonnes on Earth.',
    }],
    [{
      q: 'About how many times per second does the Crab Pulsar spin?',
      right: 'About 30 times',
      wrong: ['About once a day', 'About once a minute', 'About 3 million times'],
      why: 'Each turn takes about 33 milliseconds. It is slowly slowing down, losing a tiny bit of spin every day.',
    }, {
      q: 'The Crab Pulsar is slowly spinning down. Where does that lost spin energy go?',
      right: 'It powers the glow of the surrounding nebula',
      wrong: ['It turns into new planets', 'It warms up the Earth', 'It simply disappears'],
      why: 'A wind of fast particles and magnetic fields from the pulsar makes the nebula shine, from radio waves to gamma rays.',
    }],
    [{
      q: 'The Crab Pulsar was found in 1968. Why was it such an important discovery?',
      right: 'It proved neutron stars are born in supernovae',
      wrong: ['It was the first star ever seen', 'It was the first black hole found', 'It proved the Sun will explode'],
      why: 'A pulsar sitting inside the debris of a known explosion linked the two: big stars collapse into neutron stars when they blow up.',
    }, {
      q: 'In 1969 the Crab Pulsar became the first pulsar ever seen to…',
      right: 'Flash in visible light',
      wrong: ['Pulse in radio waves', 'Have a planet', 'Stop spinning'],
      why: 'Astronomers in Arizona saw it blinking on and off 30 times a second in their telescope. Few other pulsars do this.',
    }],
  ],
  G05: [
    [{
      q: 'The name Geminga comes from a phrase in the dialect of Milan. What does it mean?',
      right: '"It isn\'t there"',
      wrong: ['"Little twin"', '"Ghost light"', '"Bright jewel"'],
      why: 'It also stands for "Gemini gamma-ray source": a joke on how hard it was to find in ordinary light.',
    }, {
      q: 'What kind of object is Geminga?',
      right: 'The spinning core left by a supernova',
      wrong: ['A newborn star still forming', 'A planet torn from its star', 'A distant galaxy'],
      why: 'Geminga is a neutron star, a pulsar roughly 800 light-years away, born in an explosion about 300,000 years ago.',
    }],
    [{
      q: 'In which kind of light does Geminga shine most strongly?',
      right: 'Gamma rays',
      wrong: ['Radio waves', 'Visible light', 'Infrared light'],
      why: 'Gamma rays are the most energetic light of all. Geminga is one of the brightest steady gamma-ray sources in the sky.',
    }, {
      q: 'Most pulsars were found by their radio pulses, but Geminga is nearly silent in radio. Why?',
      right: 'Its radio beam probably misses Earth',
      wrong: ['It is too far away to detect', 'Earth\'s air blocks its signal', 'It stopped spinning long ago'],
      why: 'Pulsar beams are like lighthouse beams. Geminga\'s wider high-energy beams sweep over us, but its narrow radio beam seems to point elsewhere.',
    }],
    [{
      q: 'Geminga was first spotted in 1972. What found it?',
      right: 'A gamma-ray satellite in orbit',
      wrong: ['A naked-eye stargazer', 'A radio dish on Earth', 'A probe on Mars'],
      why: 'NASA\'s SAS-2 satellite caught a strong gamma-ray source near Gemini. Gamma rays cannot get through our atmosphere.',
    }, {
      q: 'For 20 years Geminga\'s nature was a mystery. What finally revealed it as a pulsar in 1992?',
      right: 'X-ray pulses caught by the ROSAT satellite',
      wrong: ['Radio pulses from the Arecibo dish', 'A close-up photo by Voyager 2', 'Its supernova exploding in 1992'],
      why: 'ROSAT found it ticking about 4 times a second, and gamma-ray data soon showed the same beat.',
    }],
  ],
  G06: [
    [{
      q: 'The Vela Pulsar lies in the constellation Vela. What does "Vela" mean?',
      right: 'The Sails, of a ship',
      wrong: ['The Veil, of a bride', 'The Wolf', 'The Candle'],
      why: 'Vela was once part of a huge constellation, Argo Navis, the ship of the Argonauts, later split into the Sails, Keel and Stern.',
    }, {
      q: 'Roughly how far away is the Vela Pulsar?',
      right: 'About 1,000 light-years',
      wrong: ['About 1 light-year', 'About 1 million light-years', 'About 1 billion light-years'],
      why: 'That makes it one of the closest pulsars to us. Its supernova remnant spreads across a patch of sky many times the width of the Moon.',
    }],
    [{
      q: 'Why does a pulsar like Vela appear to flash on and off?',
      right: 'Its beams sweep past Earth as it spins',
      wrong: ['It explodes again every second', 'Planets keep blocking its light', 'It switches on and off by itself'],
      why: 'Beams pour out near its magnetic poles, which are tilted from its spin axis. Like a lighthouse, we see a flash each time one points our way.',
    }, {
      q: 'About how many times per second does the Vela Pulsar spin?',
      right: 'About 11 times',
      wrong: ['About once an hour', 'About once a day', 'About 11,000 times'],
      why: 'Each turn takes about 89 milliseconds. A ball heavier than the Sun turning faster than a blender: only a neutron star can do that.',
    }],
    [{
      q: 'In 1969 the Vela Pulsar became the first pulsar seen to "glitch". What is a glitch?',
      right: 'A sudden tiny speed-up of its spin',
      wrong: ['A sudden flare of visible light', 'A brief stop in its spinning', 'A burst of new planets forming'],
      why: 'Vela glitches every few years. Astronomers think its superfluid interior suddenly passes spin to the outer crust.',
    }, {
      q: 'The Vela supernova\'s light reached Earth roughly how long ago?',
      right: 'About 11,000–12,000 years ago',
      wrong: ['About 100 years ago', 'About 1,000 years ago', 'About 10 million years ago'],
      why: 'That was near the end of the last Ice Age. Being so close, it may have briefly outshone everything in the night sky except the Moon.',
    }],
  ],
  G07: [
    [{
      q: 'Roughly how far away is the supernova remnant Cassiopeia A?',
      right: 'About 11,000 light-years',
      wrong: ['About 11 light-years', 'About 110 light-years', 'About 11 million light-years'],
      why: 'It lies in the W-shaped constellation Cassiopeia. Its debris has spread about 10 light-years across in just a few centuries.',
    }, {
      q: 'Cassiopeia A is one of the brightest objects in the whole sky in which kind of light?',
      right: 'Radio waves',
      wrong: ['Visible light', 'Ultraviolet light', 'Moonlight reflected off it'],
      why: 'Above about 1 GHz it is the brightest radio source beyond the Solar System, yet in visible light it is very faint.',
    }],
    [{
      q: 'Cas A\'s debris is rich in silicon, sulfur and iron. Where did these elements come from?',
      right: 'They were forged in the star and its explosion',
      wrong: ['They were made in the Big Bang', 'They came from a passing comet', 'They were blown there by the Sun'],
      why: 'Massive stars build heavier elements in layers, and the explosion makes more. Supernovae seed space with the stuff of planets and people.',
    }, {
      q: 'The debris of Cassiopeia A is still flying outward. Roughly how fast?',
      right: 'Several thousand km per second',
      wrong: ['A few metres per second', 'About 30 km per second', 'Close to the speed of light'],
      why: 'Chandra and Hubble images taken years apart show the knots moving. The blast wave is now slamming into gas the star shed before it died.',
    }],
    [{
      q: 'NASA\'s Chandra X-ray telescope made Cas A its first target in 1999. What did it spot at the centre?',
      right: 'A neutron star, the collapsed core',
      wrong: ['A newborn planet', 'A second exploding star', 'A spacecraft wreck'],
      why: 'The tiny hot point had been missed before. Chandra\'s sharp X-ray vision found it within hours of first looking.',
    }, {
      q: 'Light from Cas A\'s explosion reached Earth around 1680, yet almost nobody noticed. Why, most likely?',
      right: 'Dust in the galaxy dimmed it',
      wrong: ['It happened in daytime only', 'Telescopes were banned at the time', 'It was hidden behind the Moon'],
      why: 'Thick dust between us and Cas A swallowed most of its light. Astronomers only found the remnant in the 20th century, by its radio glow.',
    }],
  ],
  G08: [
    [{
      q: 'PSR B1919+21 was first nicknamed "LGM-1". What did LGM stand for?',
      right: 'Little Green Men',
      wrong: ['Large Galactic Magnet', 'Light Gravity Mass', 'Long Gamma Message'],
      why: 'Its pulses were so regular that the team half-jokingly wondered about an alien signal, before finding a natural explanation.',
    }, {
      q: 'The numbers in the name "PSR B1919+21" describe…',
      right: 'Its position in the sky',
      wrong: ['The date it was discovered', 'Its distance and mass', 'How fast it spins'],
      why: 'PSR means pulsar, and 1919+21 gives its sky coordinates, a bit like a celestial street address. It lies in Vulpecula, the Fox.',
    }],
    [{
      q: 'How often does PSR B1919+21 send out a pulse?',
      right: 'About every 1.3 seconds',
      wrong: ['About every 13 minutes', 'About every 13 hours', 'About once a year'],
      why: 'Every 1.337 seconds, as steady as a clock. Pulsars are among the most precise timekeepers in nature.',
    }, {
      q: 'Why couldn\'t pulses every 1.3 seconds come from spinning ordinary stars?',
      right: 'Only a tiny, ultra-dense star can spin that fast',
      wrong: ['Ordinary stars do not give off light', 'Ordinary stars never spin at all', 'Ordinary stars are too close to us'],
      why: 'A star like the Sun spinning once a second would tear itself apart. A neutron star\'s huge gravity holds it together.',
    }],
    [{
      q: 'Who spotted the strange signal of PSR B1919+21 in 1967?',
      right: 'Jocelyn Bell Burnell, a PhD student',
      wrong: ['Albert Einstein, a physicist', 'Carl Sagan, a TV astronomer', 'Edwin Hubble, a galaxy hunter'],
      why: 'At Cambridge she noticed a bit of "scruff" on kilometres of chart paper from a radio telescope she helped build.',
    }, {
      q: 'A plot of this pulsar\'s pulses became world-famous as…',
      right: 'The cover of Joy Division\'s "Unknown Pleasures"',
      wrong: ['The cover of Pink Floyd\'s "The Dark Side of the Moon"', 'The logo of NASA', 'The cover of David Bowie\'s "Space Oddity"'],
      why: 'The 1979 album cover shows about 80 successive pulses stacked into ghostly white mountain ridges on black.',
    }],
  ],
  G09: [
    [{
      q: 'PSR B1257+12 was officially named Lich. In fantasy stories, what is a lich?',
      right: 'An undead sorcerer',
      wrong: ['A friendly forest spirit', 'A dragon that guards gold', 'A kind of flying ship'],
      why: 'A dead star still "living" on, with planets that orbit a corpse: a fitting name chosen in the IAU\'s 2015 public naming contest.',
    }, {
      q: 'How many known planets orbit the pulsar PSR B1257+12?',
      right: 'Three',
      wrong: ['None', 'One', 'Eight'],
      why: 'Their names are Draugr, Poltergeist and Phobetor, all undead or nightmare creatures. The outer two are each a few times Earth\'s mass.',
    }],
    [{
      q: 'Nobody can see these planets. How were they detected?',
      right: 'Their tugs shifted the timing of the pulses',
      wrong: ['They block the pulsar\'s beam', 'They glow brightly in radio waves', 'A probe flew past them'],
      why: 'As planets pull the pulsar back and forth, its pulses arrive a tiny bit early or late, by much less than a thousandth of a second.',
    }, {
      q: 'Draugr, the innermost planet, is one of the lightest planets known. How heavy is it?',
      right: 'About twice the mass of our Moon',
      wrong: ['About twice the mass of Jupiter', 'About ten times Earth\'s mass', 'About the mass of the Sun'],
      why: 'Pulsar timing is so precise it can feel even a tiny world. Draugr circles Lich every 25 days.',
    }],
    [{
      q: 'Why are the planets of PSR B1257+12 famous?',
      right: 'They were the first confirmed planets outside the Solar System',
      wrong: ['They were the first planets photographed directly', 'They were the first planets found by Kepler', 'They were the first planets with water'],
      why: 'Announced in 1992 by Aleksander Wolszczan and Dale Frail, three years before 51 Pegasi b, the first planet found around a Sun-like star.',
    }, {
      q: 'Which giant telescope did astronomers use to find the planets of Lich?',
      right: 'The Arecibo radio dish in Puerto Rico',
      wrong: ['The Hubble Space Telescope', 'The Kepler space telescope', 'The Keck telescopes in Hawaii'],
      why: 'Its 305-metre dish could time the pulsar\'s flashes with exquisite precision. The telescope collapsed in 2020.',
    }],
  ],
  G10: [
    [{
      q: 'PSR J0437−4715 is the closest and brightest millisecond pulsar. Roughly how far away is it?',
      right: 'About 500 light-years',
      wrong: ['About 5 light-years', 'About 50,000 light-years', 'About 5 million light-years'],
      why: 'At about 156 parsecs, it is a near neighbour by pulsar standards, which makes it one of the best-studied neutron stars.',
    }, {
      q: 'In which southern constellation does PSR J0437−4715 lie?',
      right: 'Pictor, the Painter\'s Easel',
      wrong: ['Ursa Minor, the Little Bear', 'Lyra, the Lyre', 'Perseus, the Hero'],
      why: 'Pictor sits near the bright star Canopus. The "−47" in the pulsar\'s name tells you it lies far south in the sky.',
    }],
    [{
      q: 'About how many times per second does PSR J0437−4715 spin?',
      right: 'About 174 times',
      wrong: ['About once', 'About 17,000 times', 'About once a week'],
      why: 'Each turn takes under 6 milliseconds, faster than a kitchen blender. Its equator whips round at over 12,000 km per second.',
    }, {
      q: 'Old pulsars slow down. How did this one end up spinning so fast?',
      right: 'Matter from a companion star spun it up',
      wrong: ['It was hit by a passing comet', 'It is much younger than the Crab Pulsar', 'Its magnetic field pushes it faster'],
      why: 'Gas falling from its partner, now a white dwarf, acted like a hand on a merry-go-round. Such "recycled" pulsars can spin for billions of years.',
    }],
    [{
      q: 'NASA\'s NICER instrument on the space station studied this pulsar\'s X-ray hot spots. What did it measure?',
      right: 'How big the neutron star is',
      wrong: ['How hot the Sun\'s core is', 'How old the universe is', 'How far away the Moon is'],
      why: 'It found a radius of about 11 km. Knowing size and mass helps physicists learn how matter behaves at crushing densities.',
    }, {
      q: 'Astronomers time pulsars like this one to the nanosecond. What are they hunting with these "pulsar timing arrays"?',
      right: 'Gravitational waves rippling through the galaxy',
      wrong: ['Signals from alien civilisations', 'Changes in Earth\'s weather', 'New moons around Jupiter'],
      why: 'Passing waves stretch space and nudge pulse arrival times. In 2023 several teams reported evidence of a background hum of such waves.',
    }],
  ],
  G11: [
    [{
      q: 'PSR J1748−2446ad holds a record. How many times does it spin every second?',
      right: 'About 716 times',
      wrong: ['About 7 times', 'About 70 times', 'About 7,000 times'],
      why: 'Faster than any other star we know. A point on its equator races at roughly a fifth of the speed of light.',
    }, {
      q: 'Where does the record-spinning pulsar PSR J1748−2446ad live?',
      right: 'In Terzan 5, a crowded globular cluster',
      wrong: ['Inside the Crab Nebula', 'In orbit around the Sun', 'In the Andromeda Galaxy'],
      why: 'Terzan 5 lies towards Sagittarius, about 20,000 light-years away. Its packed stars make it home to dozens of fast pulsars.',
    }],
    [{
      q: 'How did PSR J1748−2446ad get spun up so fast?',
      right: 'It swallowed gas from a companion star',
      wrong: ['A comet hit it', 'It was born spinning that fast', 'Its magnetic field pushed it'],
      why: 'Gas falling onto a neutron star from a partner adds spin, like pushing a merry-go-round. Such "recycled" pulsars are called millisecond pulsars.',
    }, {
      q: 'Why doesn\'t a star spinning 716 times per second tear itself apart?',
      right: 'It is tiny and incredibly dense, so its gravity holds on',
      wrong: ['It is made of solid iron', 'Its magnetic field glues it together', 'Space has no air to fight it'],
      why: 'A neutron star packs more than the Sun\'s mass into a ball about 20–30 km wide. Even so, spinning much faster could start to break it up.',
    }],
    [{
      q: 'Which telescope discovered PSR J1748−2446ad, announced in 2006?',
      right: 'The Green Bank radio telescope in the USA',
      wrong: ['The Hubble Space Telescope', 'The James Webb Space Telescope', 'Galileo\'s first telescope'],
      why: 'Pulsars flash brightly in radio waves. Jason Hessels and colleagues caught its 1.4-millisecond beat in data taken in 2004.',
    }, {
      q: 'The "ad" at the end of PSR J1748−2446ad\'s name means…',
      right: 'It was one of the later pulsars found in its cluster',
      wrong: ['It was found in the year AD', 'Its discoverer\'s initials', 'It is the brightest pulsar'],
      why: 'Pulsars in Terzan 5 get letters in order of discovery: A, B, C… then aa, ab, ac, ad. The cluster now has more than 40.',
    }],
  ],
  G12: [
    [{
      q: 'In which constellation can you find the direction of Cygnus X-1?',
      right: 'Cygnus, the Swan',
      wrong: ['Orion, the Hunter', 'Leo, the Lion', 'Scorpius, the Scorpion'],
      why: 'The name says it: the first X-ray source found in Cygnus. It sits near the Swan\'s neck, about 7,000 light-years away.',
    }, {
      q: 'Cygnus X-1 is a black hole with a partner. What kind of star is its companion?',
      right: 'A huge blue supergiant',
      wrong: ['A small red dwarf', 'A white dwarf', 'A star just like the Sun'],
      why: 'The companion, HDE 226868, is a hot giant about 40 times the Sun\'s mass. The two circle each other every 5.6 days.',
    }],
    [{
      q: 'Black holes give off no light. Why does Cygnus X-1 shine brightly in X-rays?',
      right: 'Gas spiralling in heats up to millions of degrees',
      wrong: ['The black hole itself is burning', 'It reflects X-rays from the Sun', 'Its companion star is made of X-rays'],
      why: 'Gas pulled off the companion forms a swirling disc. Friction heats it so much it glows in X-rays before falling in.',
    }, {
      q: 'How did astronomers decide Cygnus X-1 is a black hole and not a neutron star?',
      right: 'Its companion\'s orbit shows it is too heavy',
      wrong: ['They saw it swallow a planet', 'It glows bright red', 'It sends regular radio pulses'],
      why: 'At about 21 times the Sun\'s mass, the dark object is far heavier than any neutron star can be, so it must have collapsed into a black hole.',
    }],
    [{
      q: 'In 1974 Stephen Hawking made a famous bet about Cygnus X-1. What did he bet?',
      right: 'That it was NOT a black hole',
      wrong: ['That it would explode', 'That it was a wormhole', 'That it was moving towards Earth'],
      why: 'Hawking bet Kip Thorne it wasn\'t, as an "insurance policy" for his life\'s work. He happily conceded in 1990 as evidence piled up.',
    }, {
      q: 'Cygnus X-1 was discovered in 1964. How?',
      right: 'By X-ray detectors on a rocket above the atmosphere',
      wrong: ['By Galileo\'s telescope', 'By the naked eye', 'By the Apollo astronauts'],
      why: 'Earth\'s air blocks X-rays, so early X-ray astronomy used short rocket flights. Cygnus X-1 was one of the first strong sources found.',
    }],
  ],
  G13: [
    [{
      q: 'From where on Earth can you best see the Carina Nebula?',
      right: 'The Southern Hemisphere',
      wrong: ['Only the North Pole', 'Anywhere, all year round', 'Only from a plane'],
      why: 'Carina, the Keel of a ship, is a far-southern constellation. From dark southern skies the nebula is visible to the naked eye.',
    }, {
      q: 'The Carina Nebula is about six times farther than the Orion Nebula. How does it compare in our sky?',
      right: 'It looks larger and brighter',
      wrong: ['It is too faint to ever see', 'It looks exactly the same', 'It is only visible in X-rays'],
      why: 'Despite the distance it outshines Orion. It is a far bigger cloud, lit by some of the most massive stars in the galaxy.',
    }],
    [{
      q: 'What carves the towering dust pillars in the Carina Nebula?',
      right: 'Fierce light and winds from massive stars',
      wrong: ['Wind from a nearby planet', 'Comets crashing through it', 'The pull of the Moon'],
      why: 'Hot giant stars blast away the gas around them. Denser knots resist and are left standing as pillars, with new stars forming in their tips.',
    }, {
      q: 'Why do the stars of the Carina Nebula live such short lives?',
      right: 'Massive stars burn their fuel extremely fast',
      wrong: ['The nebula steals their light', 'They are too cold to shine', 'They are eaten by black holes'],
      why: 'A star dozens of times the Sun\'s mass may last only a few million years, versus 10 billion for the Sun, then explode as a supernova.',
    }],
    [{
      q: 'Webb\'s famous 2022 image "Cosmic Cliffs" shows what?',
      right: 'The edge of a star-forming region in Carina',
      wrong: ['Mountains on Mars', 'Ice cliffs on Europa', 'The rim of a black hole'],
      why: 'It shows NGC 3324, a corner of the Carina complex. Webb\'s infrared eyes revealed hundreds of young stars hidden in the dust.',
    }, {
      q: 'In 2010 Hubble photographed "Mystic Mountain" in the Carina Nebula. What is it?',
      right: 'A pillar of gas and dust about 3 light-years tall',
      wrong: ['A volcano on a nearby moon', 'A frozen comet', 'A giant star\'s surface'],
      why: 'Taken for Hubble\'s 20th birthday, it shows jets shooting from baby stars buried inside the pillar\'s peaks.',
    }],
  ],
  G14: [
    [{
      q: 'Eta Carinae is hidden inside a two-lobed cloud called the Homunculus. What does "Homunculus" mean?',
      right: 'Little man',
      wrong: ['Great flame', 'Twin eyes', 'Dark heart'],
      why: 'Early blurry views looked a bit like a tiny human figure. Sharper images show two huge bubbles of gas and dust.',
    }, {
      q: 'Eta Carinae is not one star. What is it?',
      right: 'A pair of very massive stars',
      wrong: ['A single small star', 'A star and a planet', 'A cluster of a thousand stars'],
      why: 'Two giants circle each other every 5.5 years. Together they hold more than 100 times the Sun\'s mass.',
    }],
    [{
      q: 'Why is Eta Carinae called unstable?',
      right: 'It is so bright its light pushes its own outer layers away',
      wrong: ['It has no gravity', 'It is spinning backwards', 'It is too cold to stay together'],
      why: 'It shines millions of times brighter than the Sun, close to the limit where radiation beats gravity, so it sheds mass in huge outbursts.',
    }, {
      q: 'What is the most likely fate of Eta Carinae\'s main star?',
      right: 'Exploding as a supernova',
      wrong: ['Shrinking into a planet', 'Quietly becoming like the Sun', 'Turning into a comet'],
      why: 'Stars this heavy end violently, probably within the next million years. At about 7,500 light-years it is far enough to be safe for Earth.',
    }],
    [{
      q: 'In the 1840s Eta Carinae had a "Great Eruption". What happened in our sky?',
      right: 'It became the second-brightest star, after Sirius',
      wrong: ['It vanished forever', 'It was visible in daytime for years', 'It split into two stars'],
      why: 'It flared up around 1843 and then faded below naked-eye visibility for decades. It has slowly brightened again since.',
    }, {
      q: 'Where did the Homunculus Nebula around Eta Carinae come from?',
      right: 'Material blasted out in the 1840s eruption',
      wrong: ['A planet that broke apart', 'A comet\'s tail', 'Dust from the Big Bang'],
      why: 'The eruption threw off many times the Sun\'s mass. Hubble images show the two lobes still expanding at hundreds of km per second.',
    }],
  ],
  G15: [
    [{
      q: 'Omega Centauri is the largest globular cluster of the Milky Way. About how many stars does it hold?',
      right: 'About 10 million',
      wrong: ['About 100', 'About 10,000', 'About 10 billion'],
      why: 'They are packed into a ball about 150 light-years wide. Near the centre, stars are only a fraction of a light-year apart.',
    }, {
      q: 'Why does Omega Centauri have a Greek letter, like a star?',
      right: 'It was first catalogued as a single star',
      wrong: ['It is the last star in the universe', 'It was named after a Greek god', 'It is a cluster of exactly 24 stars'],
      why: 'To the naked eye it looks like one fuzzy star. Ptolemy listed it that way, and Bayer later gave it the letter omega.',
    }],
    [{
      q: 'Some astronomers think Omega Centauri was once something else. What?',
      right: 'The core of a small galaxy the Milky Way swallowed',
      wrong: ['A giant planet', 'A burned-out spiral arm', 'A piece of Andromeda that broke off'],
      why: 'It holds several generations of stars with different make-ups, unusual for a globular cluster but expected for a dwarf galaxy\'s stripped heart.',
    }, {
      q: 'What keeps Omega Centauri\'s millions of stars together in a ball?',
      right: 'Their shared gravity',
      wrong: ['A shell of gas', 'Magnetic fields', 'Pressure from the Milky Way\'s disc'],
      why: 'All those stars pull on each other. The cluster has held together for about 12 billion years, nearly the age of the universe.',
    }],
    [{
      q: 'In 2024, Hubble data revealed something in Omega Centauri\'s core. What?',
      right: 'Fast stars hinting at a medium-sized black hole',
      wrong: ['A new planet like Earth', 'A supernova exploding', 'A hidden spiral galaxy'],
      why: 'Seven stars move too fast to be held by visible stars alone, pointing to a black hole of at least 8,000 Suns: a rare middle-weight one.',
    }, {
      q: 'In the 1830s John Herschel looked at Omega Centauri through a telescope. What did he realise?',
      right: 'It is a vast swarm of stars, not one star',
      wrong: ['It is a comet', 'It is a planet', 'It is a galaxy far beyond ours'],
      why: 'Edmond Halley had already called it a nebula in 1677. Herschel\'s telescope resolved it into countless stars: a globular cluster.',
    }],
  ],
  G16: [
    [{
      q: 'Where is the Milky Way\'s halo?',
      right: 'In a huge sphere surrounding the flat disc',
      wrong: ['Only in the spiral arms', 'Inside the central black hole', 'In a ring around the Sun'],
      why: 'The halo is a faint, roughly round cloud of stars and dark matter that stretches far beyond the bright disc we live in.',
    }, {
      q: 'Roughly how many globular clusters orbit in the Milky Way\'s halo?',
      right: 'More than 150',
      wrong: ['Exactly 3', 'About 20', 'Over a million'],
      why: 'They swarm around the galaxy\'s centre on tilted, looping orbits. The Andromeda Galaxy has several times more.',
    }],
    [{
      q: 'Halo stars contain very few elements heavier than helium. Why?',
      right: 'They formed early, before many stars had made those elements',
      wrong: ['They burned all their iron', 'The halo is too cold for metals', 'Dark matter absorbs them'],
      why: 'Heavier elements are forged in stars and spread by supernovae. The oldest stars formed from gas that had barely been enriched.',
    }, {
      q: 'How do astronomers know the Milky Way has a dark matter halo?',
      right: 'Its outer stars and gas orbit too fast for the visible mass',
      wrong: ['It blocks the light behind it', 'It glows faintly in radio', 'Astronauts have sampled it'],
      why: 'Without extra unseen mass, the outer galaxy would fly apart. Dark matter likely makes up most of the Milky Way\'s total mass.',
    }],
    [{
      q: 'A long stream of stars, found in the 1990s, wraps around the Milky Way\'s halo. Where do its stars come from?',
      right: 'A dwarf galaxy being torn apart by the Milky Way',
      wrong: ['A comet\'s tail', 'A broken spiral arm', 'Light leaking from Andromeda'],
      why: 'The Sagittarius Dwarf Galaxy, discovered in 1994, is being stretched by our galaxy\'s tides into streams of stars that loop around the whole halo.',
    }, {
      q: 'In 2018, data from ESA\'s Gaia revealed a secret in the halo. What?',
      right: 'Stars from a galaxy that merged with ours billions of years ago',
      wrong: ['A second Sun', 'A planet orbiting a globular cluster', 'A hole in the galaxy'],
      why: 'Many halo stars share odd orbits: debris of "Gaia-Enceladus", a smaller galaxy that crashed into the Milky Way around 10 billion years ago.',
    }],
  ],
  G17: [
    [{
      q: 'In which direction in our sky is the centre of the Milky Way?',
      right: 'Towards Sagittarius',
      wrong: ['Towards the North Star', 'Towards Orion', 'Towards the Big Dipper'],
      why: 'It lies near the "Teapot" of Sagittarius, where the Milky Way looks thickest, about 26,000 light-years away.',
    }, {
      q: 'Why can\'t we see the galactic centre with our eyes or ordinary telescopes?',
      right: 'Thick dust clouds block its visible light',
      wrong: ['It is below the horizon for everyone', 'The Sun is always in front of it', 'It gives off no light'],
      why: 'Dust between us and the core dims its visible light by about a trillion times, so only a tiny fraction ever reaches us.',
    }],
    [{
      q: 'Why can infrared telescopes see through the dust to the galactic centre?',
      right: 'Longer wavelengths slip past tiny dust grains',
      wrong: ['Infrared is hotter than dust', 'Infrared travels faster than light', 'Dust is transparent at night'],
      why: 'Dust grains scatter blue and visible light strongly but let longer infrared waves through, just as sunsets look red through haze.',
    }, {
      q: 'What is the nuclear star cluster at the galactic centre like?',
      right: 'Millions of stars crammed into a few light-years',
      wrong: ['A handful of dim stars', 'An empty bubble with no stars', 'A single giant star'],
      why: 'It is one of the densest star clusters known. Near the core, stars are packed millions of times tighter than around the Sun.',
    }],
    [{
      q: 'In the early 1930s Karl Jansky detected strange static from the galactic centre. What did it start?',
      right: 'Radio astronomy',
      wrong: ['Space travel', 'Television', 'X-ray astronomy'],
      why: 'Jansky, an engineer at Bell Labs, was hunting sources of radio noise and found one coming from Sagittarius.',
    }, {
      q: 'In 2010 NASA\'s Fermi telescope found giant structures above and below the galactic centre. What are they?',
      right: 'Huge bubbles glowing in gamma rays',
      wrong: ['New spiral arms', 'Two hidden galaxies', 'Rings of planets'],
      why: 'The "Fermi bubbles" stretch about 25,000 light-years each way, likely blown by a past outburst from the central black hole.',
    }],
  ],
  G18: [
    [{
      q: 'Sagittarius A* is a supermassive black hole. Roughly how heavy is it?',
      right: 'About 4 million times the Sun\'s mass',
      wrong: ['About 4 times the Sun\'s mass', 'About 4,000 times the Sun\'s mass', 'About 4 trillion times the Sun\'s mass'],
      why: 'Heavy, but small for a galaxy core: the black hole in galaxy M87 is more than a thousand times heavier.',
    }, {
      q: 'If you could put Sagittarius A* in our Solar System, how big would it be?',
      right: 'It would fit inside the orbit of Mercury',
      wrong: ['As big as a city', 'As big as the Earth', 'Wider than the whole Solar System'],
      why: 'Its event horizon is roughly 24 million km across, about 17 times the Sun\'s width. All 4 million Suns\' worth of mass is inside.',
    }],
    [{
      q: 'Sagittarius A* is quite faint for a supermassive black hole. Why?',
      right: 'Very little gas is falling into it',
      wrong: ['It is too small to be seen', 'It is hidden behind the Sun', 'It is cooling down'],
      why: 'Black holes only glow when gas heats up on the way in. Ours is on a very light diet compared to bright quasars.',
    }, {
      q: 'What does the dark centre in the Event Horizon Telescope image of Sagittarius A* show?',
      right: 'The black hole\'s shadow against glowing gas',
      wrong: ['A cloud of dust in front', 'A gap in the telescope data', 'The surface of a dark star'],
      why: 'Light that gets too close is captured or bent away, leaving a dark shadow ringed by hot gas, as Einstein\'s theory predicts.',
    }],
    [{
      q: 'How did the Event Horizon Telescope take the 2022 image of Sagittarius A*?',
      right: 'By linking radio dishes all over the world',
      wrong: ['With one giant telescope in space', 'By sending a probe to the centre', 'With a camera on the Moon'],
      why: 'Combining dishes on several continents made a virtual telescope as big as Earth, sharp enough to see a doughnut on the Moon.',
    }, {
      q: 'Who shared the 2020 Nobel Prize in Physics for discovering a supermassive object at the galaxy\'s centre?',
      right: 'Reinhard Genzel and Andrea Ghez',
      wrong: ['Stephen Hawking and Kip Thorne', 'Edwin Hubble and Harlow Shapley', 'Carl Sagan and Frank Drake'],
      why: 'Their teams tracked stars orbiting the centre for decades. The prize was shared with Roger Penrose for black hole theory.',
    }],
  ],
  G19: [
    [{
      q: 'How long does the star S2 take to orbit Sagittarius A*?',
      right: 'About 16 years',
      wrong: ['About 16 days', 'About 160 years', 'About 16,000 years'],
      why: 'That is fast enough for astronomers to watch full orbits. The Sun takes over 200 million years to circle the galaxy once.',
    }, {
      q: 'In 2018 S2 made its closest pass to Sagittarius A*. How close did it get?',
      right: 'About 120 times the Earth–Sun distance',
      wrong: ['About as close as the Moon is to Earth', 'About 1 light-year', 'About 10,000 light-years'],
      why: 'Around 120 AU, about four times Neptune\'s distance from the Sun. Next close pass is expected around 2034.',
    }],
    [{
      q: 'Why does S2 move fastest when it is closest to Sagittarius A*?',
      right: 'Gravity is strongest there, so it speeds up',
      wrong: ['It is pushed by the black hole\'s light', 'It is lighter at that point', 'Its engines fire'],
      why: 'Like a comet near the Sun, it whips around at closest approach, reaching about 7,700 km/s, roughly 2.5% of the speed of light.',
    }, {
      q: 'S2\'s orbit slowly turns, tracing a rosette pattern. What does that confirm?',
      right: 'Einstein\'s theory of gravity',
      wrong: ['That the black hole is shrinking', 'That S2 has a planet', 'That the galaxy is spinning backwards'],
      why: 'Newton\'s gravity predicts a fixed ellipse. Einstein\'s general relativity predicts this slow swing, measured by the GRAVITY team in 2020.',
    }],
    [{
      q: 'How did astronomers use stars like S2 to weigh Sagittarius A*?',
      right: 'By timing their orbits and measuring their size',
      wrong: ['By catching light from the black hole', 'By sending a probe to it', 'By counting nearby planets'],
      why: 'A star\'s orbit size and period reveal the mass it circles. S2\'s orbit points to about 4 million Suns packed in a tiny space.',
    }, {
      q: 'In 2018 the GRAVITY instrument saw S2\'s light stretched redder near the black hole. Why?',
      right: 'Light loses energy climbing out of strong gravity',
      wrong: ['S2 turned into a red giant', 'Dust reddened it', 'The telescope overheated'],
      why: 'This "gravitational redshift" was predicted by Einstein. Seeing it near a black hole was a first, made with ESO\'s Very Large Telescope.',
    }],
  ],
  G20: [
    [{
      q: 'Seen from outside, which two satellite galaxies would you spot close to the Milky Way?',
      right: 'The Large and Small Magellanic Clouds',
      wrong: ['Andromeda and Triangulum', 'The Sombrero and the Whirlpool', 'The Pleiades and the Hyades'],
      why: 'These dwarf galaxies, about 160,000 and 200,000 light-years away, are easy naked-eye sights from the Southern Hemisphere.',
    }, {
      q: 'The Milky Way\'s disc is about 100,000 light-years wide. How thick is the thin disc?',
      right: 'About 1,000 light-years',
      wrong: ['About 10 light-years', 'About 100,000 light-years', 'About 1 million light-years'],
      why: 'That is about 100 times thinner than it is wide. Scaled to a CD, the disc would be roughly as thin as the CD itself.',
    }],
    [{
      q: 'Seen from outside, why do the Milky Way\'s spiral arms stand out bright and blue?',
      right: 'They are full of young, hot, massive stars',
      wrong: ['They are made of ice', 'They reflect light from the centre', 'They are closer to the camera'],
      why: 'Arms are where gas piles up and new stars are born. Short-lived blue giants light them up, while older, redder stars fill the whole disc.',
    }, {
      q: 'Compared to the Milky Way, our neighbour the Andromeda Galaxy is…',
      right: 'Larger, with more stars',
      wrong: ['Tiny, like a single star cluster', 'Exactly the same size', 'Inside the Milky Way'],
      why: 'Andromeda, about 2.5 million light-years away, is the biggest galaxy in our Local Group, though the two may be similar in total mass.',
    }],
    [{
      q: 'We live inside the Milky Way. How did astronomers confirm it has a central bar?',
      right: 'Infrared surveys mapped stars through the dust',
      wrong: ['A probe flew outside and took a photo', 'Ancient sky charts showed it', 'Astronauts saw it from the Moon'],
      why: 'No camera has left the galaxy. Infrared star counts, such as NASA\'s Spitzer survey in 2005, revealed the long bar from within.',
    }, {
      q: 'What did ESA\'s Gaia spacecraft do for the Milky Way?',
      right: 'Mapped the positions and motions of nearly 2 billion stars',
      wrong: ['Flew to the galactic centre', 'Photographed the galaxy from outside', 'Counted every star in it'],
      why: 'Gaia\'s 3D map, from 2014 to 2025, revealed our galaxy\'s past mergers, wobbles and the paths its stars will take.',
    }],
  ],

  // ── Local Group ──
  L01: [
    [{
      q: 'The Local Group is the family of galaxies we belong to. About how wide is it?',
      right: 'About 10 million light-years',
      wrong: ['About 10,000 light-years', 'About 100,000 light-years', 'About 10 billion light-years'],
      why: 'Our neighbourhood is about 100 times wider than the Milky Way itself. Most of its members are small dwarf galaxies clustered around the two giants.',
    }, {
      q: 'Which two galaxies are the giants of the Local Group?',
      right: 'The Milky Way and Andromeda',
      wrong: ['The two Magellanic Clouds', 'Triangulum and the Sombrero', 'M87 and Centaurus A'],
      why: 'Together they hold most of the group\'s mass. Triangulum comes third; the rest are dozens of dwarf galaxies, many orbiting one of the two big spirals.',
    }],
    [{
      q: 'The universe is expanding. Why aren\'t the Local Group galaxies flying apart?',
      right: 'Their mutual gravity is strong enough to hold them together',
      wrong: ['They are too young to feel the expansion', 'A magnetic field ties them together', 'Expansion only happens inside galaxies'],
      why: 'Cosmic expansion only wins over large, sparse distances. Inside a bound group, gravity rules, which is why Andromeda is approaching us instead of receding.',
    }, {
      q: 'Most galaxies in the Local Group are dwarf galaxies. What makes them "dwarfs"?',
      right: 'They hold far fewer stars than big spirals',
      wrong: ['They are made only of red dwarf stars', 'They are galaxies that have shrunk with age', 'They contain no dark matter'],
      why: 'The Milky Way has a few hundred billion stars; dwarfs have thousands to a few billion, and many are faint, dark-matter-rich swarms of old stars that were only found in recent decades.',
    }],
    [{
      q: 'Why are new members of the Local Group still being found today?',
      right: 'Many dwarf galaxies are so faint they hide among foreground stars',
      wrong: ['New galaxies are born there every year', 'The group only formed recently', 'Old telescopes could not see other galaxies at all'],
      why: 'Some "ultra-faint" dwarfs contain only a few thousand visible stars. Deep sky surveys like SDSS and DES uncovered dozens of them since the 2000s.',
    }, {
      q: 'Who coined the name "Local Group" for our galactic neighbourhood, in 1936?',
      right: 'Edwin Hubble',
      wrong: ['Albert Einstein', 'Galileo Galilei', 'Carl Sagan'],
      why: 'In his book "The Realm of the Nebulae", Hubble described our galaxy\'s small cluster of neighbours. Today more than 80 members are known.',
    }],
  ],
  L02: [
    [{
      q: 'The Andromeda Galaxy is about 2.5 million light-years away. Can you see it without a telescope?',
      right: 'Yes, as a faint smudge under dark skies',
      wrong: ['No, only the Hubble telescope can see it', 'Only during a total solar eclipse', 'Only from the southern hemisphere'],
      why: 'Its light is spread out, so it looks like a dim oval glow. It is one of the farthest things the human eye can see unaided.',
    }, {
      q: 'In a long-exposure photo, how big does the Andromeda Galaxy look in our sky?',
      right: 'About six full Moons wide',
      wrong: ['A tiny dot, like a star', 'About half a full Moon', 'Half the entire sky'],
      why: 'Its disc stretches about 3° across. We just can\'t see most of it with our eyes, because only the bright core stands out from the sky glow.',
    }],
    [{
      q: 'Andromeda is heading toward us at about 110 km/s. What do many simulations predict for the two galaxies?',
      right: 'A collision and a slow merger into one galaxy',
      wrong: ['A bounce, like two billiard balls', 'A swap of their central black holes', 'A pass-through with no effect at all'],
      why: 'Simulations suggest a close encounter in roughly 4–5 billion years. The merged galaxy has been nicknamed "Milkomeda", though a 2025 study says it is not certain.',
    }, {
      q: 'If Andromeda and the Milky Way collide, how often will two of their stars actually crash into each other?',
      right: 'Almost never',
      wrong: ['Most stars will collide', 'About half of them will collide', 'Every star will be destroyed'],
      why: 'Stars are tiny compared with the gaps between them. Gas clouds would smash together and trigger star birth, but the stars themselves would mostly slip past.',
    }],
    [{
      q: 'In the 1920s Edwin Hubble proved Andromeda was a separate galaxy. What did he find in it?',
      right: 'A Cepheid variable star, a pulsing "standard candle"',
      wrong: ['A comet passing in front of it', 'A planet orbiting one of its stars', 'A radio signal from its centre'],
      why: 'A Cepheid\'s pulse rate reveals its true brightness. Comparing that with how dim it looked showed Andromeda was far outside the Milky Way.',
    }, {
      q: 'Before Hubble, many astronomers thought Andromeda was what?',
      right: 'A gas cloud inside our own Milky Way',
      wrong: ['A planet beyond Neptune', 'A comet that never moved', 'A hole in the sky'],
      why: 'It was called the "Andromeda Nebula". The 1920 "Great Debate" argued whether such spirals were nearby clouds or distant "island universes".',
    }],
  ],
  L03: [
    [{
      q: 'M31* sits at the centre of the Andromeda Galaxy. What is it?',
      right: 'A supermassive black hole',
      wrong: ['A giant red star', 'A huge globular cluster', 'A dying white dwarf'],
      why: 'Stars whirl around the core far too fast for anything else to explain. Its mass is more than 100 million Suns, packed into a tiny region.',
    }, {
      q: 'Compared with Sagittarius A*, the Milky Way\'s central black hole, M31* is…',
      right: 'Tens of times more massive',
      wrong: ['About the same mass', 'Tens of times less massive', 'A million times more massive'],
      why: 'Sagittarius A* weighs about 4 million Suns; M31* is around 100 million or more. A bigger galaxy bulge tends to come with a bigger black hole.',
    }],
    [{
      q: 'M31* is very dim in X-rays compared with many galactic centres. Why?',
      right: 'Very little gas is falling into it',
      wrong: ['It is hidden behind the Moon', 'It has run out of mass', 'Black holes never give off any light'],
      why: 'Black holes only shine when gas spirals in and heats up. M31* is "starving", so it glows faintly, much like our own quiet Sagittarius A*.',
    }, {
      q: 'How do astronomers weigh a black hole like M31* that they cannot see directly?',
      right: 'By measuring how fast stars orbit around it',
      wrong: ['By timing how long its shadow lasts', 'By counting the planets it has swallowed', 'By measuring its temperature'],
      why: 'Faster orbits at a given distance mean more mass inside. It is the same logic that lets us weigh the Sun from the orbits of the planets.',
    }],
    [{
      q: 'Hubble images in the 1990s showed something odd about Andromeda\'s core. What?',
      right: 'It looked like a double nucleus',
      wrong: ['It was completely empty', 'It was spinning backwards', 'It had a ring of planets'],
      why: 'Two bright lumps, P1 and P2, appeared. The best explanation is a lopsided disc of stars orbiting the black hole, bunching up on one side.',
    }, {
      q: 'Andromeda\'s double nucleus is thought to be one disc of stars on stretched orbits. Why does that create two bright spots?',
      right: 'Stars linger and pile up at the far ends of their orbits',
      wrong: ['Two black holes each light up their own spot', 'A dust lane splits the light in two', 'One spot is a reflection of the other'],
      why: 'On an oval orbit, stars move slowest at their farthest point, so they crowd there. This "eccentric disc" model was proposed by Scott Tremaine in 1995.',
    }],
  ],
  L04: [
    [{
      q: 'Among the galaxies of the Local Group, where does Triangulum (M33) rank by size?',
      right: 'Third largest',
      wrong: ['The largest', 'Second largest', 'The smallest'],
      why: 'Only Andromeda and the Milky Way are bigger. Triangulum is about 60,000 light-years across, roughly half the Milky Way\'s width.',
    }, {
      q: 'Triangulum is about 2.7 million light-years away. What makes it special for skywatchers?',
      right: 'It is one of the most distant objects visible to the naked eye',
      wrong: ['It is the brightest galaxy in the sky', 'It can be seen in daylight', 'It is visible only through radio telescopes'],
      why: 'Under truly dark skies, sharp-eyed observers can just glimpse it with averted vision. It is a few hundred thousand light-years farther than Andromeda.',
    }],
    [{
      q: 'NGC 604 in Triangulum is one of the largest known H II regions. What is an H II region?',
      right: 'A cloud of hydrogen lit up by hot young stars',
      wrong: ['A cloud of helium left by a dead star', 'A region with no stars at all', 'A ring of ice around a black hole'],
      why: 'Ultraviolet light from massive newborn stars strips electrons from hydrogen, making it glow. NGC 604 is about 1,500 light-years wide and holds 200+ hot stars.',
    }, {
      q: 'What does Triangulum seem to lack, unlike Andromeda and the Milky Way?',
      right: 'A supermassive black hole at its centre',
      wrong: ['Spiral arms', 'Any young stars', 'Any dark matter'],
      why: 'Measurements of its core limit any central black hole to a few thousand Suns at most, tiny next to Andromeda\'s giant. Its small bulge fits that pattern.',
    }],
    [{
      q: 'Charles Messier added Triangulum to his catalogue in 1764. Why did he list objects like it?',
      right: 'So comet hunters would not mistake them for comets',
      wrong: ['To mark future targets for space probes', 'To name new constellations', 'To list stars that might explode'],
      why: 'Messier was hunting comets, and fuzzy patches kept fooling him. His "do not confuse" list, later extended to 110 objects, became a favourite tour of the sky.',
    }, {
      q: 'In 2019 Hubble released a giant mosaic of Triangulum. Roughly how many stars did it resolve?',
      right: 'About 25 million',
      wrong: ['About 25', 'About 25 thousand', 'About 25 trillion'],
      why: 'The image was stitched from 54 Hubble fields, one of the largest pictures it ever made. Even so, it shows only a fraction of the galaxy\'s stars.',
    }],
  ],
  L05: [
    [{
      q: 'M33 X-7 is a black hole in the Triangulum Galaxy. What kind of black hole is it?',
      right: 'A stellar black hole, born from a massive star',
      wrong: ['A supermassive black hole at the galaxy\'s centre', 'A tiny primordial black hole from the Big Bang', 'A black hole floating alone between galaxies'],
      why: 'It weighs about 16 Suns, the leftover core of a collapsed giant star. It lies in the galaxy\'s disc, not its centre.',
    }, {
      q: 'The "X" in the name M33 X-7 tells you what about this object?',
      right: 'It is a strong source of X-rays',
      wrong: ['It is the tenth object found there', 'Its position is still unknown', 'It is an "extra" galaxy'],
      why: 'It was catalogued as the seventh X-ray source in M33. The X-rays come from gas pulled off the companion star and heated to millions of degrees.',
    }],
    [{
      q: 'M33 X-7\'s black hole orbits a companion star of about 70 Suns. How long does one orbit take?',
      right: 'About 3.5 days',
      wrong: ['About 3.5 minutes', 'About 3.5 years', 'About 350 years'],
      why: 'The two are extremely close. Every orbit, the giant star passes in front of the black hole and blocks its X-rays, an eclipse we can time precisely.',
    }, {
      q: 'Why are eclipses so useful for weighing the black hole in M33 X-7?',
      right: 'They reveal the tilt of the orbit, so masses can be pinned down',
      wrong: ['They make the black hole briefly visible', 'They stop the black hole from spinning', 'They let us measure its temperature directly'],
      why: 'If eclipses happen, we see the orbit nearly edge-on. Combined with the star\'s orbital speed, that gives accurate masses for both partners.',
    }],
    [{
      q: 'When its mass was announced in 2007, what record did M33 X-7 set?',
      right: 'The heaviest stellar black hole known in a binary',
      wrong: ['The first black hole ever discovered', 'The closest black hole to Earth', 'The first black hole photographed'],
      why: 'At about 15.7 Suns it beat earlier records. Gravitational-wave detectors have since found heavier stellar black holes in merging pairs.',
    }, {
      q: 'Which two observatories combined to weigh the black hole in M33 X-7?',
      right: 'NASA\'s Chandra X-ray telescope and the Gemini optical telescope',
      wrong: ['Voyager 1 and Voyager 2', 'The Arecibo radio dish and the ISS', 'Kepler and the Event Horizon Telescope'],
      why: 'Chandra timed the X-ray eclipses, while Gemini tracked the companion star\'s motion. Together they gave the masses of both objects.',
    }],
  ],
  L06: [
    [{
      q: 'The Large Magellanic Cloud is a small galaxy orbiting the Milky Way. Where in the sky can you see it?',
      right: 'Only well south, as a hazy patch in the southern sky',
      wrong: ['Right next to the North Star', 'Only in the summer Milky Way from Europe', 'Next to the Moon every month'],
      why: 'It lies near the south celestial pole, in Dorado and Mensa. It looks like a detached piece of the Milky Way and is easy to see from dark southern sites.',
    }, {
      q: 'About how far away is the Large Magellanic Cloud?',
      right: 'About 160,000 light-years',
      wrong: ['About 1,600 light-years', 'About 16 million light-years', 'About 1.6 billion light-years'],
      why: 'That is closer than Andromeda by a factor of about 15. Only a few faint dwarf galaxies, like the Sagittarius Dwarf, are closer to us.',
    }],
    [{
      q: 'The Magellanic Clouds are trailed by the Magellanic Stream. What is it?',
      right: 'A long ribbon of gas pulled out by gravity',
      wrong: ['A river of comets falling toward Earth', 'A jet fired from a black hole', 'A line of stars left by a supernova'],
      why: 'Tidal forces and pressure from the Milky Way\'s hot halo have stripped gas from the Clouds. The stream wraps more than halfway around our sky.',
    }, {
      q: 'The Large Magellanic Cloud is full of young stars and glowing nebulae. Why is it still forming stars so actively?',
      right: 'It still has plenty of gas, stirred up by gravitational tugs',
      wrong: ['It is a brand-new galaxy, born recently', 'It steals stars from the Sun\'s neighbourhood', 'Its black hole is spitting out new stars'],
      why: 'Encounters with the Small Magellanic Cloud and the Milky Way compress its gas, sparking new star birth. Big elliptical galaxies, by contrast, ran out of gas long ago.',
    }],
    [{
      q: 'The Large Magellanic Cloud is named after Ferdinand Magellan. Was his crew the first to notice it?',
      right: 'No, southern peoples and earlier astronomers knew it long before',
      wrong: ['Yes, it formed shortly before 1519', 'Yes, it was hidden by clouds until then', 'No, it was first found by the Hubble telescope'],
      why: 'Indigenous Australians and South Americans told stories about it, and Persian astronomer al-Sufi mentioned it in 964. Magellan\'s chronicler Pigafetta made it famous in Europe.',
    }, {
      q: 'Why is the Large Magellanic Cloud so important for measuring the size of the universe?',
      right: 'Its distance is known very precisely, so it calibrates other distances',
      wrong: ['It sits exactly at the centre of the universe', 'It is the farthest galaxy we can see', 'It sends out regular radio pulses'],
      why: 'Using eclipsing double stars, its distance was pinned down to about 1% in 2019. That anchors the cosmic distance ladder used to measure the expansion rate.',
    }],
  ],
  L07: [
    [{
      q: 'The Tarantula Nebula lies in the Large Magellanic Cloud. What is it?',
      right: 'The most active star-forming region in the Local Group',
      wrong: ['The remains of a dead galaxy', 'A giant black hole\'s shadow', 'A cloud of dust with no stars'],
      why: 'It is churning out massive stars faster than any nursery in the Milky Way. Its other name, 30 Doradus, comes from an old star-catalogue entry.',
    }, {
      q: 'Why is the Tarantula Nebula called the "Tarantula"?',
      right: 'Its glowing filaments look like spider legs',
      wrong: ['It was discovered by a spider scientist', 'It has eight bright stars in a ring', 'It "bites" nearby galaxies'],
      why: 'Long arcs and threads of glowing gas spread out from its bright centre. JWST\'s 2022 images showed the "legs" in incredible infrared detail.',
    }],
    [{
      q: 'The Tarantula Nebula is 160,000 light-years away, yet visible to the naked eye. What would happen if it were as close as the Orion Nebula?',
      right: 'It would be bright enough to cast shadows on Earth',
      wrong: ['It would look exactly the same', 'It would be completely invisible', 'It would turn our sky permanently green'],
      why: 'The Orion Nebula is only ~1,300 light-years away. The Tarantula is so much more powerful that, at that distance, it would rival the brightest objects in our night sky.',
    }, {
      q: 'What makes the gas in the Tarantula Nebula glow so brightly?',
      right: 'Ultraviolet light from hundreds of hot, massive young stars',
      wrong: ['Heat from a nearby supermassive black hole', 'Sunlight reflected from the Milky Way', 'Lightning in giant gas storms'],
      why: 'Its central cluster contains some of the hottest, heaviest stars known. Their radiation and winds energise the gas and carve huge cavities in it.',
    }],
    [{
      q: 'The Tarantula appears in early star catalogues as "30 Doradus". What was it first thought to be?',
      right: 'A single star',
      wrong: ['A comet', 'A planet', 'A second Moon'],
      why: 'It got a star-style number in the constellation Dorado. In 1751 Nicolas-Louis de Lacaille, observing from South Africa, recognised it as a nebula.',
    }, {
      q: 'Which famous explosion was seen at the edge of the Tarantula Nebula in 1987?',
      right: 'The nearest supernova seen in modern times',
      wrong: ['The first gamma-ray burst ever recorded', 'A collision between two black holes', 'The birth of a new galaxy'],
      why: 'SN 1987A lit up in the outskirts of the Tarantula. The region is so full of massive stars that it will keep producing supernovae for millions of years.',
    }],
  ],
  L08: [
    [{
      q: 'R136a1 holds a cosmic record. Which one?',
      right: 'The most massive star known',
      wrong: ['The smallest star known', 'The oldest star known', 'The coldest star known'],
      why: 'It weighs roughly 200 Suns. It sits in R136, a crowded cluster at the heart of the Tarantula Nebula in the Large Magellanic Cloud.',
    }, {
      q: 'Compared with the Sun, how bright is R136a1?',
      right: 'A few million times brighter',
      wrong: ['About twice as bright', 'About a hundred times brighter', 'Dimmer than the Sun'],
      why: 'Massive stars are far more luminous than their mass alone suggests. R136a1 also blazes at more than 40,000 °C, about eight times hotter than the Sun\'s surface.',
    }],
    [{
      q: 'R136a1 is losing mass constantly. What is stripping it away?',
      right: 'Fierce winds driven by its own intense light',
      wrong: ['A black hole eating it', 'Collisions with comets', 'The Milky Way\'s gravity'],
      why: 'Its radiation pushes so hard on its outer gas that it blows away several Earth masses of gas every year. Stars like this sit near the limit of how heavy a star can be.',
    }, {
      q: 'R136a1 is only one or two million years old. Why won\'t it live as long as the Sun?',
      right: 'Heavy stars burn their fuel far faster',
      wrong: ['It was born with no hydrogen', 'It is being cooled by the nebula', 'Large stars cannot fuse anything'],
      why: 'Higher mass means crushing core pressure and furious fusion. The Sun will last ~10 billion years; R136a1 will be gone within a few million.',
    }],
    [{
      q: 'In the early 1980s, R136 looked like one object. What did astronomers first wonder it might be?',
      right: 'A single "superstar" of thousands of Suns',
      wrong: ['A distant quasar', 'A comet in front of the LMC', 'A planet orbiting a nearby star'],
      why: 'It was too bright to be one normal star. Sharper imaging, starting in the mid-1980s, resolved it into a dense cluster of many massive stars.',
    }, {
      q: 'R136a1\'s estimated mass has changed over the years. What happened in 2022?',
      right: 'Sharper images lowered it from ~315 to ~200 Suns',
      wrong: ['It was found to be a planet', 'It suddenly exploded', 'Its mass was raised to 1,000 Suns'],
      why: 'Using the Gemini South telescope, astronomers separated it more cleanly from neighbouring stars. It is still the heaviest star known.',
    }],
  ],
  L09: [
    [{
      q: 'SN 1987A appeared in February 1987. Why was it such a big deal?',
      right: 'It was the nearest supernova seen in nearly 400 years',
      wrong: ['It was the first supernova ever seen', 'It happened inside the Solar System', 'It destroyed a nearby galaxy'],
      why: 'The last one visible to the naked eye was Kepler\'s supernova in 1604. SN 1987A let modern instruments watch a star\'s death up close.',
    }, {
      q: 'SN 1987A exploded in the Large Magellanic Cloud. When did the star really blow up?',
      right: 'Roughly 168,000 years before 1987',
      wrong: ['In February 1987', 'About 1,987 years ago', 'About 168 million years ago'],
      why: 'Its light needed about 168,000 years to reach us, so the explosion happened back when early modern humans were living in Africa.',
    }],
    [{
      q: 'Hours before SN 1987A was seen, detectors on Earth caught a burst of what?',
      right: 'Neutrinos',
      wrong: ['Gravitational waves', 'Radio signals', 'Meteorites'],
      why: 'Neutrinos escape the collapsing core immediately, while light takes hours to break through the star. About two dozen were caught in Japan, the USA and Russia.',
    }, {
      q: 'Hubble shows glowing rings around SN 1987A. Where did they come from?',
      right: 'Gas the star shed thousands of years before exploding, lit up by the blast',
      wrong: ['Moons that were flung into orbit', 'Light bending around a black hole', 'Dust from a passing comet'],
      why: 'The dying star puffed off shells of gas. Light from the explosion lit them up, and later the debris slammed into the inner ring, making it shine like a string of pearls.',
    }],
    [{
      q: 'SN 1987A\'s exploding star had been catalogued before. What surprised astronomers about it?',
      right: 'It was a blue supergiant, not a red one',
      wrong: ['It was a tiny red dwarf', 'It was actually a planet', 'It had already exploded once before'],
      why: 'Theory expected red supergiants like Betelgeuse to explode. The star, Sanduleak −69 202, was hot and blue, forcing a rethink of how massive stars end.',
    }, {
      q: 'For decades, astronomers searched for the neutron star left by SN 1987A. What did JWST report in 2024?',
      right: 'Strong evidence of a neutron star hidden in the debris',
      wrong: ['Proof the star never exploded', 'A brand-new planet forming there', 'A wormhole at the centre'],
      why: 'JWST spotted argon gas being ionised by a hidden energy source at the centre, best explained by a young neutron star still wrapped in dust.',
    }],
  ],
  L10: [
    [{
      q: 'If the Milky Way were the size of a dinner plate, roughly how far away would Andromeda be?',
      right: 'A few metres away',
      wrong: ['Touching the plate', 'A few kilometres away', 'On the Moon'],
      why: 'Andromeda is only about 25 Milky Way widths away. Galaxies are huge compared with the gaps between them, so they collide far more often than stars do.',
    }, {
      q: 'What larger structure does the Local Group belong to?',
      right: 'The Laniakea Supercluster',
      wrong: ['The Oort Cloud', 'The Orion Arm', 'The Kuiper Belt'],
      why: 'Laniakea, Hawaiian for "immense heaven", was mapped in 2014. It spans about 500 million light-years and contains roughly 100,000 galaxies.',
    }],
    [{
      q: 'Stars in a galaxy almost never collide, but galaxies collide often. Why the difference?',
      right: 'Galaxies are close compared with their size; stars are not',
      wrong: ['Galaxies move much faster than stars', 'Stars repel each other magnetically', 'Galaxies have no gravity between them'],
      why: 'Shrink the Sun to a grain of sand and the nearest star is kilometres away. But big galaxies typically sit only tens of their own widths apart.',
    }, {
      q: 'The Local Group is falling toward a giant cluster about 50 million light-years away. Which one?',
      right: 'The Virgo Cluster',
      wrong: ['The Pleiades', 'The Magellanic Clouds', 'Omega Centauri'],
      why: 'Virgo\'s huge mass tugs on us, slowing how fast we recede with the cosmic expansion. It is the heart of the Virgo Supercluster, our local part of Laniakea.',
    }],
    [{
      q: 'The light you see from Andromeda tonight left it about 2.5 million years ago. What was happening on Earth then?',
      right: 'Early human ancestors were living in Africa',
      wrong: ['Dinosaurs ruled the planet', 'The pyramids were being built', 'The Earth had not formed yet'],
      why: 'Around then the first members of our genus, Homo, appeared. Looking out into space always means looking back in time.',
    }, {
      q: 'In 1912 Vesto Slipher found that Andromeda\'s light is blueshifted. What did that reveal?',
      right: 'Andromeda is moving toward us',
      wrong: ['Andromeda is moving away from us', 'Andromeda is made of blue stars only', 'Andromeda is hotter than the Sun'],
      why: 'Light from an approaching source is squeezed to shorter, bluer wavelengths. Almost all other galaxies turned out to be redshifted: the first hint of cosmic expansion.',
    }],
  ],

  // ── Cosmic Frontier ──
  C01: [
    [{
      q: 'The Virgo Cluster is the nearest big cluster of galaxies. Roughly how far away is it?',
      right: 'About 54 million light-years',
      wrong: ['About 54 thousand light-years', 'About 5.4 billion light-years', 'About 540 light-years'],
      why: 'Its light left when the dinosaurs had already been gone for about 12 million years. Even so, it is the closest rich cluster to us.',
    }, {
      q: 'Roughly how many galaxies belong to the Virgo Cluster?',
      right: 'About 1,300–2,000',
      wrong: ['About 12', 'About 100,000', 'About 10 million'],
      why: 'From giant ellipticals to tiny dwarfs, well over a thousand galaxies swarm around M87 at the cluster\'s heart.',
    }],
    [{
      q: 'What holds the Virgo Cluster\'s galaxies together?',
      right: 'Gravity, mostly from unseen dark matter',
      wrong: ['Magnetic fields linking the galaxies', 'Pressure from the gas around them', 'Nothing, they just line up by chance'],
      why: 'Clusters are bound by gravity. Most of their mass is dark matter, then hot gas; the stars we see are only a small share.',
    }, {
      q: 'Why do many spiral galaxies falling into the Virgo Cluster stop making new stars?',
      right: 'Hot cluster gas strips away their cold gas',
      wrong: ['Their stars all collide head-on', 'Dark matter blocks their starlight', 'Cluster space is too cold for stars to form'],
      why: 'Racing through the cluster\'s thin, hot gas acts like a strong headwind, blowing out the cold gas that stars are made from.',
    }],
    [{
      q: 'Many Virgo Cluster galaxies sit in Charles Messier\'s 18th-century catalogue. What did he list them as?',
      right: 'Fuzzy nebulae not to be mistaken for comets',
      wrong: ['New planets beyond Saturn', 'Exploding stars', 'Distant galaxies like our own'],
      why: 'Messier was a comet hunter. Nobody knew these smudges were whole galaxies until the 1920s.',
    }, {
      q: 'In the 1950s Gérard de Vaucouleurs argued that the Virgo Cluster is the heart of something bigger. What?',
      right: 'A supercluster that includes the Milky Way',
      wrong: ['A single giant galaxy', 'A ring of dead stars', 'A cloud inside our own galaxy'],
      why: 'He called it the "Local Supergalaxy", now the Virgo or Local Supercluster. Our Local Group sits on its outskirts.',
    }],
  ],
  C02: [
    [{
      q: 'What kind of galaxy is M87?',
      right: 'A giant elliptical, a huge rounded swarm of stars',
      wrong: ['A barred spiral like the Milky Way', 'A small, irregular dwarf galaxy', 'A ring galaxy with a hole in the middle'],
      why: 'M87 has no spiral arms and little fresh star formation: trillions of mostly old stars in a vast, fuzzy ball.',
    }, {
      q: 'M87 is also known as "Virgo A". What earned it that name?',
      right: 'It is the brightest radio source in Virgo',
      wrong: ['It was the first galaxy ever named', 'It is the brightest star in Virgo', 'It is the closest galaxy to Earth'],
      why: 'Early radio astronomers labelled sources by constellation and brightness. M87\'s active black hole makes it blaze in radio waves.',
    }],
    [{
      q: 'Why do giant ellipticals like M87 have so many globular clusters?',
      right: 'They grew by swallowing many smaller galaxies',
      wrong: ['They are much younger than spiral galaxies', 'Their black hole builds them from gas', 'They pull them out of empty space'],
      why: 'Each galaxy it absorbed brought its own clusters. M87 has around 12,000; the Milky Way has only about 150–200.',
    }, {
      q: 'M87 fires a jet from near its central black hole. What is the jet made of?',
      right: 'Charged particles moving close to light speed',
      wrong: ['Stars thrown out of the galaxy', 'Water and ice crystals', 'Dark matter streaming outward'],
      why: 'Magnetic fields launch hot plasma near the black hole. Hubble saw blobs that seem to move faster than light, an illusion of their speed and angle.',
    }],
    [{
      q: 'In 1918 Heber Curtis spotted a "curious straight ray" coming out of M87. What was it?',
      right: 'The first jet ever seen from a galaxy',
      wrong: ['A comet passing in front', 'A brand-new spiral arm', 'The trail of a meteor'],
      why: 'The jet is about 5,000 light-years long. Decades passed before astronomers realised a black hole was powering it.',
    }, {
      q: 'M87 got its name from an 18th-century catalogue. Whose?',
      right: 'Charles Messier\'s',
      wrong: ['Edwin Hubble\'s', 'Galileo Galilei\'s', 'Isaac Newton\'s'],
      why: 'Messier logged it in 1781 as a nebula without stars. "M87" simply means object number 87 on his list.',
    }],
  ],
  C03: [
    [{
      q: 'M87* is the black hole at the heart of M87. Roughly how massive is it?',
      right: 'About 6.5 billion times the Sun\'s mass',
      wrong: ['About 6.5 times the Sun\'s mass', 'About 6,500 times the Sun\'s mass', 'About 4 million times the Sun\'s mass'],
      why: 'It is over 1,000 times heavier than Sagittarius A*, the 4-million-Sun black hole at the centre of our Milky Way.',
    }, {
      q: 'What does the famous orange image of M87* actually show?',
      right: 'Glowing gas ringing the black hole\'s shadow',
      wrong: ['The black hole\'s solid surface', 'Light escaping from inside the hole', 'A star being torn apart'],
      why: 'Nothing escapes from inside the event horizon. We see hot gas swirling around it, framing a dark shadow. The colours are added.',
    }],
    [{
      q: 'Why does the ring around M87* look brighter on one side?',
      right: 'Gas moving toward us is boosted brighter',
      wrong: ['A nearby star lights up that side', 'That side is closer to Earth', 'The telescope was pointed off-centre'],
      why: 'The gas orbits at a large fraction of light speed. Relativity beams light forward, so the side swinging toward us shines brighter.',
    }, {
      q: 'Why does the black hole\'s dark shadow look bigger than its event horizon?',
      right: 'Gravity bends light around it like a lens',
      wrong: ['The black hole is quickly expanding', 'Dust hides its outer edge', 'The picture was zoomed by mistake'],
      why: 'Light passing close by is bent, and some even loops around the hole. The shadow appears about 2.5 times wider than the horizon.',
    }],
    [{
      q: 'The Event Horizon Telescope released the first image of a black hole in which year?',
      right: '2019',
      wrong: ['1969', '1999', '2009'],
      why: 'The data were taken in April 2017; the image came out in April 2019. A picture of our own Sagittarius A* followed in 2022.',
    }, {
      q: 'How did the Event Horizon Telescope get sharp enough to see M87*?',
      right: 'It linked radio dishes around the world into one Earth-sized telescope',
      wrong: ['It flew a giant mirror toward M87', 'It used one enormous dish in Chile', 'It combined millions of phone cameras'],
      why: 'Dishes on several continents observed at 1.3 mm. The data were too big for the internet, so hard drives were flown to supercomputers.',
    }],
  ],
  C04: [
    [{
      q: 'Centaurus A is the nearest galaxy of its kind. What kind?',
      right: 'A radio galaxy with an active black hole',
      wrong: ['A galaxy with no stars at all', 'A galaxy made of antimatter', 'A newborn galaxy still forming'],
      why: 'At about 12 million light-years it is our closest radio galaxy, a front-row seat to a feeding supermassive black hole.',
    }, {
      q: 'Where in the sky do you look for Centaurus A?',
      right: 'In the southern constellation Centaurus',
      wrong: ['Next to the Big Dipper', 'Beside the North Star', 'In Orion\'s belt'],
      why: 'It is one of the brightest galaxies in the sky, visible in binoculars from southern skies as a fuzzy ball cut by a dark lane.',
    }],
    [{
      q: 'What powers Centaurus A\'s enormous jets?',
      right: 'Matter falling toward a supermassive black hole',
      wrong: ['Nuclear fusion in one giant star', 'Collisions of dark matter particles', 'Light from the Big Bang'],
      why: 'Its central black hole weighs tens of millions of Suns. Infalling gas heats up and some is blasted out in jets thousands of light-years long.',
    }, {
      q: 'Centaurus A has a thick, dark lane of dust across its middle. Where did it most likely come from?',
      right: 'It swallowed a dusty spiral galaxy',
      wrong: ['It is a ring of planets', 'It is the shadow of a nearby star', 'It is a tear in space'],
      why: 'Elliptical galaxies are usually dust-poor. The twisted lane, full of new stars, is the wreckage of a merger.',
    }],
    [{
      q: 'In 1949 Australian astronomers matched Centaurus A to a visible galaxy. What had they detected from it?',
      right: 'Strong radio waves',
      wrong: ['Gravitational waves', 'Neutrinos', 'Bright visible flashes'],
      why: 'It was one of the first cosmic radio sources tied to a galaxy beyond our own, opening the field of radio galaxies.',
    }, {
      q: 'Who discovered Centaurus A, in 1826?',
      right: 'James Dunlop',
      wrong: ['Charles Messier', 'Edwin Hubble', 'Galileo Galilei'],
      why: 'Dunlop found it from Parramatta, Australia. Messier, observing from Paris, never saw it: it sits too far south.',
    }],
  ],
  C05: [
    [{
      q: 'The Coma Cluster lies in the constellation Coma Berenices. What does that name mean?',
      right: 'Berenice\'s Hair',
      wrong: ['The Sleeping Queen', 'The Comet\'s Tail', 'The Crown of Stars'],
      why: 'Legend says Queen Berenice II of Egypt offered her hair to the gods, and it was placed among the stars.',
    }, {
      q: 'Roughly how far away is the Coma Cluster?',
      right: 'About 320 million light-years',
      wrong: ['About 3.2 million light-years', 'About 32 billion light-years', 'About 3,200 light-years'],
      why: 'About six times farther than the Virgo Cluster, yet it holds over a thousand galaxies, led by the giants NGC 4889 and NGC 4874.',
    }],
    [{
      q: 'Most of the normal matter in the Coma Cluster is not in stars. Where is it?',
      right: 'In hot gas between the galaxies',
      wrong: ['In cold planets drifting freely', 'In black holes at every galaxy\'s centre', 'In clouds of liquid hydrogen'],
      why: 'The gas is tens of millions of degrees hot and glows in X-rays. It outweighs all the cluster\'s stars put together.',
    }, {
      q: 'Light from galaxies behind the Coma Cluster arrives slightly distorted. What does that tell astronomers?',
      right: 'How much mass the cluster has, seen or unseen',
      wrong: ['That light slows down in space', 'That the cluster is spinning fast', 'That the background galaxies are tiny'],
      why: 'Mass bends light (gravitational lensing). Measuring the distortion weighs the whole cluster, dark matter included.',
    }],
    [{
      q: 'In 1933 Fritz Zwicky measured galaxy speeds in the Coma Cluster. What did he find?',
      right: 'Far more mass than its visible galaxies',
      wrong: ['The first black hole', 'The first planet around another star', 'A galaxy made of antimatter'],
      why: 'The galaxies moved too fast to be held by their visible mass alone. Zwicky called the hidden stuff "dunkle Materie": dark matter.',
    }, {
      q: 'Zwicky\'s dark matter was mostly ignored for decades. What convinced astronomers in the 1970s?',
      right: 'Stars in spiral galaxies orbit too fast',
      wrong: ['Photos of dark matter clouds', 'A dark matter particle caught in a lab', 'A probe flying through some'],
      why: 'Vera Rubin and Kent Ford found outer stars orbit as fast as inner ones, so galaxies need unseen mass. No dark matter particle has been detected yet.',
    }],
  ],
  C06: [
    [{
      q: 'Our home supercluster, Laniakea, takes its name from Hawaiian. What does it mean?',
      right: 'Immense heaven',
      wrong: ['Endless ocean', 'Home of the gods', 'Great wind'],
      why: 'The name honours Polynesian navigators, who used the stars to find their way across the Pacific.',
    }, {
      q: 'Roughly how many galaxies does Laniakea contain?',
      right: 'About 100,000',
      wrong: ['About 100', 'About 1,000', 'About 100 trillion'],
      why: 'Spread over about 520 million light-years, Laniakea includes the Milky Way, the Virgo Cluster and many other groups and clusters.',
    }],
    [{
      q: 'How did astronomers draw Laniakea\'s boundaries?',
      right: 'By mapping which way galaxies are flowing',
      wrong: ['By finding a wall of stars around it', 'By where galaxies change colour', 'By measuring a temperature edge'],
      why: 'Like rivers in a watershed, galaxies inside Laniakea drift toward the same basin. Beyond its border, the flows head elsewhere.',
    }, {
      q: 'Within Laniakea, the Milky Way and its neighbours are drifting toward a region called the…',
      right: 'Great Attractor',
      wrong: ['Big Rip', 'Dark Core', 'Final Wall'],
      why: 'A huge concentration of mass roughly 150–250 million light-years away, partly hidden behind the dust and stars of our own galaxy.',
    }],
    [{
      q: 'In which year did Brent Tully and colleagues define the Laniakea Supercluster?',
      right: '2014',
      wrong: ['1924', '1969', '1990'],
      why: 'They mapped the motions of about 8,000 galaxies, published in Nature. Our cosmic address got a new, bigger line.',
    }, {
      q: 'Before Laniakea, astronomers considered the Milky Way\'s supercluster to be which structure?',
      right: 'The Virgo Supercluster',
      wrong: ['The Andromeda Supercluster', 'The Orion Supercluster', 'The Coma Wall'],
      why: 'The Virgo Supercluster is now seen as just one lobe of the much larger Laniakea.',
    }],
  ],
  C07: [
    [{
      q: 'On the largest scales, how are galaxies arranged?',
      right: 'Along threads and sheets around huge empty regions',
      wrong: ['Spread perfectly evenly through space', 'In one giant spinning disc', 'In neat shells centred on us'],
      why: 'This "cosmic web" spans hundreds of millions of light-years. The strands drawn in this game are illustrative, not a real map.',
    }, {
      q: 'In the cosmic web, where do the biggest galaxy clusters sit?',
      right: 'Where several filaments meet',
      wrong: ['In the middle of empty voids', 'At the edge of the universe', 'Evenly spaced on a grid'],
      why: 'Matter flows along the filaments toward the junctions, so the knots grow into the richest clusters, like cities where highways cross.',
    }],
    [{
      q: 'What shaped the cosmic web?',
      right: 'Gravity growing tiny ripples from the early universe',
      wrong: ['Explosions of the first stars', 'Magnetic fields from galaxies', 'Collisions between galaxy clusters'],
      why: 'Slightly denser spots pulled in more matter over billions of years. Dark matter collapsed into sheets and threads; normal gas followed.',
    }, {
      q: 'Much of the normal matter between galaxies is very hard to see. Why?',
      right: 'It is thin, hot gas that glows only faintly',
      wrong: ['It is hidden behind black holes', 'It is frozen into dark ice', 'It moves faster than light'],
      why: 'Thin gas at hundreds of thousands to millions of degrees fills the filaments. It may hold a large share of all normal matter.',
    }],
    [{
      q: 'In 1989 Margaret Geller and John Huchra mapped a huge sheet of galaxies. What was it called?',
      right: 'The Great Wall',
      wrong: ['The Great Attractor', 'The Milky Way Bridge', 'The Hubble Deep Field'],
      why: 'Their redshift survey revealed a wall of galaxies about 500 million light-years long, far bigger than anyone expected.',
    }, {
      q: 'The Sloan Great Wall, found in 2003, is roughly how long?',
      right: 'Over a billion light-years',
      wrong: ['About 1,000 light-years', 'About a million light-years', 'About 100 billion light-years'],
      why: 'It showed up in the Sloan Digital Sky Survey, which measured the distances of hundreds of thousands of galaxies to map the web in 3D.',
    }],
  ],
  C08: [
    [{
      q: 'Roughly how wide is the Boötes Void, one of the largest known?',
      right: 'About 330 million light-years',
      wrong: ['About 330 light-years', 'About 3 million light-years', 'About 330 billion light-years'],
      why: 'Thousands of Milky Ways could fit across it, yet only a few dozen galaxies have been found inside.',
    }, {
      q: 'How much of the universe\'s volume do cosmic voids fill?',
      right: 'Most of it',
      wrong: ['Less than 1%', 'Exactly half', 'None, voids are an illusion'],
      why: 'Galaxies crowd into filaments and walls that take up only a small share of space. Most of the cosmos is nearly empty.',
    }],
    [{
      q: 'Are cosmic voids completely empty?',
      right: 'No, they hold a few galaxies and very thin gas',
      wrong: ['Yes, not even light can cross them', 'No, they are packed with black holes', 'Yes, they are holes in space itself'],
      why: 'Voids are underdense, not empty. Their few galaxies tend to be small, blue and still forming stars.',
    }, {
      q: 'Why do voids grow emptier over time?',
      right: 'Gravity pulls matter out toward the denser walls',
      wrong: ['Black holes inside eat everything', 'Dark energy destroys the galaxies inside', 'Galaxies inside fade and vanish'],
      why: 'The surrounding walls have more mass, so they win the tug-of-war. Matter drains outward and the voids expand.',
    }],
    [{
      q: 'How was the Boötes Void discovered in 1981?',
      right: 'By mapping galaxy distances from their redshifts',
      wrong: ['A space probe flew through it', 'A dark patch seen with the naked eye', 'Its gravity was measured on Earth'],
      why: 'Robert Kirshner and colleagues measured how far galaxies were. In 3D, a giant gap appeared where flat photos showed nothing odd.',
    }, {
      q: 'A famous 1986 map, "A Slice of the Universe", showed galaxies arranged like…',
      right: 'The surfaces of soap bubbles',
      wrong: ['Beads on one straight line', 'Squares on a perfect grid', 'Rings around the Milky Way'],
      why: 'Valérie de Lapparent, Margaret Geller and John Huchra found galaxies on thin shells wrapped around big empty regions.',
    }],
  ],
  C09: [
    [{
      q: 'When you look at a galaxy 10 million light-years away, you see it as it was…',
      right: 'About 10 million years ago',
      wrong: ['Right now', 'About 10 million years in the future', 'About 10 years ago'],
      why: 'A light-year is a distance, but it is also a clock: the light has been travelling 10 million years to reach us.',
    }, {
      q: 'Astronomers say big telescopes are "time machines". Why?',
      right: 'Distant light shows objects as they were long ago',
      wrong: ['They speed up light from far away', 'They can predict where stars will be', 'They slow down time inside the tube'],
      why: 'The farther away we look, the older the light. Deep images show young galaxies as they were billions of years ago.',
    }],
    [{
      q: 'What is cosmological redshift?',
      right: 'Light stretched to longer wavelengths as space expands',
      wrong: ['Light dimmed by red dust', 'Light from stars that are cooling', 'Light bent by the Sun\'s gravity'],
      why: 'As light crosses expanding space, its waves get stretched. The farther the source, the bigger the stretch, shifting colours toward red.',
    }, {
      q: 'Why does the James Webb Space Telescope hunt for the first galaxies in infrared?',
      right: 'Their light has been stretched into infrared',
      wrong: ['The first galaxies had only red stars', 'Infrared travels faster than visible light', 'Visible light cannot cross empty space'],
      why: 'Ultraviolet and visible light from the early universe has been stretched so much on its journey that it now arrives as infrared.',
    }],
    [{
      q: 'In 1929 Edwin Hubble found that more distant galaxies…',
      right: 'Are moving away from us faster',
      wrong: ['Are moving toward us faster', 'Are all at the same distance', 'Spin faster than nearby ones'],
      why: 'Building on Vesto Slipher\'s redshifts and Georges Lemaître\'s ideas, it was evidence that the universe is expanding.',
    }, {
      q: 'JWST has seen galaxies whose light left them when the universe was how old?',
      right: 'Less than 400 million years old',
      wrong: ['About 13 billion years old', 'About 5 billion years old', 'About 10,000 years old'],
      why: 'That light has travelled over 13 billion years. These galaxies are brighter and more numerous than many models predicted.',
    }],
  ],
  C10: [
    [{
      q: 'According to the best measurements, how old is the universe?',
      right: 'About 13.8 billion years',
      wrong: ['About 4.6 billion years', 'About 1.38 billion years', 'About 100 billion years'],
      why: '4.6 billion years is the age of Earth and the Sun. The universe had been around for over 9 billion years before they formed.',
    }, {
      q: 'Is the edge of the observable universe the edge of the universe itself?',
      right: 'No, it is just how far light has had time to reach us',
      wrong: ['Yes, space simply ends there', 'Yes, it is a wall of black holes', 'No, it is the edge of our galaxy'],
      why: 'Every observer has their own horizon, centred on them. The whole universe is much bigger and may well be infinite.',
    }],
    [{
      q: 'The universe is 13.8 billion years old, but the observable universe reaches ~46 billion light-years away. Why?',
      right: 'Space kept expanding while the light travelled',
      wrong: ['Light was faster in the early universe', 'Our telescopes magnify distances', 'Our galaxy is rushing toward the edge'],
      why: 'The sources of the oldest light have been carried much farther away since it left them. Today they sit about 46 billion light-years away.',
    }, {
      q: 'Why can\'t we see light from before the universe was about 380,000 years old?',
      right: 'Space was filled with a glowing fog of hot plasma',
      wrong: ['Black holes swallowed all earlier light', 'Light did not exist yet', 'Our telescopes are not big enough yet'],
      why: 'Light kept bouncing off free electrons. Once atoms formed, it flew free. We see that moment as the cosmic microwave background.',
    }],
    [{
      q: 'The cosmic microwave background was found by accident in 1965. By whom?',
      right: 'Arno Penzias and Robert Wilson',
      wrong: ['Edwin Hubble and Milton Humason', 'Stephen Hawking and Roger Penrose', 'Carl Sagan and Frank Drake'],
      why: 'A faint hiss in their radio antenna would not go away, even after they cleaned out pigeon droppings. It earned them a Nobel Prize.',
    }, {
      q: 'Which space missions mapped the cosmic microwave background in finer and finer detail?',
      right: 'COBE, WMAP and Planck',
      wrong: ['Voyager, Cassini and Juno', 'Kepler, TESS and Gaia', 'Apollo, Gemini and Mercury'],
      why: 'Their maps of tiny hot and cold spots, the seeds of the cosmic web, pinned down the universe\'s age and contents.',
    }],
  ],
};

export function variantsFor(nodeId: string, gate: number): Variant[] {
  return BANK[nodeId]?.[gate] ?? [];
}
