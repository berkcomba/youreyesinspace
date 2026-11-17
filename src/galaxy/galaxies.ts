import { Matrix3, Vector3 } from 'three';
import { _ } from '../i18n';
import { raDecToScene } from '../math/frames';
import { Rng, hashSeed } from '../gen/SystemGenerator';
import { GALAXY_TYPE_LABEL, GalaxyModel, type GalaxyParams, type GalaxyType } from './GalaxyModel';
import { galaxyBasisFromSky, milkyWayBasis, milkyWayCenterPc } from './frames';
import { PEC_TEXELS, Peculiar, type PeculiarSpec } from './peculiar';

const MPC = 1e6;

export interface CatalogGalaxy {
  name: string; ra: number; dec: number; distMpc: number; type: GalaxyType;
  /** for a peculiar galaxy: the whole system's, rings and tails included */
  diameterKpc: number; absMag: number; pa?: number; inc?: number; axis?: number; desc?: string;
  pec?: PeculiarSpec;
}

/** Real galaxies: Local Group + bright Messier/NGC objects (approximate parameters). */
export const CATALOG: CatalogGalaxy[] = [
  { name: 'Andromeda (M31)', ra: 10.685, dec: 41.269, distMpc: 0.78, type: 'S', diameterKpc: 46, absMag: -21.5, pa: 35, inc: 77, desc: 'Yerel Grup\'un en büyük galaksisi; Samanyolu ile ~4.5 milyar yıl sonra birleşecek.' },
  { name: 'Üçgen (M33)', ra: 23.462, dec: 30.660, distMpc: 0.84, type: 'S', diameterKpc: 18, absMag: -18.9, pa: 23, inc: 54, desc: 'Yerel Grup\'un üçüncü büyük üyesi; çıplak gözle görülebilen en uzak cisimlerden biri.' },
  { name: 'Büyük Macellan Bulutu', ra: 80.894, dec: -69.756, distMpc: 0.050, type: 'Irr', diameterKpc: 9.9, absMag: -18.1, pa: 170, inc: 35, desc: 'Samanyolu\'nun en parlak uydu galaksisi. Tarantula Bulutsusu gibi dev yıldız oluşum bölgeleri barındırır.' },
  { name: 'Küçük Macellan Bulutu', ra: 13.187, dec: -72.829, distMpc: 0.061, type: 'Irr', diameterKpc: 5.8, absMag: -16.8, pa: 45, inc: 60, desc: 'Samanyolu\'nun cüce düzensiz uydu galaksisi.' },
  { name: 'M32', ra: 10.674, dec: 40.865, distMpc: 0.76, type: 'E', diameterKpc: 2.5, absMag: -16.4, axis: 0.75, desc: 'Andromeda\'nın kompakt eliptik uydusu.' },
  { name: 'M110', ra: 10.092, dec: 41.685, distMpc: 0.82, type: 'E', diameterKpc: 5.2, absMag: -16.5, pa: 170, inc: 60, axis: 0.5, desc: 'Andromeda\'nın cüce eliptik uydusu.' },
  { name: 'Barnard Galaksisi (NGC 6822)', ra: 296.235, dec: -14.789, distMpc: 0.50, type: 'Irr', diameterKpc: 2.2, absMag: -15.2 },
  { name: 'IC 1613', ra: 16.199, dec: 2.118, distMpc: 0.73, type: 'Irr', diameterKpc: 2.6, absMag: -14.5 },
  { name: 'WLM', ra: 0.492, dec: -15.461, distMpc: 0.93, type: 'Irr', diameterKpc: 3.1, absMag: -14.2 },
  { name: 'Heykeltıraş Cücesi', ra: 15.039, dec: -33.709, distMpc: 0.086, type: 'E', diameterKpc: 1.5, absMag: -11.1, axis: 0.7 },
  { name: 'Fornax Cücesi', ra: 39.997, dec: -34.449, distMpc: 0.14, type: 'E', diameterKpc: 2.0, absMag: -13.4, axis: 0.7 },
  { name: 'Leo I', ra: 152.117, dec: 12.306, distMpc: 0.25, type: 'E', diameterKpc: 1.0, absMag: -12.0, axis: 0.8 },
  { name: 'Yay Cüce Galaksisi', ra: 283.76, dec: -30.48, distMpc: 0.020, type: 'E', diameterKpc: 3.0, absMag: -13.5, axis: 0.5, desc: 'Samanyolu tarafından parçalanmakta olan cüce uydu; Galaktik merkezin arkasında.' },
  { name: 'Heykeltıraş Galaksisi (NGC 253)', ra: 11.888, dec: -25.288, distMpc: 3.5, type: 'SB', diameterKpc: 27, absMag: -21.0, pa: 52, inc: 78, desc: 'Yoğun yıldız oluşumlu "starburst" galaksi.' },
  { name: 'NGC 55', ra: 3.723, dec: -39.197, distMpc: 2.1, type: 'Irr', diameterKpc: 20, absMag: -18.5, pa: 108, inc: 80 },
  { name: 'NGC 300', ra: 13.723, dec: -37.684, distMpc: 1.9, type: 'S', diameterKpc: 20, absMag: -18.5, pa: 111, inc: 42 },
  { name: 'Centaurus A (NGC 5128)', ra: 201.365, dec: -43.019, distMpc: 3.8, type: 'S0', diameterKpc: 25, absMag: -21.0, pa: 35, inc: 60, desc: 'En yakın aktif galaksi çekirdeği; dev radyo lobları ve belirgin toz şeridi.' },
  { name: 'Güney Fırıldak (M83)', ra: 204.254, dec: -29.866, distMpc: 4.6, type: 'SB', diameterKpc: 26, absMag: -20.8, pa: 45, inc: 24 },
  { name: 'Bode Galaksisi (M81)', ra: 148.888, dec: 69.065, distMpc: 3.6, type: 'S', diameterKpc: 27, absMag: -21.1, pa: 157, inc: 60 },
  { name: 'Puro Galaksisi (M82)', ra: 148.968, dec: 69.680, distMpc: 3.5, type: 'Irr', diameterKpc: 11, absMag: -19.6, pa: 65, inc: 80, desc: 'M81 ile etkileşim sonucu patlayıcı yıldız oluşumu yaşayan galaksi.' },
  { name: 'NGC 2403', ra: 114.214, dec: 65.603, distMpc: 3.2, type: 'S', diameterKpc: 21, absMag: -19.3, pa: 127, inc: 60 },
  { name: 'Fırıldak (M101)', ra: 210.802, dec: 54.349, distMpc: 6.4, type: 'S', diameterKpc: 52, absMag: -21.5, pa: 35, inc: 18, desc: 'Samanyolu\'nun neredeyse iki katı büyüklüğünde, yüzümüze dönük dev sarmal.' },
  { name: 'Girdap (M51)', ra: 202.470, dec: 47.195, distMpc: 8.6, type: 'S', diameterKpc: 23, absMag: -21.0, pa: 163, inc: 22, desc: 'Küçük eşlikçisi NGC 5195 ile etkileşen klasik "büyük tasarım" sarmalı.' },
  { name: 'Sombrero (M104)', ra: 189.998, dec: -11.623, distMpc: 9.6, type: 'S0', diameterKpc: 29, absMag: -21.7, pa: 89, inc: 84, desc: 'Devasa şişkinliği ve keskin toz halkasıyla tanınır.' },
  { name: 'Virgo A (M87)', ra: 187.706, dec: 12.391, distMpc: 16.4, type: 'E', diameterKpc: 40, absMag: -22.3, axis: 0.85, desc: 'Başak Kümesi\'nin devi; 6.5 milyar güneş kütleli kara deliği ilk görüntülenen kara deliktir.' },
  { name: 'M49', ra: 187.445, dec: 8.000, distMpc: 17.1, type: 'E', diameterKpc: 47, absMag: -22.6, axis: 0.8 },
  { name: 'M60', ra: 190.917, dec: 11.553, distMpc: 16.8, type: 'E', diameterKpc: 35, absMag: -22.2, axis: 0.8 },
  { name: 'M86', ra: 186.549, dec: 12.946, distMpc: 15.2, type: 'S0', diameterKpc: 39, absMag: -22.0, axis: 0.65 },
  { name: 'M84', ra: 186.266, dec: 12.887, distMpc: 16.8, type: 'E', diameterKpc: 30, absMag: -21.8, axis: 0.9 },
  { name: 'M100', ra: 185.729, dec: 15.822, distMpc: 16.0, type: 'S', diameterKpc: 32, absMag: -21.7, pa: 30, inc: 28 },
  { name: 'M99', ra: 184.707, dec: 14.416, distMpc: 15.2, type: 'S', diameterKpc: 27, absMag: -21.2, pa: 50, inc: 20 },
  { name: 'M61', ra: 185.479, dec: 4.474, distMpc: 16.0, type: 'SB', diameterKpc: 30, absMag: -21.3, pa: 10, inc: 20 },
  { name: 'Kara Göz (M64)', ra: 194.182, dec: 21.683, distMpc: 5.3, type: 'S', diameterKpc: 16, absMag: -20.3, pa: 115, inc: 60 },
  { name: 'Ayçiçeği (M63)', ra: 198.955, dec: 42.029, distMpc: 8.9, type: 'S', diameterKpc: 29, absMag: -21.0, pa: 105, inc: 55 },
  { name: 'M94', ra: 192.721, dec: 41.120, distMpc: 4.7, type: 'S', diameterKpc: 15, absMag: -19.9, pa: 120, inc: 35 },
  { name: 'M106', ra: 184.740, dec: 47.304, distMpc: 7.2, type: 'SB', diameterKpc: 40, absMag: -21.3, pa: 150, inc: 70 },
  { name: 'Hayalet (M74)', ra: 24.174, dec: 15.783, distMpc: 9.0, type: 'S', diameterKpc: 26, absMag: -20.8, pa: 25, inc: 20 },
  { name: 'M77', ra: 40.670, dec: -0.013, distMpc: 12.9, type: 'SB', diameterKpc: 27, absMag: -21.5, pa: 70, inc: 30, desc: 'En yakın ve en parlak Seyfert galaksilerinden biri.' },
  { name: 'M65', ra: 169.733, dec: 13.092, distMpc: 10.7, type: 'SB', diameterKpc: 28, absMag: -21.0, pa: 174, inc: 70 },
  { name: 'M66', ra: 170.063, dec: 12.991, distMpc: 10.7, type: 'SB', diameterKpc: 29, absMag: -21.3, pa: 173, inc: 55 },
  { name: 'NGC 3628', ra: 170.071, dec: 13.589, distMpc: 10.7, type: 'S', diameterKpc: 30, absMag: -20.6, pa: 104, inc: 87 },
  { name: 'M95', ra: 160.990, dec: 11.704, distMpc: 10.0, type: 'SB', diameterKpc: 21, absMag: -20.4, pa: 13, inc: 45 },
  { name: 'M96', ra: 161.691, dec: 11.820, distMpc: 9.4, type: 'SB', diameterKpc: 22, absMag: -20.7, pa: 176, inc: 50 },
  { name: 'M105', ra: 161.957, dec: 12.582, distMpc: 10.6, type: 'E', diameterKpc: 16, absMag: -20.6, axis: 0.9 },
  { name: 'M108', ra: 167.879, dec: 55.674, distMpc: 14.1, type: 'SB', diameterKpc: 35, absMag: -21.0, pa: 80, inc: 80 },
  { name: 'M109', ra: 179.400, dec: 53.375, distMpc: 16.9, type: 'SB', diameterKpc: 37, absMag: -21.5, pa: 63, inc: 45 },
  { name: 'NGC 891', ra: 35.639, dec: 42.349, distMpc: 9.1, type: 'S', diameterKpc: 33, absMag: -20.9, pa: 22, inc: 89, desc: 'Tam kenardan görülen, Samanyolu\'na çok benzeyen sarmal.' },
  { name: 'İğne Galaksisi (NGC 4565)', ra: 189.087, dec: 25.988, distMpc: 11.9, type: 'S', diameterKpc: 55, absMag: -21.7, pa: 136, inc: 88 },
  { name: 'NGC 1300', ra: 49.921, dec: -19.411, distMpc: 18.7, type: 'SB', diameterKpc: 33, absMag: -21.3, pa: 106, inc: 35, desc: 'Ders kitabı çubuklu sarmal.' },
  { name: 'NGC 7331', ra: 339.267, dec: 34.416, distMpc: 12.2, type: 'S', diameterKpc: 37, absMag: -21.6, pa: 171, inc: 70 },
  { name: 'Fornax A (NGC 1316)', ra: 50.674, dec: -37.208, distMpc: 19.0, type: 'S0', diameterKpc: 45, absMag: -22.8, axis: 0.7 },
  { name: 'NGC 1365', ra: 53.402, dec: -36.140, distMpc: 17.9, type: 'SB', diameterKpc: 60, absMag: -22.3, pa: 32, inc: 40 },
  { name: 'M58', ra: 189.431, dec: 11.818, distMpc: 19.1, type: 'SB', diameterKpc: 34, absMag: -21.5, pa: 95, inc: 40 },
  {
    name: 'Antenler (NGC 4038)', ra: 180.4708, dec: -18.8694, distMpc: 22, type: 'S', diameterKpc: 120, absMag: -21.4, pa: 0, inc: 25,
    desc: 'Birleşmekte olan iki sarmal galaksiden kuzeydeki. Çarpışmanın sıkıştırdığı gaz milyarlarca yeni yıldız doğuruyor; gelgit kuvvetleri iki galaksiden de upuzun birer yıldız kuyruğu çekip çıkarmış. Böcek antenlerine benzeyen bu kuyruklar galaksilere adını verir.',
    pec: { label: 'Birleşen galaksi', body: 0.14, tails: [{ phase: 200, sweep: 45, r0: 0.12, r1: 1.2, lift: 0.18, w0: 0.035, w1: 0.08, light: 0.16, young: 0.45, knots: 0.55 }] },
  },
];

/**
 * Peculiar galaxies drawn by hand after published images: rings, tidal tails, warps (shapes and
 * numbers approximate). Members of a pair share one distance, so they stand side by side. They
 * come after the survey galaxies in the index: adding them moves no existing galaxy's index.
 */
export const PECULIAR_CATALOG: CatalogGalaxy[] = [
  {
    name: 'Hoag Nesnesi', ra: 229.3100, dec: 21.5856, distMpc: 183, type: 'E', diameterKpc: 46, absMag: -21.1, pa: 0, inc: 20, axis: 0.9,
    desc: 'Neredeyse kusursuz bir halka galaksi: yaşlı, sarı yıldızlardan oluşan yuvarlak çekirdeği karanlık bir boşluk ve genç, mavi yıldızlardan bir halka çevreliyor. Bu biçimin nasıl oluştuğu hâlâ tartışmalı. Boşluğun içinden, çok daha uzaktaki ikinci bir halka galaksi görünür.',
    pec: {
      label: 'Halka galaksi', body: 0.3,
      rings: [
        // tightly wound blue strands, a sharp inner edge and a fluffy outside
        { r: 0.76, w: 0.09, h: 0.035, skew: 1.8, wobble: 0.22, strands: 9, twist: 7, strandAmp: 0.6, light: 0.32, young: 0.85, knots: 0.9, dust: 0.15 },
        // the faint red inner ring deep images show in the gap
        { r: 0.46, w: 0.03, h: 0.03, arc: 0.35, arcPhase: 130, wobble: 0.15, light: 0.02, young: 0.12, knots: 0.1, dust: 0.05 },
      ],
    },
  },
  {
    name: 'Araba Tekerleği (ESO 350-40)', ra: 9.4213, dec: -33.7164, distMpc: 129, type: 'S0', diameterKpc: 50, absMag: -21.0, pa: 15, inc: 40,
    desc: 'Birkaç yüz milyon yıl önce küçük bir galaksi bu sarmalın tam ortasından geçti. Çarpışmanın yarattığı dalga, suya atılan taşın halkası gibi dışa yayıldı ve geçtiği yerde gazı sıkıştırarak genç, mavi yıldızlardan dev bir halka yaktı. İç halkayı dış halkaya tekerlek parmaklıkları gibi ince kollar bağlar.',
    pec: {
      label: 'Çarpışma halkası galaksisi', body: 0.2,
      rings: [
        { r: 0.9, w: 0.055, h: 0.03, ox: 0.08, oz: -0.06, spokes: 14, spokeIn: 0.32, light: 0.42, young: 0.95, knots: 0.95, dust: 0.3 },
        { r: 0.27, w: 0.04, h: 0.03, light: 0.1, young: 0.15, knots: 0.35, dust: 0.9 },
      ],
    },
  },
  {
    name: 'Lindsay-Shapley Halkası (AM 0644-741)', ra: 100.7751, dec: -74.2362, distMpc: 92.9, type: 'S0', diameterKpc: 56, absMag: -22.3, pa: 90, inc: 55,
    desc: 'Yaklaşık 150 bin ışık yılı çapında bir çarpışma halkası. Halkadaki pembe düğümler, çarpışmanın sıkıştırdığı gazda yeni doğan yıldızların aydınlattığı dev hidrojen bulutları. Eski çekirdek halkanın merkezinden belirgin biçimde kaymış duruyor.',
    pec: { label: 'Çarpışma halkası galaksisi', body: 0.22, rings: [{ r: 0.75, w: 0.06, h: 0.03, ox: 0.3, oz: 0.05, arc: 0.7, arcPhase: 0, light: 0.55, young: 0.95, knots: 1, dust: 0.35 }] },
  },
  {
    name: 'Arp 147 (halka)', ra: 47.8266, dec: 1.3150, distMpc: 138, type: 'S0', diameterKpc: 30, absMag: -20.0, pa: 0, inc: 35,
    desc: 'Komşusu tam içinden geçince ortaya çıkan neredeyse kusursuz bir halka. Mavi halkada yeni yıldızlar doğuyor; halkanın kenarındaki kızıl düğüm galaksinin eski çekirdeği olabilir.',
    pec: { label: 'Çarpışma halkası galaksisi', body: 0.12, rings: [{ r: 0.6, w: 0.07, h: 0.035, ox: 0.35, oz: -0.25, light: 0.72, young: 0.95, knots: 1, dust: 0.3 }] },
  },
  {
    name: 'Arp 147 (eşlikçi)', ra: 47.8349, dec: 1.3135, distMpc: 138, type: 'E', diameterKpc: 18, absMag: -20.6, axis: 0.75,
    desc: 'Komşusunun içinden geçerek onu bir halkaya dönüştüren galaksi. Kendisi de çarpışmadan nasibini almış: çevresinde soluk bir yıldız halesi var.',
  },
  {
    name: 'NGC 922', ra: 36.2684, dec: -24.7882, distMpc: 43.9, type: 'SB', diameterKpc: 32, absMag: -20.6, pa: 0, inc: 30,
    desc: 'Cüce bir galaksinin diskin içinden geçmesiyle oluşmuş, C harfine benzeyen yarım bir halka. Halka boyunca yoğun, pembe yıldız oluşum bölgeleri sıralanır; çarpan cüce galaksi bugün biraz ötede duruyor.',
    pec: { label: 'Çarpışma halkası galaksisi', body: 0.4, rings: [{ r: 0.72, w: 0.08, h: 0.035, ox: -0.1, oz: 0.05, arc: 0.12, arcPhase: 200, light: 0.42, young: 0.95, knots: 0.95, dust: 0.3 }] },
  },
  {
    name: 'NGC 4650A', ra: 191.2044, dec: -40.7143, distMpc: 41.8, type: 'S0', diameterKpc: 34, absMag: -19.6, pa: 120, inc: 75,
    desc: 'Kutup halkalı galaksilerin en ünlüsü: yaşlı yıldızlardan oluşan lentiküler bir galaksinin çevresinde, kutuplarının üzerinden geçen geniş bir gaz, toz ve genç yıldız halkası döner. Halka başka bir galaksiden koparılmış ya da kozmik ağdan süzülen gazdan oluşmuş olabilir.',
    pec: { label: 'Kutup halkalı galaksi', body: 0.32, rings: [{ r: 0.55, w: 0.2, h: 0.03, tilt: 90, tiltAz: 90, light: 0.45, young: 0.75, knots: 0.6, dust: 1 }] },
  },
  {
    name: 'NGC 660', ra: 25.7598, dec: 13.6457, distMpc: 12.2, type: 'S', diameterKpc: 36, absMag: -20.4, pa: 135, inc: 80,
    desc: 'Kenardan gördüğümüz bir diski, ona eğik duran geniş bir yıldız, gaz ve toz halkası sarıyor. Halkanın geçmişteki bir galaksi karşılaşmasından kaldığı düşünülüyor.',
    pec: { label: 'Kutup halkalı galaksi', body: 0.5, rings: [{ r: 0.7, w: 0.12, h: 0.035, tilt: 55, tiltAz: 90, arc: 0.6, arcPhase: 30, light: 0.35, young: 0.6, knots: 0.6, dust: 1 }] },
  },
  {
    name: 'Fareler (NGC 4676A)', ra: 191.5421, dec: 30.7319, distMpc: 93.6, type: 'S0', diameterKpc: 100, absMag: -21.6, pa: 0, inc: 65,
    desc: 'Birbirinin çevresinde dönen iki galaksiden kuzeydeki. Kütle çekimi yıldızlarının bir bölümünü upuzun, dümdüz bir kuyruk hâlinde dışarı çekmiş; fare benzetmesi buradan geliyor. İkisi sonunda tek bir galaksiye dönüşecek.',
    pec: { label: 'Etkileşen galaksi', body: 0.2, tails: [{ phase: 0, sweep: 12, r0: 0.12, r1: 1.25, lift: 0.12, w0: 0.045, w1: 0.11, light: 0.22, young: 0.6, knots: 0.4 }] },
  },
  {
    name: 'Fareler (NGC 4676B)', ra: 191.5467, dec: 30.7228, distMpc: 93.6, type: 'SB', diameterKpc: 80, absMag: -21.3, pa: 0, inc: 45,
    desc: 'Farelerin güneydeki üyesi: çubuklu sarmalından kopan yıldızlar kıvrık bir kuyruk çiziyor. Samanyolu ile Andromeda\'nın karşılaşması da bir gün buna benzeyecek.',
    pec: { label: 'Etkileşen galaksi', body: 0.25, tails: [{ phase: 185, sweep: -70, r0: 0.15, r1: 1.2, lift: -0.1, w0: 0.06, w1: 0.13, light: 0.2, young: 0.6, knots: 0.5 }] },
  },
  {
    name: 'Antenler (NGC 4039)', ra: 180.4729, dec: -18.8861, distMpc: 22, type: 'S', diameterKpc: 100, absMag: -21.0, pa: 0, inc: 30,
    desc: 'Antenlerin güneydeki üyesi. Kuzeydeki komşusuyla birkaç yüz milyon yıl içinde tek bir eliptik galaksiye dönüşecek; Samanyolu ile Andromeda\'nın geleceği de böyle görünecek.',
    pec: { label: 'Birleşen galaksi', body: 0.16, tails: [{ phase: 160, sweep: -45, r0: 0.12, r1: 1.15, lift: -0.15, w0: 0.035, w1: 0.075, light: 0.14, young: 0.45, knots: 0.6 }] },
  },
  {
    name: 'İribaş (UGC 10214)', ra: 241.5169, dec: 55.4253, distMpc: 134.3, type: 'SB', diameterKpc: 170, absMag: -22.0, pa: 0, inc: 35,
    desc: 'Yanından geçen küçük bir galaksinin kütle çekimi, diskinden yaklaşık 280 bin ışık yılı uzunluğunda bir yıldız ve gaz kuyruğu çekip çıkarmış. Kuyruk boyunca parlak, mavi yıldız kümeleri doğuyor; bunlar zamanla bağımsız cüce galaksilere dönüşebilir.',
    pec: { label: 'Etkileşen galaksi', body: 0.17, tails: [{ phase: 95, sweep: 18, r0: 0.12, r1: 1.25, lift: 0.08, w0: 0.045, w1: 0.09, light: 0.25, young: 0.85, knots: 0.9 }] },
  },
  {
    name: 'Gül (Arp 273, UGC 1810)', ra: 35.3696, dec: 39.3757, distMpc: 106.4, type: 'S', diameterKpc: 66, absMag: -22.2, pa: 0, inc: 35,
    desc: 'Arp 273 çiftinin büyük üyesi. Küçük komşusu diskinin içinden geçmiş olabilir; kolları bu yüzden kaymış ve halkaya benzer bir biçim almış; çift uzaktan bir gülü andırıyor. Kolların ucundaki mavi düğümler, karşılaşmanın tetiklediği yıldız oluşumu.',
    pec: { label: 'Etkileşen galaksi', body: 0.72, rings: [{ r: 0.82, w: 0.06, h: 0.03, ox: 0.06, oz: -0.08, arc: 0.25, arcPhase: 140, light: 0.25, young: 0.95, knots: 0.9, dust: 0.4 }] },
  },
  {
    name: 'Arp 273 (UGC 1813)', ra: 35.3858, dec: 39.3568, distMpc: 106.4, type: 'S', diameterKpc: 40, absMag: -21.0, pa: 0, inc: 82,
    desc: 'Arp 273\'ün kenardan görülen küçük üyesi; büyük komşusunun diskinin içinden geçtiği düşünülüyor.',
  },
  {
    name: 'NGC 2207', ra: 94.0921, dec: -21.3727, distMpc: 39.3, type: 'S', diameterKpc: 50, absMag: -21.9, pa: 0, inc: 35,
    desc: 'IC 2163 ile iç içe geçmiş gibi duran dev sarmal. Kütle çekimleri birbirlerinin kollarını çekiştiriyor; birkaç milyar yıl içinde birleşmeleri bekleniyor.',
    pec: { label: 'Etkileşen galaksi', body: 0.9, tails: [{ phase: 300, sweep: 35, r0: 0.7, r1: 1.2, lift: 0.08, w0: 0.05, w1: 0.09, light: 0.06, young: 0.8, knots: 0.7 }] },
  },
  {
    name: 'IC 2163', ra: 94.1167, dec: -21.3758, distMpc: 39.3, type: 'SB', diameterKpc: 56, absMag: -21.5, pa: 0, inc: 55,
    desc: 'NGC 2207\'nin yanından geçerken kolları gelgit kuvvetiyle göz kapağı biçiminde sıkışmış ve doğuya doğru uzun bir kuyruğa savrulmuş galaksi.',
    pec: {
      label: 'Etkileşen galaksi', body: 0.4,
      rings: [{ r: 0.4, w: 0.045, h: 0.03, arc: 0.15, arcPhase: 90, light: 0.15, young: 0.8, knots: 0.6, dust: 0.8 }],
      tails: [{ phase: 80, sweep: 25, r0: 0.3, r1: 1.25, lift: 0.08, w0: 0.06, w1: 0.12, light: 0.22, young: 0.75, knots: 0.6 }],
    },
  },
  {
    name: 'Penguen (NGC 2936)', ra: 144.4339, dec: 2.7609, distMpc: 98.4, type: 'S', diameterKpc: 70, absMag: -22.0, pa: 0, inc: 40,
    desc: 'Bir zamanlar sıradan bir sarmaldı; yanındaki eliptik galaksinin kütle çekimi diskini bükerek bir penguen silueti çizdi: parlak çekirdek gözü, kıvrılan kollar gövdeyi ve gagayı oluşturuyor.',
    pec: {
      label: 'Etkileşen galaksi', body: 0.3,
      tails: [
        { phase: 20, sweep: 160, r0: 0.25, r1: 1.0, lift: 0.05, w0: 0.08, w1: 0.13, light: 0.33, young: 0.8, knots: 0.8 },
        { phase: 200, sweep: 60, r0: 0.25, r1: 0.8, lift: -0.05, w0: 0.06, w1: 0.1, light: 0.12, young: 0.7, knots: 0.6 },
      ],
    },
  },
  {
    name: 'Yumurta (NGC 2937)', ra: 144.4377, dec: 2.7474, distMpc: 98.4, type: 'E', diameterKpc: 28, absMag: -21.4, axis: 0.7,
    desc: 'Penguenin yanındaki "yumurta": yıldız oluşumu çoktan durmuş, pürüzsüz bir eliptik galaksi. Penguenin biçimini bozan onun kütle çekimi.',
  },
  {
    name: 'Barış İçin Atomlar (NGC 7252)', ra: 335.1865, dec: -24.6783, distMpc: 68.5, type: 'E', diameterKpc: 150, absMag: -21.9, pa: 0, inc: 30, axis: 0.85,
    desc: 'Yaklaşık bir milyar yıl önce iki sarmal galaksinin birleşmesinden kalan genç bir eliptik galaksi. Çekirdeğin çevresindeki ilmekler elektron yörüngeli atom çizimlerini andırdığı için adını Eisenhower\'ın 1953\'teki "Barış İçin Atomlar" konuşmasından alır; iki uzun kuyruk çarpışmanın izi.',
    pec: {
      label: 'Birleşme kalıntısı', body: 0.14,
      rings: [{ r: 0.2, w: 0.022, h: 0.04, arc: 0.3, arcPhase: 45, light: 0.06, young: 0.2, knots: 0.2, dust: 0.1 }],
      tails: [
        { phase: 340, sweep: 70, r0: 0.1, r1: 1.2, lift: 0.15, w0: 0.035, w1: 0.09, light: 0.12, young: 0.4, knots: 0.5 },
        { phase: 160, sweep: 70, r0: 0.1, r1: 1.15, lift: -0.12, w0: 0.035, w1: 0.09, light: 0.11, young: 0.4, knots: 0.5 },
      ],
    },
  },
  {
    name: 'İntegral İşareti (UGC 3697)', ra: 107.8439, dec: 71.8364, distMpc: 44.8, type: 'S', diameterKpc: 50, absMag: -20.2, pa: 0, inc: 88,
    desc: 'Kenardan gördüğümüz ince diskinin iki ucu zıt yönlere kıvrılmış; bu yüzden ∫ (integral) işaretine benziyor. Bükülmenin yakındaki küçük bir komşunun kütle çekiminden kaynaklandığı düşünülüyor.',
    pec: { label: 'Bükülmüş disk', body: 0.85, bend: 0.12 },
  },
];

/** every hand-made galaxy: the catalogue and the peculiar ones (static site, name lookups) */
export const HANDMADE: CatalogGalaxy[] = [...CATALOG, ...PECULIAR_CATALOG];

export const TYPE_CODE: Record<GalaxyType, number> = { E: 0, S0: 1, S: 2, SB: 3, Irr: 4 };
/** guest slots for far-cluster member galaxies the camera is close to (see GalaxyIndex.adopt) */
const GUEST_SLOTS = 3;
export const TYPE_BY_CODE: GalaxyType[] = ['E', 'S0', 'S', 'SB', 'Irr'];

/**
 * Real galaxies of the surveys (public/data/galaxies.json, scripts/build-galaxies.mjs):
 * [ra, dec, distance Mpc, radius kpc, absolute magnitude, type (+8: guessed), axis ratio, name, source]
 */
export interface SurveyGalaxies {
  sources: Record<string, string>;
  h0: number;
  rows: Array<[number, number, number, number, number, number, number, string, number]>;
}

export async function loadSurveyGalaxies(baseUrl: string): Promise<SurveyGalaxies> {
  const res = await fetch(`${baseUrl}data/galaxies.json`);
  if (!res.ok) throw new Error(`galaxies.json: ${res.status}`);
  return res.json() as Promise<SurveyGalaxies>;
}

/** where a galaxy's data come from */
export type GalaxySourceKind = 'milkyway' | 'handmade' | 'ungc' | '2mrs' | '2mrs-cluster' | 'procedural' | 'guest';

/** 2MRS limit (Ks, extinction-corrected) and the mean V − Ks of its galaxies */
const SURVEY_KS_LIMIT = 11.75;
const SURVEY_V_K = 3.0;
/** the survey misses galaxies behind the Milky Way's disc (|b| below ~6°) */
const SIN_ZONE_OF_AVOIDANCE = Math.sin(6 * Math.PI / 180);

/** Anything the galaxy sprite renderer can draw (the local index and the far-universe tiers). */
export interface GalaxySource {
  readonly count: number;
  /** entries [0, catalogCount) may be labelled */
  readonly catalogCount: number;
  /** real survey galaxies [surveyStart, surveyEnd) (after the generated ones) */
  readonly surveyStart?: number;
  readonly surveyEnd?: number;
  /** pc, scene frame, relative to the Sun */
  readonly positions: Float32Array;
  readonly radius: Float32Array;
  readonly absMag: Float32Array;
  readonly type: Uint8Array;
  readonly seed: Uint32Array;
  readonly normal: Float32Array;
  readonly major: Float32Array;
  readonly axisRatio: Float32Array;
  /** spiral arm count / pitch angle (deg) — absent for unresolved aggregate tiers */
  readonly arms?: Float32Array;
  readonly pitch?: Float32Array;
  /** hand-made peculiar galaxies [peculiarStart, peculiarEnd) (after the survey), labelled too */
  readonly peculiarStart?: number;
  readonly peculiarEnd?: number;
  /** the sprite's parameters of the peculiar galaxies (see Peculiar.spriteTexels) */
  peculiarSprites?(): PeculiarSprites;
  name(i: number): string;
}

export interface PeculiarSprites {
  /** PEC_TEXELS RGBA texels per peculiar galaxy */
  texels: Float32Array;
  /** the galaxy of each row */
  index: number[];
}

/** survey row also drawn by hand among the peculiar galaxies: kept (indices stay put) but parked */
const SURVEY_PARKED = 16;

function fract(x: number): number { return x - Math.floor(x); }

/** Cheap 3D value noise for the cosmic web */
export function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const h = (a: number, b: number, c: number) => {
    let n = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const s = (t: number) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(
    lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

/**
 * Flat index of every galaxy: index 0 = Milky Way, then the real catalogue, then a procedural
 * cosmic web out to ~250 Mpc. Full `GalaxyModel`s are built lazily.
 */
export class GalaxyIndex {
  /** galaxies in use (grows by a few when guest slots are occupied) */
  count: number;
  readonly catalogCount: number;
  /** real survey galaxies (UNGC, 2MRS) occupy [surveyStart, surveyEnd), after the generated ones */
  readonly surveyStart: number;
  readonly surveyEnd: number;
  /** hand-made peculiar galaxies occupy [peculiarStart, peculiarEnd), after the survey */
  readonly peculiarStart: number;
  readonly peculiarEnd: number;
  private readonly surveyNames: string[] = [];
  /**
   * per survey galaxy: source row code (0 UNGC, 1 2MRS Hubble-law, 2 2MRS cluster) + 8 when the
   * type is a guess + SURVEY_PARKED
   */
  private readonly surveyFlags: Uint8Array;
  readonly surveyCredits: Record<string, string>;
  readonly surveyH0: number;
  /** pc, scene frame, relative to the Sun */
  readonly positions: Float32Array;
  readonly radius: Float32Array;      // pc
  readonly absMag: Float32Array;
  readonly type: Uint8Array;
  readonly seed: Uint32Array;
  /** disc normal (scene frame) */
  readonly normal: Float32Array;
  /** in-plane major axis (scene frame) */
  readonly major: Float32Array;
  readonly axisRatio: Float32Array;
  /** spiral arm count (S / SB; shared by the analytic model and the sprite shader) */
  readonly arms: Float32Array;
  /** pitch angle (deg) */
  readonly pitch: Float32Array;
  private readonly models = new Map<number, GalaxyModel>();
  /**
   * Guest slots: member galaxies of a far-universe cluster the camera has come close to are
   * copied here for as long as we are near them, so that the ordinary machinery (analytic model,
   * star cloud, procedural stars and deep-sky objects, "which galaxy am I in") treats them as
   * real galaxies. Slots are reused; `guestKey` tells which member occupies one.
   */
  readonly guestSlots = GUEST_SLOTS;
  readonly guestBase: number;
  private readonly guestKey: (string | null)[] = new Array(GUEST_SLOTS).fill(null);
  private readonly guestName = new Map<number, string>();

  constructor(proceduralCount = 110_000, survey: SurveyGalaxies | null = null) {
    const surveyRows = survey?.rows ?? [];
    const N = 1 + CATALOG.length + proceduralCount + surveyRows.length + PECULIAR_CATALOG.length + GUEST_SLOTS;
    // the generated population stops here; then the survey galaxies, the peculiar ones, the guest slots
    const LIMIT = 1 + CATALOG.length + proceduralCount;
    this.surveyFlags = new Uint8Array(surveyRows.length);
    this.surveyCredits = survey?.sources ?? {};
    this.surveyH0 = survey?.h0 ?? 70;
    this.positions = new Float32Array(N * 3);
    this.radius = new Float32Array(N);
    this.absMag = new Float32Array(N);
    this.type = new Uint8Array(N);
    this.seed = new Uint32Array(N);
    this.normal = new Float32Array(N * 3);
    this.major = new Float32Array(N * 3);
    this.axisRatio = new Float32Array(N);
    this.catalogCount = 1 + CATALOG.length;

    const basis = new Matrix3();
    const setBasis = (i: number, b: Matrix3) => {
      const m = b.elements;
      this.major[i * 3] = m[0]; this.major[i * 3 + 1] = m[1]; this.major[i * 3 + 2] = m[2];
      this.normal[i * 3] = m[3]; this.normal[i * 3 + 1] = m[4]; this.normal[i * 3 + 2] = m[5];
    };

    // 0: Milky Way
    const mwC = milkyWayCenterPc();
    this.positions.set([mwC.x, mwC.y, mwC.z], 0);
    this.radius[0] = 15_000;
    this.absMag[0] = -20.9;
    this.type[0] = TYPE_CODE.SB;
    this.seed[0] = 1;
    this.axisRatio[0] = 0.1;
    setBasis(0, milkyWayBasis(basis));

    // Real galaxies
    const dir = new Vector3();
    const placeHandmade = (g: CatalogGalaxy, i: number) => {
      raDecToScene(g.ra, g.dec, dir);
      const d = g.distMpc * MPC;
      this.positions[i * 3] = dir.x * d; this.positions[i * 3 + 1] = dir.y * d; this.positions[i * 3 + 2] = dir.z * d;
      this.radius[i] = (g.diameterKpc * 1000) / 2;
      this.absMag[i] = g.absMag;
      this.type[i] = TYPE_CODE[g.type];
      this.seed[i] = hashSeed(i, 0x6a1a);
      this.axisRatio[i] = g.axis ?? (g.type === 'E' ? 0.75 : 0.12);
      setBasis(i, galaxyBasisFromSky(dir, g.pa ?? 0, g.inc ?? (g.type === 'E' ? 40 : 45), basis));
    };
    CATALOG.forEach((g, k) => placeHandmade(g, 1 + k));

    // Procedural cosmic web: cluster nodes, filaments between neighbouring nodes, and a sparse
    // field population. `env` (0 field … 1 cluster core) biases luminosity and Hubble type.
    const rng = new Rng(0xC05A11C);
    const box = 250 * MPC;
    let i = this.catalogCount;
    const gauss = () => {
      const u1 = Math.max(rng.next(), 1e-9), u2 = rng.next();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };
    const ngp = raDecToScene(192.85948, 27.12825, new Vector3());
    const place = (x: number, y: number, z: number, env: number): void => {
      if (i >= LIMIT) return;
      const dSun = Math.sqrt(x * x + y * y + z * z);
      // spherical local volume (a cube would be visible from outside as a box of galaxies)
      if (dSun < 2.5 * MPC || dSun > box) return;
      let M = -16.5 - 6.2 * Math.pow(rng.next(), 0.55 + 0.45 * (1 - env)) - env * 0.6;
      // with the real survey loaded, every galaxy above its detection limit is a real one: the
      // generated population only fills in below it (and behind the Galactic plane, where it is blind)
      if (survey && Math.abs(x * ngp.x + y * ngp.y + z * ngp.z) > dSun * SIN_ZONE_OF_AVOIDANCE) {
        const limit = SURVEY_KS_LIMIT + SURVEY_V_K - 5 * Math.log10(dSun) + 5;
        if (M < limit) M = limit + 0.2 + 1.3 * fract(Math.sin(x * 1e-5 + y * 3.1e-6 + z * 7.7e-6) * 43758.5453);
      }
      const tr = rng.next();
      const pE = 0.1 + 0.35 * env, pS0 = pE + 0.1 + 0.2 * env, pS = pS0 + 0.36 * (1 - env * 0.6), pSB = pS + 0.24 * (1 - env * 0.6);
      const t: GalaxyType = tr < pE ? 'E' : tr < pS0 ? 'S0' : tr < pS ? 'S' : tr < pSB ? 'SB' : 'Irr';
      this.positions[i * 3] = x; this.positions[i * 3 + 1] = y; this.positions[i * 3 + 2] = z;
      this.radius[i] = 2000 * Math.pow(10, (-M - 16) / 5) * (t === 'Irr' ? 0.6 : 1);
      this.absMag[i] = M;
      this.type[i] = TYPE_CODE[t];
      this.seed[i] = hashSeed(i, 0x9a1a, Math.floor(x / 1e5));
      this.axisRatio[i] = t === 'E' ? 0.5 + rng.next() * 0.5 : 0.08 + rng.next() * 0.08;
      // random orientation
      const nrm = new Vector3(rng.next() * 2 - 1, rng.next() * 2 - 1, rng.next() * 2 - 1).normalize();
      const tmp = Math.abs(nrm.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
      const maj = new Vector3().crossVectors(tmp, nrm).normalize();
      this.normal[i * 3] = nrm.x; this.normal[i * 3 + 1] = nrm.y; this.normal[i * 3 + 2] = nrm.z;
      this.major[i * 3] = maj.x; this.major[i * 3 + 1] = maj.y; this.major[i * 3 + 2] = maj.z;
      i++;
    };

    // 1. nodes (cluster / group centres) – denser where the large-scale noise is high
    const nodeCount = 1100;
    const nodes: Array<{ x: number; y: number; z: number; rich: number; r: number }> = [];
    while (nodes.length < nodeCount) {
      const x = (rng.next() * 2 - 1) * box, y = (rng.next() * 2 - 1) * box, z = (rng.next() * 2 - 1) * box;
      const s1 = 1 / (45 * MPC);
      const n1 = vnoise(x * s1 + 13.1, y * s1 + 7.7, z * s1 + 3.3);
      if (rng.next() > 0.15 + 0.85 * n1 * n1) continue;
      const rich = Math.pow(rng.next(), 2.2); // few rich clusters, many poor groups
      nodes.push({ x, y, z, rich, r: (0.8 + 2.2 * rich) * MPC });
    }
    // the Virgo cluster (real) is a node too, so procedural filaments lead toward it
    raDecToScene(187.7, 12.4, dir);
    nodes.push({ x: dir.x * 16.5 * MPC, y: dir.y * 16.5 * MPC, z: dir.z * 16.5 * MPC, rich: 0.9, r: 2.2 * MPC });

    const clusterBudget = Math.floor(proceduralCount * 0.42);
    const filamentBudget = Math.floor(proceduralCount * 0.40);
    const richSum = nodes.reduce((s, n) => s + 0.15 + n.rich, 0);

    // 2. cluster members: roughly NFW-like (steep core, r^-2.5 wings)
    for (const n of nodes) {
      const members = Math.max(6, Math.round(clusterBudget * (0.15 + n.rich) / richSum));
      for (let k = 0; k < members && i < LIMIT; k++) {
        const u = rng.next();
        const rad = n.r * 1.4 * Math.pow(u, 0.75) * (1 + 0.5 * Math.abs(gauss()));
        const v = new Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(rad);
        const env = Math.max(0, 1 - rad / (n.r * 2.5));
        place(n.x + v.x, n.y + v.y, n.z + v.z, 0.5 + 0.5 * env);
      }
    }

    // 3. filaments: each node connects to its 2–3 nearest neighbours
    const edges: Array<[number, number]> = [];
    const seen = new Set<number>();
    for (let a = 0; a < nodes.length; a++) {
      const na = nodes[a];
      const near: Array<[number, number]> = [];
      for (let b = 0; b < nodes.length; b++) {
        if (a === b) continue;
        const nb = nodes[b];
        const d2 = (na.x - nb.x) ** 2 + (na.y - nb.y) ** 2 + (na.z - nb.z) ** 2;
        near.push([d2, b]);
      }
      near.sort((p, q) => p[0] - q[0]);
      const links = 2 + (rng.next() < 0.5 ? 1 : 0);
      for (let k = 0; k < links; k++) {
        const b = near[k][1];
        const key = a < b ? a * 4096 + b : b * 4096 + a;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push([a, b]);
      }
    }
    const lengthSum = edges.reduce((s, [a, b]) => s + Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y, nodes[a].z - nodes[b].z), 0);
    for (const [a, b] of edges) {
      const na = nodes[a], nb = nodes[b];
      const L = Math.hypot(na.x - nb.x, na.y - nb.y, na.z - nb.z);
      const count = Math.round(filamentBudget * L / lengthSum);
      // slight bow so filaments aren't perfectly straight
      const bow = new Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(L * 0.08 * rng.next());
      for (let k = 0; k < count && i < LIMIT; k++) {
        const t = rng.next();
        const sig = (1.2 + 0.8 * rng.next()) * MPC;
        const bx = bow.x * 4 * t * (1 - t), by = bow.y * 4 * t * (1 - t), bz = bow.z * 4 * t * (1 - t);
        place(
          na.x + (nb.x - na.x) * t + bx + gauss() * sig,
          na.y + (nb.y - na.y) * t + by + gauss() * sig,
          na.z + (nb.z - na.z) * t + bz + gauss() * sig,
          0.25,
        );
      }
    }

    // 4. field galaxies (avoid the emptiest voids)
    let tries = 0;
    while (i < LIMIT && tries < proceduralCount * 20) {
      tries++;
      const x = (rng.next() * 2 - 1) * box, y = (rng.next() * 2 - 1) * box, z = (rng.next() * 2 - 1) * box;
      const s2 = 1 / (18 * MPC);
      const n2 = vnoise(x * s2 + 101.5, y * s2 + 55.2, z * s2 + 9.9);
      if (rng.next() > n2 * n2) continue;
      place(x, y, z, 0.05);
    }

    // real survey galaxies (the hand-made catalogue keeps the ones it already has)
    this.surveyStart = i;
    const handDirs = CATALOG.map((g) => raDecToScene(g.ra, g.dec, new Vector3()));
    const pecDirs = PECULIAR_CATALOG.map((g) => raDecToScene(g.ra, g.dec, new Vector3()));
    for (const [ra, dec, dMpc, rKpc, M, code, q, name, src] of surveyRows) {
      raDecToScene(ra, dec, dir);
      const dup = CATALOG.some((g, k) => {
        const sepRad = Math.acos(Math.min(1, dir.dot(handDirs[k])));
        const angR = (g.diameterKpc / 2) / (g.distMpc * 1000);
        return sepRad < Math.max(0.06 * Math.PI / 180, 0.25 * angR) && Math.abs(g.absMag - M) < 1.5;
      });
      if (dup) continue;
      // pair members sit close together: only the row at the hand-drawn galaxy's own centre is it
      const parked = PECULIAR_CATALOG.some((g, k) => {
        const sepRad = Math.acos(Math.min(1, dir.dot(pecDirs[k])));
        const angR = (g.diameterKpc / 2) / (g.distMpc * 1000);
        return sepRad < Math.max(0.4 / 60 * Math.PI / 180, 0.1 * angR) && Math.abs(g.absMag - M) < 1.5;
      });
      const t = TYPE_BY_CODE[code & 7];
      const d = dMpc * MPC;
      this.positions[i * 3] = dir.x * d; this.positions[i * 3 + 1] = dir.y * d; this.positions[i * 3 + 2] = dir.z * d;
      this.radius[i] = Math.max(rKpc * 1000, 20);
      this.absMag[i] = M;
      this.type[i] = code & 7;
      this.seed[i] = hashSeed(i, 0x5e1a);
      // ellipticals: the measured b/a; discs: thin, inclined as the axis ratio says (intrinsic q₀ 0.2)
      const elliptical = t === 'E';
      this.axisRatio[i] = elliptical ? Math.max(q, 0.3) : t === 'Irr' ? 0.25 : 0.12;
      const inc = elliptical ? 40 : Math.acos(Math.sqrt(Math.max(0, (q * q - 0.04) / 0.96))) * 180 / Math.PI;
      setBasis(i, galaxyBasisFromSky(dir, this.seed[i] % 180, inc, basis));
      this.surveyNames.push(name);
      this.surveyFlags[i - this.surveyStart] = src + (code & 8) + (parked ? SURVEY_PARKED : 0);
      if (parked) this.park(i);
      i++;
    }
    this.surveyEnd = i;
    this.peculiarStart = i;
    for (const g of PECULIAR_CATALOG) placeHandmade(g, i++);
    this.peculiarEnd = i;
    this.count = i;
    this.guestBase = i;
    // free guest slots sit far away with no size, so no distance search ever lands on one
    for (let k = 0; k < GUEST_SLOTS; k++) this.park(this.guestBase + k);

    // spiral geometry, derived from the seed exactly as the GalaxyModel always did
    this.arms = new Float32Array(N);
    this.pitch = new Float32Array(N);
    for (let k = 0; k < this.count; k++) {
      const t = this.typeOf(k);
      const r = new Rng(this.seed[k]);
      this.arms[k] = k === 0 ? 4 : t === 'SB' ? 2 : 2 + Math.floor(r.next() * 3);
      this.pitch[k] = k === 0 ? 14 : 10 + r.next() * 14;
    }
  }

  /** far away with no size: no distance search lands on it, no sprite shows it */
  private park(slot: number): void {
    this.positions[slot * 3] = 1e13; this.positions[slot * 3 + 1] = 0; this.positions[slot * 3 + 2] = 0;
    this.radius[slot] = 1e-3;
    this.absMag[slot] = 0;
  }

  /** Slot index of a guest with this key, or -1 */
  guestOf(key: string): number {
    const k = this.guestKey.indexOf(key);
    return k < 0 ? -1 : this.guestBase + k;
  }

  /** Is galaxy i a (currently occupied) guest slot? */
  isGuest(i: number): boolean { return i >= this.guestBase && this.guestKey[i - this.guestBase] !== null; }

  /**
   * Copy member `m` of `src` into a guest slot (or return the slot it already has).
   * Returns -1 when every slot is taken by a key in `keep`. A slot taken from a guest that is not
   * is handed to `evict` first: whatever was built for the galaxy that had it (its star cloud)
   * must go, or it would stand where the new one is expected.
   */
  adopt(src: GalaxySource, m: number, key: string, name: string, keep: Set<string>, evict: (slot: number) => void): number {
    const have = this.guestOf(key);
    if (have >= 0) return have;
    let k = this.guestKey.indexOf(null);
    if (k < 0) {
      k = this.guestKey.findIndex((x) => x !== null && !keep.has(x));
      if (k < 0) return -1;
      evict(this.guestBase + k);
      this.release(this.guestBase + k);
    }
    const slot = this.guestBase + k;
    this.guestKey[k] = key;
    this.guestName.set(slot, name);
    this.models.delete(slot);
    for (let c = 0; c < 3; c++) {
      this.positions[slot * 3 + c] = src.positions[m * 3 + c];
      this.normal[slot * 3 + c] = src.normal[m * 3 + c];
      this.major[slot * 3 + c] = src.major[m * 3 + c];
    }
    this.radius[slot] = src.radius[m];
    this.absMag[slot] = src.absMag[m];
    this.type[slot] = src.type[m];
    this.seed[slot] = src.seed[m];
    this.axisRatio[slot] = src.axisRatio[m];
    const t = this.typeOf(slot);
    const r = new Rng(this.seed[slot]);
    this.arms[slot] = src.arms ? src.arms[m] : t === 'SB' ? 2 : 2 + Math.floor(r.next() * 3);
    this.pitch[slot] = src.pitch ? src.pitch[m] : 10 + r.next() * 14;
    this.count = Math.max(this.count, slot + 1);
    return slot;
  }

  /** Free a guest slot */
  release(slot: number): void {
    const k = slot - this.guestBase;
    if (k < 0 || k >= GUEST_SLOTS || this.guestKey[k] === null) return;
    this.guestKey[k] = null;
    this.guestName.delete(slot);
    this.models.delete(slot);
    this.park(slot);
  }

  /** a real galaxy: the Milky Way, the hand-made catalogue or the surveys */
  isReal(i: number): boolean {
    return i < this.catalogCount || (i >= this.surveyStart && i < this.peculiarEnd);
  }

  /** catalogue entry of a hand-made galaxy (not the Milky Way), or null */
  handmade(i: number): CatalogGalaxy | null {
    if (i >= 1 && i < this.catalogCount) return CATALOG[i - 1];
    if (i >= this.peculiarStart && i < this.peculiarEnd) return PECULIAR_CATALOG[i - this.peculiarStart];
    return null;
  }

  /** the first hand-made galaxy whose (source) name contains `ref`, or -1 */
  findHandmade(ref: string): number {
    for (let i = 1; i < this.catalogCount; i++) if (CATALOG[i - 1].name.includes(ref)) return i;
    for (let i = this.peculiarStart; i < this.peculiarEnd; i++) if (PECULIAR_CATALOG[i - this.peculiarStart].name.includes(ref)) return i;
    return -1;
  }

  /** what kind of galaxy it is, untranslated: the Hubble type, or a peculiar galaxy's kind */
  typeLabel(i: number): string {
    return this.handmade(i)?.pec?.label ?? GALAXY_TYPE_LABEL[this.typeOf(i)];
  }

  /** the sprite's parameters of the hand-drawn rings and tails */
  peculiarSprites(): PeculiarSprites {
    const index: number[] = [];
    for (let i = 1; i < this.peculiarEnd; i++) {
      if (i === this.catalogCount) i = this.peculiarStart;
      if (this.handmade(i)?.pec) index.push(i);
    }
    const texels = new Float32Array(Math.max(1, index.length) * PEC_TEXELS * 4);
    const major = new Vector3(), normal = new Vector3();
    index.forEach((i, row) => {
      major.fromArray(this.major, i * 3);
      normal.fromArray(this.normal, i * 3);
      new Peculiar(this.handmade(i)!.pec!).spriteTexels(major, normal, texels, row * PEC_TEXELS * 4);
    });
    return { texels, index };
  }

  sourceOf(i: number): GalaxySourceKind {
    if (i === 0) return 'milkyway';
    if (this.handmade(i)) return 'handmade';
    if (i >= this.surveyStart && i < this.surveyEnd) return (['ungc', '2mrs', '2mrs-cluster'] as const)[this.surveyFlags[i - this.surveyStart] & 7];
    return this.isGuest(i) ? 'guest' : 'procedural';
  }

  /** survey galaxy whose morphology was not measured (its type is a guess) */
  typeGuessed(i: number): boolean {
    return i >= this.surveyStart && i < this.surveyEnd && (this.surveyFlags[i - this.surveyStart] & 8) !== 0;
  }

  /** untranslated (source) name — use for matching catalogue references */
  rawName(i: number): string {
    if (this.guestName.has(i)) return this.guestName.get(i)!;
    if (i === 0) return 'Samanyolu';
    const h = this.handmade(i);
    if (h) return h.name;
    if (i >= this.surveyStart && i < this.surveyEnd) return this.surveyNames[i - this.surveyStart];
    return `Galaksi YE-${(this.seed[i] % 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`;
  }

  name(i: number): string {
    if (this.guestName.has(i)) return this.guestName.get(i)!;
    if (i === 0) return _('Samanyolu');
    const h = this.handmade(i);
    if (h) return _(h.name);
    if (i >= this.surveyStart && i < this.surveyEnd) return this.surveyNames[i - this.surveyStart];
    return _('Galaksi YE-{code}', { code: (this.seed[i] % 0xffffff).toString(16).toUpperCase().padStart(6, '0') });
  }

  typeOf(i: number): GalaxyType { return TYPE_BY_CODE[this.type[i]]; }

  position(i: number, out = new Vector3()): Vector3 {
    return out.set(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
  }

  distancePc(i: number): number {
    return Math.hypot(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
  }

  /** Lazily build the analytic model of galaxy i */
  model(i: number): GalaxyModel {
    let m = this.models.get(i);
    if (m) return m;
    const t = this.typeOf(i);
    const major = new Vector3(this.major[i * 3], this.major[i * 3 + 1], this.major[i * 3 + 2]);
    const normal = new Vector3(this.normal[i * 3], this.normal[i * 3 + 1], this.normal[i * 3 + 2]);
    const z = new Vector3().crossVectors(major, normal).normalize();
    const basis = new Matrix3().set(major.x, normal.x, z.x, major.y, normal.y, z.y, major.z, normal.z, z.z);
    const hand = this.handmade(i);
    const params: GalaxyParams = {
      id: `g${i}`,
      name: this.name(i),
      type: t,
      seed: this.seed[i],
      center: this.position(i),
      basis,
      radius: this.radius[i],
      absMag: this.absMag[i],
      arms: this.arms[i],
      pitchDeg: this.pitch[i],
      axisRatio: this.axisRatio[i],
      description: i === 0
        ? _('Ev galaksimiz: ~13 milyar yıllık, 100–400 milyar yıldızlı çubuklu sarmal. Güneş, merkezden ~8.2 kpc uzakta Orion Kolu\'nda yer alır.')
        : hand ? (hand.desc ? _(hand.desc) : undefined)
          : this.isReal(i) ? this.surveyDescription(i)
          : this.isGuest(i) ? _('Uzak bir galaksi kümesinin üyesi; parlaklığı ve Hubble tipi kümenin morfoloji–yoğunluk ilişkisinden, yapısı tipinden türetildi.')
          : _('Prosedürel olarak üretilmiş galaksi; konumu kozmik ağ yoğunluk modelinden, yapısı Hubble tipinden türetildi.'),
      catalog: this.isReal(i),
      distancePc: this.distancePc(i),
      peculiar: hand?.pec,
    };
    m = new GalaxyModel(params);
    if (this.models.size > 12) {
      for (const k of this.models.keys()) { if (k !== 0) { this.models.delete(k); break; } }
    }
    this.models.set(i, m);
    return m;
  }

  /**
   * Galaxy that "owns" a point (pc, relative to the Sun): the one with the smallest
   * distance / (k·radius). Returns null when the point is in intergalactic space.
   */
  containing(p: Vector3, k = 3): number | null {
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < this.count; i++) {
      const dx = this.positions[i * 3] - p.x, dy = this.positions[i * 3 + 1] - p.y, dz = this.positions[i * 3 + 2] - p.z;
      const score = Math.sqrt(dx * dx + dy * dy + dz * dz) / (k * this.radius[i]);
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return bestScore < 1 ? best : null;
  }

  /** Nearest galaxy surface distance (pc) from a point – used for speed scaling */
  nearestSurfaceDistance(p: Vector3): number {
    let best = Infinity;
    for (let i = 0; i < this.count; i++) {
      const dx = this.positions[i * 3] - p.x, dy = this.positions[i * 3 + 1] - p.y, dz = this.positions[i * 3 + 2] - p.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - this.radius[i];
      if (d < best) best = d;
    }
    return Math.max(best, 0);
  }

  /** what the survey entry is and how its numbers were obtained */
  surveyDescription(i: number): string {
    const src = this.sourceOf(i);
    const parts = [src === 'ungc'
      ? _('Updated Nearby Galaxy Catalog\'daki (Karachentsev ve ark. 2013) gerçek bir yakın galaksi; uzaklığı Hubble yasasından değil, doğrudan ölçüldü (kırmızı dev kolunun ucu, Sefeidler vb.).')
      : src === '2mrs-cluster'
        ? _('2MASS Kırmızıya Kayma Taraması\'ndaki (Huchra ve ark. 2012) gerçek bir galaksi; ait olduğu kümenin ölçülmüş uzaklığına yerleştirildi.')
        : _('2MASS Kırmızıya Kayma Taraması\'ndaki (Huchra ve ark. 2012) gerçek bir galaksi; uzaklığı kırmızıya kaymasından, Hubble yasasıyla (H₀ = {h} km/s/Mpc) hesaplandı.', { h: this.surveyH0 })];
    parts.push(this.typeGuessed(i)
      ? _('Morfolojisi ölçülmemiş: Hubble tipi tahmin, iç yapısı bu tipe göre kurulmuş bir modeldir.')
      : _('Konum, uzaklık, boyut, parlaklık ve Hubble tipi gerçek; iç yapısı bu tipe göre kurulmuş bir modeldir.'));
    return parts.join(' ');
  }

  search(query: string, limit = 6): number[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: number[] = [];
    for (let i = 0; i < this.peculiarEnd; i++) {
      if (i === this.catalogCount) i = this.peculiarStart;
      if (this.name(i).toLowerCase().includes(q) || this.rawName(i).toLowerCase().includes(q)) hits.push(i);
    }
    // survey galaxies: exact designations first, then prefixes ("NGC 1" must not list NGC 1000–1999 first)
    const exact: number[] = [], prefix: number[] = [];
    for (let i = this.surveyStart; i < this.surveyEnd; i++) {
      if (this.surveyFlags[i - this.surveyStart] & SURVEY_PARKED) continue;
      const n = this.surveyNames[i - this.surveyStart].toLowerCase();
      if (n === q) exact.push(i);
      else if (prefix.length < limit && (n.startsWith(q) || (q.length >= 4 && n.includes(q)))) prefix.push(i);
    }
    hits.push(...exact, ...prefix);
    const m = /^(?:galaksi\s+|galaxy\s+|galaxie\s+|galaxia\s+)?ye-([0-9a-f]{6})$/i.exec(q);
    if (m) {
      const code = parseInt(m[1], 16);
      for (let i = this.catalogCount; i < this.count; i++) if (this.seed[i] % 0xffffff === code) { hits.push(i); break; }
    }
    return hits.slice(0, limit);
  }
}
