/**
 * White dwarfs whose perceived colour is far from any blackbody: dense helium atmospheres broaden
 * the absorption of sodium, calcium or carbon until whole bands of the visible go missing.
 * Hollands, Gänsicke, Tremblay & Koester (2026), "Any colour you like: the diverse chromaticities
 * of white dwarfs", RAS Techniques and Instruments 5, rzag069 (doi:10.1093/rasti/rzag069).
 *
 * All of them lie in the Gaia Catalogue of Nearby Stars tier; they are matched by Gaia DR3
 * source_id. `hex` is the disc-integrated sRGB colour of the paper's tables C4–C6.
 */
export interface ColouredDwarf {
  /** Gaia DR3 source_id */
  gaia: string;
  /** survey designation (the paper's name) */
  wd: string;
  /** older catalogue name, searchable */
  alias?: string;
  hex: string;
  /** effective temperature (K) where the paper gives one */
  teff?: number;
  spectral: string;
  /** colour as a person would name it */
  label: string;
  note: string;
}

export const COLOURED_DWARFS: ColouredDwarf[] = [
  {
    gaia: '1666074615061406336', wd: 'WD J1330+6435', hex: '#DDFFB8', teff: 4240, spectral: 'DZ',
    label: 'Yeşil',
    note: 'Bilinen ilk yeşil yıldız (Hollands ve ark. 2026). Yuttuğu kayalık gezegen enkazından gelen sodyum, kalsiyum ve lityum atmosferini kirletiyor. Aşırı yoğun helyumun içinde sodyumun dar turuncu çizgisi genişleyip sarıyı, turuncuyu ve kırmızının bir kısmını soğuruyor; geriye 500 nm civarında tepe yapan açık yeşil bir ışık kalıyor. Güneş benzeri yıldızlarda bu mümkün değil.',
  },
  {
    gaia: '609898313949732608', wd: 'WD J0851+1543', hex: '#F1FFF8', spectral: 'DZ',
    label: 'Soluk yeşil',
    note: 'Soluk yeşil-camgöbeği bir beyaz cüce: mavide güçlü Ca II soğurması ve kırmızıda dik düşen ışık, rengini yeşile kaydırıyor. Tayfı yüksek kaliteli olduğu için yeşilliği güvenle söylenebiliyor (Hollands ve ark. 2026).',
  },
  {
    gaia: '2341622358827194880', wd: 'WD J2356−2054', hex: '#70B4FF', teff: 4000, spectral: 'DZ',
    label: 'Canlı mavi',
    note: 'Yalnızca 4000 K sıcaklıkta ama canlı mavi: atmosferindeki sodyum o kadar bol ki aşırı genişlemiş soğurması görünür ışığın ortasını tamamen siliyor, geriye 450–500 nm arası kalıyor. Yeşil yıldız WD J1330+6435\'in daha uç bir akrabası (Blouin ve ark. 2019; Hollands ve ark. 2026).',
  },
  {
    gaia: '927618687178189056', wd: 'WD J0744+4649', hex: '#F6FFA3', spectral: 'DZ',
    label: 'Sarı',
    note: 'Turuncu olması gerekirken sarı: kalsiyum 460 nm altındaki ışığın çoğunu soğuruyor. Atmosferindeki metaller yuttuğu bir gezegen parçasının kabuk benzeri kayaçtan oluştuğunu gösteriyor (Hollands ve ark. 2026).',
  },
  {
    gaia: '740483560857296768', wd: 'WD J1011+2845', alias: 'LHS 2229', hex: '#FF8775', teff: 4335, spectral: 'DQpec',
    label: 'Somon pembesi',
    note: 'Algılanan rengiyle bilinen en kırmızı yıldız olabilir: koyu somon pembesi. Derinden yüzeye taşınan karbon, çarpık Swan bantlarıyla 400–600 nm arasını bastırıyor. Yalnızca 48 ışık yılı uzakta (Hollands ve ark. 2026).',
  },
  {
    gaia: '3662951038644235776', wd: 'WD J1333+0016', hex: '#FF9DB3', spectral: 'DQpec',
    label: 'Pembe',
    note: 'Karbonlu atmosferindeki çarpık Swan bantları yüzünden pembe görünen bir beyaz cüce; LHS 2229\'a benziyor ama mavide biraz daha fazla ışık yayıyor (Hollands ve ark. 2026).',
  },
  {
    gaia: '1505825635741455872', wd: 'WD J1403+4533', hex: '#C5F5FF', spectral: 'DC',
    label: 'Camgöbeği',
    note: 'Kızılötesinde sönük, soğuk bir beyaz cüce: aşırı yoğun atmosferinde çarpışan moleküllerin soğurması kırmızıyı bastırıyor ve yıldız camgöbeği görünüyor (Hollands ve ark. 2026).',
  },
];

/** sRGB 0…1 of a "#RRGGBB" colour */
export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
}

const byWd = new Map(COLOURED_DWARFS.map((c) => [c.wd, c]));

/** the entry named by a curated destination (`ref`), if it is one of these stars */
export function colouredDwarf(name: string): ColouredDwarf | undefined {
  return byWd.get(name);
}
