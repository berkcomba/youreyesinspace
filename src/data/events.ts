import { cues, type TourCue, type TourDef, type TourStep } from './tours';

/**
 * Sky & space events ("Events" tab): each one is a single-scene mini tour played by the same
 * TourPlayer as the guided tours, with the simulation clock set to the event. Narration is
 * written in Turkish and translated like every other display string.
 *
 * Dates and figures were checked on 2026-10-22. Spacecraft geometry comes from NASA/JPL Horizons
 * (see public/ephem and scripts/fetch-horizons.mjs); mission dates are the agencies' published
 * plans and may move — `status` and `source` say how firm each one is, and
 * public/events/overrides.json can patch `time`/`status` without a rebuild.
 */

export type EventKind =
  | 'orbit-insertion' | 'flyby' | 'conjunction' | 'opposition' | 'elongation'
  | 'meteor-shower' | 'moon' | 'milestone' | 'eclipse' | 'solstice';

export type EventStatus = 'scheduled' | 'confirmed' | 'happened';

export interface SkyEvent {
  id: string;
  kind: EventKind;
  title: string;
  summary: string;
  /** instant of the event, ISO 8601 UTC */
  time: string;
  /** visibility / activity window, ISO 8601 UTC */
  window?: [string, string];
  status: EventStatus;
  source: { name: string; url: string };
  /** bodies of the simulation involved (first = main subject) */
  bodies: string[];
  /** the scene (one or more tour steps) */
  scene: TourStep[];
  /** simulation clock when the scene starts (default: `time`) */
  sceneStart?: string;
  /** one line under the chapter title as the scene opens: what the visitor is about to see */
  kicker: string;
  /**
   * the figures that make the event graspable at a glance — shown in the scene's facts strip and,
   * the first three, on the panel card: [label, value]
   */
  facts: Array<[string, string]>;
  /** 'sky' = seen from Earth, 'space' = from space */
  view?: 'space' | 'sky';
  /** epoch of the trajectory data shown, when the scene uses Horizons tables */
  epoch?: string;
  tags?: string[];
}

const { body, card, uncard, overview, vantage, pulse, rate, shot, dolly, drift, fov, meteors } = cues;
const readout = (at: number, kind: 'distance' | 'altitude' | 'separation' | 'light', a: string, b: string, o: { label: string; from?: string; text?: string; until?: number }): TourCue =>
  ({ at, action: 'readout', kind, a, b, ...o });
const lookFrom = (at: number, ref: string, toward: string[], fov?: number, alt?: number): TourCue => ({ at, action: 'lookFrom', ref, toward, fov, alt });
const orbits = (at: number, on: boolean, moons?: boolean): TourCue => ({ at, action: 'orbits', on, moons });
const fill = (at: number, on: boolean): TourCue => ({ at, action: 'fill', on });
const time = (at: number, iso: string): TourCue => ({ at, action: 'time', iso });

/*
 * Scene grammar. Every event is cut like a short film rather than parked on one view:
 *  - an opening shot that already moves (slow push-in `dolly`, a wider `drift` than the tours'),
 *  - one or two cuts on the sentences that need them (`vantage`/`shot`/`overview` with `seconds`
 *    stretched so the flight itself is the transition),
 *  - a "hero" moment for spacecraft: the over-the-shoulder `shot` with the clock slowed so the
 *    world rolls past, timed with a `time` jump onto the closest approach,
 *  - and a wide closing frame while the data note is read.
 */
const PUSH = -0.012;  // gentle push-in, ln(distance)/s (×0.5 in ~60 s)
const PULL = 0.014;   // gentle pull-out
const SWEEP = 0.02;   // visible auto-orbit (rad/s) — the tours' default is 0.05

const ESA = (url: string) => ({ name: 'ESA', url });
const NASA = (url: string) => ({ name: 'NASA', url });
const JPL = (url: string) => ({ name: 'NASA/JPL', url });
const IMO = { name: 'IMO', url: 'https://www.imo.net/resources/calendar/' };
const USNO = { name: 'USNO', url: 'https://aa.usno.navy.mil/data/' };
const HORIZONS = 'NASA/JPL Horizons, 2026-10-22';

/** A shower's radiant (ICRF, degrees) and entry speed (km/s) — IMO working list */
interface Radiant { ra: number; dec: number; speed: number }
const RADIANT = {
  orionids: { ra: 95, dec: 16, speed: 66 },
  staurids: { ra: 52, dec: 13, speed: 27 },
  ntaurids: { ra: 58, dec: 22, speed: 29 },
  leonids: { ra: 152, dec: 22, speed: 71 },
  geminids: { ra: 112, dec: 33, speed: 35 },
  ursids: { ra: 217, dec: 76, speed: 33 },
} satisfies Record<string, Radiant>;

/**
 * Meteor shower scene, in four beats on the narration:
 *  0  cold open — Earth's night side from a few radii out, the first streaks already burning in
 *     (the camera is placed side-on to the stream so the trails are long, over a dark globe);
 *  1  the parent body and its whole orbit, i.e. the dust stream, with the live Sun distance;
 *  2  Earth's orbit cutting across it, the clock running hours a second;
 *  3  back at Earth for the finale: the full shower, denser, with fireballs, while the rest of the
 *     text is read. `rate` = [opening, finale] streaks per real second; `fireballs` their share.
 */
function showerScene(id: string, parent: string, radiant: Radiant, { text, extra = [], rate: density = [6, 14], fireballs = 0.06 }: { text: string; extra?: TourCue[]; rate?: [number, number]; fireballs?: number }): TourStep[] {
  const shower = (at: number, rate: number, seconds: number): TourCue => meteors(at, { ref: 'earth', ...radiant, rate, fireballs, approach: true, seconds });
  return [{
    id, target: body('earth'), text, timeRate: 60, dwell: 7, orbitRate: 0.006, dollyRate: 0,
    cues: [
      fill(0, false), orbits(0, false), shower(0, density[0], 3.5),
      orbits(1, true), drift(1, SWEEP), overview(1, parent, 9), rate(1, 86400 * 2), readout(1, 'distance', parent, 'sun', { label: 'Güneş\'e uzaklığı' }),
      overview(2, 'earth', 9), rate(2, 3600 * 6), dolly(2, PUSH),
      uncard(3), rate(3, 60), orbits(3, false), fill(3, false), dolly(3, PUSH * 0.4), drift(3, 0.006), shower(3, density[1], 8),
      ...extra,
    ],
  }];
}

export const EVENTS: SkyEvent[] = [
  /* ------------------------------------------------------------------ October 2026 */
  {
    id: 'orionids-2026', kind: 'meteor-shower', status: 'happened', source: IMO,
    title: 'Orionid meteor yağmuru zirvesi',
    summary: 'Halley Kuyruklu Yıldızı\'nın tozundan doğan Orionidler, saatte yirmi kadar hızlı meteorla zirve yapıyor.',
    kicker: 'Halley\'nin tozu Dünya\'nın yoluna çıkıyor',
    facts: [['Kaynak', '1P/Halley'], ['Hız', '66 km/s'], ['Zirvede', '~20 meteor/sa'], ['Radyan', 'Avcı (Orion)'], ['Etkin dönem', '2 Eki – 7 Kas']],
    time: '2026-10-21T06:00:00Z', window: ['2026-10-02T00:00:00Z', '2026-11-07T00:00:00Z'],
    bodies: ['halley', 'earth'], view: 'space', tags: ['meteor', 'halley'],
    scene: showerScene('orionids', 'halley', RADIANT.orionids, {
      // 0 origin (cold open on the shower) · 1 Halley now · 2 Earth crossing · 3 rates (finale) · 4 Eta Aquariids
      rate: [6, 16], fireballs: 0.05,
      text: 'Orionidler, Halley Kuyruklu Yıldızı\'nın geçmiş dönüşlerinde bıraktığı tozdan doğar; Dünya bu şeridi her Ekim ayında keser. Halley\'nin kendisi şu anda Neptün yörüngesinin ötesinde, 2061\'deki dönüşüne doğru yavaşça yol alıyor. Dünya\'nın yörüngesine yaklaşalım: toz parçacıkları atmosfere saniyede altmış altı kilometre hızla çarpar ve uzun, parlak izler bırakır. Zirvede saatte yirmi kadar meteor görülür; radyan, Avcı takımyıldızının kaldırdığı sopanın yakınındadır. Aynı toz şeridinin öbür yarısını Mayıs ayında Eta Akuarid yağmuru olarak izleriz.',
      extra: [card(3, { big: '66 km/s', title: 'Atmosfere giriş hızı', text: 'Toz şeridi, kuyruklu yıldızın yörüngesi boyunca uzanır; burada yörünge çizgisiyle temsil edilir.' })],
    }),
  },

  /* ------------------------------------------------------------------ November 2026 */
  {
    id: 'hera-didymos-2026', kind: 'flyby', status: 'scheduled', source: ESA('https://www.esa.int/Space_Safety/Hera'),
    title: 'Hera, Didymos\'a yaklaşıyor',
    summary: 'ESA\'nın gezegen savunması sondası Hera, DART\'ın çarptığı ikili asteroit Didymos–Dimorphos\'a varıyor; ilk yakın görüntüler Kasım sonunda bekleniyor.',
    kicker: 'Beş günde yüz kilometreden otuza',
    facts: [['Sonda', 'Hera (ESA)'], ['Hedef', 'Didymos–Dimorphos'], ['Mesafe', '100 → 30 km'], ['Görev', 'Gezegen savunması'], ['Varış', '4 Kas 2026']],
    time: '2026-11-04T00:00:00Z', window: ['2026-11-01T00:00:00Z', '2026-12-31T00:00:00Z'],
    // the last five days of the approach (Horizons: ~100 km out on 29 Oct, ~30 km on 4 Nov)
    sceneStart: '2026-10-29T12:00:00Z',
    bodies: ['hera', 'didymos', 'dimorphos'], view: 'space', epoch: HORIZONS, tags: ['esa', 'asteroid', 'planetary-defence'],
    scene: [{
      id: 'hera', target: body('didymos'), timeRate: 5400, dwell: 5, orbitRate: SWEEP, dollyRate: 0,
      // 0 arrival (the binary itself, Dimorphos circling) · 1 DART · 2 approach (over Hera's
      // shoulder, Didymos ahead, live distance) · 3 cubesats · 4 data note (the rock with Hera's
      // planned path converging on it in the background)
      text: 'ESA\'nın Hera sondası, iki yıllık yolculuğun ardından Didymos ikili asteroitine varıyor. Hedefi, NASA\'nın DART aracının 2022\'de bilerek çarptığı küçük uydu Dimorphos: çarpma, uydunun yörünge periyodunu otuz üç dakika kısaltmıştı. Hera şu anda ikiliye yavaşça yaklaşıyor ve önümüzdeki haftalarda onlarca kilometre mesafeden yörüngeye yerleşecek. Yanında taşıdığı Milani ve Juventas küp uyduları, Dimorphos\'un kütlesini ve iç yapısını ölçecek; ilk yakın görüntüler Kasım sonunda bekleniyor. İzlediğiniz yaklaşma yolu, ESA\'nın JPL Horizons\'a verdiği planlanmış yörüngedir ve 4 Kasım\'a kadar yayımlanmıştır; sonrası henüz ilan edilmedi.',
      cues: [
        orbits(0, true), orbits(0, true, true), fill(0, false), vantage(0, 25, 75, 7, 'didymos', 6),
        fov(2, 28, 3), fill(2, true), shot(2, 'hera', 'didymos', 5, { az: 7, elev: 4, seconds: 6 }), drift(2, 0.006), dolly(2, PUSH),
        readout(2, 'distance', 'hera', 'didymos', { label: 'Hera–Didymos uzaklığı' }),
        card(3, { big: '2', title: 'Küp uydu', text: 'Milani (spektrometre) ve Juventas (radar) — bir asteroitin içini ilk kez görüntüleyecek.' }),
        fov(4, 50, 4), fill(4, false), shot(4, 'didymos', 'hera', 30, { az: 8, elev: 6, seconds: 8 }), drift(4, 0.006), dolly(4, 0),
      ],
    }],
  },
  {
    id: 'southern-taurids-2026', kind: 'meteor-shower', status: 'scheduled', source: IMO,
    title: 'Güney Taurid meteor yağmuru zirvesi',
    summary: 'Encke Kuyruklu Yıldızı\'nın geniş toz akımından gelen yavaş, parlak "ateş topları" ile ünlü yağmur zirveye ulaşıyor.',
    kicker: 'Yavaş ama parlak: Encke\'nin ateş topları',
    facts: [['Kaynak', '2P/Encke'], ['Hız', '27 km/s'], ['Zirvede', '~5 meteor/sa'], ['Radyan', 'Boğa (Taurus)'], ['Etkin dönem', '10 Eyl – 20 Kas']],
    time: '2026-11-05T00:00:00Z', window: ['2026-09-10T00:00:00Z', '2026-11-20T00:00:00Z'],
    bodies: ['encke', 'earth'], view: 'space', tags: ['meteor'],
    scene: showerScene('staurids', 'encke', RADIANT.staurids, {
      // 0 origin · 1 Encke now · 2 Earth in the stream · 3 fireballs (finale) · 4 radiant / Moon
      // sparse and slow, but one in three a fireball
      rate: [2.5, 5], fireballs: 0.35,
      text: 'Güney Tauridler, bilinen en kısa periyotlu kuyruklu yıldız olan Encke\'nin yüzyıllar içinde saçtığı geniş bir toz akımından gelir. Encke, Güneş\'i yalnızca üç virgül üç yılda bir dolaşır; şu anda yörüngesinin dış yarısında. Dünya bu geniş akımın içinden haftalarca geçer; parçacıklar atmosfere saniyede yirmi sekiz kilometre gibi görece yavaş girer. Bu yüzden Tauridler az sayıda ama uzun süren, çoğu zaman ateş topu kadar parlak meteorlar üretir. Radyan Boğa takımyıldızındadır; bu yıl Ay\'ın geç doğması gece yarısına kadar karanlık bir gökyüzü sağlar.',
    }),
  },
  {
    id: 'northern-taurids-2026', kind: 'meteor-shower', status: 'scheduled', source: IMO,
    title: 'Kuzey Taurid meteor yağmuru zirvesi',
    summary: 'Taurid kompleksinin kuzey kolu zirvede; Güney Tauridlerle birlikte Kasım başında ateş topu sayısı artıyor.',
    kicker: 'Taurid kompleksinin ikinci kolu zirvede',
    facts: [['Kaynak', '2P/Encke'], ['Hız', '29 km/s'], ['Zirvede', '~5 meteor/sa'], ['Radyan', 'Boğa (Taurus)'], ['Etkin dönem', '20 Eki – 10 Ara']],
    time: '2026-11-12T00:00:00Z', window: ['2026-10-20T00:00:00Z', '2026-12-10T00:00:00Z'],
    bodies: ['encke', 'earth'], view: 'space', tags: ['meteor'],
    scene: showerScene('ntaurids', 'encke', RADIANT.ntaurids, {
      // 0 origin · 1 Encke's orbit · 2 Earth crosses the branch · 3 five an hour (finale) · 4 radiant
      rate: [2.5, 5], fireballs: 0.3,
      text: 'Kuzey Tauridler, aynı Encke akımının gezegen çekimleriyle ikiye bölünmüş kuzey koludur. Encke\'nin yörüngesi Merkür\'ün içinden Asteroit Kuşağı\'na kadar uzanır ve her dönüşte akıma yeni toz ekler. Dünya bu kolu Kasım ortasında keser; iki kolun çakıştığı haftalarda ateş topu sayısı belirgin biçimde artar. Saatte beş kadar meteorla sakin bir yağmurdur, ama yavaş ve parlak izleri fotoğrafçıların gözdesidir. Radyan, Ülker yıldız kümesinin hemen güneyinde yer alır.',
    }),
  },
  {
    id: 'mars-jupiter-conjunction-2026', kind: 'conjunction', status: 'confirmed', source: USNO,
    title: 'Mars–Jüpiter kavuşumu',
    summary: 'Şafaktan önce doğu ufkunda Mars ile Jüpiter gökyüzünde yalnızca 1,2 derece ayrıklıkla yan yana.',
    kicker: 'Şafaktan önce iki gezegen, bir parmak genişliğinde',
    facts: [['Ayrıklık', '1,2°'], ['Ölçek', '~2 dolunay genişliği'], ['Gökyüzü', 'Doğu, şafak öncesi'], ['Çıplak gözle', 'Evet'], ['Parlak olan', 'Jüpiter']],
    time: '2026-11-16T02:03:00Z', window: ['2026-11-14T00:00:00Z', '2026-11-18T00:00:00Z'],
    bodies: ['mars', 'jupiter', 'earth'], view: 'sky', tags: ['naked-eye', 'conjunction'],
    scene: [{
      id: 'marsjup', target: body('earth'), timeRate: 1, dwell: 5, orbitRate: 0.01, dollyRate: PUSH,
      // 0 sky view (wide, then a slow zoom onto the pair) · 1 separation · 2 true distances ·
      // 3 top-down (long flight above the orbits, planets moving) · 4 perspective
      text: '16 Kasım sabahı, gün doğmadan önce doğu ufkunda Mars ile Jüpiter yan yana parlıyor. İki gezegen gökyüzünde yalnızca bir virgül iki derece, yani dolunayın iki buçuk katı kadar birbirine yaklaşıyor. Elbette gerçekte yan yana değiller: Mars bizden yaklaşık üç yüz milyon, Jüpiter ise dokuz yüz milyon kilometre uzakta. Yukarıdan bakınca ne olduğu anlaşılıyor: Dünya, Mars ve Jüpiter Güneş çevresindeki yörüngelerinde aynı doğrultuya diziliyor. Kavuşum yalnızca bir perspektif oyunudur, ama çıplak gözle izlemesi en kolay gök olaylarından biridir.',
      cues: [
        lookFrom(0, 'earth', ['mars', 'jupiter'], 28), fov(0, 6, 14),
        readout(1, 'separation', 'mars', 'jupiter', { label: 'Açısal ayrıklık', text: 'Dünya\'dan görünen' }),
        readout(2, 'distance', 'jupiter', 'earth', { label: 'Dünya–Jüpiter uzaklığı', text: 'Mars ise ~300 milyon km' }),
        overview(3, 'jupiter', 10), rate(3, 86400 * 2),
      ],
    }],
  },
  {
    id: 'leonids-2026', kind: 'meteor-shower', status: 'scheduled', source: IMO,
    title: 'Leonid meteor yağmuru zirvesi',
    summary: 'Tempel-Tuttle Kuyruklu Yıldızı\'nın tozu: en hızlı meteorlar ve tarihin büyük meteor fırtınalarının kaynağı.',
    kicker: 'En hızlı meteorlar: saniyede yetmiş bir kilometre',
    facts: [['Kaynak', '55P/Tempel-Tuttle'], ['Hız', '71 km/s'], ['Zirvede', '~15 meteor/sa'], ['Radyan', 'Aslan (Leo)'], ['Son fırtına', '2002']],
    time: '2026-11-17T12:00:00Z', window: ['2026-11-06T00:00:00Z', '2026-11-30T00:00:00Z'],
    bodies: ['tempeltuttle', 'earth'], view: 'space', tags: ['meteor'],
    scene: showerScene('leonids', 'tempeltuttle', RADIANT.leonids, {
      // 0 origin · 1 the comet now · 2 head-on crossing · 3 ordinary year vs the storms (finale,
      // cut like 1833: the sky "rains") · 4 radiant / Moon
      rate: [8, 45], fireballs: 0.04,
      text: 'Leonidler, otuz üç yılda bir dönen Tempel-Tuttle Kuyruklu Yıldızı\'nın bıraktığı tozdan gelir. Kuyruklu yıldız şu anda yörüngesinin uzak ucuna yakın; bir sonraki perihelyonu 2031\'de. Dünya, Kasım ortasında onun yörüngesini neredeyse kafa kafaya keser: parçacıklar atmosfere saniyede yetmiş bir kilometreyle, bilinen en yüksek hızla girer. Sıradan bir yılda saatte on beş meteor görülür; ama 1833 ve 1966\'da gökyüzü saatte yüz binlerce meteorla "yağmış", 1999–2002 arasında da fırtınalar yaşanmıştı. Radyan Aslan takımyıldızının başındadır; bu yıl Ay yeni aya yakın olduğundan koşullar elverişli.',
      extra: [card(3, { big: '71 km/s', title: 'En hızlı meteorlar', text: 'Dünya akımla kafa kafaya karşılaştığı için giriş hızı en yüksek düzeydedir.' })],
    }),
  },
  {
    id: 'voyager1-light-day-2026', kind: 'milestone', status: 'confirmed', source: JPL('https://science.nasa.gov/mission/voyager/'),
    title: 'Voyager 1 Dünya\'dan bir ışık günü uzakta',
    summary: 'İnsan yapımı en uzak nesnenin sinyali artık Dünya\'ya tam 24 saatte ulaşıyor: 25,9 milyar kilometre.',
    kicker: 'Sinyal artık tam bir gün yolda',
    facts: [['Uzaklık', '25,9 milyar km'], ['Işık süresi', '24 saat'], ['Fırlatma', '5 Eylül 1977'], ['Hız', '~17 km/s'], ['Güneş\'e göre', '~173 AB']],
    time: '2026-11-18T10:17:00Z',
    bodies: ['voyager1', 'earth', 'sun'], view: 'space', epoch: HORIZONS, tags: ['nasa', 'voyager', 'milestone'],
    scene: [{
      id: 'v1lightday', target: body('voyager1'), timeRate: 1, dwell: 6, orbitRate: 0.03, dollyRate: PULL,
      // 0 threshold (the probe itself, the Sun a bright star behind it) · 1 pulse leaving it
      // toward Earth · 2 distance · 3 scale (twelve-second pull-out above the whole system) · 4 record
      text: 'Voyager 1, 1977\'den beri yol alıyor ve bugün yeni bir eşiği geçiyor: Dünya\'dan tam bir ışık günü uzaklığa ulaştı. Şu anda ondan gönderilen bir radyo sinyali, ışık hızında yol almasına rağmen bize ancak yirmi dört saat sonra ulaşıyor. Mesafe yirmi beş virgül dokuz milyar kilometre; Güneş\'e uzaklığı ise Dünya\'nınkinin yüz yetmiş üç katı. Geri çekilip bakalım: Neptün\'ün yörüngesi bile bu ölçekte küçük bir halka olarak kalıyor. Bu, insan yapımı bir nesnenin bugüne dek ulaştığı en uzak noktadır ve her saniye on yedi kilometre daha artıyor.',
      cues: [
        // sunward side of the probe: the dish lit, interstellar space and the Milky Way behind it
        fov(0, 46), shot(0, 'voyager1', 'sun', 5, { az: 145, elev: 18, seconds: 5 }),
        readout(0, 'light', 'earth', 'voyager1', { label: 'Tek yön sinyal süresi', text: 'Voyager 1 → Dünya' }),
        pulse(1, 'voyager1', 'earth', 9),
        readout(2, 'distance', 'earth', 'voyager1', { label: 'Dünya–Voyager 1 uzaklığı' }),
        orbits(3, true), fov(3, 50, 6), vantage(3, 65, 0, 95_000, 'sun', 12), rate(3, 86400 * 10), drift(3, 0.01), dolly(3, PUSH),
      ],
    }],
  },
  {
    id: 'mercury-west-elongation-2026', kind: 'elongation', status: 'confirmed', source: USNO,
    title: 'Merkür en büyük batı uzanımında',
    summary: 'Merkür Güneş\'ten 19,5 derece batıda: sabah alacakaranlığında en iyi görünürlüğü.',
    kicker: 'Sabah alacakaranlığında kısa bir pencere',
    facts: [['Uzanım', '19,5° batı'], ['Ne zaman', 'Gün doğumundan önce'], ['Yön', 'Doğu-güneydoğu ufku'], ['Pencere', '~2 hafta'], ['Güneş\'e uzaklığı', '~0,4 AB']],
    time: '2026-11-20T12:00:00Z', window: ['2026-11-13T00:00:00Z', '2026-11-28T00:00:00Z'],
    bodies: ['mercury', 'sun', 'earth'], view: 'sky', tags: ['naked-eye'],
    scene: [{
      id: 'mercelong', target: body('earth'), timeRate: 1, dwell: 5, orbitRate: 0.01, dollyRate: PUSH,
      // 0 sky (slow zoom from a wide dawn frame onto Sun + Mercury) · 1 angle · 2 why · 3 top-down
      // (long flight above the inner system, Mercury racing round at two days a second) · 4 cycle
      text: 'Merkür Güneş\'e o kadar yakın dolaşır ki onu ancak alacakaranlıkta, ufka yakın görebiliriz. Bu sabah Güneş\'ten on dokuz buçuk derece batıda, yani en büyük açısal uzaklığında: gün doğumundan önce doğu ufkunda belirir. Uzanım, iç gezegenin yörüngesine Dünya\'dan teğet baktığımız andır. Yukarıdan bakınca geometri açık: Güneş–Merkür doğrusu, Dünya\'dan gelen bakış çizgisine dik düşer. Merkür bu döngüyü yaklaşık her yüz on altı günde yineler; bir sonraki akşam uzanımı Ocak\'ta.',
      cues: [
        lookFrom(0, 'earth', ['mercury', 'sun'], 70), fov(0, 38, 12),
        readout(1, 'separation', 'mercury', 'sun', { label: 'Güneş\'ten açısal uzaklık' }),
        orbits(3, true), vantage(3, 88, 0, 330, 'sun', 10), rate(3, 86400 * 2),
      ],
    }],
  },
  {
    id: 'bepicolombo-moi-2026', kind: 'orbit-insertion', status: 'scheduled', source: ESA('https://www.esa.int/Science_Exploration/Space_Science/BepiColombo'),
    title: 'BepiColombo Merkür yörüngesine giriyor',
    summary: 'Yedi yıllık yolculuğun sonunda ESA/JAXA aracı Merkür\'ün çekimine yakalanıyor; ilk yakın geçiş 21 Kasım akşamı.',
    kicker: 'Yedi yılın sonunda Merkür\'ün çekimine teslim',
    facts: [['Araç', 'BepiColombo'], ['Ortaklık', 'ESA · JAXA'], ['Fırlatma', 'Ekim 2018'], ['Yakın geçişler', '9 (Dünya, Venüs, Merkür)'], ['Yörüngeye giriş', '21 Kas 2026']],
    time: '2026-11-21T18:50:00Z', window: ['2026-11-05T00:00:00Z', '2026-12-16T00:00:00Z'],
    sceneStart: '2026-11-21T08:00:00Z',
    bodies: ['bepicolombo', 'mercury'], view: 'space', epoch: HORIZONS, tags: ['esa', 'jaxa', 'mercury'],
    scene: [{
      id: 'bepimoi', target: body('mercury'), timeRate: 1800, dwell: 8, orbitRate: 0.008, dollyRate: PUSH,
      // 0 arrival (wide, the approach arc) · 1 weak capture · 2 first periapsis (clock onto
      // 18:20, over the spacecraft's shoulder as Mercury rolls past) · 3 what next · 4 data note
      text: 'BepiColombo, yedi yıl ve dokuz gezegen geçişinin ardından Merkür\'e vardı. Yakalanma tek bir büyük motor ateşlemesiyle değil, haftalarca süren yavaş bir yaklaşmayla gerçekleşiyor: araç, Merkür\'ün zayıf çekim alanına adeta süzülerek giriyor. Bu akşam ilk kez yüzeyin yalnızca birkaç yüz kilometre üstünden geçiyor; artık Merkür\'ün bir uydusu. Önümüzdeki haftalarda yörünge her geçişte biraz daha daralacak; Aralık\'ta Avrupa\'nın MPO\'su ile Japonya\'nın Mio\'su ayrılıp kendi bilim yörüngelerine yerleşecek. İzlediğiniz yol, ESA\'nın JPL Horizons\'a verdiği planlanan yörüngedir; canlı telemetri değildir.',
      cues: [
        orbits(0, true), vantage(0, 24, 40, 40, 'mercury', 8),
        readout(1, 'altitude', 'bepicolombo', 'mercury', { label: 'Merkür yüzeyinden yükseklik' }),
        // periapsis itself (18:50, 635 km) is over the night side: ride in from the terminator crossing
        time(2, '2026-11-21T18:04:00Z'), rate(2, 100), orbits(2, false), shot(2, 'bepicolombo', 'mercury', 5, { az: 24, elev: 14, seconds: 4 }), dolly(2, 0),
        rate(3, 1800), orbits(3, true), vantage(3, 32, 70, 14, 'mercury', 6), drift(3, SWEEP), dolly(3, PULL),
        card(3, { big: '2', title: 'Yörünge aracı', text: 'MPO (ESA): 480 × 1.500 km kutup yörüngesi · Mio (JAXA): 590 × 11.640 km.' }),
      ],
    }],
  },
  {
    id: 'beaver-supermoon-2026', kind: 'moon', status: 'confirmed', source: USNO,
    title: 'Kunduz Ayı: yılın en büyük dolunayı',
    summary: 'Ay, perijeden saatler sonra dolunay evresine giriyor: 2026\'nın en büyük ve en parlak "süper ay"ı.',
    kicker: 'Perijeden saatler sonra dolunay',
    facts: [['Dolunay', '24 Kas 14:53 UTC'], ['Uzaklık', '~357 bin km'], ['Görünür boyut', '%7 daha büyük'], ['Parlaklık', '%15 daha parlak'], ['Sıra', 'Yılın en büyüğü']],
    time: '2026-11-24T14:53:00Z',
    bodies: ['moon', 'earth', 'sun'], view: 'space', tags: ['naked-eye', 'moon'],
    scene: [{
      id: 'supermoon', target: body('moon'), timeRate: 3600 * 3, dwell: 5, orbitRate: SWEEP, dollyRate: PULL,
      // 0 intro (the full lit disc, slowly pulling away) · 1 ellipse (long climb above the whole
      // orbit) · 2 14 % · 3 name · 4 from Earth (sky view zooming onto the Moon)
      text: '24 Kasım\'daki dolunay yılın en büyüğü: Ay, yörüngesinin Dünya\'ya en yakın noktasına birkaç saat arayla tam dolunay evresine giriyor. Ay\'ın yörüngesi daire değil elips; uzaklığı üç yüz elli altı bin ile dört yüz altı bin kilometre arasında değişir. Perijeye yakın bir dolunay, apojedekinden yüzde on dört daha büyük ve yüzde otuz daha parlak görünür. Kasım dolunayına Kuzey Amerika geleneğinde Kunduz Ayı denir: kunduzların kış için barınaklarını kurduğu dönem. Şimdi Dünya\'dan bakalım: Güneş tam arkamızda, önümüzde ise tam aydınlanmış Ay.',
      cues: [
        vantage(0, 8, 0, 3.2, 'moon', 6),
        overview(1, 'moon', 9), dolly(1, 0), readout(1, 'distance', 'moon', 'earth', { label: 'Dünya–Ay uzaklığı' }),
        card(2, { big: '%14', title: 'Perije ile apoje arasındaki boyut farkı', text: 'Parlaklık farkı yaklaşık %30.' }),
        // back onto the instant of full moon (the clock has run days ahead by now)
        time(4, '2026-11-24T14:53:00Z'), rate(4, 1), orbits(4, false), lookFrom(4, 'earth', ['moon'], 7), fov(4, 2.6, 9),
      ],
    }],
  },
  {
    id: 'uranus-opposition-2026', kind: 'opposition', status: 'confirmed', source: USNO,
    title: 'Uranüs karşı konumda',
    summary: 'Güneş, Dünya ve Uranüs bir doğru üzerinde: gezegen yılın en yakın ve en parlak hâlinde, bütün gece gökyüzünde.',
    kicker: 'Güneş, Dünya ve Uranüs bir doğru üzerinde',
    facts: [['Uzaklık', '~18,5 AB'], ['Parlaklık', '5,6 kadir'], ['Takımyıldız', 'Boğa'], ['Görünürlük', 'Bütün gece'], ['Çıplak gözle', 'Zorlukla, karanlık gökte']],
    time: '2026-11-25T12:00:00Z', window: ['2026-11-10T00:00:00Z', '2026-12-10T00:00:00Z'],
    bodies: ['uranus', 'earth', 'sun'], view: 'space', tags: ['opposition'],
    scene: [{
      id: 'uranusopp', target: body('uranus'), timeRate: 3600 * 4, dwell: 5, orbitRate: SWEEP, dollyRate: PULL,
      // 0 alignment (close on the tilted rings, drifting out) · 1 distance (long climb above the
      // orbits) · 2 from Earth (sky view, zooming onto the dot) · 3 colour (back in close) · 4 tilt
      text: '25 Kasım\'da Uranüs karşı konumda: Güneş, Dünya ve Uranüs bir doğru üzerinde diziliyor ve gezegen gece boyunca gökyüzünde kalıyor. Karşı konum, bir dış gezegenin Dünya\'ya en yakın ve en parlak olduğu andır; Uranüs şu anda bizden iki virgül altı milyar kilometre uzakta. Dünya\'dan bakınca Koç takımyıldızında, kadir beş virgül altı ile karanlık bir gökyüzünde çıplak gözle zar zor, dürbünle kolayca seçilen mavi-yeşil bir noktadır. Rengi, atmosferindeki metanın kırmızı ışığı soğurmasından gelir. Yana yatmış ekseniyle Uranüs, Güneş etrafındaki seksen dört yıllık turunu adeta yuvarlanarak tamamlar.',
      cues: [
        vantage(0, 22, 35, 4.5, 'uranus', 6),
        overview(1, 'uranus', 10), rate(1, 86400 * 5), dolly(1, 0), readout(1, 'distance', 'uranus', 'earth', { label: 'Dünya–Uranüs uzaklığı' }),
        time(2, '2026-11-25T12:00:00Z'), rate(2, 1), orbits(2, false), lookFrom(2, 'earth', ['uranus'], 14), fov(2, 4, 8),
        rate(3, 3600 * 4), orbits(3, true), vantage(3, 18, 50, 5, 'uranus', 6), dolly(3, PUSH),
      ],
    }],
  },

  /* ------------------------------------------------------------------ December 2026 */
  {
    id: 'europa-clipper-earth-flyby-2026', kind: 'flyby', status: 'confirmed', source: NASA('https://europa.nasa.gov/'),
    title: 'Europa Clipper Dünya\'nın yanından geçiyor',
    summary: 'Jüpiter yolundaki sonda yerçekimi desteği için Dünya\'ya ~3.200 km\'ye kadar yaklaşıyor; en yakın nokta 3 Aralık 20:15 UTC.',
    kicker: 'Üç bin kilometreden bir yerçekimi itişi',
    facts: [['En yakın', '~3.200 km'], ['Saat', '3 Ara 20:15 UTC'], ['Hedef', 'Jüpiter · Europa'], ['Varış', 'Nisan 2030'], ['Amaç', 'Yerçekimi desteği']],
    time: '2026-12-03T20:15:00Z', window: ['2026-12-03T08:00:00Z', '2026-12-04T08:00:00Z'],
    sceneStart: '2026-12-03T15:00:00Z',
    bodies: ['europaclipper', 'earth'], view: 'space', epoch: HORIZONS, tags: ['nasa', 'flyby', 'jupiter'],
    scene: [{
      id: 'clipperflyby', target: body('earth'), timeRate: 900, dwell: 8, orbitRate: 0.008, dollyRate: -0.018,
      // 0 intro (backlit crescent, the inbound trail, pushing in) · 1 speed/altitude · 2 closest
      // approach (clock onto 20:08 at 45×, over the spacecraft's shoulder as Earth slides past)
      // · 3 arrival at Jupiter (wide again, outbound leg) · 4 data note
      text: 'Europa Clipper, Jüpiter yolunda son kez eve uğruyor: Dünya\'nın yanından geçerek gezegenin yerçekiminden hız çalıyor. Araç Dünya\'ya göre saniyede on iki kilometreden hızlı ilerliyor ve yüzeye üç bin iki yüz kilometreye kadar yaklaşacak; bu, pek çok iletişim uydusundan daha alçak. En yakın nokta evrensel saatle yirmi on beşte; geçiş, aracın Güneş etrafındaki yörüngesini Jüpiter\'e ulaşacak biçimde genişletiyor. Clipper, Jüpiter\'e 2030 Nisan\'ında varacak ve Europa\'nın buz kabuğu altındaki okyanusu kırk dokuz yakın geçişle inceleyecek. Yörünge verisi NASA/JPL Horizons\'tan alınmış, en yakın geçiş çevresinde dakika çözünürlüğünde örneklenmiştir.',
      cues: [
        orbits(0, true), fill(0, false), vantage(0, 26, 145, 28, 'earth', 8),
        readout(1, 'altitude', 'europaclipper', 'earth', { label: 'Dünya yüzeyinden yükseklik' }),
        // in over the day side, across the terminator at 20:09, closest approach in Earth's shadow
        time(2, '2026-12-03T19:57:00Z'), rate(2, 60), orbits(2, false), shot(2, 'europaclipper', 'earth', 9, { az: 20, elev: 10, seconds: 4 }), dolly(2, 0),
        rate(3, 900), orbits(3, true), vantage(3, 24, 150, 22, 'earth', 7), drift(3, 0.012), dolly(3, PULL),
        card(3, { big: '49', title: 'Planlanan Europa geçişi', text: 'Varış: Nisan 2030. 30 m açıklığındaki güneş panelleriyle NASA\'nın en büyük gezegenler arası aracı.' }),
      ],
    }],
  },
  {
    id: 'new-moon-2026-12', kind: 'moon', status: 'confirmed', source: USNO,
    title: 'Yeni Ay',
    summary: 'Ay, Güneş ile Dünya arasından geçiyor: karanlık gökyüzü haftası, Geminidler için ideal.',
    kicker: 'Karanlık gökyüzü haftası başlıyor',
    facts: [['Yeni Ay', '9 Ara 00:51 UTC'], ['Aydınlanma', '%0'], ['Sonraki dolunay', '24 Ara'], ['İdeal', 'Geminidler için'], ['Ay nerede', 'Güneş\'in yanında']],
    time: '2026-12-09T00:51:00Z',
    bodies: ['moon', 'earth', 'sun'], view: 'space', tags: ['moon'],
    scene: [{
      id: 'newmoon', target: body('moon'), timeRate: 3600 * 2, dwell: 4, orbitRate: 0.012, dollyRate: PULL,
      // 0 geometry (the dark Moon from its night side, the Sun's glare just past its limb) ·
      // 1 why no eclipse (long climb above the tilted orbit) · 2 dark skies · 3 orbit
      text: 'Yeni Ay\'da Ay, Güneş ile Dünya arasından geçer; bize dönük yüzü karanlıktır ve gökyüzünde Güneş\'in yanında görünmez. Her yeni ayda tutulma olmaz, çünkü Ay\'ın yörüngesi Dünya\'nınkine göre beş derece eğiktir ve gölgesi çoğu zaman Dünya\'nın üstünden ya da altından geçer. Yeni Ay haftası, gök gözlemcileri için en karanlık gökyüzünü getirir: bu yıl Geminid zirvesiyle çakışıyor. Yörüngeyi hızlandırılmış izliyorsunuz: Ay, Dünya\'nın çevresini yirmi dokuz buçuk günde dolanarak evrelerini tamamlar.',
      cues: [
        fill(0, false), vantage(0, 7, 168, 4.5, 'moon', 6),
        overview(1, 'moon', 10), rate(1, 3600 * 6), dolly(1, PUSH), readout(1, 'separation', 'moon', 'sun', { label: 'Güneş\'ten açısal uzaklık' }),
      ],
    }],
  },
  {
    id: 'bepicolombo-separation-2026', kind: 'milestone', status: 'scheduled', source: ESA('https://www.esa.int/Science_Exploration/Space_Science/BepiColombo'),
    title: 'BepiColombo: MPO ve Mio ayrılıyor',
    summary: 'Merkür yörüngesindeki yığın ayrılıyor: ESA\'nın MPO\'su ve JAXA\'nın Mio\'su kendi bilim yörüngelerine yerleşiyor.',
    kicker: 'İki orbiter, iki yörünge',
    facts: [['MPO', 'ESA · 480 × 1.500 km'], ['Mio', 'JAXA · 590 × 11.640 km'], ['Ayrılma', '9 Ara 2026'], ['Bilim görevi', '1 yıl + uzatma'], ['Yüzeyin haritası', 'MPO']],
    time: '2026-12-09T12:00:00Z', window: ['2026-12-09T00:00:00Z', '2026-12-11T00:00:00Z'],
    sceneStart: '2026-12-09T00:00:00Z',
    bodies: ['bepicolombo', 'mercury'], view: 'space', epoch: HORIZONS, tags: ['esa', 'jaxa', 'mercury'],
    scene: [{
      id: 'bepisep', target: body('mercury'), timeRate: 1200, dwell: 6, orbitRate: 0.01, dollyRate: PUSH,
      // 0 state (the tightening orbit from above) · 1 separation (over the stack's shoulder,
      // Mercury rolling below) · 2 two orbits (wide again, sweeping) · 3 science · 4 note
      text: 'Merkür yörüngesine girdikten iki hafta sonra BepiColombo yığını artık gezegeni on saatten kısa sürede dolanıyor. Bu günlerde yığın ayrılıyor: önce Mio\'yu koruyan güneş kalkanı, sonra iki yörünge aracı birbirinden kopuyor. Japonya\'nın Mio\'su Merkür\'ün manyetosferini incelemek için uzun elips yörüngede kalırken, Avrupa\'nın MPO\'su yüzeye yakın kutup yörüngesine iniyor. Bilim görevi 2027 başında başlayacak: yüzeyin bileşimi, iç yapısı ve Güneş\'e en yakın gezegenin manyetik alanı. Gösterilen yörünge, ESA\'nın JPL Horizons\'a verdiği planlanan yoldur; ayrılma zamanı değişebilir.',
      cues: [
        orbits(0, true), vantage(0, 40, 75, 12, 'mercury', 7),
        // periapsis pass over the day side (~06:20, 600 km): the surface rolls past under the stack
        time(1, '2026-12-09T06:04:00Z'), rate(1, 60), orbits(1, false), shot(1, 'bepicolombo', 'mercury', 5, { az: 24, elev: 14, seconds: 5 }), dolly(1, 0),
        readout(1, 'altitude', 'bepicolombo', 'mercury', { label: 'Merkür yüzeyinden yükseklik' }),
        rate(2, 1800), orbits(2, true), vantage(2, 30, 60, 11, 'mercury', 6), drift(2, SWEEP), dolly(2, PULL),
      ],
    }],
  },
  {
    id: 'geminids-2026', kind: 'meteor-shower', status: 'scheduled', source: IMO,
    title: 'Geminid meteor yağmuru zirvesi',
    summary: 'Yılın en zengin yağmuru: asteroit 3200 Phaethon\'un tozu, zirvede saatte 150 meteor, karanlık gökyüzü.',
    kicker: 'Yılın en zengin yağmuru, aysız gökyüzünde',
    facts: [['Kaynak', '3200 Phaethon'], ['Hız', '35 km/s'], ['Zirvede', '~150 meteor/sa'], ['Radyan', 'İkizler (Gemini)'], ['Ay', 'İnce hilal']],
    time: '2026-12-14T01:00:00Z', window: ['2026-12-04T00:00:00Z', '2026-12-17T00:00:00Z'],
    bodies: ['phaethon', 'earth'], view: 'space', tags: ['meteor', 'naked-eye'],
    scene: [{
      id: 'geminids', target: body('earth'), timeRate: 60, dwell: 7, orbitRate: 0.006, dollyRate: 0,
      // 0 richest (cold open: Earth's night side under the shower) · 1 Phaethon (long pull-out
      // above its whole orbit) · 2 crossing (dive back to Earth's orbit) · 3 radiant (finale: the
      // full 150-an-hour sky) · 4 conditions
      text: 'Geminidler yılın en zengin meteor yağmurudur: zirvede karanlık bir gökyüzünde saatte yüz elliye kadar meteor görülür. Kaynağı bir kuyruklu yıldız değil, Güneş\'e Merkür\'den de çok yaklaşan asteroit 3200 Phaethon\'dur; Güneş\'in ısısı yüzeyini çatlatıp toz saçar. Dünya her Aralık ayında Phaethon\'un yörüngesi boyunca uzanan toz şeridinden geçer; parçacıklar atmosfere saniyede otuz beş kilometreyle girer ve çoğu zaman renkli, yavaş izler bırakır. Meteorlar gökyüzünde İkizler takımyıldızındaki bir noktadan, radyandan saçılır gibi görünür: bu, Dünya\'nın akımın içinden geçiş doğrultusudur. En iyi izleme zamanı gece yarısından sonra; Ay bu yıl ince hilal olduğundan erkenden batar ve gökyüzü karanlık kalır.',
      cues: [
        fill(0, false), orbits(0, false), meteors(0, { ref: 'earth', ...RADIANT.geminids, rate: 10, fireballs: 0.08, approach: true, seconds: 3.5 }),
        orbits(1, true), drift(1, SWEEP), overview(1, 'phaethon', 10), rate(1, 86400 * 2), readout(1, 'distance', 'phaethon', 'sun', { label: 'Phaethon–Güneş uzaklığı' }),
        overview(2, 'earth', 9), rate(2, 3600 * 6), dolly(2, PUSH),
        rate(3, 60), orbits(3, false), fill(3, false), dolly(3, PUSH * 0.4), drift(3, 0.006),
        meteors(3, { ref: 'earth', ...RADIANT.geminids, rate: 34, fireballs: 0.08, approach: true, seconds: 8 }),
        card(3, { big: '~150/sa', title: 'Zirve saatlik oran (ZHR)', text: 'Toz şeridi burada ana cismin yörünge çizgisiyle temsil edilir; gerçek dağılım daha geniştir.' }),
      ],
    }],
  },
  {
    id: 'december-solstice-2026', kind: 'solstice', status: 'confirmed', source: USNO,
    title: 'Aralık gündönümü',
    summary: 'Kuzey yarıkürede yılın en uzun gecesi, güneyde en uzun günü: Dünya\'nın eğik ekseni Güneş\'e göre en uç konumunda.',
    kicker: 'Kuzeyde en uzun gece, güneyde en uzun gün',
    facts: [['An', '21 Ara 20:50 UTC'], ['Eksen eğikliği', '23,4°'], ['Güneş tepede', 'Oğlak Dönencesi'], ['Kuzeyde', 'En kısa gün'], ['Güneyde', 'En uzun gün']],
    time: '2026-12-21T20:50:00Z',
    bodies: ['earth', 'sun'], view: 'space', tags: ['seasons'],
    scene: [{
      id: 'solstice', target: body('earth'), timeRate: 1800, dwell: 5, orbitRate: SWEEP, dollyRate: PUSH,
      // 0 tilt (terminator shot, Earth turning at half an hour a second) · 1 terminator ·
      // 2 arctic night (swing up over the dark pole) · 3 orbit (long climb above the year) · 4 not distance
      text: 'Dünya\'nın dönme ekseni yörünge düzlemine göre yirmi üç buçuk derece eğiktir ve yıl boyunca aynı yöne bakar. Aralık gündönümünde Güney Kutbu Güneş\'e doğru, Kuzey Kutbu ise ondan uzağa eğilmiştir: gece-gündüz sınırı Dünya\'yı en eğik açıyla keser. Kuzey Kutup Dairesi\'nin ötesinde Güneş hiç doğmaz; güneyde ise Antarktika gece yarısı güneşiyle aydınlıktır. Yörüngeden bakınca Dünya, Güneş çevresindeki turunun bu noktasına her yıl 21–22 Aralık\'ta ulaşır. Mevsimleri yapan uzaklık değil bu eğimdir: Dünya aslında Güneş\'e en yakın noktasından Ocak başında geçer.',
      cues: [
        // the terminator is the subject: no work light on the night side, no orbit lines until the wide shot
        fill(0, false), orbits(0, false), vantage(0, 10, 90, 5, 'earth', 6),
        vantage(2, 62, 60, 4.5, 'earth', 7), dolly(2, 0),
        orbits(3, true), overview(3, 'earth', 10), rate(3, 86400 * 3), dolly(3, PUSH),
      ],
    }],
  },
  {
    id: 'ursids-2026', kind: 'meteor-shower', status: 'scheduled', source: IMO,
    title: 'Ursid meteor yağmuru zirvesi',
    summary: 'Yılın son yağmuru: 8P/Tuttle Kuyruklu Yıldızı\'nın tozu, Küçükayı\'dan saçılan az ama düzenli meteorlar.',
    kicker: 'Yılın son yağmuru, Kutup Yıldızı\'nın yanından',
    facts: [['Kaynak', '8P/Tuttle'], ['Hız', '33 km/s'], ['Zirvede', '~10 meteor/sa'], ['Radyan', 'Küçükayı'], ['Etkin dönem', '17 – 26 Ara']],
    time: '2026-12-22T12:00:00Z', window: ['2026-12-17T00:00:00Z', '2026-12-26T00:00:00Z'],
    bodies: ['tuttle', 'earth'], view: 'space', tags: ['meteor'],
    scene: showerScene('ursids', 'tuttle', RADIANT.ursids, {
      // 0 origin · 1 Tuttle's tilted orbit · 2 Earth crosses after the solstice · 3 a quiet shower
      // (finale) · 4 the 1945 / 1986 outbursts — the sky briefly fills
      rate: [3, 8],
      extra: [meteors(4, { ref: 'earth', ...RADIANT.ursids, rate: 30, fireballs: 0.08 })],
      text: 'Ursidler, on üç buçuk yılda bir dönen 8P/Tuttle Kuyruklu Yıldızı\'nın bıraktığı tozdan doğar. Tuttle\'ın yörüngesi ekliptiğe elli beş derece eğiktir; şu anda Satürn\'e yakın uzaklıkta, bir sonraki perihelyonu 2035\'te. Dünya, gündönümünün hemen ardından bu akımın içinden geçer; parçacıklar atmosfere saniyede otuz üç kilometreyle girer. Sakin bir yağmurdur: zirvede saatte on kadar meteor, ama radyanı Küçükayı\'da olduğundan kuzey yarıkürede bütün gece ufkun üstündedir. Seyrek de olsa 1945 ve 1986\'da saatte yüzü aşan patlamalar kaydedilmiştir.',
    }),
  },
  {
    id: 'cold-supermoon-2026', kind: 'moon', status: 'confirmed', source: USNO,
    title: 'Soğuk Ay: yılın son süper ayı',
    summary: 'Aralık dolunayı da perijeye yakın: 2026\'yı kapatan ikinci ardışık "süper ay".',
    kicker: 'Aralık dolunayı da perijeye yakın',
    facts: [['Dolunay', '24 Ara 01:28 UTC'], ['Sıra', 'Yılın son süper ayı'], ['Gökyüzünde', 'Kuzeyde yılın en yüksek dolunayı'], ['Görünür boyut', 'Ortalamadan büyük'], ['Bir önceki', '24 Kas']],
    time: '2026-12-24T01:28:00Z',
    bodies: ['moon', 'earth', 'sun'], view: 'space', tags: ['naked-eye', 'moon'],
    scene: [{
      id: 'coldmoon', target: body('moon'), timeRate: 3600 * 3, dwell: 5, orbitRate: SWEEP, dollyRate: PULL,
      // 0 intro (full disc, drifting out) · 1 distance (climb above the orbit) · 2 high moon
      // (over Earth's shoulder: the Moon opposite the Sun) · 3 name · 4 from Earth (zoom in)
      text: 'Aralık dolunayı da perijeye yakın denk geliyor: Kasım\'dakinden biraz daha küçük ama yine yılın en büyüklerinden biri. Ay şu anda Dünya\'ya üç yüz altmış bin kilometreden daha yakın. Kış dolunayı kuzey yarıkürede gökyüzünde en yükseğe çıkan dolunaydır; Güneş\'in alçakta kaldığı günlerde Ay onun karşısında, yüksekte yol alır. Aralık dolunayına Soğuk Ay denir; uzun kış gecelerinin başlangıcını işaret eder. Dünya\'dan bakınca İkizler takımyıldızında, Geminidlerin radyanının hemen yanında parlıyor.',
      cues: [
        vantage(0, 12, 0, 3.2, 'moon', 6),
        overview(1, 'moon', 9), dolly(1, 0), readout(1, 'distance', 'moon', 'earth', { label: 'Dünya–Ay uzaklığı' }),
        orbits(2, false), shot(2, 'earth', 'moon', 6, { az: 12, elev: 10, seconds: 8 }), dolly(2, PUSH),
        time(4, '2026-12-24T01:28:00Z'), rate(4, 1), orbits(4, false), lookFrom(4, 'earth', ['moon'], 7), fov(4, 2.6, 9),
      ],
    }],
  },

  /* ------------------------------------------------------------------ February 2027 */
  {
    id: 'annular-eclipse-2027', kind: 'eclipse', status: 'confirmed', source: NASA('https://science.nasa.gov/eclipses/future-eclipses/'),
    title: 'Halkalı Güneş tutulması',
    summary: 'Ay, Güneş\'in önünden geçiyor ama onu tam örtemiyor: Güney Amerika ve Atlantik üzerinde "ateş halkası".',
    kicker: 'Ay Güneş\'i örtüyor ama tam değil: ateş halkası',
    facts: [['Tür', 'Halkalı'], ['Büyüklük', '0,93'], ['En uzun halka', '7 dk 51 sn'], ['Yol', 'Güney Amerika · Atlantik'], ['Kısmi', 'Afrika ve Antarktika\'nın bir bölümü']],
    time: '2027-02-06T16:00:00Z', window: ['2027-02-06T12:30:00Z', '2027-02-06T19:30:00Z'],
    sceneStart: '2027-02-06T15:00:00Z',
    bodies: ['moon', 'sun', 'earth'], view: 'space', tags: ['eclipse'],
    scene: [{
      id: 'annular', target: body('moon'), timeRate: 120, dwell: 6, orbitRate: 0.01, dollyRate: PUSH,
      // 0 geometry (sunward side of the Moon, Earth hanging behind it) · 1 why annular (climb
      // above the orbit) · 2 from Earth (clock onto 15:50 at 60×: the Moon sliding across the Sun) · 3 path · 4 next
      text: 'Bir Güneş tutulmasında Ay, Güneş ile Dünya arasından tam olarak geçer ve gölgesi Dünya\'ya düşer. Bu kez Ay yörüngesinin uzak yarısında olduğundan gökyüzünde Güneş\'ten biraz küçük görünür: onu tam örtemez ve geriye parlak bir ateş halkası kalır. Gölge merkezinden bakalım: Ay\'ın karanlık diski Güneş\'in ortasına yerleşiyor. Halkalılık kuşağı Güney Pasifik\'ten Şili ve Arjantin üzerinden Atlantik\'e uzanır; Güney Amerika ve Afrika\'nın geniş bölgelerinde parçalı tutulma izlenir. Bir sonraki büyük tutulma 2 Ağustos 2027\'de: Mısır ve Suudi Arabistan üzerinden geçen altı dakikalık tam tutulma.',
      cues: [
        orbits(0, false), shot(0, 'moon', 'earth', 7, { az: 26, elev: 12, seconds: 7 }),
        orbits(1, true), overview(1, 'moon', 9), dolly(1, 0), readout(1, 'separation', 'moon', 'sun', { label: 'Ay–Güneş açısal ayrıklığı', text: 'Dünya merkezinden' }),
        time(2, '2027-02-06T15:50:00Z'), rate(2, 60), orbits(2, false), lookFrom(2, 'earth', ['moon', 'sun'], 4, 50), fov(2, 2.2, 10),
        card(3, { big: '2 Ağu 2027', title: 'Sonraki tam tutulma', text: 'Luksor üzerinde 6 dk 23 s — yüzyılın en uzunlarından.' }),
      ],
    }],
  },
];

export function eventById(id: string): SkyEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}

/** The event as a playable tour definition. */
export function eventTour(e: SkyEvent): TourDef {
  // scenes are composed shots: a slow, visible drift plus a gentle push-in unless the step says
  // otherwise; the opening step carries the chapter title, the one-line promise and the facts strip
  const steps = e.scene.map((s, i) => ({
    ...s, orbitRate: s.orbitRate ?? 0.012, dollyRate: s.dollyRate ?? PUSH,
    // the bodies the event is about keep their tags; the rest of the sky stays quiet
    show: [...(s.show ?? []), ...e.bodies],
    ...(i === 0 ? { title: s.title ?? e.title, kicker: s.kicker ?? e.kicker, facts: s.facts ?? e.facts } : {}),
  }));
  return { id: `event:${e.id}`, title: e.title, summary: e.summary, steps, startIso: e.sceneStart ?? e.time, audio: `events/${e.id}`, keepClock: true };
}

/** Human label of an event kind (source language) */
export const KIND_LABELS: Record<EventKind, string> = {
  'orbit-insertion': 'Yörüngeye giriş',
  flyby: 'Yakın geçiş',
  conjunction: 'Kavuşum',
  opposition: 'Karşı konum',
  elongation: 'Uzanım',
  'meteor-shower': 'Meteor yağmuru',
  moon: 'Ay',
  milestone: 'Kilometre taşı',
  eclipse: 'Tutulma',
  solstice: 'Gündönümü',
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  scheduled: 'planlandı',
  confirmed: 'kesin',
  happened: 'gerçekleşti',
};

/** Runtime patch shape of public/events/overrides.json */
export interface EventOverride {
  time?: string;
  status?: EventStatus;
  /** hide the event entirely */
  hidden?: boolean;
}

/** Apply `public/events/overrides.json` (fetched by the panel) in place. */
export function applyOverrides(patch: Record<string, EventOverride>): void {
  for (const e of EVENTS) {
    const p = patch[e.id];
    if (!p) continue;
    if (p.time && !Number.isNaN(Date.parse(p.time))) e.time = p.time;
    if (p.status) e.status = p.status;
    if (p.hidden) e.tags = [...(e.tags ?? []), 'hidden'];
  }
}
