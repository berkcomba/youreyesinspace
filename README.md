# Your Eyes In Space

**[youreyesinspace.com](https://youreyesinspace.com)** — tarayıcıda çalışan, Space Engine esinli
evren gezgini. Güneş Sistemi'nden gözlemlenebilir evrenin ucuna (13,8 Gpc) kadar kesintisiz uçuş;
gerçek yıldız/galaksi katalogları + deterministik prosedürel evren. Vite · TypeScript · Three.js.

*A web-native, Space Engine–style universe explorer: fly seamlessly from the Solar System to the edge
of the observable universe. Turkish UI.*

## Özellikler

- **Güneş Sistemi** — NASA/JPL Kepler elemanlarıyla gezegenler, cüce gezegenler, uydular, kuyruklu
  yıldızlar; prosedürel yüzey/atmosfer/bulut/halka shader'ları, tutulma ve halka gölgeleri.
- **Gerçek yüzey görüntüleri** — Dünya (NASA Blue Marble NG + Black Marble gece ışıkları), Ay
  (LRO WAC), Mars (Viking MDIM 2.1); irtifaya göre LOD'lu karo akışı, doğrudan NASA sunucularından.
- **İnsanlığın uzay araçları** — Voyager 1/2, Pioneer 10/11, New Horizons, Parker, ISS, Hubble,
  JWST (L2), Perseverance, Curiosity, Juno; güncel konumlar ve NASA 3B modelleri.
- **Yıldızlar** — HYG kataloğundan 109 000 gerçek yıldız; prosedürel gezegen sistemleri; yıldızlar
  arası uçuş, uçulabilir Samanyolu.
- **Galaksiler** — 55 gerçek galaksi + 13,8 Gpc'ye kadar prosedürel kozmik ağ; LOD zinciri.
- **Kara delikler** — Sagittarius A* (S2/S38/S55 yörüngeleriyle), M87*, M31*, Centaurus A*, Cygnus X-1,
  Gaia BH1, V404 Cygni, A0620-00, LMC X-1/X-3, M33 X-7 ve diğerleri; ekran uzayında gerçek zamanlı Schwarzschild ışın izleme (null jeodezikler),
  Doppler ışımalı ve kütleçekimsel kırmızıya kaymalı akreasyon diski, gölge ve Einstein halkası.
- **Derin gökyüzü yer imleri** — Orion, Karina, Tarantula ve NGC 604 bulutsuları; Ülker, Omega Centauri,
  Mayall II kümeleri; Yengeç, SN 1987A, Cas A kalıntıları; Eta Carinae, R136a1, WOH G64 gibi rekor
  yıldızlar — Samanyolu'nda ve komşu galaksilerde gerçek konumlarında, uçulabilir.
- **Kamera** — serbest uçuş, yörünge, takip, otopilot, fare kilitli serbest dolaşım; floating origin
  + logaritmik derinlik (1 m'den 10¹³ km'ye).
- **UI** — arama, bilgi paneli, zaman kontrolü, "Görmeye değecek yerler" menüsü, ayarlar, `F1` yardım.

## Geliştirme

```bash
npm ci
npm run dev        # http://localhost:5173
npm run typecheck
npm run build      # dist/
```

Yıldız kataloğunu yeniden üretmek için (HYG CSV gerekir):

```bash
node scripts/build-stars.mjs /path/to/hygdata_v41.csv
```

## Dağıtım

Uygulama statik; üretimde `nginx:alpine` içinde servis edilir (`Dockerfile`, `deploy/nginx/*`:
CSP ve güvenlik başlıkları, gzip, immutable cache, isteğe bağlı origin koruması).

- **CI/CD** — `.github/workflows/deploy.yml`: her push/PR'da typecheck + build; `main`'e push'ta
  Cloud Build ile imaj → Cloud Run (Workload Identity Federation, anahtarsız). Kurulum:
  `deploy/github-cicd-setup.sh`.
- **Elle** — `GCP_PROJECT=<proje> ./deploy/cloudrun-deploy.sh`
- **Alan adı / Cloudflare** — `deploy/cloudflare.md`

Sırlar (`ORIGIN_AUTH_SECRET`, `CF_API_TOKEN`, …) yalnızca ortam değişkeni / GitHub Secrets ile
verilir; repoya yazılmaz.

## Mimari (kısa)

```
src/core      Engine (renderer, post-process), Universe, StarSystem, CelestialBody, TimeSystem
src/math      Kepler çözücü, referans çerçeveleri (ekliptik ↔ sahne)
src/data      Güneş Sistemi, uzay aracı, kara delik ve derin gökyüzü verisi, HYG katalog okuyucu, görüntü sağlayıcıları
src/gen       Prosedürel yıldız sistemi üretici
src/galaxy    Galaksi kataloğu/modeli, prosedürel yıldızlar, uzak evren katmanları
src/render    Gövde/karo/yıldız/galaksi/yörünge render'ları, kara delik mercekleme geçişi ve GLSL shader'lar
src/camera    Kamera kontrolcüsü (modlar, otopilot, hız ölçekleme)
src/ui        HUD, paneller, ayarlar, arama, yerler menüsü
```

## Lisans

Kod: [MIT](LICENSE). Veri, modeller ve akıtılan görüntülerin lisansları için [NOTICE.md](NOTICE.md)
(HYG kataloğu türevi **CC BY-SA 4.0**, NASA içerikleri kamu malı). "Your Eyes In Space" adı ve logo
BigBrains'in markasıdır; fork'lar kendi ad ve logolarını kullanmalıdır.

Your Eyes In Space bir [BigBrains](https://bigbrains.com.tr) ürünüdür.
