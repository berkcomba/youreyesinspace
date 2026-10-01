/**
 * "Görmeye değecek yerler" – curated destinations for the topbar dropdown.
 * body: Solar-System body id · star: HYG proper name (resolved through the catalogue search)
 * galaxy: substring of the galaxy catalogue name · index 0 = Milky Way overview.
 * blackhole: universal black-hole id (see data/blackholes.ts) · landmark: id from data/landmarks.ts.
 */
export interface Place {
  label: string;
  kind: 'body' | 'star' | 'galaxy' | 'blackhole' | 'landmark';
  ref: string;
  note?: string;
}

export interface PlaceGroup {
  title: string;
  items: Place[];
}

export const PLACES: PlaceGroup[] = [
  {
    title: 'Uzay araçları',
    items: [
      { label: 'Voyager 1', kind: 'body', ref: 'voyager1', note: 'İnsan yapımı en uzak nesne' },
      { label: 'Voyager 2', kind: 'body', ref: 'voyager2', note: 'Yıldızlararası uzay' },
      { label: 'Pioneer 10', kind: 'body', ref: 'pioneer10', note: 'Sessiz, Aldebaran yönünde' },
      { label: 'Pioneer 11', kind: 'body', ref: 'pioneer11', note: 'Satürn\'e ulaşan ilk araç' },
      { label: 'New Horizons', kind: 'body', ref: 'newhorizons', note: 'Kuiper Kuşağı' },
      { label: 'Parker Solar Probe', kind: 'body', ref: 'parker', note: 'Güneş koronası' },
      { label: 'James Webb (JWST)', kind: 'body', ref: 'jwst', note: 'Güneş–Dünya L2' },
      { label: 'Hubble', kind: 'body', ref: 'hubble', note: 'Alçak Dünya yörüngesi' },
      { label: 'ISS – Uluslararası Uzay İstasyonu', kind: 'body', ref: 'iss', note: '~420 km irtifa' },
      { label: 'Juno', kind: 'body', ref: 'juno', note: 'Jüpiter kutup yörüngesi' },
      { label: 'Perseverance', kind: 'body', ref: 'perseverance', note: 'Mars – Jezero Krateri' },
      { label: 'Curiosity', kind: 'body', ref: 'curiosity', note: 'Mars – Gale Krateri' },
    ],
  },
  {
    title: 'Kara delikler',
    items: [
      { label: 'Sagittarius A*', kind: 'blackhole', ref: 'b0', note: 'Samanyolu merkezi · 4,3 milyon M☉' },
      { label: 'Cygnus X-1', kind: 'blackhole', ref: 'cygx1', note: 'İlk keşfedilen kara delik' },
      { label: 'Gaia BH1', kind: 'blackhole', ref: 'b2', note: 'En yakın bilinen · uykuda' },
      { label: 'V404 Cygni', kind: 'blackhole', ref: 'b3', note: 'X-ışını novası' },
      { label: 'A0620-00', kind: 'blackhole', ref: 'b4', note: 'Tekboynuz\'da sessiz çift' },
      { label: 'M87*', kind: 'blackhole', ref: 'b1', note: 'İlk fotoğraflanan · 6,5 milyar M☉' },
      { label: 'M31*', kind: 'blackhole', ref: 'm31star', note: 'Andromeda merkezi · 140 milyon M☉' },
      { label: 'LMC X-1', kind: 'blackhole', ref: 'lmcx1', note: 'Büyük Macellan Bulutu' },
      { label: 'M33 X-7', kind: 'blackhole', ref: 'm33x7', note: 'Üçgen Galaksisi · tutulmalı' },
      { label: 'Centaurus A*', kind: 'blackhole', ref: 'cenastar', note: 'En yakın aktif çekirdek' }
    ],
  },
  {
    title: 'Bulutsular, kümeler ve rekor yıldızlar',
    items: [
      { label: 'Orion Bulutsusu (M42)', kind: 'landmark', ref: 'l-m42', note: 'En yakın yıldız fabrikası' },
      { label: 'Ülker (Pleiades)', kind: 'landmark', ref: 'l-pleiades', note: 'Yedi Kız Kardeş' },
      { label: 'Karina Bulutsusu', kind: 'landmark', ref: 'l-carina', note: 'Eta Carinae\'nin evi' },
      { label: 'Yengeç Bulutsusu (M1)', kind: 'landmark', ref: 'l-m1', note: '1054 süpernovası' },
      { label: 'Omega Centauri', kind: 'landmark', ref: 'l-omegacen', note: 'En büyük küresel küme' },
      { label: 'Tarantula Bulutsusu', kind: 'landmark', ref: 'l-30dor', note: 'Büyük Macellan Bulutu' },
      { label: 'R136a1', kind: 'landmark', ref: 'l-r136a1', note: 'Bilinen en kütleli yıldız' },
      { label: 'SN 1987A', kind: 'landmark', ref: 'l-sn1987a', note: 'Büyük Macellan Bulutu' },
      { label: 'Mayall II (G1)', kind: 'landmark', ref: 'l-g1', note: 'Andromeda · dev küresel küme' },
      { label: 'Hubble\'ın V1 Sefeidi', kind: 'landmark', ref: 'l-m31v1', note: 'Andromeda · 1923' },
      { label: 'NGC 604', kind: 'landmark', ref: 'l-ngc604', note: 'Üçgen Galaksisi' },
    ],
  },
  {
    title: 'Gezegenler ve uydular',
    items: [
      { label: 'Dünya', kind: 'body', ref: 'earth' },
      { label: 'Ay', kind: 'body', ref: 'moon' },
      { label: 'Mars', kind: 'body', ref: 'mars' },
      { label: 'Jüpiter', kind: 'body', ref: 'jupiter', note: 'Büyük Kırmızı Leke' },
      { label: 'Europa', kind: 'body', ref: 'europa', note: 'Buz kabuğu altında okyanus' },
      { label: 'Io', kind: 'body', ref: 'io', note: 'Volkanik uydu' },
      { label: 'Satürn', kind: 'body', ref: 'saturn', note: 'Halkalar' },
      { label: 'Titan', kind: 'body', ref: 'titan', note: 'Metan gölleri, yoğun atmosfer' },
      { label: 'Enceladus', kind: 'body', ref: 'enceladus', note: 'Buz gayzerleri' },
      { label: 'Uranüs', kind: 'body', ref: 'uranus', note: 'Yan yatmış gezegen' },
      { label: 'Neptün', kind: 'body', ref: 'neptune' },
      { label: 'Triton', kind: 'body', ref: 'triton', note: 'Retrograd uydu' },
      { label: 'Plüton', kind: 'body', ref: 'pluto' },
      { label: 'Güneş', kind: 'body', ref: 'sun' },
      { label: '1P/Halley', kind: 'body', ref: 'halley', note: 'Kuyruklu yıldız' },
    ],
  },
  {
    title: 'Yıldızlar',
    items: [
      { label: 'Proxima Centauri', kind: 'star', ref: 'Proxima Centauri', note: 'En yakın yıldız – 4,2 ıy' },
      { label: 'Alpha Centauri (Rigil Kentaurus)', kind: 'star', ref: 'Rigil Kentaurus', note: 'Üçlü sistem – 4,4 ıy' },
      { label: 'Sirius', kind: 'star', ref: 'Sirius', note: 'Gökyüzünün en parlak yıldızı' },
      { label: 'Vega', kind: 'star', ref: 'Vega' },
      { label: 'Betelgeuse', kind: 'star', ref: 'Betelgeuse', note: 'Kırmızı süperdev' },
      { label: 'Rigel', kind: 'star', ref: 'Rigel', note: 'Mavi süperdev' },
      { label: 'Polaris', kind: 'star', ref: 'Polaris', note: 'Kutup Yıldızı' },
      { label: 'Aldebaran', kind: 'star', ref: 'Aldebaran' },
      { label: 'Antares', kind: 'star', ref: 'Antares' },
      { label: 'Deneb', kind: 'star', ref: 'Deneb', note: '~2600 ıy uzakta' },
    ],
  },
  {
    title: 'Galaksiler',
    items: [
      { label: 'Samanyolu (dışarıdan)', kind: 'galaxy', ref: '#0', note: 'Galaksimize genel bakış' },
      { label: 'Büyük Macellan Bulutu', kind: 'galaxy', ref: 'Büyük Macellan' },
      { label: 'Küçük Macellan Bulutu', kind: 'galaxy', ref: 'Küçük Macellan' },
      { label: 'Andromeda (M31)', kind: 'galaxy', ref: 'Andromeda' },
      { label: 'Üçgen (M33)', kind: 'galaxy', ref: 'Üçgen' },
      { label: 'Centaurus A', kind: 'galaxy', ref: 'Centaurus A' },
      { label: 'Girdap (M51)', kind: 'galaxy', ref: 'Girdap' },
      { label: 'Fırıldak (M101)', kind: 'galaxy', ref: 'Fırıldak (M101)' },
      { label: 'Sombrero (M104)', kind: 'galaxy', ref: 'Sombrero' },
      { label: 'Virgo A (M87)', kind: 'galaxy', ref: 'M87', note: 'İlk görüntülenen kara delik' },
      { label: 'Antenler', kind: 'galaxy', ref: 'Antenler', note: 'Birleşen galaksiler' },
    ],
  },
];
