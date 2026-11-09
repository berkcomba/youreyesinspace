import { _ } from '../i18n';
import type { ScopeStrings } from './types';

/** every string of the telescope view in the current language (the app, and /encyclopedia/scope.json) */
export function scopeStrings(): ScopeStrings {
  return {
    title: _('Dünya\'dan teleskopla'), open: _('Teleskopla bak'), close: _('Teleskop görünümünü kapat'),
    ins: _('Alet'), mag: _('Büyütme'), field: _('Alan'), alt: _('Ufuktan yükseklik'), seeing: _('Görüş (seeing)'), sky: _('Gökyüzü'),
    s06: _('Mükemmel (0,6″)'), s12: _('İyi (1,2″)'), s20: _('Orta (2″)'), s35: _('Kötü (3,5″)'),
    bortle: _('Bortle {n}'), b1: _('kusursuz karanlık'), b4: _('kırsal'), b6: _('banliyö'), b9: _('şehir merkezi'),
    gAmateur: _('Amatör aletler'), gResearch: _('Araştırma teleskopları'), gRadio: _('Radyo teleskopları'),
    iEye: _('Çıplak göz'), iBino: _('10×50 dürbün'), iAch70: _('70/700 akromatik refraktör'), iApo100: _('100/700 apokromatik refraktör'),
    iMak127: _('Maksutov 127/1500'), iNewt130: _('Newton 130/650'), iSct203: _('Schmidt-Cassegrain 203/2032 (8″)'),
    iDob305: _('Dobson 305/1500 (12″)'), iDob406: _('Dobson 406/1800 (16″)'),
    iHale: _('Palomar Hale 5,1 m · CCD'), iVlt: _('VLT 8,2 m · uyarlanır optik'), iKeck: _('Keck 10 m · uyarlanır optik'),
    iFast: _('FAST 500 m · 21 cm'), iEffelsberg: _('Effelsberg 100 m · 21 cm'), iVla: _('VLA (A dizilimi) · 21 cm'),
    iAlma: _('ALMA · 1,3 mm'), iEht: _('Olay Ufku Teleskobu · 1,3 mm'),
    rTfov: _('Gerçek alan'), rExit: _('Çıkış göz bebeği'), rRes: _('Ayırma gücü'), rLim: _('Sınır kadir'), rBeam: _('Işın'),
    rLas: _('En büyük ölçek'), rSize: _('Görünür boyut'), rBright: _('Görünür kadir'), rLit: _('Aydınlık kısım'), rSeeing: _('Görüş'),
    nGlare: _('Güneş\'e çok yakın ({e}°): ancak alacakaranlıkta, ufka yakın ve parıltı içinde görülebilir.'),
    nFilter: _('Tam açıklıklı güneş filtresiyle (beyaz ışık). Filtresiz bakmak gözü kalıcı olarak kör eder.'),
    nFaint: _('Bu aletle görünmez: parlaklığı {m} kadir, sınır {l} kadir.'),
    nDust: _('Görünür ışıkta görülemez: Samanyolu\'nun merkezinden gelen ışığı toz yaklaşık 30 kadir söndürür. Radyo dalgaları tozu deler.'),
    nRadioDark: _('Radyoda karanlık: bu dalga boyunda kayda değer ışıma yok; harita yalnızca alıcı gürültüsü.'),
    nEht: _('Olay Ufku Teleskobu yalnızca çok küçük ve çok parlak kaynakları görüntüler; bu cisimden alanın tamamı tek düze.'),
    nAo: _('Uyarlanır optik, kızılötesinde (K bandı, 2,2 µm): çekirdek kırınım sınırında, çevresinde zayıf bir seeing halesi.'),
    nLas: _('Girişimölçer {las} üzerindeki büyük ölçekli ışımayı göremez; yalnızca ince yapı kalır.'),
    nField: _('Alan yıldızları temsilidir; konumları gerçek değildir.'),
    nBeam: _('Işın cisimden büyük: tek bir leke olarak görünür.'),
    oUpright: _('Görüntü düz.'), oInverted: _('Görüntü ters: 180° dönük.'), oMirrored: _('Köşegen prizma: görüntü ayna gibi, sağ ile sol yer değiştirir.'),
    capVisual: _('Göz merceğinden: atmosferin titremesi ve bulanıklığı, aletin kırınımı, karanlığa alışmış gözün sınırları. Görüş ve yükseklik değiştikçe görüntü de değişir.'),
    capDetector: _('Uzun pozlu dedektör görüntüsü: kuzey yukarıda, doğu solda; parlaklık asinh ile gerildi.'),
    capRadio: _('Radyo haritası: parlaklık ışının boyutunda yumuşar; renkler yapaydır. Kuzey yukarıda, sol altta ışın.'),
    hClose: _('Merceğin ortasına yakından bakmak için görüntüye tıklayın.'),
    hWhole: _('Merceğin ortası yakından gösteriliyor; tüm alan için görüntüye tıklayın.'),
    north: _('K'), east: _('D'), noGl: _('Bu görünüm için WebGL2 gerekiyor.'),
  };
}
