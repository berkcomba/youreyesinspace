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

export const CURRENT_VERSION = '0.9.3';

export const CHANGELOG: Release[] = [
  {
    version: '0.9.3', date: '2026-11-11', title: 'Dönen kara delik diskleri, teleskop görünümü ve yeni dünyalar',
    items: [
      { text: 'Kara delikler: yığılma diskleri artık dönüyor; gaz iç kenarda daha hızlı akıyor, ağır delikler daha yavaş dönüyor ve disk simülasyon saatine uyuyor. İnce parlak gaz iplikleri; içte akkor beyaz, dışta kızıl, bize doğru gelen yanı daha mavi ve daha parlak' },
      { text: 'Yıldız izleri: yıldızlar arasında hızla uçarken yıldızlar çizgiye uzuyor; ayarlardan kapatılabiliyor' },
      { text: 'Yıldız boyutu ayarı: gökyüzündeki yıldızlar 3 kata kadar büyütülebiliyor' },
      { text: 'Teleskop görünümü: seçilen cismin Dünya\'dan dürbünle, amatör ve akıllı teleskoplarla, Hubble ve JWST ile, radyo teleskoplarıyla nasıl göründüğü; filtreler, göz mercekleri, pozlama süresi, radyo bantları ve VLA dizilimleri. Bilgi kartında ve ansiklopedide' },
      { text: 'On iki yeni gezegen türü: orman, kum denizi, tuz, zehirli, jeotermal, Titan benzeri, demir, khthonik, lav gözü, hycean, süper-kabarık ve sıcak Neptün' },
      { text: 'Gaz devleri: her birine kendi renkleri, kuşakları, fırtınaları ve kutup başlıkları; en sıcaklarının gece yüzü kor gibi parlıyor' },
      { text: 'Her dünyaya kendi jeolojisi: yarık vadileri, kalkan volkanları, kutup başlıkları ve buz çatlakları; iniş alanlarında yeni kaya türleri ve ufukta pus' },
      { text: 'Ünlü öte gezegenlere kendi haritaları; HD 189733 b kobalt mavisi pusu ve rüzgârın savurduğu bulutlarıyla' },
      { text: 'Bulutsular ve kümeler uzaktan da yakından da aynı görünüyor; üretilmiş bulutsular yaklaşırken artık kaybolmuyor' },
      { text: 'Etkinlikler: her etkinlik beş dilde seslendirildi; 2027\'nin yarı gölge Ay tutulması ve Luksor\'da altı dakikadan uzun süren tam Güneş tutulması eklendi' },
      { text: 'Renkli beyaz cüceler: yeşil yıldız WD J1330+6435 ve altı benzeri (Hollands ve ark. 2026)' },
      { text: 'Ay, JPL Horizons efemerisiyle kendi yörünge çizgisinin üzerinde; her kuyruklu yıldız Güneş\'ten uzakta da sönük bir kuyruk taşıyor; Jüpiter\'in Büyük Kırmızı Lekesi geri döndü' },
      { text: 'Telefonlar: iki satırlı üst çubuk ve yatay ekran düzeni; en yüksek grafik seviyesiyle açılıyor, ilk saniyelerde takılırsa düşük seviyeye iniyor' },
    ],
  },
  {
    version: '0.9.2', date: '2026-11-07', title: 'Ansiklopedi ve sinematik turlar',
    items: [
      { text: 'Ansiklopedi: yıldızlar, öte gezegenler, takımyıldızlar, derin gökyüzü, galaksiler, kara delikler, Güneş Sistemi ve gök olayları için beş dilde on binlerce sayfa; her sayfadan simülasyonda açma' },
      { text: 'A\'dan Z\'ye dizin ve bütün ansiklopedide arama' },
      { text: 'Simülasyondan ansiklopediye: üst çubukta kitap düğmesi, Hakkında kartında bağlantı ve sayfası olan her seçimin altında "Ansiklopedide oku"' },
      { text: 'Gökyüzü konum haritası: her cismin gökyüzündeki yeri, tüm gökyüzü ve galaksiye tepeden bakış; Yerleştir düğmesiyle başka sitelere gömülebiliyor' },
      { text: 'Turlar: her tura Carl Sagan tadında giriş ve kapanış anlatımları, sinematik kamera hareketleri ve tarih kartları; beş dilde yeniden seslendirildi' },
      { text: 'Güneş Sistemi turunun finali: Plüton\'dan Güneş\'e ve Dünya\'ya geriye bakış, ardından müzik eşliğinde gezegenlerin yanından geçen kesintisiz bir uçuşla açılış ekranına dönüş' },
      { text: 'Turlarda yüzeye iniş: bazı sahneler artık bir dünyanın üzerinde durup gökyüzüne bakıyor' },
      { text: 'Karşılama: her ilk ziyarette aynı sahne, müzik ilk tıklamayla başlıyor; gerçek Ay ve Io dokuları' },
      { text: 'Destek: GitHub Sponsors ile Buy Me a Coffee arasında seçim' },
      { text: 'Windows: gölgelendiriciler arka planda derleniyor, açılışta ve inişte sayfa donmuyor; sürüklerken yanıp sönen işaretler ve Opera GX\'teki titreme düzeltildi' },
      { text: 'Düzeltme: Öte Gezegenler turundaki siyah dikdörtgen' },
    ],
  },
  {
    version: '0.9.1', date: '2026-11-05', title: 'Gerçek kataloglar, ilk karşılama, öte gezegenler ve müzik',
    items: [
      { text: 'Gerçek kataloglar: JPL küçük cisim veritabanından ana kuşak, Dünya\'ya yakın asteroitler, Truvalılar, dış cisimler ve kuyruklu yıldızlar; derin uzay tarama nesneleri, ölçülmüş yörüngeleriyle öte gezegen sistemleri, kahverengi cüceler ve çift yıldızlar; UNGC ve 2MRS galaksileri' },
      { text: 'İlk ziyaret karşılaması: canlı sahneler üzerinde beş bölüm (600 kat hızda dönen Satürn, Dünya doğuşu, Jüpiter önünde Io, Güneş); yalnızca bir kez gösterilir' },
      { text: 'Daha akıcı açılış: karşılama sahneleri yükleme ekranının arkasında ziyaret edilip gölgelendiriciler derleniyor ve yüzeyler önceden pişiriliyor; yıldız katalogları bir arka plan iş parçacığında ayrıştırılıp parça parça yükleniyor' },
      { text: 'Gezegen yüzeyleri küp haritalara pişiriliyor: daha zengin kayaç ve gaz devi modelleri, göz uyumu (otomatik pozlama), ışık hüzmeleri ve bulutsu profilleri' },
      { text: 'Yeni tur: Öte Gezegenler — 51 Pegasi b\'den TRAPPIST-1\'e on bir durak, beş dilde seslendirme ve görsellerle' },
      { text: 'Fon müziği: turlarda ve karşılamada telifsiz space rock parçaları; anlatıcı konuşurken kısılıyor, her tura farklı bir şarkı düşüyor; şarkı başlarken sağ altta adı ve sanatçısı' },
      { text: 'Radyo: ayarlardan açınca şarkılar karışık sırayla sürekli çalıyor; ayarlar düğmesinin altındaki dönen plaktan ses düzeyi, duraklatma ve sonraki şarkı' },
      { text: 'Asteroit ve Kuiper kuşakları varsayılan olarak kapalı; ayarlardan açılabiliyor' },
      { text: 'Düzeltme: uzak bir kümenin üye galaksisine yaklaşınca galaksinin görünmez olması' },
    ],
  },
  {
    version: '0.8', date: '2026-10-30', title: 'Yayıncı modu: izleyicilerle birlikte uzay seferi',
    items: [
      { text: 'Yayıncı modu (youreyesinspace.com/?stream): yayıncı rotayı seçer, izleyiciler telefonlarıyla QR koddan katılıp yol üzerindeki bilgi kapılarının sorularını birlikte cevaplar' },
      { text: 'İzleyiciler yayın sohbetine A, B, C veya D yazarak da cevap ve oy verebilir' },
      { text: 'Yolda rastgele uzay olayları: ekip oyla karar veriyor, sonuç gemi gövdesini, cevap süresini ya da puan çarpanını değiştiriyor; her bölümün sonunda zorlu bir final sorusu' },
      { text: 'Puanlama, sıralama ve oylar sunucuda: tek bir yayına binlerce izleyici katılabiliyor; telefonlar bot korumasından geçerek katılıyor' },
      { text: 'Seslendirilmiş anlatıcı, ses efektleri ve canlı liderlik tablosu' },
      { text: 'Kuyruklu yıldızların toz kuyrukları daha yumuşak ve doğal görünüyor' },
    ],
  },
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
