/**
 * Release notes shown behind the version badge. Source language is Turkish, like every other
 * display string; entries are translated through the dictionary (`text` fields are collected by
 * scripts/i18n-check.mjs). Newest first.
 */
export interface Release {
  version: string;
  /** ISO date of the release (a range for the early ones) */
  date: string;
  /** one-line theme of the release */
  title: string;
  items: Array<{ text: string }>;
}

export const CURRENT_VERSION = '0.7';

export const CHANGELOG: Release[] = [
  {
    version: '0.7', date: '2026-10-28', title: 'Yüzeye iniş, hacimsel galaksiler, keşfe açık bir evren',
    items: [
      { text: 'Katı gezegenlere iniş: yüzey ve gökyüzü inince üretiliyor; zamanla oynayıp gökyüzünü izleme, kalkış ve irtifa kontrolü' },
      { text: 'Gezegen yüzeylerinde su, buz, volkanlar ve gaz çıkışları; kuyruklu yıldızlara gerçekçi toz ve iyon kuyrukları' },
      { text: 'Hacimsel galaksiler ve bulutsular: toz şeritleri ve parlayan gaz ışın izlemeyle çiziliyor' },
      { text: 'Yakındaki her yıldız ve gezegen tıklanabilir; küme yıldızları seçilebiliyor ve keşif sayacı bir sonraki keşfi gösteriyor' },
      { text: 'Bilimsel nadirliğe uygun çift ve çoklu yıldız sistemleri; dış galaksilerde zenginleşen prosedürel nesneler' },
      { text: 'Kümeler tek tek yıldızlara ayrışıyor; galaksi merkezlerinde parlama ve uzaktan sönük gezegenler düzeltildi' },
      { text: 'Temiz görünüm (N) tüm işaretleri ve isimleri gizliyor; yıldız parlaması (lens flare) için ayar' },
      { text: 'Grafik seviyeleri: en düşük, orta, en yüksek; telefonda en düşük, bilgisayarda en yüksek seviyeyle açılıyor' },
      { text: 'Kalabalık galaksilerde ve hacimsel bulutların içinde hızlı uçarken takılmalar azaldı' },
      { text: 'Güneş Sistemi turu: omuz çekimleri, gerçek yükseklik verisiyle Olympus Mons, Mars\'a inerken aşağı bakan kamera ve Satürn\'ün kutup altıgeni' },
    ],
  },
  {
    version: '0.6', date: '2026-10-24', title: 'Gökyüzü etkinlikleri, Mars yüzeyi, daha sakin bir gökyüzü',
    items: [
      { text: 'Etkinlikler paneli: yaklaşan geçişler, kavuşumlar, meteor yağmurları, tutulmalar ve görev kilometre taşları; her biri anlatımlı, sinematik bir sahneyle izleniyor ve geri sayım üst çubukta' },
      { text: 'JPL Horizons efemerisleri: BepiColombo, Europa Clipper ve Hera gerçek yörünge tablolarıyla uçuyor; izleri sahnede çiziliyor' },
      { text: 'Meteor yağmurları: radyanttan atmosfere giren akımlar, ateş topları ve gece tarafına bakan izleme noktası' },
      { text: 'Perseverance ve Curiosity çevresinde gerçek Mars arazisi: HiRISE, CTX ve HRSC+MOLA verisinden beş halkalı yükseklik haritası, ufukta NASA rover panoramaları' },
      { text: 'Etkinlik sahneleri için gömülebilir (embed) görünüm ve paylaşım bağlantıları; Hakkında kartında ziyaret sayacı' },
      { text: 'Ayarlar: cüce gezegenleri, asteroit ve kuyruklu yıldızları, insan yapımı nesneleri gizleme anahtarları' },
      { text: 'Turlar: yalnızca anlatılan cisimler etiketleniyor, arka plan sakin; kara delik turunda yoldaş yıldızlar ve S-yıldızı yörüngeleri de sahnede' },
      { text: 'Render çözünürlüğü 0,25×\'e kadar iniyor ve takılma olunca kendiliğinden düşüyor (otomatik çözünürlük)' },
      { text: 'Akademi: Güneş, yıldızlararası ortam ve yıldız oluşumu, anakol ve sonrası evrim bölümleri (11–13)' },
      { text: 'Halka sistemlerinin içinden uçarken kaya parçacıkları; yakındayken gece tarafını aydınlatma seçeneği' },
      { text: 'Kaynak kodu lisansı AGPL-3.0; tur, ders ve seslendirme içeriği için ayrı içerik lisansı' },
    ],
  },
  {
    version: '0.5', date: '2026-10-20', title: 'Akademi büyüyor, gökyüzü daha okunaklı',
    items: [
      { text: 'Akademi bölümleri 4–10: özel görelilik, ışık–madde etkileşimi, teleskoplar, çift yıldızlar, tayf sınıflandırması, yıldız atmosferleri ve iç yapıları' },
      { text: 'Sedna, Gonggong, Quaoar ve Orcus cüce gezegenleri' },
      { text: 'Güneş\'ten uzaklaşınca Güneş işareti ve ekran dışı pusula; etiketlerde isteğe bağlı uzaklık' },
      { text: 'Her etiket tıklanabilir: yıldız, galaksi, bulutsu, kara delik ve cisim adları seçim yapıyor' },
      { text: 'Prosedürel nesneler için anahtar, yeşil vurgu ve isim seçenekleri' },
      { text: 'Yıldızların canlı fotosferi (granülasyon, lekeler, kenar kararması) ve koronası' },
    ],
  },
  {
    version: '0.4', date: '2026-10-13', title: 'Akademi açılıyor',
    items: [
      { text: 'Akademi: bölüm bölüm astrofizik dersleri; formüller, etkileşimli küçük deneyler, sahne ipuçları ve seslendiren anlatıcı (bölüm 1–3)' },
      { text: 'Turlarda Güneş ufukta arkadan aydınlatılmış yakın çekimler, gölgesiz dolgu ışığı, açılış görünümü olarak dönen Güneş Sistemi' },
    ],
  },
  {
    version: '0.3', date: '2026-10-09', title: 'Turlar yeniden kuruldu',
    items: [
      { text: 'Rehberli turlar yeni ipucu setiyle: gerçek ölçekli karşılaştırmalar, fotoğraf ve bilgi kartları, bulut katmanı geçişleri, bakış noktaları, ışık darbesi; beş dilde anlatım' },
      { text: 'Bulutsular fotoğraftan türetilmiş üç boyutlu nokta bulutları olarak' },
      { text: 'Küçük cisimler için gerçekçi şekiller; on beş cisim için NASA Treks görüntüleri' },
    ],
  },
  {
    version: '0.1 – 0.2', date: '2026-09-29', title: 'İlk sürümler',
    items: [
      { text: 'Logaritmik derinlikli Güneş Sistemi, Kepler yörüngeleri, akan NASA uydu görüntüleri' },
      { text: 'Gerçek kara delikler ve kütleçekimsel mercekleme, dokuz pulsar sistemi, Samanyolu ve yakın galaksilerde derin gökyüzü yer imleri' },
      { text: 'Görev planlayıcı: Lambert/Hohmann ve sapan rotaları, gerçek ve bilim kurgu araçlar' },
      { text: 'Beş dil, dokunmatik ve telefon desteği, ilk sesli turlar' },
    ],
  },
];
