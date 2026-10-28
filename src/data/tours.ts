/**
 * Guided tours: narrated lessons that fly the camera from object to object while a voice
 * (xAI TTS, "altair") explains what is on screen. Narration is written in the source language
 * (Turkish) and translated like every other display string; the audio for each locale lives in
 * `public/tours/<locale>/<tour>/<step>.mp3` with a manifest produced by `scripts/tts-tours.mjs`.
 *
 * A step = one destination + one paragraph. The player starts the flight and the narration
 * together; the next step begins when both the audio and the flight have finished. Cues fire
 * at sentence starts (0-based index into the Turkish text) and drive the show: cloud strips,
 * overviews, surface pins, true-scale size comparisons, photo / trivia cards, light pulses…
 */

/** Where a step takes the camera (same reference scheme as `places.ts`) */
export type TourTarget =
  | { kind: 'body'; ref: string }
  | { kind: 'star'; ref: string }
  | { kind: 'blackhole'; ref: string }
  | { kind: 'landmark'; ref: string }
  | { kind: 'galaxy'; ref: string };

/**
 * Something that happens while a step is narrated. `at` is the index of the sentence (of the
 * source text, 0-based) at whose start the cue fires; the player maps it onto the spoken locale.
 * `delay` (seconds) holds it back further into that sentence.
 */
export type TourCue = { delay?: number } & (
  /** fade the cloud layer in/out (e.g. strip Venus to show the radar surface) */
  | { at: number; action: 'clouds'; on: boolean }
  /** change the simulation rate from this sentence on (s/s) */
  | { at: number; action: 'rate'; rate: number }
  /** pull back above `ref`'s orbit around its parent so the whole orbit is in view (`seconds`: flight time) */
  | { at: number; action: 'overview'; ref: string; seconds?: number }
  /**
   * Pin a surface feature of `ref` (east longitude, degrees) with a labelled marker and, unless
   * `approach` is false, fly in above it. `storm` snaps to the gas giant's rendered storm instead.
   */
  | { at: number; action: 'pin'; ref: string; lat: number; lon: number; label: string; approach?: boolean; storm?: boolean; extent?: number }
  /** remove the pin */
  | { at: number; action: 'unpin' }
  /** fly back to the step's target */
  | { at: number; action: 'return' }
  /**
   * Show a framed inset in the corner: a photograph (`public/tour-media/<image>`) and/or a trivia
   * card (`title`, a `big` headline figure such as "×1.300", `text`). `source` is the picture
   * credit. Stays until `until` (sentence index), the next card, or the end of the step.
   */
  | { at: number; action: 'card'; image?: string; title?: string; big?: string; text?: string; source?: string; until?: number }
  /** hide the current card */
  | { at: number; action: 'uncard' }
  /**
   * Place a true-scale copy of `ref` (e.g. Earth) beside the step's target so the two can be
   * compared; the camera backs off far enough to see both. Removed by `uncompare` or step end.
   */
  | { at: number; action: 'compare'; ref: string; shoulder?: boolean }
  | { at: number; action: 'uncompare' }
  /**
   * Postcard of a mountain: a real relief built offline (`relief`: directory under
   * tour-media/terrain, centred on the summit at `lat`/`lon`, `peak` km above the plains, drawn
   * `scale` times taller) rises on `ref`, and the camera glides down — looking at the ground as
   * it comes in — to stand `dist` km from the summit, `alt` km above the ground, looking at it
   * across the horizon. `fov` narrows the lens (telephoto), `seconds` is the flight time.
   */
  | { at: number; action: 'postcard'; ref: string; lat: number; lon: number; relief: string; peak: number; scale: number; dist: number; alt: number; fov?: number; seconds?: number }
  /**
   * Over a ringed planet's shoulder: the camera `dist` radii out, `elev` degrees above the ring
   * plane, `az` degrees round from the sunlit side, aimed at the rings `aimR` radii out and `aimAz`
   * degrees further round — the planet's limb fills one side of the frame, the rings sweep away
   * on the other. Holds still while the clock runs fast.
   */
  | { at: number; action: 'limb'; ref?: string; elev: number; az: number; dist: number; aimR: number; aimAz: number; seconds?: number }
  /**
   * Fly to a vantage point around `ref` (default: the step's target): `elev` degrees above its
   * equator plane, `az` degrees around the pole measured from the sunlit side (0 = noon side,
   * 90 = morning terminator), `dist` in radii. `seconds` stretches the flight (slow reveals).
   * `inside`: a ringed planet's camera may come closer than its outer ring.
   */
  | { at: number; action: 'vantage'; ref?: string; elev: number; az: number; dist: number; seconds?: number; inside?: boolean }
  /**
   * Over-the-shoulder shot: camera `dist` radii from `ref` on the side away from `toward`, so
   * `toward` hangs in the background behind it (a spacecraft against the world it approaches).
   * `az`/`elev` (degrees) swing the camera off that axis so both stay in frame; `seconds` = flight time.
   */
  | { at: number; action: 'shot'; ref: string; toward: string; dist: number; az?: number; elev?: number; seconds?: number }
  /** continuous push-in (negative) / pull-out (positive) while dwelling: ln(distance) per second */
  | { at: number; action: 'dolly'; rate: number }
  /** auto-orbit drift speed (rad/s) from this sentence on */
  | { at: number; action: 'drift'; rate: number }
  /** a pulse of light travels from body `from` to body `to` in `seconds` (light-travel time demo) */
  | { at: number; action: 'pulse'; from: string; to: string; seconds: number }
  /**
   * Live figure in the corner card, recomputed every frame from the simulation: the distance
   * between `a` and `b`, the altitude of `a` above `b`'s surface, the angular separation of `a`
   * and `b` seen from `from` (default Earth), or the one-way light time between them.
   */
  | { at: number; action: 'readout'; kind: 'distance' | 'altitude' | 'separation' | 'light'; a: string; b: string; from?: string; label: string; text?: string; until?: number }
  /**
   * Sky view: park the camera just above `ref` (`alt` km, default 300) on the side facing the
   * `toward` bodies and keep it aimed at their midpoint while the step plays (a "look up from
   * Earth" shot for conjunctions and oppositions). `fov` narrows the field of view (degrees).
   */
  | { at: number; action: 'lookFrom'; ref: string; toward: string[]; alt?: number; fov?: number }
  /** field of view (degrees) from this sentence on, eased over `seconds` (slow zoom); restored at step end */
  | { at: number; action: 'fov'; deg: number; seconds?: number }
  /** set the simulation clock to an instant (ISO 8601 UTC) */
  | { at: number; action: 'time'; iso: string }
  /** force orbit lines on/off (planet orbits; `moons` for moon orbits) without moving the camera */
  | { at: number; action: 'orbits'; on: boolean; moons?: boolean }
  /** the soft "work light" tours add on a body's night side when close: off for genuinely backlit shots */
  | { at: number; action: 'fill'; on: boolean }
  /**
   * Meteor shower raining into `ref`'s atmosphere from the radiant at `ra`/`dec` (ICRF degrees):
   * `speed` km/s sets the streak speed, `rate` is streaks per real second (a cinematic figure),
   * `fireballs` the fraction of bright bolides. `approach` flies the camera to a spot that looks
   * across the night side at the hemisphere being hit (`seconds`: flight time). `on: false` stops it.
   */
  | { at: number; action: 'meteors'; on: true; ref: string; ra: number; dec: number; speed: number; rate: number; fireballs?: number; approach?: boolean; seconds?: number }
  | { at: number; action: 'meteors'; on: false });

export interface TourStep {
  /** stable id — audio file name */
  id: string;
  target: TourTarget;
  /** narration (source language) */
  text: string;
  /** simulation rate (s/s) while this step plays; default 1 */
  timeRate?: number;
  /** auto-orbit speed around the target (rad/s); default 0.05 */
  orbitRate?: number;
  /** continuous push-in (negative) / pull-out while dwelling, ln(distance)/s; default 0 */
  dollyRate?: number;
  /** extra seconds to linger after the narration ends; default 1.5 */
  dwell?: number;
  /** timed events during the narration (see TourCue) */
  cues?: TourCue[];
  /**
   * Bodies that keep their tags while the step plays, besides the target, its primary and moons
   * and everything the cues refer to (the player hides every other tag during a tour)
   */
  show?: string[];
  /** chapter title shown full-screen for a few seconds as the step opens (cinematic) */
  title?: string;
  /** one line under the chapter title */
  kicker?: string;
  /** supporting figures shown in the side strip while the step plays: [label, value] */
  facts?: Array<[string, string]>;
}

export interface TourDef {
  id: string;
  title: string;
  summary: string;
  steps: TourStep[];
  /** small line above the chapter title (default: "<tour title> · i / n"); single-scene events use it for kind and date */
  eyebrow?: string;
  /** simulation clock at the start (ISO 8601 UTC); default: leave the visitor's clock alone */
  startIso?: string;
  /** audio folder (`public/tours/<locale>/<audio>/`); default `id` */
  audio?: string;
  /** at the end stay on the scene's date at 1× instead of restoring the visitor's clock (events) */
  keepClock?: boolean;
}

const body = (ref: string): TourTarget => ({ kind: 'body', ref });
const star = (ref: string): TourTarget => ({ kind: 'star', ref });
const bh = (ref: string): TourTarget => ({ kind: 'blackhole', ref });
const lm = (ref: string): TourTarget => ({ kind: 'landmark', ref });
const gal = (ref: string): TourTarget => ({ kind: 'galaxy', ref });

/* cue shorthands */
type CardOpts = Omit<Extract<TourCue, { action: 'card' }>, 'at' | 'action'>;
const card = (at: number, c: CardOpts): TourCue => ({ at, action: 'card', ...c });
const uncard = (at: number): TourCue => ({ at, action: 'uncard' });
const rate = (at: number, r: number): TourCue => ({ at, action: 'rate', rate: r });
const overview = (at: number, ref: string, seconds?: number): TourCue => ({ at, action: 'overview', ref, seconds });
const ret = (at: number): TourCue => ({ at, action: 'return' });
const pin = (at: number, ref: string, lat: number, lon: number, label: string, extra: { storm?: boolean; approach?: boolean; extent?: number } = {}): TourCue => ({ at, action: 'pin', ref, lat, lon, label, ...extra });
const unpin = (at: number): TourCue => ({ at, action: 'unpin' });
const clouds = (at: number, on: boolean): TourCue => ({ at, action: 'clouds', on });
const compare = (at: number, ref: string, o: { shoulder?: boolean } = {}): TourCue => ({ at, action: 'compare', ref, ...o });
const uncompare = (at: number): TourCue => ({ at, action: 'uncompare' });
const vantage = (at: number, elev: number, az: number, dist: number, ref?: string, seconds?: number): TourCue => ({ at, action: 'vantage', elev, az, dist, ref, seconds });
const pulse = (at: number, from: string, to: string, seconds: number): TourCue => ({ at, action: 'pulse', from, to, seconds });
const shot = (at: number, ref: string, toward: string, dist: number, o: { az?: number; elev?: number; seconds?: number } = {}): TourCue => ({ at, action: 'shot', ref, toward, dist, ...o });
const dolly = (at: number, r: number): TourCue => ({ at, action: 'dolly', rate: r });
const drift = (at: number, r: number): TourCue => ({ at, action: 'drift', rate: r });
const fov = (at: number, deg: number, seconds?: number): TourCue => ({ at, action: 'fov', deg, seconds });
type MeteorOpts = Omit<Extract<TourCue, { action: 'meteors'; on: true }>, 'at' | 'action' | 'on'>;
const meteors = (at: number, m: MeteorOpts): TourCue => ({ at, action: 'meteors', on: true, ...m });
const unmeteors = (at: number): TourCue => ({ at, action: 'meteors', on: false });

/** cue shorthands shared with the Events scenes (src/data/events.ts) */
export const cues = { body, star, bh, lm, gal, card, uncard, rate, overview, ret, pin, unpin, clouds, compare, uncompare, vantage, pulse, shot, dolly, drift, fov, meteors, unmeteors };

/* picture credits (not translated) */
const NASA = 'NASA';
const JPL = 'NASA/JPL';
const JPLC = 'NASA/JPL-Caltech';
const SSI = 'NASA/JPL-Caltech/SSI';
const HUBBLE = 'NASA/ESA/Hubble';
const WEBB = 'NASA/ESA/CSA/STScI';
const NH = 'NASA/JHUAPL/SwRI';
const ESA = 'ESA (CC BY-SA 3.0 IGO)';
const ESO = 'ESO (CC BY 4.0)';
const EHT = 'EHT Collaboration (CC BY 4.0)';

export const TOURS: TourDef[] = [
  {
    id: 'solar-system',
    title: 'Güneş Sistemi Turu',
    summary: 'Güneş\'ten Plüton\'a: gerçek ölçekli karşılaştırmalar, hızlandırılmış yörüngeler, yüzey işaretleri ve fotoğraflarla sekiz gezegen, bir ay ve bir cüce gezegen.',
    steps: [
      { id: 'sun', target: body('sun'),
        // 0 welcome · 1 mass · 2 Earth comparison · 3 temperatures · 4 light pulse · 5 eight minutes ago
        text: 'Güneş Sistemi turuna hoş geldiniz; yolculuğumuz her şeyin merkezinden, Güneş\'ten başlıyor. Dört buçuk milyar yaşındaki bu yıldız, sistemdeki toplam kütlenin yüzde doksan dokuz virgül sekizini tek başına taşır. Ne kadar büyük olduğunu görmek için yanına gerçek ölçekli bir Dünya koyalım: çapı boyunca yan yana yüz dokuz Dünya dizilir, içine ise bir milyon üç yüz bin tanesi sığar. Yüzeyi beş bin beş yüz derece, çekirdeği on beş milyon derecedir; her saniye altı yüz milyon ton hidrojeni helyuma dönüştürür. Şimdi geri çekilelim ve ışığın yolculuğunu izleyelim: Güneş\'ten çıkan ışık, Dünya\'ya sekiz dakika yirmi saniyede ulaşır. Yani Güneş\'e her baktığınızda, aslında sekiz dakika önceki hâlini görürsünüz.',
        cues: [
          compare(2, 'earth', { shoulder: true }),
          card(2, { big: '109 Dünya', title: 'Güneş\'in çapı boyunca', text: 'Hacmine bir milyon üç yüz bin Dünya sığar.' }),
          card(3, { image: 'sun.jpg', source: 'NASA/SDO', title: 'Güneş patlaması', text: 'Dinamik Güneş Gözlemevi\'nin görüntülediği bir X sınıfı patlama.' }),
          uncompare(4), uncard(4), overview(4, 'earth'), pulse(4, 'sun', 'earth', 7),
        ], dwell: 1 },

      { id: 'mercury', target: body('mercury'),
        // 0 intro · 1 88-day orbit (overview) · 2 slow spin (back) · 3 temperatures · 4 Caloris pin · 5 BepiColombo
        text: 'İlk durağımız Merkür: en küçük gezegen ve Güneş\'e en yakın olanı. Güneş\'in etrafındaki bir turu yalnızca seksen sekiz gün sürer; şu anda o turu hızlandırılmış olarak izliyorsunuz. Buna karşılık kendi etrafında çok yavaş döner: bir Merkür günü, iki Merkür yılı sürer. Atmosferi yok denecek kadar incedir; bu yüzden gündüz tarafı dört yüz otuz dereceye çıkarken gece tarafı eksi yüz seksen dereceye düşer. Kuzey yarım küredeki Caloris Havzası, bin beş yüz kilometre genişliğinde dev bir çarpma izidir; onu oluşturan çarpışma gezegenin tam karşı tarafında bile tepeler yükseltmiştir. Şu anda Avrupa ve Japonya\'nın ortak aracı BepiColombo, Merkür\'ün yörüngesine girmek üzere ona doğru yol alıyor.',
        cues: [
          overview(1, 'mercury'), rate(1, 2.8e6),
          ret(2), rate(2, 1),
          card(2, { big: '1 gün = 2 yıl', title: 'Merkür\'de zaman', text: 'Bir güneş günü yüz yetmiş altı Dünya günü sürer.', until: 4 }),
          pin(4, 'mercury', 30.5, 161.2, 'Caloris Havzası', { extent: 775 }),
          // BepiColombo's capture week (the sampled ephemeris around Mercury): seen from a little
          // way behind the spacecraft, Mercury filling the background
          unpin(5), { at: 5, action: 'time', iso: '2026-11-21T12:00:00Z' },
          shot(5, 'bepicolombo', 'mercury', 8, { az: -32, elev: 10, seconds: 4 }),
          card(5, { image: 'bepicolombo.jpg', source: 'ESA/BepiColombo/MTM (CC BY-SA 3.0 IGO)', title: 'BepiColombo', text: 'Aracın Merkür yakın geçişinde çektiği fotoğraf, 2025.' }),
        ], dwell: 3 },

      { id: 'venus', target: body('venus'),
        // 0 twin (Earth beside) · 1 clouds hide · 2 strip clouds: hell · 3 Maxwell pin · 4 radar / Venera · 5 slow retrograde spin
        text: 'Venüs, boyutuyla Dünya\'nın ikizi sayılır; yan yana koyduğumuzda fark neredeyse görünmez. Ama benzerlik burada biter: şu anda gördüğünüz sülfürik asit bulutları, altındaki dünyayı tamamen gizler. Bulutları kaldıralım: altta, kalın karbondioksit atmosferinin sera etkisiyle dört yüz altmış beş dereceye ısınmış ve basıncı Dünya\'nın doksan iki katı olan bir cehennem var. Yüzeyde kurşun erir; buradaki en yüksek dağ, on bir kilometrelik Maxwell Dağları\'dır. Bu yüzeyi yalnızca radar görebildi; Sovyet Venera araçları ise inişten sonra en fazla iki saat dayanabildi. Venüs ayrıca ters yönde ve çok yavaş döner: bir günü, bir yılından daha uzundur.',
        cues: [
          compare(0, 'earth'),
          uncompare(1),
          clouds(2, false), dolly(2, -0.045),
          card(2, { big: '465 °C', title: 'Yüzey sıcaklığı', text: 'Basınç doksan iki atmosfer: bir kilometre derinlikteki denizle aynı.', until: 4 }),
          pin(3, 'venus', 65.2, 3.3, 'Maxwell Dağları'),
          unpin(4), ret(4),
          card(4, { image: 'magellan.jpg', source: JPL, title: 'Magellan radar haritası', text: 'Yüzeyin tamamı bin dokuz yüz doksanlarda radarla haritalandı.' }),
          clouds(5, true), rate(5, 2.5e6),
        ], dwell: 5 },

      { id: 'earth', target: body('earth'),
        // 0 home · 1 water · 2 night side (vantage) · 3 shield · 4 Blue Marble · 5 Moon's month (overview)
        text: 'Ve işte evimiz: Dünya, evrende yaşam barındırdığını bildiğimiz tek yer. Yüzeyinin yüzde yetmiş biri sıvı suyla kaplıdır; bu yüzden uzaydan mavi görünür. Gece tarafına geçelim: şehirlerin ışıkları, yaşayan bir gezegenin uzaydan görülebilen imzasıdır. Güçlü manyetik alanı bizi Güneş rüzgârından korur, ozon tabakası morötesi ışınları süzer. Bin dokuz yüz yetmiş ikide Apollo on yedi mürettebatının çektiği bu fotoğraf, Mavi Bilye, tarihin en çok çoğaltılan görüntülerinden biri oldu. Ay\'ın kütle çekimi ise eksen eğikliğini sabit tutarak mevsimlerin düzenli olmasını sağlar; şimdi geri çekilip onun bir aylık turunu izleyelim.',
        cues: [
          vantage(2, 12, 108, 3.4),
          card(4, { image: 'bluemarble.jpg', source: NASA, title: 'Mavi Bilye', text: 'Apollo 17, 7 Aralık 1972; Antarktika\'dan Akdeniz\'e tüm bir yarım küre.' }),
          uncard(5), overview(5, 'moon'), rate(5, 3e5),
        ], dwell: 7 },

      { id: 'moon', target: body('moon'),
        // 0 intro · 1 Earth comparison · 2 Apollo 11 pin · 3 twelve astronauts · 4 Tycho pin · 5 tidal lock
        text: 'Ay, Dünya\'nın tek doğal uydusu ve insanların ayak bastığı tek başka gök cismi. Dünya\'nın yanında ne kadar küçük olduğuna bakın: çapı Dünya\'nınkinin yalnızca dörtte biri kadardır. Bin dokuz yüz altmış dokuzda Apollo on bir, Sükûnet Denizi\'ne indi; Neil Armstrong ve Buzz Aldrin yüzeyde iki buçuk saat yürüdü. Bin dokuz yüz yetmiş ikiye kadar toplam on iki astronot Ay\'da yürüdü ve üç yüz seksen iki kilogram kaya getirdi. Güneydeki parlak ışınlı Tycho Krateri, yüz sekiz milyon yıl önceki bir çarpışmanın izidir; ışınları binlerce kilometre uzanır. Ay bize hep aynı yüzünü gösterir, çünkü dönüşü yörüngesine kilitlenmiştir; her yıl yaklaşık dört santimetre bizden uzaklaşır.',
        cues: [
          compare(1, 'earth'),
          uncompare(2), pin(2, 'moon', 0.67, 23.47, 'Apollo 11 iniş yeri'),
          card(2, { image: 'apollo11.jpg', source: NASA, title: 'Buzz Aldrin, Apollo 11', text: 'Neil Armstrong\'un çektiği fotoğraf, 20 Temmuz 1969.' }),
          uncard(4), pin(4, 'moon', -43.3, -11.4, 'Tycho Krateri'),
          // over the Moon's shoulder: its far side toward us, the Earth it always faces behind
          unpin(5), shot(5, 'moon', 'earth', 3, { az: 25, elev: 10 }),
        ], dwell: 2 },

      { id: 'mars', target: body('mars'),
        // 0 rust · 1 Earth comparison · 2 Olympus pin · 3 Valles pin · 4 rovers (back) · 5 day & year (overview)
        text: 'Kızıl Gezegen Mars, rengini yüzeyindeki paslanmış demirden alır. Çapı Dünya\'nın yarısı kadardır; ama kara alanı neredeyse Dünya\'nın tüm karalarına eşittir, çünkü okyanusu yoktur. Güneş Sistemi\'nin en büyük yanardağına ev sahipliği yapar: yirmi iki kilometre yüksekliğindeki Olympus Mons, Everest\'in iki buçuk katıdır. Dört bin kilometre uzunluğundaki Valles Marineris kanyonu ise Amerika kıtasını baştan başa geçecek kadar uzundur. Milyarlarca yıl önce yüzeyinde nehirler ve göller vardı; bugün bu suyun izlerini Curiosity ve Perseverance gibi robotlar arıyor. Günü bizimkine çok benzer, yirmi dört saat otuz yedi dakika; yılı ise altı yüz seksen yedi gün sürer.',
        cues: [
          compare(1, 'earth'),
          // the volcano marked from orbit, then a glide down to a telephoto "postcard" of it
          // standing over the horizon; the next pin waits a little so the view can be enjoyed
          uncompare(2), pin(2, 'mars', 18.65, -133.8, 'Olympus Mons', { approach: false }),
          { at: 2, action: 'postcard', ref: 'mars', lat: 18.65, lon: -133.8, relief: 'olympus', peak: 22, scale: 3, dist: 380, alt: 2.5, fov: 30, seconds: 9 },
          card(2, { image: 'olympus.jpg', source: 'NASA/JPL/USGS', title: 'Olympus Mons', text: 'Tabanı Fransa kadar geniş; yamaçları o kadar yumuşak ki tepesinden ufku göremezsiniz. Kartpostal görünümünde yükseklik üç kat abartılı.' }),
          { ...pin(3, 'mars', -13.9, -59.2, 'Valles Marineris'), delay: 3 },
          { ...card(3, { image: 'valles.jpg', source: 'NASA/JPL/USGS', title: 'Valles Marineris', text: 'Yer yer yedi kilometre derinliğinde; Büyük Kanyon\'un on katı.' }), delay: 3 },
          unpin(4), ret(4),
          card(4, { image: 'perseverance.jpg', source: 'NASA/JPL-Caltech/ASU/MSSS', title: 'Perseverance ve Ingenuity', text: 'Jezero Krateri, Haziran 2021.' }),
          uncard(5), overview(5, 'mars'), rate(5, 6e6),
        ], dwell: 6 },

      { id: 'jupiter', target: body('jupiter'),
        // 0 king · 1 Earth comparison · 2 bands · 3 Great Red Spot pin · 4 ten-hour day · 5 moons / Galileo
        text: 'Jüpiter, gezegenlerin kralı: kütlesi diğer tüm gezegenlerin toplamının iki buçuk katıdır. Yanına gerçek ölçekli bir Dünya koyduğumuzda fark çarpıcıdır: içine bin üç yüz Dünya sığar. Yüzeyi yoktur; gördüğünüz renkli şeritler, hidrojen ve helyum atmosferindeki dev bulut kuşaklarıdır. Büyük Kırmızı Leke, en az üç yüz elli yıldır süren ve Dünya\'dan daha büyük bir fırtınadır. Bu devin günü yalnızca on saat sürer; şu anda bir Jüpiter gününü hızlandırılmış izliyorsunuz. Etrafında bilinen doksan beşten fazla ay döner; dördünü bin altı yüz onda Galileo, küçük teleskobuyla keşfetti.',
        cues: [
          compare(1, 'earth'),
          card(1, { big: '1.300 Dünya', title: 'Jüpiter\'in hacmine sığar', text: 'Kütlesi ise üç yüz on sekiz Dünya kadardır.' }),
          uncompare(2), uncard(2),
          pin(3, 'jupiter', -22, 20, 'Büyük Kırmızı Leke', { storm: true }),
          card(3, { image: 'grs.jpg', source: 'NASA/JPL-Caltech/SwRI/MSSS', title: 'Büyük Kırmızı Leke', text: 'Juno, Temmuz 2017; genişliği on altı bin kilometre.' }),
          unpin(4), ret(4), rate(4, 3600), uncard(4),
          card(5, { image: 'galileo.jpg', source: 'Justus Sustermans, 1636', title: 'Galileo Galilei', text: 'Dört büyük ayı Ocak 1610\'da keşfetti; bugün onlara Galileo ayları diyoruz.' }),
        ], dwell: 5 },

      { id: 'saturn', target: body('saturn'),
        // 0 elegant · 1 rings width · 2 edge-on (vantage) · 3 density · 4 hexagon pin · 5 Cassini
        text: 'Satürn, hiç şüphesiz Güneş Sistemi\'nin en zarif gezegeni. Halkaları çoğunlukla su buzundan oluşur ve genişlikleri iki yüz seksen bin kilometreyi bulur. Ama tam kenarından baktığımızda neredeyse kaybolurlar: kalınlıkları çoğu yerde yalnızca on metre kadardır. Gezegenin kendisi o kadar hafiftir ki yeterince büyük bir okyanusa koysanız yüzerdi. Kuzey kutbunda, her kenarı Dünya kadar olan gizemli bir altıgen fırtına döner. Cassini aracı on üç yıl boyunca bu sistemi inceledi ve iki bin on yedide görevini gezegenin atmosferine dalarak tamamladı.',
        cues: [
          // the approach shows the whole planet first; then over its shoulder, the rings sweeping
          // away, the clock a little faster; then far out, exactly edge-on
          { at: 1, delay: 1, action: 'limb', elev: 12, az: 30, dist: 1.6, aimR: 1.9, aimAz: 80, seconds: 5 }, rate(1, 900),
          vantage(2, 0.3, 70, 9),
          card(2, { image: 'rings_edge.jpg', source: SSI, title: 'Halkalar kenardan', text: 'Cassini\'nin halka düzleminden çektiği görüntü: iki yüz seksen bin kilometre genişlik, on metre kalınlık.' }),
          ret(3), uncard(3), rate(3, 1),
          pin(4, 'saturn', 89, 0, 'Kuzey kutbu altıgeni'),
          card(4, { image: 'hexagon.jpg', source: SSI, title: 'Altıgen', text: 'Her kenarı yaklaşık on dört bin beş yüz kilometre; Cassini, kızılötesi.' }),
          unpin(5), ret(5),
          card(5, { image: 'cassini.jpg', source: SSI, title: 'Dünya\'nın gülümsediği gün', text: 'Cassini, Satürn\'ün gölgesinden geriye baktı; halkaların altındaki mavi nokta Dünya. 19 Temmuz 2013.' }),
        ], dwell: 5 },

      { id: 'uranus', target: body('uranus'),
        // 0 tilt · 1 84-year roll (overview) · 2 42-year seasons · 3 colour & rings (back) · 4 Herschel · 5 Webb
        text: 'Uranüs, yan yatmış gezegen: ekseni doksan sekiz derece eğiktir. Yani Güneş\'in etrafında adeta yuvarlanarak döner; seksen dört yıllık bir turunu yukarıdan izleyelim. Bu yüzden kutupları kırk iki yıl boyunca gündüz, kırk iki yıl boyunca gece yaşar. Metan gazı kırmızı ışığı soğurduğu için mavi-yeşil görünür ve onun da ince, koyu halkaları vardır. Bin yedi yüz seksen birde William Herschel\'in teleskopla keşfettiği ilk gezegendir; yakından yalnızca Voyager İki gördü. James Webb Teleskobu ise iki bin yirmi üçte halkalarını ve kutup başlığını bu netlikte görüntüledi.',
        cues: [
          overview(1, 'uranus'), rate(1, 3e8),
          ret(3), rate(3, 1),
          card(4, { image: 'herschel.jpg', source: 'Lemuel Francis Abbott, 1785', title: 'William Herschel', text: 'Uranüs\'ü 13 Mart 1781\'de Bath\'taki bahçesinden, kendi yaptığı teleskopla buldu.' }),
          card(5, { image: 'uranus.jpg', source: WEBB, title: 'Webb\'in gözüyle Uranüs', text: 'Kızılötesi: halkalar, kutup başlığı ve fırtınalar, 2023.' }),
        ], dwell: 5 },

      { id: 'neptune', target: body('neptune'),
        // 0 on paper · 1 1846 (overview) · 2 165 years · 3 winds (back) · 4 Voyager 2 dark spot · 5 Triton (overview)
        text: 'Neptün, Güneş\'ten en uzak gezegen; teleskopla değil, kâğıt üzerinde keşfedildi. Uranüs\'ün yörüngesindeki sapmaları inceleyen matematikçiler yerini hesapladı ve bin sekiz yüz kırk altıda tam orada bulundu. Güneş etrafındaki bir turu yüz altmış beş yıl sürer; keşfinden bu yana yalnızca bir tur tamamladı. Rüzgârları saatte iki bin yüz kilometreyi aşar; bunlar Güneş Sistemi\'ndeki en hızlı rüzgârlardır. Voyager İki bin dokuz yüz seksen dokuzda yanından geçtiğinde Dünya büyüklüğünde bir fırtına gördü: Büyük Karanlık Leke. Büyük ayı Triton ters yönde döner; muhtemelen yakalanmış bir Kuiper Kuşağı cismidir ve bir gün parçalanıp bir halkaya dönüşecek.',
        cues: [
          overview(1, 'neptune'), rate(1, 5e8),
          ret(3), rate(3, 1),
          card(4, { image: 'neptune.jpg', source: JPL, title: 'Voyager 2, Ağustos 1989', text: 'Büyük Karanlık Leke birkaç yıl içinde kayboldu; Hubble o zamandan beri yenilerini gördü.' }),
          uncard(5), overview(5, 'triton'), rate(5, 6e4),
        ], dwell: 6 },

      { id: 'pluto', target: body('pluto'),
        // 0 intro · 1 Moon comparison · 2 New Horizons · 3 heart & mountains · 4 Charon barycentre (overview) · 5 farewell
        text: 'Son durağımız Plüton; bin dokuz yüz otuzda keşfedildi ve iki bin altıya kadar dokuzuncu gezegen sayıldı. Aslında Ay\'ımızdan bile küçüktür: yan yana koyduğumuzda bu açıkça görülür. İki bin on beşte New Horizons yanından geçene kadar bulanık bir noktadan ibaretti. Araç, yüzeyinde dev bir kalp şekli, azot buzulları ve su buzundan dağlar buldu; yüzey sıcaklığı eksi iki yüz otuz derecedir. Uydusu Charon o kadar büyüktür ki ikisi birlikte, aralarındaki boşlukta kalan ortak bir kütle merkezi etrafında döner. Güneş Sistemi turumuz burada bitiyor; iyi yolculuklar.',
        cues: [
          compare(1, 'moon'),
          uncompare(2),
          card(2, { image: 'pluto.jpg', source: NH, title: 'Plüton, 14 Temmuz 2015', text: 'Kalp biçimli Tombaugh Regio, azot buzuyla kaplı bir ova.' }),
          card(4, { image: 'charon.jpg', source: NH, title: 'Plüton ve Charon', text: 'İkili bir gezegen: Charon, Plüton\'un yarısı çapında.' }),
          overview(4, 'charon'), rate(4, 6e4),
        ], dwell: 6 },
    ],
  },

  {
    id: 'mars',
    title: 'Mars ve Robotları',
    summary: 'Kızıl Gezegen, iki küçük ayı ve yüzeyinde dolaşan keşif araçları; işaretli yüzey şekilleri ve robotların fotoğraflarıyla.',
    steps: [
      { id: 'mars', target: body('mars'),
        // 0 welcome · 1 day (fast spin) · 2 atmosphere · 3 Hellas pin · 4 polar cap pin · 5 rivers
        text: 'Mars turuna hoş geldiniz; Kızıl Gezegen, insanlığın en çok araç gönderdiği dünya. Günü Dünya\'nınkine çok benzer, yirmi dört saat otuz yedi dakika; şu anda bir Mars gününü hızlandırılmış izliyorsunuz. Atmosferi çok incedir ve neredeyse tamamen karbondioksitten oluşur; ortalama sıcaklık eksi altmış derecedir. Güney yarım küredeki Hellas Havzası, iki bin üç yüz kilometre genişliğinde ve dokuz kilometre derinliğindeki en büyük çarpma izidir. Kutuplarında su buzu ve kuru buzdan başlıklar vardır; kışın atmosferin dörtte biri kutupta donar. Yüzeyindeki kurumuş nehir yatakları ve eski göl tabanları, Mars\'ın bir zamanlar çok farklı olduğunu fısıldar.',
        cues: [
          rate(1, 3600),
          rate(3, 1), pin(3, 'mars', -42.4, 70.5, 'Hellas Havzası'),
          pin(4, 'mars', 86, 0, 'Kuzey kutup başlığı'),
          unpin(5), ret(5),
        ], dwell: 2 },

      { id: 'phobos', target: body('phobos'),
        // 0 potato (photo) · 1 closest orbit · 2 7h39 orbit (overview) · 3 rises in the west · 4 falling (back) · 5 Stickney
        text: 'Mars\'ın iki küçük ayından büyüğü Phobos: yalnızca yirmi iki kilometre genişliğinde, patates biçimli bir kaya. Gezegene altı bin kilometre uzaklıkta döner; bu, Güneş Sistemi\'ndeki en yakın ay yörüngesidir. O kadar hızlıdır ki Mars\'ın etrafını yedi saat otuz dokuz dakikada dolaşır; işte o tur, yukarıdan ve hızlandırılmış. Mars yüzeyinden bakıldığında batıdan doğar ve dört saat sonra doğudan batar. Her yüzyıl iki metre alçalıyor; yaklaşık elli milyon yıl içinde ya Mars\'a çarpacak ya da parçalanıp bir halkaya dönüşecek. Dev Stickney Krateri, dokuz kilometre genişliğiyle ayın neredeyse yarısını kaplar.',
        cues: [
          card(0, { image: 'phobos.jpg', source: 'NASA/JPL-Caltech/University of Arizona', title: 'Phobos', text: 'Mars Reconnaissance Orbiter, 2008; sağdaki büyük çukur Stickney Krateri.' }),
          uncard(2), overview(2, 'phobos'), rate(2, 3000),
          ret(4), rate(4, 1),
        ], dwell: 3 },

      { id: 'deimos', target: body('deimos'),
        // 0 small · 1 30-hour orbit (overview) · 2 smooth · 3 origin (back) · 4 MMX
        text: 'Deimos, Mars\'ın daha küçük ve daha uzak ayı: çapı yaklaşık on iki kilometredir. Gezegenin etrafını otuz saatte dolaşır; Mars yüzeyinden bakıldığında parlak bir yıldızdan farksızdır. Yüzeyi Phobos\'a göre daha pürüzsüzdür, çünkü kraterleri kalın bir toz tabakasıyla dolmuştur. Her iki ayın da yakalanmış asteroitler mi yoksa dev bir çarpışmanın kalıntıları mı olduğu hâlâ tartışılıyor. Japonya\'nın MMX görevi bu soruyu yanıtlamak için Phobos\'tan örnek alıp Dünya\'ya getirecek.',
        cues: [
          overview(1, 'deimos'), rate(1, 1.2e4),
          ret(3), rate(3, 1),
        ], dwell: 2 },

      { id: 'curiosity', target: body('curiosity'),
        text: 'Şimdi yüzeye iniyoruz: karşınızda Curiosity, bir ton ağırlığında, araba büyüklüğünde bir robot. İki bin on iki Ağustos\'unda Gale Krateri\'ne bir gökyüzü vinciyle, halatlarla sarkıtılarak indi. Enerjisini plütonyumun ısısından üretir, bu yüzden toz fırtınalarından etkilenmez. Krater tabanında eskiden milyonlarca yıl süren bir göl olduğunu kanıtladı ve yaşam için gereken kimyasal bileşenleri buldu. On yılı aşkın süredir Sharp Dağı\'nın yamaçlarını tırmanarak Mars\'ın iklim tarihini katman katman okuyor.',
        // 0 approach: low over the ground, Mont Mercou's cliff behind · 4 the far side, Mount Sharp rising
        cues: [
          vantage(0, 8, 40, 5),
          card(0, { image: 'curiosity.jpg', source: 'NASA/JPL-Caltech/MSSS', title: 'Curiosity\'nin öz çekimi', text: 'Buckskin kaya örneği alanı, Sharp Dağı\'nın eteği, 2015.' }),
          vantage(4, 12, 215, 8, undefined, 5),
        ], dwell: 2 },

      { id: 'perseverance', target: body('perseverance'),
        text: 'Ve Perseverance, Mars\'taki en gelişmiş robot; iki bin yirmi bir Şubat\'ında Jezero Krateri\'ne indi. Burası üç buçuk milyar yıl önce bir nehrin göle döküldüğü eski bir delta. Görevi, geçmiş mikrobik yaşamın izlerini aramak ve kaya örneklerini titanyum tüplere doldurarak gelecekteki bir görevin Dünya\'ya getirmesi için bırakmak. Yanında getirdiği küçük helikopter Ingenuity, başka bir gezegende uçan ilk araç oldu ve planlanan beş uçuş yerine yetmiş iki uçuş gerçekleştirdi. MOXIE deneyi ise Mars havasından oksijen üreterek gelecekteki astronotlar için yolu açtı.',
        // 0 approach: wheel height, Jezero's boulder field all around · 4 drift to the other flank
        cues: [
          vantage(0, 7, 230, 5),
          card(3, { image: 'perseverance.jpg', source: 'NASA/JPL-Caltech/ASU/MSSS', title: 'Ingenuity', text: 'Perseverance\'ın kamerasından, Haziran 2021; bir kilo sekiz yüz gramlık helikopter.' }),
          vantage(4, 15, 60, 9, undefined, 5),
        ], dwell: 2 },

      { id: 'finale', target: body('mars'),
        // 0 look back · 1 fleet (moons overview) · 2 findings · 3 lost field (back) · 4 farewell
        text: 'Mars\'tan ayrılmadan önce bir kez daha geriye bakalım. Bugün yörüngesinde ve yüzeyinde bir düzineye yakın aktif araç çalışıyor. Bulgular tutarlı: Mars bir zamanlar ılık, nemli ve belki de yaşanabilir bir dünyaydı. Manyetik alanını kaybedince Güneş rüzgârı atmosferini uzaya süpürdü ve gezegen soğuk bir çöle dönüştü. Yine de insanlığın bir gün ayak basacağı ilk gezegen büyük olasılıkla burası olacak; Mars turumuz sona erdi.',
        cues: [
          overview(1, 'deimos'), rate(1, 1.2e4),
          ret(3), rate(3, 1),
        ], dwell: 3 },
    ],
  },

  {
    id: 'jupiter',
    title: 'Jüpiter ve Ayları',
    summary: 'Dev gezegen, dört Galileo ayı ve kutuplarının üzerinde dönen Juno; yörüngeler yukarıdan, aylar gerçek ölçekte.',
    steps: [
      { id: 'jupiter', target: body('jupiter'),
        // 0 welcome · 1 moons (overview) · 2 resonance · 3 size (Earth beside) · 4 Galileo · 5 onwards
        text: 'Jüpiter sistemine hoş geldiniz; bu dev, neredeyse küçük bir güneş sistemi gibidir. Etrafında doksan beşten fazla ay döner; dört büyüğünün yörüngelerini yukarıdan izleyelim. Io iki günde, Europa üç buçuk günde, Ganymede yedi günde, Callisto ise on yedi günde bir tur atar; iç üçü birbirine kilitlidir, Io dört tur attığında Europa iki, Ganymede bir tur atar. Gezegen o kadar büyüktür ki içine bin üç yüz Dünya sığar ve manyetik alanı Güneş Sistemi\'ndeki en büyük yapıdır. Bin altı yüz onda Galileo bu dört ayı küçük teleskobuyla keşfetti; her şeyin Dünya\'nın etrafında dönmediğinin ilk kanıtıydı. Şimdi o dört ayı sırayla ziyaret edeceğiz.',
        cues: [
          overview(1, 'callisto'), rate(1, 2e5),
          ret(3), rate(3, 1200), compare(3, 'earth'),
          card(3, { big: '1.300 Dünya', title: 'Jüpiter\'in hacmine sığar', text: 'Manyetik alanı gökyüzünde görülebilseydi dolunaydan büyük görünürdü.' }),
          uncompare(4),
          card(4, { image: 'galileo.jpg', source: 'Justus Sustermans, 1636', title: 'Galileo Galilei', text: 'Ocak 1610: Jüpiter\'in yanında dört küçük yıldız, her gece farklı yerde.' }),
        ], timeRate: 1200, dwell: 3 },

      { id: 'io', target: body('io'),
        // 0 volcanic (photo) · 1 tidal heating · 2 Loki pin · 3 sulphur (back) · 4 no craters
        text: 'Io, Güneş Sistemi\'nin en volkanik dünyası. Jüpiter ile diğer ayların kütle çekimi arasında sürekli ezilip gerilir; bu gelgit ısınması iç kısmını eritir. Yüzeyinde dört yüzden fazla aktif yanardağ vardır ve bazıları lavı yüzlerce kilometre yükseğe fırlatır; en büyüğü Loki Patera, iki yüz kilometre genişliğinde bir lav gölüdür. Sarı, turuncu ve kırmızı renkler kükürt ve kükürt bileşiklerinden gelir. Yüzeyi o kadar hızlı yenilenir ki üzerinde neredeyse hiç çarpma krateri yoktur.',
        cues: [
          card(0, { image: 'io.jpg', source: 'NASA/JPL/University of Arizona', title: 'Io', text: 'Galileo aracından, 1999; koyu lekeler aktif yanardağlar.' }),
          uncard(2), pin(2, 'io', 13, -51.2, 'Loki Patera'),
          unpin(3), ret(3),
        ], timeRate: 1200, dwell: 2 },

      { id: 'europa', target: body('europa'),
        // 0 promise · 1 Moon comparison · 2 brown lines (photo) · 3 Clipper
        text: 'Europa, yaşam arayışının en umut verici adresi. Ay\'ımızdan biraz küçüktür; ama pürüzsüz buz kabuğunun altında, Dünya\'daki tüm okyanusların iki katı kadar su barındıran küresel bir okyanus bulunduğu düşünülüyor. Yüzeydeki kahverengi çizgiler, buzun çatlayıp alttaki suyun yukarı sızdığı yerlerdir. NASA\'nın Europa Clipper aracı iki bin yirmi dörtte fırlatıldı ve iki bin otuzda yaklaşık elli yakın geçişle bu okyanusun yaşanabilir olup olmadığını araştıracak.',
        cues: [
          compare(1, 'moon'),
          uncompare(2),
          card(2, { image: 'europa.jpg', source: 'NASA/JPL-Caltech/SETI Institute', title: 'Europa', text: 'Galileo mozaiği, gerçeğe yakın renk; çizgiler binlerce kilometre uzanır.' }),
          card(3, { image: 'europaclipper.jpg', source: JPLC, title: 'Europa Clipper', text: 'Güneş panelleri açıkken bir basketbol sahasından uzun; NASA\'nın en büyük gezegen aracı.' }),
        ], timeRate: 1200, dwell: 3 },

      { id: 'ganymede', target: body('ganymede'),
        // 0 largest · 1 bigger than Mercury (comparison) · 2 magnetic field · 3 two terrains (photo) · 4 ocean / JUICE
        text: 'Ganymede, Güneş Sistemi\'nin en büyük ayı. Merkür gezegeninden bile büyüktür; yan yana koyduğumuzda bunu görebilirsiniz. Kendi manyetik alanına sahip bilinen tek aydır; bu alan Jüpiter\'inkinin içinde küçük bir kabarcık oluşturur ve kutuplarında auroralar yaratır. Yüzeyi iki farklı yaştadır: koyu, kraterli eski bölgeler ve açık renkli, oluklu daha genç bölgeler. Buz kabuğunun altında onun da bir okyanusu var; Avrupa Uzay Ajansı\'nın JUICE aracı iki bin otuz birde yörüngesine girecek.',
        cues: [
          compare(1, 'mercury'),
          uncompare(3),
          card(3, { image: 'ganymede.jpg', source: 'NASA/JPL-Caltech/SwRI/MSSS', title: 'Ganymede', text: 'Juno, Haziran 2021: yirmi yıl sonraki ilk yakın geçiş.' }),
          card(4, { image: 'juice.jpg', source: ESA, title: 'JUICE', text: 'Jüpiter\'in buzlu aylarını inceleyecek Avrupa aracı; 2023\'te fırlatıldı.' }),
        ], timeRate: 1200, dwell: 3 },

      { id: 'callisto', target: body('callisto'),
        text: 'Callisto, dört Galileo ayının en dıştakisi ve en sessizi. Yüzeyi Güneş Sistemi\'ndeki en yoğun kraterli yüzeydir; dört milyar yıldır neredeyse hiç değişmemiştir. Jüpiter\'den uzak olduğu için gelgit ısınmasından etkilenmez ve radyasyon kuşaklarının dışında kalır. Bu da onu gelecekte insanlı bir üs için en güvenli aday yapar; altında da bir okyanus bulunabileceğine dair ipuçları var.',
        cues: [
          card(1, { image: 'callisto.jpg', source: 'NASA/JPL/DLR', title: 'Callisto', text: 'Galileo, 2001; Güneş Sistemi\'nin en eski yüzeyi.' }),
        ], timeRate: 1200, dwell: 2 },

      { id: 'juno', target: body('juno'),
        // 0 arrival (photo) · 1 solar panels · 2 polar orbit (overview) · 3 cyclones · 4 core (back)
        text: 'Son olarak Juno\'ya bakalım: bu NASA aracı iki bin on altı Temmuz\'unda Jüpiter\'in yörüngesine girdi. Güneş\'ten bu kadar uzakta güneş enerjisiyle çalışan ilk araçtır; üç dev paneli bir basketbol sahası kadar yer kaplar. Radyasyondan korunmak için kutuplar üzerinden geçen uzun, eliptik bir yörüngede döner; işte o yörünge, hızlandırılmış. Her geçişte bulutların birkaç bin kilometre üzerinden geçer ve Jüpiter\'in kutuplarında dev siklonlar keşfetti. Çekirdeğinin sanıldığından daha büyük ve dağınık olduğunu gösterdi; Jüpiter turumuz burada sona eriyor.',
        cues: [
          card(0, { image: 'juno.jpg', source: JPLC, title: 'Juno', text: 'Sanatçı çizimi: Juno, Jüpiter\'in kutbunun üzerinde.' }),
          uncard(2), overview(2, 'juno'), rate(2, 5e5),
          ret(4), rate(4, 1),
        ], dwell: 3 },
    ],
  },

  {
    id: 'saturn',
    title: 'Satürn: Halkaların Efendisi',
    summary: 'Halkalar kenardan ve yukarıdan, kalın atmosferli Titan, gayzerleriyle Enceladus ve iki tuhaf ay.',
    steps: [
      { id: 'saturn', target: body('saturn'),
        // 0 welcome · 1 Earth comparison · 2 density · 3 winds & day (fast spin) · 4 Cassini
        text: 'Satürn turuna hoş geldiniz: Güneş\'ten altıncı gezegen, çapıyla Dünya\'nın dokuz katı büyüklüğünde bir gaz devi. Yanına gerçek ölçekli bir Dünya koyduğumuzda, halkaların bile ne kadar geniş olduğu ortaya çıkar. Yoğunluğu sudan düşüktür; bu, bir gezegen için benzersizdir. Ekvatorunda rüzgârlar saatte bin sekiz yüz kilometreye ulaşır ve günü yalnızca on buçuk saat sürer. Cassini aracı iki bin dörtten iki bin on yediye kadar on üç yıl boyunca bu sistemi inceledi ve görevini gezegenin atmosferine dalarak tamamladı.',
        cues: [
          compare(1, 'earth'),
          uncompare(3), rate(3, 3600),
          rate(4, 600),
          card(4, { image: 'cassini.jpg', source: SSI, title: 'Dünya\'nın gülümsediği gün', text: 'Cassini, Satürn\'ün gölgesinden geriye baktı; halkaların altındaki mavi nokta Dünya. 19 Temmuz 2013.' }),
        ], timeRate: 600, dwell: 4 },

      { id: 'rings', target: body('saturn'),
        // 0 billions of pieces · 1 edge-on (vantage) · 2 paper · 3 Cassini Division (back above) · 4 young & raining
        text: 'Şimdi halkalara daha yakından bakalım: bu dev disk aslında tek bir yapı değil, mikroskobik tozdan ev büyüklüğüne kadar milyarlarca buz parçasından oluşur. Genişliği iki yüz seksen bin kilometreyi aşar ama kenarından bakınca neredeyse yok olur: kalınlığı çoğu yerde on metreden azdır. Ölçekli bir kâğıt yaprağından bile incedir. Aradaki en büyük boşluk olan Cassini Bölümü\'nü küçük ay Mimas\'ın kütle çekimi açar. Halkalar muhtemelen yalnızca birkaç yüz milyon yaşında ve yavaş yavaş gezegene yağıyorlar; yüz milyon yıl içinde kaybolabilirler.',
        cues: [
          vantage(1, 0.4, 60, 4.2),
          card(1, { image: 'rings_edge.jpg', source: SSI, title: 'Halkalar kenardan', text: 'Cassini, halka düzleminden: kalınlık on metre, genişlik iki yüz seksen bin kilometre.' }),
          vantage(3, 38, 35, 3.2), uncard(3),
        ], orbitRate: 0.09, timeRate: 600, dwell: 4 },

      { id: 'titan', target: body('titan'),
        // 0 intro · 1 Moon comparison · 2 strip the haze · 3 Huygens (haze back) · 4 Dragonfly
        text: 'Titan, Satürn\'ün en büyük ayı ve Güneş Sistemi\'nde kalın bir atmosferi olan tek ay. Ay\'ımızdan bir buçuk kat büyüktür; azot ağırlıklı atmosferi Dünya\'nınkinden yüzde elli daha yoğundur ve turuncu bir pusla yüzeyi gizler. Pusun altına bakalım: yüzeyinde sıvı metan ve etandan göller, nehirler ve yağmurlar vardır; eksi yüz seksen derecede su kaya kadar serttir. İki bin beşte Huygens sondası yüzeyine indi ve buz çakıllarıyla kaplı bir nehir yatağı fotoğrafladı. NASA\'nın Dragonfly adlı nükleer enerjili dronu iki bin otuz dörtte buraya ulaşıp kum tepelerinin üzerinde uçacak.',
        cues: [
          compare(1, 'moon'),
          uncompare(2), clouds(2, false),
          card(2, { image: 'titan.jpg', source: 'NASA/JPL/University of Arizona/University of Idaho', title: 'Pusun altındaki Titan', text: 'Cassini, kızılötesi; koyu alanlar kum tepeleri.' }),
          clouds(3, true),
          card(3, { image: 'huygens.jpg', source: 'ESA/NASA/JPL/University of Arizona', title: 'Titan\'ın yüzeyi', text: 'Huygens, 14 Ocak 2005: dış Güneş Sistemi\'nde bir yüzeyden çekilen ilk fotoğraf.' }),
          card(4, { image: 'dragonfly.jpg', source: 'NASA/JHUAPL', title: 'Dragonfly', text: 'Sekiz rotorlu, nükleer pilli dron; 2028\'de fırlatılacak.' }),
        ], timeRate: 600, dwell: 3 },

      { id: 'enceladus', target: body('enceladus'),
        // 0 small · 1 tiger stripes pin · 2 Cassini flew through · 3 E ring / 33-hour orbit (overview) · 4 white
        text: 'Enceladus yalnızca beş yüz kilometre çapında ama Güneş Sistemi\'nin en ilgi çekici dünyalarından biri. Güney kutbundaki kaplan çizgisi denilen dört çatlaktan yüzlerce gayzer, su buharı ve buz kristallerini uzaya püskürtür. Cassini bu fıskiyelerin içinden uçtu ve tuz, organik moleküller ve hidrojen buldu; tam da yaşam için gereken malzemeler. Bu buz taneleri Satürn\'ün E halkasını besler; Enceladus, Satürn\'ün etrafını otuz üç saatte dolaşır. Yüzeyi taze kar gibi bembeyazdır ve Güneş ışığının neredeyse tamamını yansıtır.',
        cues: [
          pin(1, 'enceladus', -82, 0, 'Kaplan çizgileri'),
          card(1, { image: 'enceladus.jpg', source: 'NASA/JPL/SSI', title: 'Gayzerler', text: 'Cassini, arkadan aydınlatılmış: güney kutbundan fışkıran buz, 2009.' }),
          unpin(3), uncard(3), overview(3, 'enceladus'), rate(3, 1.3e4),
        ], timeRate: 600, dwell: 4 },

      { id: 'mimas', target: body('mimas'),
        // 0 Death Star (Herschel pin) · 1 size · 2 near shattering (photo) · 3 ocean (back)
        text: 'Mimas\'ı gördüğünüz anda tanırsınız: dev Herschel Krateri ona Yıldız Savaşları\'ndaki Ölüm Yıldızı\'nın görünümünü verir. Krater yüz otuz kilometre genişliğindedir; yani ayın çapının üçte biri. Bu çarpışma biraz daha şiddetli olsaydı Mimas paramparça olurdu. İki bin yirmi dörtte yörüngesindeki küçük sallantılar incelendiğinde şaşırtıcı bir sonuç çıktı: bu donmuş görünen küçük ayın buz kabuğunun altında genç bir okyanus olabilir.',
        cues: [
          pin(0, 'mimas', -1.4, -111.8, 'Herschel Krateri'),
          card(2, { image: 'mimas.jpg', source: SSI, title: 'Mimas', text: 'Cassini, Şubat 2010; kraterin ortasındaki tepe Everest kadar yüksek.' }),
          unpin(3), ret(3),
        ], timeRate: 600, dwell: 2 },

      { id: 'iapetus', target: body('iapetus'),
        // 0 two-tone (photo) · 1 dust sweeping · 2 ridge pin · 3 distant orbit (overview) · 4 farewell
        text: 'Son durağımız Iapetus, Güneş Sistemi\'nin en tuhaf aylarından biri: bir yarısı kar kadar beyaz, diğer yarısı kömür kadar kara. Yörüngesinde hep aynı yüzü öne baktığı için dış halkalardan gelen koyu tozu süpürür; ısınan koyu bölgelerden buz buharlaşıp parlak tarafa yağar. Ekvatorunun tam ortasında on üç kilometre yüksekliğinde, bin üç yüz kilometre uzunluğunda bir dağ sırtı uzanır; bu da ona ceviz görünümü verir. Satürn\'den üç buçuk milyon kilometre uzakta, yetmiş dokuz günde bir tur atar; halkaları yukarıdan görebilen tek büyük ay odur. Satürn turumuz sona erdi.',
        cues: [
          card(0, { image: 'iapetus.jpg', source: SSI, title: 'Iapetus', text: 'Cassini, Eylül 2007: iki renkli yüzey ve ekvator sırtı.' }),
          uncard(2), pin(2, 'iapetus', 0, -90, 'Ekvator sırtı'),
          unpin(3), overview(3, 'iapetus'), rate(3, 8e5),
        ], timeRate: 600, dwell: 4 },
    ],
  },

  {
    id: 'explorers',
    title: 'İnsanlığın Elçileri',
    summary: 'Dünya yörüngesinden yıldızlararası uzaya: ISS, Hubble, JWST, Parker, New Horizons ve Voyager\'lar; yörüngeleri ve fotoğraflarıyla.',
    steps: [
      { id: 'iss', target: body('iss'),
        // 0 welcome · 1 90-minute orbit (overview) · 2 sixteen sunrises · 3 size (back, photo) · 4 since 2000
        text: 'İnsanlığın uzaydaki elçilerini ziyaret edeceğimiz bu tura Dünya yörüngesinden başlıyoruz: karşınızda Uluslararası Uzay İstasyonu. Dört yüz kilometre yükseklikte, saatte yirmi sekiz bin kilometre hızla döner ve Dünya\'nın etrafını doksan dakikada tamamlar; işte o tur, hızlandırılmış. Astronotlar günde on altı gün doğumu görür. Bir futbol sahası büyüklüğünde ve dört yüz yirmi ton ağırlığındadır. İki bin Kasım\'ından beri üzerinde kesintisiz insan yaşıyor; bu, insanlığın uzaydaki en uzun sürekli varlığıdır.',
        cues: [
          overview(1, 'iss'), rate(1, 600),
          ret(3), rate(3, 30),
          card(3, { image: 'iss.jpg', source: NASA, title: 'Uluslararası Uzay İstasyonu', text: 'Crew Dragon\'dan çekilen fotoğraf, Kasım 2021.' }),
        ], timeRate: 30, dwell: 3 },

      { id: 'hubble', target: body('hubble'),
        // 0 since 1990 (photo) · 1 mirror · 2 blurry fix · 3 deep field
        text: 'Hubble Uzay Teleskobu, bin dokuz yüz doksandan beri evrene bakışımızı değiştiriyor. Beş yüz kırk kilometre yükseklikte döner ve iki virgül dört metrelik aynasıyla atmosferin bulanıklığından kurtulmuş görüntüler alır. İlk görüntüleri bulanıktı; aynasındaki ufak bir kusur bin dokuz yüz doksan üçte astronotlar tarafından yörüngede düzeltildi. Evrenin yaşını ölçtü, karanlık enerjinin keşfine katkı sağladı ve Derin Alan görüntüleriyle gökyüzünün boş görünen bir noktasında binlerce galaksi gösterdi.',
        cues: [
          card(0, { image: 'hubble.jpg', source: NASA, title: 'Hubble', text: 'Uzay mekiğinden, bakım görevi sonrası, 1997.' }),
          card(3, { image: 'deepfield.jpg', source: 'NASA/ESA/G. Illingworth (UCSC)', title: 'Hubble Aşırı Derin Alan', text: 'Dolunayın onda biri kadar bir gök parçasında beş bin beş yüz galaksi.' }),
        ], timeRate: 30, dwell: 4 },

      { id: 'jwst', target: body('jwst'),
        // 0 L2 · 1 mirror (photo) · 2 sunshield · 3 science (Tarantula)
        text: 'James Webb Uzay Teleskobu, Dünya\'dan bir buçuk milyon kilometre uzakta, Güneş\'in ters tarafındaki Lagrange iki noktasının etrafında döner. Altı buçuk metrelik altın kaplı aynası on sekiz altıgen parçadan oluşur ve fırlatıldığı iki bin yirmi bir Noel\'inde katlanmış hâldeydi. Kızılötesi ışıkta gördüğü için tenis kortu büyüklüğündeki güneş kalkanıyla eksi iki yüz otuz üç dereceye soğutulur. Evrenin ilk galaksilerini, yıldızların doğduğu toz bulutlarının içini ve ötegezegenlerin atmosferlerini inceliyor.',
        cues: [
          card(1, { image: 'jwst.jpg', source: 'NASA/Chris Gunn', title: 'Webb\'in aynası', text: 'On sekiz berilyum parça, altın kaplama; Goddard, 2016.' }),
          card(3, { image: 'tarantula.jpg', source: WEBB, title: 'Tarantula Bulutsusu', text: 'Webb\'in kızılötesi gözüyle bir yıldız doğumevi, 2022.' }),
        ], dwell: 3 },

      { id: 'parker', target: body('parker'),
        // 0 touching the Sun · 1 Venus flybys (orbit overview) · 2 record · 3 heat shield (back, photo) · 4 corona puzzle
        text: 'Parker Güneş Sondası, Güneş\'e dokunan ilk araç. İki bin on sekizde fırlatıldı ve Venüs\'ün kütle çekimini kullanarak yörüngesini adım adım daralttı; yörüngesini yukarıdan izleyelim. İki bin yirmi dört Aralık\'ında Güneş yüzeyine altı milyon dokuz yüz bin kilometre yaklaştı; bu sırada saatte altı yüz doksan bin kilometreyle insan yapımı en hızlı nesne oldu. On bir santimetrelik karbon kalkanı bin dört yüz dereceye dayanırken arkasındaki aletler oda sıcaklığında kalır. Amacı, Güneş\'in dış atmosferinin yüzeyinden neden yüzlerce kat sıcak olduğunu çözmek.',
        cues: [
          overview(1, 'parker'), rate(1, 1e6),
          ret(3), rate(3, 1),
          card(3, { image: 'parker.jpg', source: 'NASA/Johns Hopkins APL', title: 'Parker Solar Probe', text: 'Karbon kalkanı önde: on bir santimetre, bin dört yüz derece.' }),
        ], dwell: 3 },

      { id: 'newhorizons', target: body('newhorizons'),
        // 0 fastest launch · 1 Pluto (photo) · 2 Arrokoth · 3 still working
        text: 'New Horizons, iki bin altıda Dünya\'dan ayrılan en hızlı uzay aracıydı; Ay\'ın mesafesini dokuz saatte geçti. Dokuz buçuk yıllık yolculuğun ardından iki bin on beş Temmuz\'unda Plüton\'un yanından geçti ve bulanık bir noktayı dağları, buzulları ve kalbiyle gerçek bir dünyaya dönüştürdü. İki bin on dokuzda ise Kuiper Kuşağı\'nda kardan adam biçimli Arrokoth\'u ziyaret etti; bu, bir uzay aracının incelediği en uzak cisimdir. Hâlâ çalışıyor ve Güneş Sistemi\'nin dış sınırlarını ölçüyor.',
        cues: [
          card(0, { image: 'newhorizons.jpg', source: 'NASA/JHUAPL', title: 'New Horizons', text: 'Bir piyano büyüklüğünde; plütonyum pille çalışır.' }),
          card(1, { image: 'pluto.jpg', source: NH, title: 'Plüton', text: 'New Horizons, 14 Temmuz 2015; en yakın geçişte on iki bin beş yüz kilometre.' }),
        ], dwell: 3 },

      { id: 'voyager1', target: body('voyager1'),
        // 0 farthest (photo) · 1 1977 · 2 interstellar 2012 · 3 25 billion km · 4 golden record
        text: 'Voyager Bir, insan yapımı en uzak nesne. Bin dokuz yüz yetmiş yedide fırlatıldı; Jüpiter ve Satürn\'ü ziyaret etti, Titan\'a yaklaşmak için Plüton\'dan vazgeçti. İki bin on ikide Güneş rüzgârının sınırını aşarak yıldızlararası uzaya çıkan ilk araç oldu. Bugün yirmi beş milyar kilometreden uzaktadır; sinyalleri bize yirmi iki saatten uzun sürede ulaşır. Üzerinde, elli beş dilde selam ve Dünya\'nın seslerini taşıyan altın bir plak vardır: belki bir gün onu bulacak birileri için.',
        cues: [
          card(0, { image: 'voyager.jpg', source: JPLC, title: 'Voyager', text: 'Sanatçı çizimi: yıldızlararası uzayda.' }),
          card(3, { big: '22 saat', title: 'Sinyalin yolculuğu', text: 'Işık hızında bile yirmi iki saatten uzun sürer; cevap için iki gün beklenir.' }),
          card(4, { image: 'goldenrecord.jpg', source: JPL, title: 'Altın Plak', text: 'Yüz on beş görüntü, doksan dakika müzik, elli beş dilde selam.' }),
        ], dwell: 4 },

      { id: 'voyager2', target: body('voyager2'),
        // 0 only grand tour · 1 route · 2 Uranus & Neptune (photo) · 3 interstellar 2018 (heliopause art) · 4 farewell
        text: 'Ve Voyager İki, dört dış gezegenin hepsini ziyaret eden tek araç. Kardeşinden on altı gün önce fırlatıldı ama daha yavaş bir rotayla Jüpiter, Satürn, Uranüs ve Neptün\'ün yanından geçti. Uranüs ve Neptün\'e dair bildiklerimizin çoğu hâlâ onun bin dokuz yüz seksen altı ve seksen dokuzdaki geçişlerinden gelir. İki bin on sekizde yıldızlararası uzaya ulaştı. Her iki Voyager\'ın plütonyum pilleri zayıflıyor; iki bin otuzlu yıllarda sessizleşecekler ama milyarlarca yıl boyunca yıldızların arasında süzülmeye devam edecekler; turumuz burada sona eriyor.',
        cues: [
          card(2, { image: 'triton.jpg', source: JPL, title: 'Triton, Ağustos 1989', text: 'Voyager 2\'nin son durağı: Neptün\'ün en büyük ayı, azot gayzerleriyle.' }),
          card(3, { image: 'heliopause.jpg', source: JPLC, title: 'Güneş\'in sınırında', text: 'Sanatçı çizimi: iki Voyager heliosferin dışında, yıldızlararası uzayda.' }),
        ], dwell: 3 },
    ],
  },

  {
    id: 'stellar-life',
    title: 'Bir Yıldızın Yaşamı',
    summary: 'Gaz bulutundan kara deliğe: yıldızların doğumu, yaşamı ve ölümü.',
    steps: [
      { id: 'orion', target: lm('l-m42'), text: 'Bu turda bir yıldızın yaşam öyküsünü, doğumundan ölümüne kadar izleyeceğiz. Hikâye böyle yerlerde başlar: Orion Bulutsusu, bize bin üç yüz elli ışık yılı uzaklıktaki dev bir yıldız fabrikası. Soğuk gaz ve toz, kendi ağırlığı altında çökerek yüzlerce yeni yıldız oluşturuyor. Merkezdeki dört parlak Trapezium yıldızı, morötesi ışığıyla bulutsuyu içten aydınlatır. Gökyüzünde çıplak gözle Orion\'un kılıcındaki bulanık leke olarak görülür.',
        cues: [
          card(2, { big: '24 ışık yılı', title: 'Bulutsunun genişliği', text: 'İçinde yaklaşık iki bin genç yıldız; en gençleri yüz bin yaşında.' }),
        ] },
      { id: 'pleiades', target: lm('l-pleiades'), text: 'Yıldızlar yalnız doğmaz; kardeşleriyle birlikte doğar. Ülker, yani Pleiades, böyle genç bir aile. Yaklaşık yüz milyon yaşındadır; Güneş\'e kıyasla bir bebek sayılır. Binden fazla yıldız içerir ama çıplak gözle genellikle altı ya da yedisi görülür; bu yüzden pek çok kültürde Yedi Kız Kardeş adıyla bilinir. Parlak mavi yıldızlarının etrafındaki pus, kümenin içinden geçtiği bir toz bulutunun yansımasıdır. Birkaç yüz milyon yıl içinde bu kardeşler dağılıp galaksiye karışacak.',
        cues: [
          card(3, { big: '7 Kız Kardeş', title: 'Ülker', text: 'Subaru logosundaki altı yıldız da onlardır; Japoncada kümenin adı Subaru\'dur.' }),
        ] },
      { id: 'sun', target: body('sun'), text: 'Bir yıldızın yaşamının en uzun ve en sakin dönemi, anakol evresidir. Güneş tam da bu evrededir: dört buçuk milyar yıldır çekirdeğinde hidrojeni helyuma dönüştürüyor ve bunu yaklaşık beş milyar yıl daha sürdürecek. Her saniye altı yüz milyon ton hidrojen yakar. Dışa doğru iten basınç ile içe çeken kütle çekimi arasındaki bu hassas denge, yıldızı kararlı tutar. Bu denge bozulduğunda ise yaşlılık başlar.',
        cues: [
          card(2, { image: 'sun.jpg', source: 'NASA/SDO', title: 'Güneş patlaması', text: 'Dinamik Güneş Gözlemevi, morötesi: bir X sınıfı patlama.' }),
        ] },
      { id: 'betelgeuse', target: star('Betelgeuse'), text: 'Betelgeuse, yaşamının sonuna yaklaşmış bir yıldızın nasıl göründüğünü gösterir. Çekirdeğindeki hidrojen tükenince şişerek kırmızı bir süperdeve dönüştü; Güneş\'in yerinde olsaydı Jüpiter\'in yörüngesine kadar uzanırdı. Yalnızca on milyon yaşında ama Güneş\'ten yaklaşık on beş kat ağır olduğu için yakıtını çok hızlı tüketti. İki bin on dokuzda aniden sönükleşti; yüzeyinden kopan dev bir toz bulutu onu perdelemişti. Önümüzdeki yüz bin yıl içinde bir süpernova olarak patlayacak ve gündüz bile görülebilecek.',
        cues: [
          card(1, { big: '×900', title: 'Güneş\'in çapının', text: 'Güneş\'in yerine konsa Mars\'ı ve asteroit kuşağını yutar, Jüpiter\'e yaklaşırdı.', until: 3 }),
          card(3, { image: 'betelgeuse.jpg', source: ESO, title: 'Büyük Sönükleşme', text: 'ESO SPHERE, Ocak ve Mart 2019: yüzeyin bir kısmı toz bulutuyla perdelendi.' }),
        ] },
      { id: 'ring', target: lm('l-m57'), text: 'Güneş gibi orta kütleli yıldızlar patlamaz; dış katmanlarını yumuşakça uzaya üfler. Halka Bulutsusu bunun en güzel örneğidir. İki bin beş yüz ışık yılı uzaklıktaki bu renkli kabuk, ölmekte olan bir yıldızın birkaç bin yıl önce attığı dış katmanlarıdır. Merkezde kalan minik beyaz nokta, yüz yirmi bin derece sıcaklığındaki çekirdeğidir ve morötesi ışığıyla gazı parlatır. Güneş de yaklaşık yedi milyar yıl sonra böyle bir gezegenimsi bulutsuya dönüşecek.',
        cues: [
          card(3, { big: '120.000 °C', title: 'Merkezdeki beyaz cüce', text: 'Güneş\'in yüzeyinden yirmi kat sıcak; ama Dünya kadar küçük.' }),
        ] },
      { id: 'sirius', target: star('Sirius'), text: 'Sirius, gökyüzünün en parlak yıldızı; bize yalnızca sekiz virgül altı ışık yılı uzaklıkta. Ama bizi asıl ilgilendiren, parlaklığının gölgesinde kalan küçük yoldaşı Sirius B. Bu bir beyaz cüce: ölmüş bir yıldızın geriye kalan çekirdeği. Güneş kadar kütlesi, Dünya kadar boyutu vardır; bir çay kaşığı maddesi bir ton çeker. Artık enerji üretmez, yalnızca milyarlarca yıl boyunca yavaşça soğur. Güneş\'in nihai kaderi de budur.',
        cues: [
          card(1, { image: 'sirius.jpg', source: HUBBLE, title: 'Sirius A ve B', text: 'Sol alttaki küçük nokta beyaz cüce Sirius B. Hubble, 2003.' }),
          card(3, { big: '1 ton', title: 'Bir çay kaşığı beyaz cüce', text: 'Güneş\'in kütlesi, Dünya\'nın hacmine sıkışmış.' }),
        ] },
      { id: 'crab', target: lm('l-m1'), text: 'Ağır yıldızlar ise çok daha gürültülü ölür. Yengeç Bulutsusu, bin elli dört yılında Çinli ve Arap gökbilimcilerin kaydettiği bir süpernovanın kalıntısıdır. O patlama gündüz bile üç hafta boyunca görüldü. Bugün altı ışık yılı genişliğindeki bu lifli bulut saniyede bin beş yüz kilometreyle genişlemeye devam ediyor. Merkezinde ise patlamadan arta kalan nötron yıldızı var: saniyede otuz kez dönen Yengeç Pulsarı. Yıldızdaki demir, altın ve diğer ağır elementler böyle patlamalarla uzaya saçılır; vücudunuzdaki kalsiyum da bir zamanlar bir yıldızın içindeydi.',
        cues: [
          card(1, { image: 'crab.jpg', source: 'NASA/ESA/J. Hester & A. Loll (ASU)', title: 'Yengeç Bulutsusu', text: 'Hubble mozaiği: turuncu lifler hidrojen, mavi parıltı pulsarın rüzgârı.' }),
          card(4, { big: '30 tur/saniye', title: 'Yengeç Pulsarı', text: 'Yirmi kilometrelik bir nötron yıldızı; bütün bulutsuyu aydınlatır.' }),
        ] },
      { id: 'cygx1', target: bh('cygx1'), text: 'Ve en ağır yıldızlar için son durak: kara delik. Cygnus X-Bir, keşfedilen ilk kara deliktir. Yirmi bir güneş kütlesindeki bu nesne, mavi süperdev yoldaşından gaz çeker; gaz akreasyon diskinde milyonlarca dereceye ısınarak X-ışını yayar. İkisi ortak kütle merkezlerinin etrafında beş buçuk günde bir dönerler. Olay ufkunun içinden ışık bile kaçamaz. Bir gaz bulutunda başlayan yolculuk, uzay-zamanın kendisinde açılmış bir delikle sona erer. Yıldızların yaşamı turu burada bitiyor.',
        cues: [
          // "draws gas from its blue supergiant companion": the disc with the star looming behind
          shot(2, 'cygx1', '@star', 110, { az: 28, elev: 6 }),
          card(2, { image: 'cygx1.jpg', source: 'ESA/Hubble (CC BY 4.0)', title: 'Cygnus X-1', text: 'Sanatçı çizimi: mavi süperdevden kara deliğe akan gaz.' }),
          // the pair circling their barycentre, one 5.6-day orbit every ~10 s
          rate(3, 5e4), uncard(3), overview(3, 'cygx1'),
          // "not even light escapes": back to the lensed hole
          rate(4, 1), ret(4),
        ] },
    ],
  },

  {
    id: 'black-holes',
    title: 'Kara Delikler',
    summary: 'En yakın uyuyan kara delikten galaksilerin merkezindeki devlere.',
    steps: [
      { id: 'cygx1', target: bh('cygx1'), text: 'Kara delikler turuna hoş geldiniz. Başlangıç noktamız bir klasik: Cygnus X-Bir. Bin dokuz yüz altmış dörtte bir roketle keşfedilen bu X-ışını kaynağı, bin dokuz yüz yetmiş birde bir kara delik olarak tanımlanan ilk nesne oldu. Yirmi bir güneş kütlesindedir ve mavi süperdev yoldaşı HDE iki yüz yirmi altı bin sekiz yüz altmış sekiz ile beş buçuk günde bir ortak kütle merkezlerinin etrafında döner. Yoldaşından çektiği gaz, parlak bir diskte milyonlarca dereceye ısınır. Stephen Hawking bu nesnenin kara delik olmadığına bahse girmişti; bin dokuz yüz doksanda yenilgisini kabul etti.',
        cues: [
          card(2, { image: 'cygx1.jpg', source: 'ESA/Hubble (CC BY 4.0)', title: 'Cygnus X-1', text: 'Sanatçı çizimi: mavi süperdevden kara deliğe akan gaz.' }),
          // the pair: above the orbit while the clock runs at 50 000× (one 5.6-day orbit ≈ 10 s)
          uncard(3), rate(3, 5e4), overview(3, 'cygx1'),
          // back to the disc, the blue supergiant looming behind it (its disc spans ~25° from the hole)
          rate(4, 1), shot(4, 'cygx1', '@star', 110, { az: 28, elev: 6 }),
          card(5, { big: '1 yıllık Penthouse', title: 'Hawking\'in bahsi', text: 'Kip Thorne\'a karşı girdiği bahsi kaybetti; kaybetmekten memnundu: kara delikler üzerine çalışmaları boşa gitmemişti.' }),
        ] },
      { id: 'gaiabh1', target: bh('b2'), text: 'Gaia BH Bir, bize en yakın bilinen kara delik: bin beş yüz altmış ışık yılı. Ne diski var ne de X-ışını yayar; tamamen sessiz. Varlığı yalnızca Güneş benzeri bir yıldızın görünmez bir eşin etrafında yüz seksen altı günde bir sallanmasından anlaşıldı. Bu sallantıyı iki bin yirmi ikide Gaia uydusunun hassas konum ölçümleri ortaya çıkardı. Dokuz virgül altı güneş kütlesindedir ve olay ufkunun çapı yalnızca elli altı kilometredir. Burada onu yalnızca arka plandaki yıldızları büken kütle çekimsel merceklemeyle görebilirsiniz.',
        cues: [
          // the wobble: the Sun-like star swinging round the barycentre it shares with its invisible
          // partner (the star's orbit is the wide one: 1.3 AU against the hole's 0.1 AU), one 186-day orbit every ~8 s
          rate(2, 2e6), overview(2, 'gaiabh1-star'),
          // down to the hole itself for the lensing
          rate(4, 1), ret(4),
          card(4, { big: '56 km', title: 'Olay ufkunun çapı', text: 'Dokuz buçuk güneş kütlesi, İstanbul kadar bir alana sığmış.' }),
        ] },
      { id: 'v404', target: bh('b3'), text: 'V Dört Yüz Dört Cygni, bir X-ışını novası. Çoğu zaman sessizdir ama yoldaşından biriken gaz bir eşiği aştığında birkaç gün içinde patlayarak gökyüzünün en parlak X-ışını kaynağı olur. Bu patlamalar bin dokuz yüz otuz sekiz, elli altı, seksen dokuz ve iki bin on beşte gözlendi. İki bin on beşteki patlamada jetlerinin saniyeler içinde yön değiştirdiği görüldü; kara deliğin dönüşü uzay-zamanı sürükleyerek diski bir topaç gibi yalpalatıyordu. Dokuz güneş kütlesindedir ve uzaklığı radyo paralaksıyla doğrudan ölçülen ilk kara deliktir.',
        cues: [
          // the disc with the orange subgiant that feeds it hanging behind
          shot(1, 'v404', 'v404-star', 120, { az: 20, elev: 8 }),
          card(2, { big: '1938 · 1956 · 1989 · 2015', title: 'Patlamalar', text: 'Aralarda onlarca yıl sessizlik; sonra birkaç günde gökyüzünün en parlak X-ışını kaynağı.' }),
        ] },
      { id: 'sgra', target: bh('b0'), text: 'Şimdi galaksimizin kalbine, yirmi altı bin ışık yılı uzağa gidiyoruz. Sagittarius A yıldız, Samanyolu\'nun merkezindeki süper kütleli kara delik: dört virgül üç milyon güneş kütlesi. Etrafındaki yıldızlar onun kütlesini ölçmemizi sağladı; S İki adlı yıldız, on altı yılda bir ona o kadar yaklaşır ki ışık hızının yüzde üçüne ulaşır. Bu gözlemler iki bin yirmide Nobel Fizik Ödülü\'nü getirdi. İki bin yirmi ikide Olay Ufku Teleskobu onun gölgesini görüntüledi. Şu anda oldukça sessiz; neredeyse hiç madde yutmuyor.',
        cues: [
          // the S-stars: above S2's orbit with the clock at 50 million× (its 16-year orbit in ~10 s)
          rate(2, 5e7), overview(2, 's2'),
          rate(4, 1), ret(4),
          card(4, { image: 'sgra.jpg', source: EHT, title: 'Sagittarius A*', text: 'Olay Ufku Teleskobu, Mayıs 2022: gölgenin etrafındaki sıcak gaz halkası.' }),
        ] },
      { id: 'm87', target: bh('b1'), text: 'Son durağımız, fotoğrafı çekilen ilk kara delik: M Seksen Yedi yıldız. Elli beş milyon ışık yılı uzaktaki dev eliptik galaksi Virgo A\'nın merkezinde oturur. Altı buçuk milyar güneş kütlesindedir; olay ufku Plüton\'un yörüngesinden altı kat geniştir. İki bin on dokuzda yayımlanan ünlü turuncu halka görüntüsü, gölgesini çevreleyen sıcak gazın ışığıdır. Buradan ışık hızına yakın bir jet fırlar ve beş bin ışık yılı boyunca uzanır. Kara delikler turumuz sona erdi.',
        cues: [
          card(3, { image: 'm87eht.jpg', source: EHT, title: 'M87*', text: 'İlk kara delik fotoğrafı, 10 Nisan 2019; sekiz teleskop, Dünya büyüklüğünde bir dizi.' }),
          card(4, { image: 'm87jet.jpg', source: HUBBLE, title: 'M87 jeti', text: 'Beş bin ışık yılı uzunluğunda plazma jeti; Hubble.' }),
        ] },
    ],
  },

  {
    id: 'pulsars',
    title: 'Pulsarlar: Kozmik Fenerler',
    summary: 'Saniyede yüzlerce kez dönen nötron yıldızları ve değiştirdikleri fizik.',
    steps: [
      { id: 'b1919', target: lm('l-b1919'), text: 'Pulsarlar turuna hoş geldiniz. Her şey bin dokuz yüz altmış yedide, Cambridge\'de doktora öğrencisi Jocelyn Bell\'in radyo verilerinde her bir virgül üç saniyede bir tekrarlayan tuhaf bir sinyal fark etmesiyle başladı. Sinyal o kadar düzenliydi ki ekibi ona yarı şaka Küçük Yeşil Adamlar anlamına gelen LGM Bir adını verdi. Karşınızdaki PSR B Bin Dokuz Yüz On Dokuz artı Yirmi Bir, işte o ilk pulsar. Aslında bir deniz feneri gibi dönen ve ışın demetini her turda bize doğrultan bir nötron yıldızıydı.',
        cues: [
          card(1, { big: '1,337 saniye', title: 'LGM-1', text: 'Jocelyn Bell\'in 1967\'de kâğıt şeritlerde fark ettiği sinyalin periyodu.' }),
        ] },
      { id: 'crab', target: lm('l-crabpsr'), text: 'Yengeç Pulsarı, bin elli dört yılındaki süpernovanın geride bıraktığı nötron yıldızı. Saniyede otuz kez döner ve Yengeç Bulutsusu\'nun tamamını enerjisiyle aydınlatır. Yalnızca yirmi kilometre çapındadır ama Güneş\'ten daha ağırdır; bir şeker küpü büyüklüğündeki maddesi bir dağ kadar çeker. Radyo dalgalarından gama ışınlarına kadar her dalga boyunda nabız atar. Gözlemlenebilir bir süpernovayla kesin olarak eşleştirilen ilk pulsardır ve pulsarların patlayan yıldızlardan doğduğunu kanıtlamıştır.',
        cues: [
          card(1, { image: 'crab.jpg', source: 'NASA/ESA/J. Hester & A. Loll (ASU)', title: 'Yengeç Bulutsusu', text: 'Merkezdeki pulsar, bulutsunun mavi parıltısını besler.' }),
          card(2, { big: '1 şeker küpü = 1 dağ', title: 'Nötron yıldızı maddesi', text: 'Santimetreküpü yüz milyon tondan ağır.' }),
        ] },
      { id: 'vela', target: lm('l-vela'), text: 'Vela Pulsarı, bin ışık yılı uzaklıktaki en parlak radyo pulsarlarından biri. On bir bin yıl önce patlayan bir yıldızın kalıntısıdır ve saniyede on bir kez döner. Zaman zaman aniden hızlanır; bu olaylara glitch denir. Yıldızın katı kabuğundaki depremlerin ya da iç kısmındaki süperakışkan nötronların kabuğa enerji aktarmasının sonucudur. Yani bu küçük yıldızı inceleyerek maddenin Dünya\'daki hiçbir laboratuvarda üretilemeyecek yoğunluklardaki davranışını öğreniyoruz.',
        cues: [
          card(1, { image: 'vela.jpg', source: 'NASA/CXC/Univ. of Toronto/M. Durant et al.', title: 'Vela Pulsarı', text: 'Chandra, X-ışını: pulsardan fırlayan yarım ışık yılı uzunluğunda jet.' }),
        ] },
      { id: 'j1748', target: lm('l-j1748'), text: 'PSR J Bin Yedi Yüz Kırk Sekiz eksi Yirmi Dört Kırk Altı A D, bilinen en hızlı dönen pulsar: saniyede yedi yüz on altı tur. Ekvatorundaki hız ışık hızının dörtte birine yaklaşır; biraz daha hızlı dönse parçalanırdı. Bu hıza, yoldaş yıldızından çektiği maddeyle milyonlarca yıl boyunca hızlanarak ulaştı. Yay takımyıldızındaki Terzan Beş adlı yoğun küresel kümede yaşar. Yoldaşı, pulsarın şiddetli ışınımıyla şişmiş durumdadır ve yörüngenin yaklaşık yüzde kırkında onu örterek sinyalini keser.',
        cues: [
          card(0, { big: '716 tur/saniye', title: 'En hızlı pulsar', text: 'Bir mutfak blenderinden hızlı dönen, Güneş\'ten ağır bir yıldız.' }),
          rate(4, 3000),
        ] },
      { id: 'hulsetaylor', target: lm('l-hulsetaylor'), text: 'Hulse ve Taylor Çifti, fiziğin en önemli deneylerinden birine sahne oldu. Bin dokuz yüz yetmiş dörtte keşfedilen bu sistemde bir pulsar ile başka bir nötron yıldızı, ortak kütle merkezlerinin etrafında yedi saat kırk beş dakikada bir dönerler. Yörüngeleri her yıl birkaç milimetre küçülür. Bu, Einstein\'ın öngördüğü kütle çekim dalgalarıyla enerji kaybına tam olarak uyar: genel göreliliğin ilk dolaylı kanıtı. Russell Hulse ve Joseph Taylor bu keşifle bin dokuz yüz doksan üçte Nobel Fizik Ödülü\'nü kazandı. İki yıldız üç yüz milyon yıl içinde birleşecek.',
        cues: [
          rate(1, 3000),
          card(2, { big: '3,5 metre/yıl', title: 'Küçülen yörünge', text: 'Kütle çekim dalgalarıyla kaybedilen enerji: Einstein\'ın öngörüsüne yüzde yarım hassasiyetle uyuyor.' }),
          rate(4, 1),
        ] },
      { id: 'lich', target: lm('l-lich'), text: 'İlk ötegezegenler bir Güneş benzeri yıldızın değil, ölü bir yıldızın etrafında bulundu. Bin dokuz yüz doksan ikide Aleksander Wolszczan ve Dale Frail, Lich adlı bu pulsarın nabzındaki milisaniyelik gecikmelerden etrafında dönen gezegenleri çıkardı. Draugr, Poltergeist ve Phobetor adlı bu üç gezegen, muhtemelen süpernovadan arta kalan enkazdan yeniden oluştu. Draugr, bilinen en küçük kütleli ötegezegendir; Ay\'ın yalnızca iki katı ağırlığındadır. Pulsarın ölümcül ışınımı altında yaşam düşünülemez bile; adları bu yüzden hayaletlerden ve yaşayan ölülerden alınmıştır.',
        cues: [
          card(2, { big: 'Draugr · Poltergeist · Phobetor', title: 'İlk ötegezegenler, 1992', text: 'Adlarını hayaletlerden ve yaşayan ölülerden aldılar.' }),
        ] },
      { id: 'sgr1806', target: lm('l-sgr1806'), text: 'Son durağımız bir magnetar: SGR Bin Sekiz Yüz Altı eksi Yirmi. Magnetarlar, evrendeki en güçlü manyetik alanlara sahip nötron yıldızlarıdır; bu alan Dünya\'nınkinden bin trilyon kat güçlüdür ve bin kilometre öteden bir kredi kartını siler. İki bin dört Aralık\'ının yirmi yedisinde kabuğu çatladı ve onda bir saniyede Güneş\'in yüz bin yılda yaydığı kadar enerji saçtı. Elli bin ışık yılı uzaktan gelen bu patlama Dünya\'nın üst atmosferini ölçülebilir biçimde iyonlaştırdı ve uyduların dedektörlerini kör etti. Bugüne kadar Güneş Sistemi dışından gözlenen en parlak olaydır. Pulsarlar turumuz sona erdi.',
        cues: [
          card(2, { big: '0,1 saniye', title: '27 Aralık 2004', text: 'Güneş\'in yüz bin yılda yaydığı kadar enerji, bir göz kırpışında.' }),
        ] },
    ],
  },

  {
    id: 'neighbours',
    title: 'Komşu Yıldızlar',
    summary: 'En yakın yıldızlardan gökyüzünün en parlaklarına: altı yıldız, altı öykü.',
    steps: [
      { id: 'proxima', target: star('Proxima Centauri'), text: 'Komşu yıldızlar turuna hoş geldiniz. İlk durağımız, Güneş\'e en yakın yıldız: dört virgül iki ışık yılı uzaklıktaki Proxima Centauri. Küçük ve soğuk bir kırmızı cücedir; Güneş\'in yalnızca yüzde on ikisi kadar kütlesi vardır ve çıplak gözle görülemeyecek kadar sönüktür. Ama ani parlamalarla yüzeyinden şiddetli radyasyon püskürtür. İki bin on altıda etrafında Dünya büyüklüğünde bir gezegen keşfedildi: Proxima b, yaşanabilir bölgede, yani yüzeyinde sıvı suyun bulunabileceği uzaklıkta döner. Bugünkü en hızlı araçlarımızla buraya ulaşmak yetmiş bin yıl sürerdi.',
        cues: [
          card(4, { image: 'proxima.jpg', source: ESO, title: 'Proxima b', text: 'Sanatçı çizimi: yıldızına on bir günde bir tur atan, Dünya kütlesinde bir gezegen.' }),
          card(5, { big: '70.000 yıl', title: 'Voyager hızıyla', text: 'Dört virgül iki ışık yılı: ışık için dört yıl, bizim için binlerce kuşak.' }),
        ] },
      { id: 'alphacen', target: star('Rigil Kentaurus'), text: 'Proxima aslında büyük bir ailenin uzak üyesi. Alpha Centauri A ve B, dört virgül dört ışık yılı uzaklıkta birbirlerinin etrafında seksen yılda bir dönen iki yıldızdır. A, Güneş\'e şaşırtıcı ölçüde benzer: biraz daha büyük, biraz daha parlak. B ise biraz daha küçük ve turuncudur. Birlikte gökyüzünün üçüncü en parlak yıldızı olarak görünürler. Breakthrough Starshot projesi, lazerle itilen pul büyüklüğünde sondaları ışık hızının beşte biriyle buraya göndermeyi ve yirmi yılda ulaşmayı hayal ediyor.',
        cues: [
          rate(1, 2e8),
          rate(4, 1),
          card(5, { big: '20 yıl', title: 'Breakthrough Starshot', text: 'Işık hızının beşte biriyle giden gram ağırlığında sondalar; cevap dört yıl sonra gelir.' }),
        ] },
      { id: 'vega', target: star('Vega'), text: 'Vega, yirmi beş ışık yılı uzaklıktaki parlak mavi-beyaz yıldız. Güneş\'in iki katı kütlesinde ve kırk katı parlaklığındadır. O kadar hızlı döner ki ekvatoru kutuplarından belirgin biçimde şişkindir; üstelik ona neredeyse tam kutbundan bakıyoruz. Etrafında, gezegen oluşumunun artığı olabilecek bir toz diski bulundu. Dünya\'nın ekseni yavaşça yalpaladığı için on iki bin yıl önce Kutup Yıldızı\'ydı ve on iki bin yıl sonra yeniden olacak. Gökbilimciler yüzyıllarca parlaklık ölçeğinin sıfır noktası olarak onu kullandı.',
        cues: [
          card(2, { big: '12,5 saat', title: 'Vega\'nın günü', text: 'Güneş yirmi beş günde döner; Vega o kadar hızlı ki ekvatoru yüzde yirmi üç şişkin.' }),
        ] },
      { id: 'polaris', target: star('Polaris'), text: 'Polaris, Kutup Yıldızı. Gökyüzünün en parlak yıldızı değildir ama en önemlilerinden biridir: Dünya\'nın dönme ekseninin uzantısına bir dereceden daha yakın durur, bu yüzden tüm gökyüzü onun etrafında dönüyor gibi görünür. Yüzyıllar boyunca denizcilere kuzeyi gösterdi. Aslında dört yüz otuz ışık yılı uzaklıkta, Güneş\'ten iki bin kat parlak bir sarı süperdevdir ve iki küçük yoldaşıyla üçlü bir sistem oluşturur. Ayrıca bir Sefeid değişenidir: dört günde bir ritmik olarak parlayıp sönerek bize kozmik uzaklıkları ölçmeyi öğretir.',
        cues: [
          card(3, { big: '×2.000', title: 'Güneş\'ten parlak', text: 'Dört yüz otuz ışık yılı uzaktan bile gökyüzünün kırk sekizinci parlak yıldızı.' }),
        ] },
      { id: 'antares', target: star('Antares'), text: 'Antares, Akrep takımyıldızının kalbi. Adı Yunanca Mars\'ın rakibi anlamına gelir; çünkü kızıl rengi ve parlaklığıyla gezegene benzetilirdi. Beş yüz elli ışık yılı uzaklıktaki bu kırmızı süperdevin çapı Güneş\'in yaklaşık yedi yüz katıdır; Güneş\'in yerine koysanız Mars\'ın yörüngesini yutardı. Yoğunluğu ise havadan bile düşüktür. Güneş\'ten on iki kat ağırdır ve yakıtını tüketmek üzeredir; önümüzdeki bir milyon yıl içinde bir süpernova olarak patlayacak.',
        cues: [
          card(2, { big: '×700', title: 'Güneş\'in çapının', text: 'Güneş\'in yerine konsa Merkür, Venüs, Dünya ve Mars onun içinde kalırdı.' }),
        ] },
      { id: 'deneb', target: star('Deneb'), text: 'Son durağımız Deneb, Kuğu takımyıldızının kuyruğu ve bu turdaki en uzak yıldız: yaklaşık iki bin altı yüz ışık yılı. Buna rağmen gökyüzünün en parlak yirmi yıldızından biridir; çünkü Güneş\'ten yaklaşık iki yüz bin kat daha fazla ışık saçan, bilinen en parlak yıldızlardan biridir. Bugün gördüğünüz ışığı, Roma Cumhuriyeti\'nin kurulduğu dönemde yola çıktı. Mavi-beyaz bir süperdevdir ve birkaç milyon yıl içinde ya süpernova olacak ya da kırmızı bir süperdeve dönüşecek. Komşu yıldızlar turumuz sona erdi.',
        cues: [
          card(2, { big: '2.600 yıl', title: 'Işığın yolculuğu', text: 'Gördüğünüz ışık yola çıktığında Roma henüz bir krallıktı.' }),
        ] },
    ],
  },

  {
    id: 'galaxies',
    title: 'Galaksiler: Evin Ötesi',
    summary: 'Samanyolu\'nun dışına çıkıp uydu galaksilerimizi, Andromeda\'yı ve çarpışan galaksileri ziyaret edin.',
    steps: [
      { id: 'milkyway', target: gal('#0'), text: 'Galaksiler turuna hoş geldiniz. Önce evimize dışarıdan bakalım. Samanyolu, yüz bin ışık yılı genişliğinde, merkezinde bir çubuk bulunan sarmal bir galaksidir ve iki yüz ile dört yüz milyar arasında yıldız içerir. Güneş, merkezden yirmi altı bin ışık yılı uzakta, Orion Kolu denilen küçük bir kolda yer alır ve galaksinin etrafındaki bir turunu iki yüz otuz milyon yılda tamamlar. Dinozorlar yok olduğundan beri Güneş bu turun yalnızca dörtte birini aldı. Merkezdeki parlak şişkinlikte dört milyon güneş kütleli bir kara delik gizlidir.',
        cues: [
          card(3, { big: '230 milyon yıl', title: 'Bir galaktik yıl', text: 'Güneş bugüne kadar galaksinin etrafında yalnızca yirmi tur attı.' }),
          card(5, { image: 'sgra.jpg', source: EHT, title: 'Sagittarius A*', text: 'Merkezdeki kara deliğin gölgesi; Olay Ufku Teleskobu, 2022.' }),
        ], orbitRate: 0.03 },
      { id: 'lmc', target: gal('Büyük Macellan'), text: 'Büyük Macellan Bulutu, Samanyolu\'nun en büyük uydu galaksisi. Yüz altmış bin ışık yılı uzaklıktadır ve güney yarım küreden çıplak gözle gökyüzünde kopmuş bir bulut parçası gibi görünür. Kütlesi bizimkinin yaklaşık yüzde biridir. İçinde, Yerel Grup\'un en büyük yıldız doğumevi olan Tarantula Bulutsusu ve bilinen en ağır yıldızlardan R Yüz Otuz Altı a Bir bulunur. Bin dokuz yüz seksen yedide burada patlayan süpernova, dört yüz yıldır çıplak gözle görülen ilk süpernovaydı. Birkaç milyar yıl içinde Samanyolu onu yutacak.',
        cues: [
          card(3, { image: 'tarantula.jpg', source: WEBB, title: 'Tarantula Bulutsusu', text: 'Webb, 2022: Yerel Grup\'un en büyük yıldız doğumevi.' }),
        ], orbitRate: 0.03 },
      { id: 'smc', target: gal('Küçük Macellan'), text: 'Küçük Macellan Bulutu, iki yüz bin ışık yılı uzaklıktaki daha küçük kardeşi. Düzensiz bir galaksidir; muhtemelen Büyük Macellan ve Samanyolu\'nun kütle çekimi onu bu biçimsiz hâle getirdi. İkisi arasında uzanan bir hidrojen köprüsü, yakın bir karşılaşmanın izidir. Bin dokuz yüz on ikide Henrietta Leavitt burada binlerce değişen yıldızı inceleyerek Sefeid yıldızlarının periyot-parlaklık ilişkisini keşfetti. Bu keşif, evrendeki uzaklıkları ölçmemizi sağlayan ilk kozmik cetvel oldu.',
        cues: [
          card(3, { image: 'leavitt.jpg', source: 'AAVSO', title: 'Henrietta Swan Leavitt', text: 'Harvard\'da fotoğraf plakalarını inceleyerek Sefeid periyot-parlaklık ilişkisini buldu, 1912.' }),
        ], orbitRate: 0.03 },
      { id: 'andromeda', target: gal('Andromeda'), text: 'Andromeda, en yakın büyük komşumuz. İki buçuk milyon ışık yılı uzaklıktadır ve çıplak gözle görülebilen en uzak cisimdir; bugün gördüğünüz ışığı, Dünya\'da henüz insan yokken yola çıktı. Bin dokuz yüz yirmi üçte Edwin Hubble buradaki bir Sefeid yıldızını ölçerek onun Samanyolu\'nun bir parçası değil, bambaşka bir galaksi olduğunu kanıtladı; evren bir gecede milyonlarca kat büyüdü. Bir trilyon yıldız içerir ve saniyede yüz on kilometreyle bize yaklaşıyor. Yaklaşık dört buçuk milyar yıl sonra Samanyolu ile birleşerek dev bir eliptik galaksi oluşturacak.',
        cues: [
          card(1, { image: 'andromeda.jpg', source: 'Adam Evans (CC BY 2.0)', title: 'Andromeda Galaksisi', text: 'Gökyüzünde dolunayın altı katı genişliğinde; ama yalnızca parlak merkezi çıplak gözle görülür.' }),
          card(4, { big: '4,5 milyar yıl', title: 'Samanyolu ile birleşme', text: 'Yıldızlar çarpışmayacak; ama iki galaksi tek bir dev eliptik galaksiye dönüşecek.' }),
        ], orbitRate: 0.03 },
      { id: 'triangulum', target: gal('Üçgen'), text: 'Üçgen Galaksisi, Yerel Grup\'un üçüncü büyük üyesi. İki virgül yedi milyon ışık yılı uzaklıktadır ve kırk milyar yıldızıyla Andromeda ile Samanyolu\'nun küçük kardeşidir. Merkezinde belirgin bir şişkinlik ya da süper kütleli kara delik yoktur; kollarını neredeyse tepeden görürüz. İçinde bin beş yüz ışık yılı genişliğinde dev bir yıldız oluşum bölgesi olan NGC Altı Yüz Dört bulunur; Orion Bulutsusu\'ndan yüz kat büyüktür. Muhtemelen Andromeda\'nın bir uydusudur ve bir gün ona katılacaktır.',
        cues: [
          card(3, { big: '×100', title: 'Orion Bulutsusu\'nun', text: 'NGC 604: bin beş yüz ışık yılı genişliğinde bir yıldız doğumevi.' }),
        ], orbitRate: 0.03 },
      { id: 'm87', target: gal('M87'), text: 'Şimdi Yerel Grup\'tan çıkıp Virgo Kümesi\'nin kalbine, elli beş milyon ışık yılı uzağa gidiyoruz. M Seksen Yedi, dev bir eliptik galaksi. Sarmal kolları yoktur; trilyonlarca yaşlı, sarı yıldızdan oluşan devasa bir küredir ve etrafında on iki binden fazla küresel yıldız kümesi döner; Samanyolu\'nda yalnızca yüz elli tane vardır. Merkezinde altı buçuk milyar güneş kütleli, fotoğrafı çekilen ilk kara delik bulunur. Bu kara delikten fırlayan jet, beş bin ışık yılı boyunca uzanır ve bin dokuz yüz on sekizden beri bilinmektedir.',
        cues: [
          card(3, { image: 'm87eht.jpg', source: EHT, title: 'M87*', text: 'İlk kara delik fotoğrafı, 10 Nisan 2019.' }),
          card(4, { image: 'm87jet.jpg', source: HUBBLE, title: 'M87 jeti', text: 'Işık hızına yakın plazma; beş bin ışık yılı uzunluğunda.' }),
        ], orbitRate: 0.03 },
      { id: 'sombrero', target: gal('Sombrero'), text: 'Sombrero Galaksisi adını hak ediyor: yirmi dokuz milyon ışık yılı uzaklıktaki bu galaksiye neredeyse tam kenarından bakıyoruz. Olağanüstü büyük ve parlak merkez şişkinliği, keskin bir toz şeridiyle çevrilidir; tıpkı geniş kenarlı bir Meksika şapkası gibi. Yaklaşık iki bin küresel küme ve merkezinde bir milyar güneş kütleli bir kara delik barındırır. Sarmal mı yoksa eliptik mi olduğu uzun süre tartışıldı; kızılötesi gözlemler, eliptik bir galaksinin içine gömülü bir disk olduğunu gösterdi.',
        cues: [
          card(1, { image: 'sombrero.jpg', source: 'NASA/ESA/Hubble Heritage Team', title: 'Sombrero Galaksisi', text: 'Hubble, 2003: altı derecelik bir eğimle görülen toz şeridi.' }),
        ], orbitRate: 0.03 },
      { id: 'antennae', target: gal('Antenler'), text: 'Son durağımızda galaksilerin de çarpışabildiğini göreceğiz. Antenler, kırk beş milyon ışık yılı uzaklıkta birbirinin içinden geçmekte olan iki sarmal galaksidir. Karşılaşma yaklaşık altı yüz milyon yıl önce başladı. Kütle çekimi yıldızlardan oluşan iki uzun kuyruğu uzaya savurdu; adını veren böcek antenleri bunlardır. Yıldızlar birbirine çarpmaz, aralarındaki uzaklıklar çok büyüktür; ama gaz bulutları çarpışır ve sıkışarak milyarlarca yeni yıldız doğurur. Birkaç yüz milyon yıl içinde ikisi tek bir eliptik galaksiye dönüşecek. Samanyolu ile Andromeda\'nın geleceği de aynen böyle görünecek. Galaksiler turumuz sona erdi.',
        cues: [
          card(1, { image: 'antennae.jpg', source: 'NASA/ESA/CXC/JPL-Caltech', title: 'Antenler', text: 'Hubble, Chandra ve Spitzer\'in birleşik görüntüsü: pembe gaz, mavi X-ışını, kırmızı toz.' }),
        ], orbitRate: 0.03 },
    ],
  },
];

/* ------------------------------------------------------------------------------------------ */
/* Cinematic chapter titles and supporting figures, per tour and step (source language).      */
/* Kept apart from the narration so the voice tracks stay untouched when these change.        */
/* ------------------------------------------------------------------------------------------ */

type StepExtras = { title: string; kicker?: string; facts?: Array<[string, string]> };
const EXTRAS: Record<string, Record<string, StepExtras>> = {
  'solar-system': {
    sun: { title: 'Güneş', kicker: 'Her şeyin merkezi', facts: [['Yaş', '4,6 milyar yıl'], ['Çap', '1 392 700 km · 109 Dünya'], ['Yüzey', '5 500 °C'], ['Çekirdek', '15 milyon °C'], ['Kütle payı', 'Sistemin %99,8\'i']] },
    mercury: { title: 'Merkür', kicker: 'Güneş\'e en yakın, en küçük gezegen', facts: [['Çap', '4 879 km'], ['Yıl', '88 gün'], ['Güneş günü', '176 Dünya günü'], ['Sıcaklık', '−180 °C … +430 °C'], ['Uydular', 'Yok']] },
    venus: { title: 'Venüs', kicker: 'Dünya\'nın ikizi, bulutların altında cehennem', facts: [['Çap', '12 104 km'], ['Yüzey', '465 °C'], ['Basınç', '92 atmosfer'], ['Gün', '243 Dünya günü (ters yönde)'], ['Bulutlar', 'Sülfürik asit']] },
    earth: { title: 'Dünya', kicker: 'Yaşam barındırdığını bildiğimiz tek yer', facts: [['Çap', '12 742 km'], ['Su yüzeyi', '%71'], ['Atmosfer', '%78 azot, %21 oksijen'], ['Uydular', '1 — Ay'], ['Yaş', '4,54 milyar yıl']] },
    moon: { title: 'Ay', kicker: 'İnsanın ayak bastığı tek başka dünya', facts: [['Çap', '3 474 km · Dünya\'nın ¼\'ü'], ['Uzaklık', '384 400 km'], ['Yürüyen insan', '12 astronot, 1969–72'], ['Getirilen kaya', '382 kg'], ['Uzaklaşma', 'Yılda 3,8 cm']] },
    mars: { title: 'Mars', kicker: 'Kızıl Gezegen', facts: [['Çap', '6 779 km · Dünya\'nın yarısı'], ['Gün', '24 sa 37 dk'], ['Olympus Mons', '22 km yüksek'], ['Valles Marineris', '4 000 km uzun'], ['Uydular', '2 — Phobos, Deimos']] },
    jupiter: { title: 'Jüpiter', kicker: 'Gezegenlerin kralı', facts: [['Çap', '139 820 km · 11 Dünya'], ['Kütle', 'Diğer gezegenlerin 2,5 katı'], ['Gün', '9 sa 56 dk'], ['Büyük Kırmızı Leke', '350+ yıllık fırtına'], ['Uydular', '95+']] },
    saturn: { title: 'Satürn', kicker: 'Halkaların efendisi', facts: [['Çap', '116 460 km'], ['Halka genişliği', '280 000 km'], ['Halka kalınlığı', '~10 m'], ['Yoğunluk', '0,69 g/cm³ — suda yüzer'], ['Uydular', '146+']] },
    uranus: { title: 'Uranüs', kicker: 'Yan yatmış gezegen', facts: [['Çap', '50 724 km'], ['Eksen eğikliği', '98°'], ['Yıl', '84 Dünya yılı'], ['Kutup gecesi', '42 yıl'], ['Keşif', '1781, W. Herschel']] },
    neptune: { title: 'Neptün', kicker: 'Kâğıt üzerinde keşfedilen gezegen', facts: [['Çap', '49 244 km'], ['Yıl', '165 Dünya yılı'], ['Rüzgâr', '2 100 km/sa'], ['Keşif', '1846, hesapla'], ['Ziyaret', 'Voyager 2, 1989']] },
    pluto: { title: 'Plüton', kicker: 'Dokuzuncu gezegenden cüce gezegene', facts: [['Çap', '2 377 km · Ay\'dan küçük'], ['Yüzey', '−230 °C'], ['Yıl', '248 Dünya yılı'], ['En büyük uydu', 'Charon'], ['Ziyaret', 'New Horizons, 2015']] },
  },
  mars: {
    mars: { title: 'Mars', kicker: 'İnsanlığın en çok araç gönderdiği dünya', facts: [['Gün', '24 sa 37 dk'], ['Atmosfer', '%95 CO₂, çok ince'], ['Ortalama sıcaklık', '−60 °C'], ['Hellas Havzası', '2 300 km geniş, 9 km derin'], ['Çap', '6 779 km']] },
    phobos: { title: 'Phobos', kicker: 'Mars\'ın yakın ve acele eden ayı', facts: [['Boyut', '22 km, patates biçimli'], ['Yörünge yüksekliği', '6 000 km'], ['Tur süresi', '7 sa 39 dk'], ['Gökyüzünde', 'Batıdan doğar'], ['Gelecek', '~50 milyon yılda parçalanacak']] },
    deimos: { title: 'Deimos', kicker: 'Küçük ve uzak olan', facts: [['Çap', '~12 km'], ['Tur süresi', '30 saat'], ['Yüzey', 'Tozla dolmuş kraterler'], ['Köken', 'Tartışmalı'], ['Ziyaret', 'MMX (JAXA), 2026+']] },
    curiosity: { title: 'Curiosity', kicker: 'Gale Krateri, 2012\'den beri', facts: [['Kütle', '899 kg'], ['İniş', '6 Ağustos 2012, gökyüzü vinci'], ['Güç', 'Plütonyum RTG'], ['Buluş', 'Eski bir gölün kanıtı'], ['Hedef', 'Aeolis Mons (Sharp Dağı)']] },
    perseverance: { title: 'Perseverance', kicker: 'Jezero Krateri\'nde yaşam izi arayan robot', facts: [['İniş', '18 Şubat 2021'], ['Yer', 'Jezero: 3,5 milyar yıllık delta'], ['Örnek tüpleri', 'Titanyum, Dünya\'ya dönecek'], ['Yol arkadaşı', 'Ingenuity helikopteri'], ['Uçuş', '72 uçuş, 2021–24']] },
    finale: { title: 'Mars\'a Veda', kicker: 'Soğuk bir çöle dönüşen ılık dünya', facts: [['Aktif araç', '~12 (yörünge + yüzey)'], ['Kayıp', 'Manyetik alan ve atmosfer'], ['Geçmiş', 'Göller, nehirler, belki yaşam'], ['Gelecek', 'İnsanlı iniş adayı']] },
  },
  jupiter: {
    jupiter: { title: 'Jüpiter', kicker: 'Küçük bir güneş sistemi gibi', facts: [['Uydular', '95+'], ['Galileo ayları', 'Io · Europa · Ganymede · Callisto'], ['Rezonans', 'Io 4 : Europa 2 : Ganymede 1'], ['Hacim', '1 300 Dünya'], ['Gün', '9 sa 56 dk']] },
    io: { title: 'Io', kicker: 'En volkanik dünya', facts: [['Çap', '3 643 km'], ['Aktif yanardağ', '400+'], ['Loki Patera', '200 km lav gölü'], ['Isı kaynağı', 'Gelgit ısınması'], ['Renk', 'Kükürt bileşikleri']] },
    europa: { title: 'Europa', kicker: 'Buzun altında bir okyanus', facts: [['Çap', '3 122 km'], ['Okyanus', 'Dünya okyanuslarının 2 katı su'], ['Buz kabuğu', '15–25 km'], ['Görev', 'Europa Clipper, varış 2030'], ['Yüzey', 'Çatlaklı, pürüzsüz']] },
    ganymede: { title: 'Ganymede', kicker: 'Güneş Sistemi\'nin en büyük ayı', facts: [['Çap', '5 268 km · Merkür\'den büyük'], ['Manyetik alan', 'Kendi alanına sahip tek ay'], ['Yüzey', 'İki yaş: koyu eski, açık genç'], ['Okyanus', 'Buz altında, olası'], ['Görev', 'JUICE (ESA), 2034']] },
    callisto: { title: 'Callisto', kicker: 'Dört milyar yıldır değişmeyen yüzey', facts: [['Çap', '4 821 km'], ['Yüzey', 'En yoğun kraterli'], ['Radyasyon', 'Kuşakların dışında'], ['Gelecek', 'İnsanlı üs adayı'], ['Tur süresi', '17 gün']] },
    juno: { title: 'Juno', kicker: 'Kutupların üzerinden geçen gözcü', facts: [['Varış', '4 Temmuz 2016'], ['Güç', 'Güneş panelleri, 60 m²'], ['Yörünge', 'Kutupsal, eliptik'], ['En yakın geçiş', 'Bulutların ~4 000 km üstü'], ['Buluş', 'Kutup siklonları']] },
  },
  saturn: {
    saturn: { title: 'Satürn', kicker: 'Güneş\'ten altıncı gezegen', facts: [['Çap', '116 460 km · 9 Dünya'], ['Yoğunluk', '0,69 g/cm³'], ['Gün', '10 sa 33 dk'], ['Yıl', '29,5 Dünya yılı'], ['Altıgen', 'Kuzey kutbunda, Dünya boyutunda']] },
    rings: { title: 'Halkalar', kicker: 'Milyarlarca buz parçasından bir disk', facts: [['Genişlik', '280 000 km'], ['Kalınlık', '~10 m'], ['Madde', '%99 su buzu'], ['Cassini Bölümü', '4 800 km boşluk'], ['Yaş', 'Belki yalnızca 100 milyon yıl']] },
    titan: { title: 'Titan', kicker: 'Kalın atmosferli tek ay', facts: [['Çap', '5 150 km'], ['Atmosfer', '%95 azot, 1,5 bar'], ['Yüzey', '−179 °C'], ['Göller', 'Sıvı metan ve etan'], ['İniş', 'Huygens, 2005']] },
    enceladus: { title: 'Enceladus', kicker: 'Buzdan fışkıran okyanus', facts: [['Çap', '504 km'], ['Yansıtma', '%99 — en parlak yüzey'], ['Fıskiyeler', 'Güney kutbu, kaplan çizgileri'], ['Okyanus', 'Küresel, buz altında'], ['Besler', 'Satürn\'ün E halkasını']] },
    mimas: { title: 'Mimas', kicker: 'Ölüm Yıldızı\'na benzeyen ay', facts: [['Çap', '396 km'], ['Herschel Krateri', '139 km — çapın ⅓\'ü'], ['Yörünge', '22,6 saat'], ['Sürpriz', 'Genç bir iç okyanus (2024)']] },
    iapetus: { title: 'Iapetus', kicker: 'Yarısı kara, yarısı beyaz', facts: [['Çap', '1 469 km'], ['Yansıtma', '%4 ile %60 arası'], ['Ekvator sırtı', '20 km yüksek, 1 300 km uzun'], ['Tur süresi', '79 gün'], ['Keşif', '1671, G. Cassini']] },
  },
  explorers: {
    iss: { title: 'Uluslararası Uzay İstasyonu', kicker: 'İnsanlığın yörüngedeki evi', facts: [['Yükseklik', '~400 km'], ['Hız', '27 600 km/sa'], ['Tur süresi', '93 dakika'], ['Kütle', '420 ton'], ['Sürekli mürettebat', '2000\'den beri']] },
    hubble: { title: 'Hubble Uzay Teleskobu', kicker: 'Evrene bakışımızı değiştiren göz', facts: [['Fırlatma', '24 Nisan 1990'], ['Ayna', '2,4 m'], ['Yükseklik', '~540 km'], ['Servis', '5 astronot görevi'], ['Gözlem', '1,5 milyondan fazla']] },
    jwst: { title: 'James Webb Uzay Teleskobu', kicker: 'Kızılötesinde ilk ışığa bakış', facts: [['Fırlatma', '25 Aralık 2021'], ['Konum', 'L₂, 1,5 milyon km'], ['Ayna', '6,5 m, 18 altıgen'], ['Güneş kalkanı', 'Tenis kortu kadar'], ['Sıcaklık', '−233 °C']] },
    parker: { title: 'Parker Güneş Sondası', kicker: 'Güneş\'e dokunan ilk araç', facts: [['Fırlatma', '12 Ağustos 2018'], ['En yakın geçiş', '6,1 milyon km'], ['Hız', '690 000 km/sa — en hızlı'], ['Isı kalkanı', '1 370 °C\'ye dayanır'], ['Venüs sapanı', '7 kez']] },
    newhorizons: { title: 'New Horizons', kicker: 'Plüton\'un ilk ziyaretçisi', facts: [['Fırlatma', '19 Ocak 2006'], ['Plüton geçişi', '14 Temmuz 2015'], ['Arrokoth', '1 Ocak 2019, 6,6 milyar km'], ['Hız', '~58 000 km/sa'], ['Durum', 'Kuiper Kuşağı\'nda, aktif']] },
    voyager1: { title: 'Voyager 1', kicker: 'İnsan yapımı en uzak nesne', facts: [['Fırlatma', '5 Eylül 1977'], ['Uzaklık', '24+ milyar km'], ['Sinyal', '22+ saat tek yön'], ['Yıldızlararası uzay', '2012\'den beri'], ['Altın Plak', 'Dünya\'nın sesleri']] },
    voyager2: { title: 'Voyager 2', kicker: 'Dört dev gezegeni gören tek araç', facts: [['Fırlatma', '20 Ağustos 1977'], ['Ziyaret', 'Jüpiter · Satürn · Uranüs · Neptün'], ['Yıldızlararası uzay', '2018\'den beri'], ['Uzaklık', '20+ milyar km'], ['Güç', 'RTG, azalıyor']] },
  },
  'stellar-life': {
    orion: { title: 'Orion Bulutsusu', kicker: 'Yıldızların doğduğu yer', facts: [['Uzaklık', '1 344 ışık yılı'], ['Genişlik', '24 ışık yılı'], ['Yaş', '< 2 milyon yıl'], ['Genç yıldız', '~2 000'], ['Çıplak gözle', 'Görünür']] },
    pleiades: { title: 'Ülker', kicker: 'Kardeş yıldızlar', facts: [['Uzaklık', '444 ışık yılı'], ['Yaş', '~100 milyon yıl'], ['Yıldız sayısı', '1 000+'], ['Parlak üyeler', 'Yedi Kız Kardeş'], ['Dağılma', '~250 milyon yıl içinde']] },
    sun: { title: 'Güneş', kicker: 'Anakolda sakin bir orta yaş', facts: [['Yaş', '4,6 milyar yıl'], ['Anakol ömrü', '~10 milyar yıl'], ['Yakıt', 'Saniyede 600 milyon ton hidrojen'], ['Sınıf', 'G2 V sarı cüce'], ['Gelecek', 'Kırmızı dev → beyaz cüce']] },
    betelgeuse: { title: 'Betelgeuse', kicker: 'Ömrünün sonuna yaklaşan dev', facts: [['Uzaklık', '~550 ışık yılı'], ['Yarıçap', '~750 Güneş'], ['Kütle', '~17 Güneş'], ['Yaş', '~10 milyon yıl'], ['Son', 'Süpernova, 100 bin yıl içinde']] },
    ring: { title: 'Halka Bulutsusu', kicker: 'Güneş benzeri bir yıldızın son nefesi', facts: [['Uzaklık', '2 300 ışık yılı'], ['Çap', '~1 ışık yılı'], ['Yaş', '~4 000 yıl'], ['Merkez', 'Beyaz cüce, 120 000 K'], ['Genişleme', '20 km/s']] },
    sirius: { title: 'Sirius', kicker: 'En parlak yıldız ve ölü yoldaşı', facts: [['Uzaklık', '8,6 ışık yılı'], ['Sirius A', '2 Güneş kütlesi, A1 V'], ['Sirius B', 'Beyaz cüce, Dünya boyutunda'], ['Yörünge', '50 yıl'], ['Beyaz cüce yoğunluğu', '~1 ton / cm³']] },
    crab: { title: 'Yengeç Bulutsusu', kicker: '1054 süpernovasının kalıntısı', facts: [['Uzaklık', '6 500 ışık yılı'], ['Patlama', '4 Temmuz 1054'], ['Genişlik', '11 ışık yılı'], ['Genişleme', '1 500 km/s'], ['Merkez', 'Pulsar, saniyede 30 tur']] },
    cygx1: { title: 'Cygnus X-1', kicker: 'En ağır yıldızların son durağı', facts: [['Uzaklık', '7 200 ışık yılı'], ['Kütle', '21 Güneş'], ['Yoldaş', 'Mavi süperdev HDE 226868'], ['Yörünge', '5,6 gün'], ['Keşif', '1964, X-ışını']] },
  },
  'black-holes': {
    cygx1: { title: 'Cygnus X-1', kicker: 'Bir klasik', facts: [['Uzaklık', '7 200 ışık yılı'], ['Kütle', '21 Güneş'], ['Yoldaş', 'Mavi süperdev'], ['Yörünge', '5,6 gün'], ['Bahis', 'Hawking–Thorne, 1974']] },
    gaiabh1: { title: 'Gaia BH1', kicker: 'Bize en yakın bilinen kara delik', facts: [['Uzaklık', '1 560 ışık yılı'], ['Kütle', '9,6 Güneş'], ['Yoldaş', 'Güneş benzeri yıldız'], ['Yörünge', '186 gün'], ['Keşif', '2022, Gaia astrometrisi']] },
    v404: { title: 'V404 Cygni', kicker: 'Uyuyan dev, X-ışını novası', facts: [['Uzaklık', '7 800 ışık yılı'], ['Kütle', '9 Güneş'], ['Patlamalar', '1938 · 1956 · 1989 · 2015'], ['Yoldaş', 'K sınıfı yıldız'], ['Jetler', 'Saniyeler içinde yön değiştirir']] },
    sgra: { title: 'Sagittarius A*', kicker: 'Samanyolu\'nun kalbi', facts: [['Uzaklık', '26 000 ışık yılı'], ['Kütle', '4,3 milyon Güneş'], ['S2 yıldızı', '16 yılda bir tur'], ['Nobel', '2020, Genzel & Ghez'], ['Fotoğraf', 'EHT, 2022']] },
    m87: { title: 'M87*', kicker: 'Fotoğrafı çekilen ilk kara delik', facts: [['Uzaklık', '55 milyon ışık yılı'], ['Kütle', '6,5 milyar Güneş'], ['Olay ufku', 'Plüton yörüngesinin 6 katı'], ['Jet', '5 000 ışık yılı'], ['Fotoğraf', 'EHT, 10 Nisan 2019']] },
  },
  pulsars: {
    b1919: { title: 'PSR B1919+21', kicker: 'İlk pulsar — LGM-1', facts: [['Keşif', '1967, Jocelyn Bell'], ['Periyot', '1,337 saniye'], ['Uzaklık', '~2 300 ışık yılı'], ['Takma ad', 'Küçük Yeşil Adamlar'], ['Nobel', '1974 (Hewish)']] },
    crab: { title: 'Yengeç Pulsarı', kicker: 'Saniyede otuz kez dönen kalp', facts: [['Dönüş', '30 tur / saniye'], ['Çap', '~20 km'], ['Kütle', '1,4 Güneş'], ['Yaş', '970 yıl'], ['Işınım', 'Radyodan gamaya']] },
    vela: { title: 'Vela Pulsarı', kicker: 'Aniden hızlanan yıldız', facts: [['Uzaklık', '~1 000 ışık yılı'], ['Dönüş', '11 tur / saniye'], ['Yaş', '~11 000 yıl'], ['Glitch', 'Düzensiz hızlanmalar'], ['İç yapı', 'Süperakışkan nötronlar']] },
    j1748: { title: 'PSR J1748−2446ad', kicker: 'Bilinen en hızlı pulsar', facts: [['Dönüş', '716 tur / saniye'], ['Ekvator hızı', 'Işık hızının ~¼\'ü'], ['Ev', 'Terzan 5 küresel kümesi'], ['Uzaklık', '~18 000 ışık yılı'], ['Keşif', '2004']] },
    hulsetaylor: { title: 'Hulse–Taylor Çifti', kicker: 'Kütle çekim dalgalarının ilk kanıtı', facts: [['Keşif', '1974'], ['Yörünge', '7 sa 45 dk'], ['Küçülme', 'Yılda ~3,5 m'], ['Nobel', '1993'], ['Birleşme', '~300 milyon yıl sonra']] },
    lich: { title: 'Lich — PSR B1257+12', kicker: 'İlk ötegezegenlerin yıldızı', facts: [['Keşif', '1992, Wolszczan & Frail'], ['Gezegen', 'Draugr · Poltergeist · Phobetor'], ['Draugr', 'Ay\'ın 2 katı kütle'], ['Uzaklık', '~2 300 ışık yılı'], ['Dönüş', '161 tur / saniye']] },
    sgr1806: { title: 'SGR 1806−20', kicker: 'Bir magnetar', facts: [['Manyetik alan', 'Dünya\'nın 10¹⁵ katı'], ['Dev patlama', '27 Aralık 2004'], ['Enerji', '0,1 saniyede Güneş\'in 100 000 yılı'], ['Uzaklık', '~50 000 ışık yılı'], ['Etki', 'Dünya iyonosferini sarstı']] },
  },
  neighbours: {
    proxima: { title: 'Proxima Centauri', kicker: 'Güneş\'e en yakın yıldız', facts: [['Uzaklık', '4,24 ışık yılı'], ['Kütle', 'Güneş\'in %12\'si'], ['Sınıf', 'M5.5 kırmızı cüce'], ['Gezegen', 'Proxima b (2016)'], ['Parlamalar', 'Şiddetli, sık']] },
    alphacen: { title: 'Alpha Centauri', kicker: 'Komşu ikili', facts: [['Uzaklık', '4,37 ışık yılı'], ['A', 'G2 V, Güneş benzeri'], ['B', 'K1 V, turuncu'], ['Yörünge', '80 yıl'], ['Gökyüzünde', '3. en parlak yıldız']] },
    vega: { title: 'Vega', kicker: 'Eski ve gelecekteki Kutup Yıldızı', facts: [['Uzaklık', '25 ışık yılı'], ['Kütle', '2 Güneş'], ['Parlaklık', '40 Güneş'], ['Dönüş', 'Ekvatoru şişkin, 12,5 saat'], ['Toz diski', 'Var']] },
    polaris: { title: 'Polaris', kicker: 'Kutup Yıldızı', facts: [['Uzaklık', '~430 ışık yılı'], ['Parlaklık', '~2 000 Güneş'], ['Sınıf', 'F7 sarı süperdev'], ['Kutba uzaklık', '< 1°'], ['Sistem', 'Üçlü']] },
    antares: { title: 'Antares', kicker: 'Akrep\'in kalbi', facts: [['Uzaklık', '~550 ışık yılı'], ['Yarıçap', '~700 Güneş'], ['Kütle', '~12 Güneş'], ['Yoğunluk', 'Havadan düşük'], ['Son', 'Süpernova']] },
    deneb: { title: 'Deneb', kicker: 'Kuğu\'nun kuyruğu, çok uzakta', facts: [['Uzaklık', '~2 600 ışık yılı'], ['Parlaklık', '~200 000 Güneş'], ['Sınıf', 'A2 mavi-beyaz süperdev'], ['Yarıçap', '~200 Güneş'], ['Işık yola çıktı', 'Roma Cumhuriyeti dönemi']] },
  },
  galaxies: {
    milkyway: { title: 'Samanyolu', kicker: 'Evimize dışarıdan bakış', facts: [['Çap', '100 000 ışık yılı'], ['Yıldız sayısı', '200–400 milyar'], ['Tip', 'Çubuklu sarmal'], ['Güneş', 'Merkeze 26 000 ışık yılı'], ['Galaktik yıl', '230 milyon yıl']] },
    lmc: { title: 'Büyük Macellan Bulutu', kicker: 'En büyük uydu galaksimiz', facts: [['Uzaklık', '160 000 ışık yılı'], ['Kütle', 'Samanyolu\'nun ~%1\'i'], ['Tarantula', 'Yerel Grup\'un en büyük yıldız doğumevi'], ['R136a1', 'Bilinen en ağır yıldız'], ['SN 1987A', 'Modern çağın en yakın süpernovası']] },
    smc: { title: 'Küçük Macellan Bulutu', kicker: 'Biçimsiz küçük kardeş', facts: [['Uzaklık', '200 000 ışık yılı'], ['Tip', 'Düzensiz'], ['Köprü', 'Hidrojen, LMC\'ye uzanır'], ['Leavitt', '1912, Sefeid yasası'], ['Yıldız sayısı', '~3 milyar']] },
    andromeda: { title: 'Andromeda', kicker: 'En yakın büyük komşumuz', facts: [['Uzaklık', '2,5 milyon ışık yılı'], ['Yıldız sayısı', '~1 trilyon'], ['Çap', '~220 000 ışık yılı'], ['Hubble', '1923, Sefeid ölçümü'], ['Çarpışma', '~4,5 milyar yıl sonra']] },
    triangulum: { title: 'Üçgen Galaksisi', kicker: 'Yerel Grup\'un üçüncüsü', facts: [['Uzaklık', '2,7 milyon ışık yılı'], ['Yıldız sayısı', '~40 milyar'], ['Merkez', 'Kara delik yok'], ['NGC 604', '1 500 ışık yılı genişliğinde H II bölgesi'], ['Görünüm', 'Neredeyse tepeden']] },
    m87: { title: 'M87', kicker: 'Virgo Kümesi\'nin devi', facts: [['Uzaklık', '55 milyon ışık yılı'], ['Tip', 'Dev eliptik'], ['Küresel küme', '12 000+'], ['Kara delik', '6,5 milyar Güneş'], ['Jet', '5 000 ışık yılı']] },
    sombrero: { title: 'Sombrero Galaksisi', kicker: 'Geniş kenarlı şapka', facts: [['Uzaklık', '29 milyon ışık yılı'], ['Eğim', '~6° — neredeyse kenardan'], ['Küresel küme', '~2 000'], ['Kara delik', '~1 milyar Güneş'], ['Katalog', 'M104']] },
    antennae: { title: 'Antenler', kicker: 'Çarpışan iki galaksi', facts: [['Uzaklık', '45 milyon ışık yılı'], ['Başlangıç', '~600 milyon yıl önce'], ['Kuyruklar', 'Yüz binlerce ışık yılı'], ['Yıldız oluşumu', 'Patlama hâlinde'], ['Son', 'Tek eliptik galaksi']] },
  },
};
for (const t of TOURS) for (const s of t.steps) { const e = EXTRAS[t.id]?.[s.id]; if (e) Object.assign(s, e); }

export function tourById(id: string): TourDef | undefined {
  return TOURS.find((t) => t.id === id);
}
