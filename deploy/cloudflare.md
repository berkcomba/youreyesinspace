# Production deploy: Cloud Run + Cloudflare

Hedef mimari (günlük ~500 ziyaretçi, statik WebGL uygulaması):

```
tarayıcı ──HTTPS──▶ Cloudflare (WAF · rate-limit · bot · Brotli · edge cache)
                        │  X-Origin-Auth: <sır>
                        ▼
                   Cloud Run (nginx:alpine, dist/) ── 403 if header ≠ sır
```

## 1. Cloud Run

```bash
gcloud auth login
gcloud config set project <PROJE_ID>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

export GCP_PROJECT=<PROJE_ID>
export GCP_REGION=europe-west1            # Türkiye'ye en yakın düşük gecikmeli bölge
export ORIGIN_AUTH_SECRET="$(openssl rand -hex 24)"   # sakla – Cloudflare'de de kullanılacak
./deploy/cloudrun-deploy.sh
```

Script şunları yapar: Artifact Registry deposu → Cloud Build ile çok aşamalı Docker imajı
(`node:22-alpine` build → `nginx:1.27-alpine`) → `gcloud run deploy` (`--allow-unauthenticated`,
1 vCPU / 256 MiB, concurrency 200, max 4 instance). Çıktıda `https://<servis>-<hash>-ew.a.run.app`
adresini verir; `/_health` 200 dönmeli. `ORIGIN_AUTH_SECRET` verildiği için bu adres doğrudan
403 döner — sadece Cloudflare üzerinden gelen istekler (başlığı taşıyan) geçer.

Maliyet: 500 kullanıcı/gün ≈ 15–20 GB/ay çıkış trafiği; büyük dosyalar (stars.bin 2,6 MB,
modeller 0,3–9 MB) Cloudflare edge'de 1 yıl cache'lenir, Cloud Run'a nadiren iner. Beklenen fatura
Cloud Run için ücretsiz kota içinde veya birkaç dolar.

## 2. Alan adı → Cloud Run

Örnek alan adı `example.com`; DNS kayıtları alan adının kayıtlı olduğu sağlayıcıda (registrar) düzenlenir.

1. **Doğrulama:** `gcloud domains verify example.com` → Search Console'un verdiği TXT kaydını
   registrar DNS'ine ekle, "Verify" de.
2. **Eşleme:** `GCP_PROJECT=<proje> DOMAIN=example.com ./deploy/domain-mapping.sh` → kök için 4 A + 4 AAAA, `www` için
   CNAME `ghs.googlehosted.com` kayıtlarını yazdırır.
3. **DNS:** kayıtları ekle (registrar'da ya da NS'i Cloudflare'e taşıdıysan Cloudflare'de, ilk başta gri bulut).
   Sertifika 5–30 dk içinde çıkar; `https://example.com` çalışır.
4. **Cloudflare önüne almak için** (WAF/rate-limit/cache): Cloudflare'de siteyi ekle (Free plan yeter),
   verdiği iki NS adresini registrar → Nameservers'a yaz (yayılma 1–24 sa), kayıtları **Proxied** yap,
   `deploy/cloudflare-security.sh` çalıştır. Registrar'ın kendi "forwarding"/parking kayıtlarını sil.

Alternatif: **Global HTTPS Load Balancer + serverless NEG** — Cloud Armor vb. için; ~18 $/ay ek maliyet, bu proje için gerekmez.

## 3. Cloudflare güvenlik

Cloudflare panelinde **My Profile → API Tokens → Create Token** ile şu izinleri taşıyan bir token oluştur:
Zone Settings:Edit, Zone WAF:Edit, Cache Rules:Edit, Transform Rules:Edit, Bot Management:Edit (zone: ilgili alan adı).

```bash
export CF_API_TOKEN=...            # asla repoya yazma
export CF_ZONE_ID=...              # Overview sayfası, sağ alt
export SITE_HOST=example.com
export ORIGIN_AUTH_SECRET=...      # Cloud Run'a verdiğinle aynı
./deploy/cloudflare-security.sh
```

Script (idempotent) şunları kurar:

| Alan | Ayar |
|---|---|
| TLS | SSL **Full (strict)**, Always HTTPS, min TLS 1.2, TLS 1.3, HSTS 1 yıl + preload |
| Performans | Brotli, HTTP/3, 0-RTT, Early Hints, CSS/HTML minify (JS kapalı) |
| Bot | Bot Fight Mode, Browser Integrity Check, security level *medium*, doğrulanmamış botlara managed challenge |
| WAF | Sadece GET/HEAD/OPTIONS; `.map`, `.env`, `.git`, gizli dosya yolları blok; threat score > 30 challenge |
| Rate limit | `/` 60 istek/10 sn/IP (challenge); `/data`, `/models` 120/10 sn (blok); genel 600/10 sn (blok) |
| Cache | `/assets`, `/data`, `/models` edge'de 1 yıl (query string cache key'de → `?v=BUILD_ID` ile bust); `/` 5 dk |
| Origin koruması | Transform rule ile `X-Origin-Auth: <sır>`; nginx başlığı doğrulamayan isteğe 403 |
| Başlıklar | nosniff, DENY, Referrer-Policy, Permissions-Policy; `Server`/`X-Powered-By` kaldırılır |

Ek olarak panelden (API'si plana bağlı):

* **Security → Settings → Managed Rules:** Cloudflare Managed Ruleset + OWASP Core (Pro plan ve üstü).
* **Security → Bots:** Pro+ planda Super Bot Fight Mode → "Definitely automated: Block".
* **Speed → Optimization:** Rocket Loader **kapalı** kalsın (ES module + WebGL uygulamasını bozar). Auto Minify JS kapalı.
* **Caching → Tiered Cache:** Smart Tiered Cache açık (origin'e daha az istek).
* **Scrape Shield → Hotlink Protection:** açık (logo/görsel hotlink'ini engeller).

## 4. Doğrulama

```bash
curl -sI https://example.com/ | grep -iE 'strict-transport|content-security|x-frame|cf-cache-status|cache-control'
curl -sI https://example.com/data/stars.bin?v=x | grep -iE 'cf-cache-status|cache-control|content-encoding'
curl -sI -X POST https://example.com/   # 403/405 beklenir
curl -sI https://<servis>-<hash>-ew.a.run.app/      # 403 beklenir (origin doğrudan kapalı)
```

Tarayıcıda: DevTools → Network → `stars.bin` ve `*.glb` için `cf-cache-status: HIT` ve
`content-encoding: br`; ana `index.html` için `cache-control: no-cache` görülmeli.

## 5. Güncelleme

`./deploy/cloudrun-deploy.sh` yeniden çalıştırılır; `BUILD_ID` = git commit kısa hash'i.
Vite hash'li `/assets` + `?v=BUILD_ID` sayesinde eski cache ile çakışma olmaz; `index.html`
edge'de en fazla 5 dk kalır. Anında yenilemek için Cloudflare **Caching → Purge Everything**.

## Lisans / atıf gereklilikleri

* HYG Database v3 (David Nash, Astronexus) — **CC BY-SA 4.0**. Yardım (F1) panelinde atıf ve lisans bağlantısı var; türev veri (`public/data/stars.bin`) aynı lisansla paylaşılmalıdır.
* NASA 3D Resources modelleri — kamu malı; NASA logosu/isim kullanımına dair NASA medya kılavuzlarına uyulmalı.
* Yüzey görüntüleri (Dünya: NASA GIBS Blue Marble NG + VIIRS Black Marble; Ay: Moon Trek LRO WAC; Mars: Mars Trek Viking MDIM 2.1) — NASA kamu malı, anahtar gerektirmez, doğrudan tarayıcıdan `gibs.earthdata.nasa.gov` ve `trek.nasa.gov` adreslerinden akıtılır (`src/data/imagery.ts`). Bu iki host CSP `img-src` yönergesinde izinli olmalıdır (`deploy/nginx/security-headers.conf`); yeni bir sağlayıcı eklenirse CSP de güncellenmelidir. Ekranda sol altta atıf gösterilir.
