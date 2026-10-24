"""Build the real-ground assets for the Mars rovers: HiRISE relief + orthophotos around each site.

    python3 scripts/terrain-scene.py fetch  [curiosity,perseverance] [workdir]   # HiRISE near rings (range requests only)
    python3 scripts/terrain-scene.py far    [curiosity,perseverance] [workdir]   # 16/64/256 km rings: HiRISE 32 m, HRSC+MOLA, CTX
    python3 scripts/terrain-scene.py export [curiosity,perseverance] [workdir] [public/tour-media/terrain]

Sources (USGS Astrogeology mosaics on asc-pds-services S3; nothing is downloaded whole):
  perseverance  Mars 2020 TRN HiRISE DTM mosaic (1 m, MOLA-tied) and RED orthomosaic (25 cm), both
                uncompressed strip TIFFs → read with byte-range requests for just the window needed.
                Credit NASA/JPL-Caltech/UArizona/USGS.
  curiosity     MSL Gale merged DEM (1 m, LZW strips → one strip per row via rasterio) and the HiRISE
                LRGB 78-quad colour COG (25 cm, JPEG tiles with overviews → windowed reads).
                Credit NASA/JPL-Caltech/UArizona/USGS.
  far rings     16 km: the same HiRISE DEMs at 32 m; 64 and 256 km: the USGS HRSC+MOLA blended DEM
                (200 m, uncompressed strips → byte ranges of just the window). Imagery: NASA Trek's
                block-adjusted CTX mosaics of Gale and Jezero (6 m, PNG tiles with a no-data alpha;
                gaps take the Viking globe's own luminance). Credit NASA/JPL/MSSS, ESA/DLR/FU Berlin.

Per rover the export writes five nested square rings (1, 4, 16, 64, 256 km; finest first) into
<id>/: h<i>.png (16-bit height in the R,G bytes, km above the vehicle's ground level), c<i>.jpg
(imagery whose ~1 km low-pass is the Viking globe's own colour) and meta.json, consumed by `appearance.terrain` (src/data/spacecraft.ts) via
src/render/Terrain.ts. Needs numpy, rasterio, Pillow, certifi (a throw-away venv is fine).
"""

import json, math, os, struct, sys, time, io
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import urllib.request, urllib.error, ssl, certifi
from PIL import Image
SSL_CTX = ssl.create_default_context(cafile=certifi.where())
os.environ['GDAL_DISABLE_READDIR_ON_OPEN'] = 'EMPTY_DIR'
import rasterio
from rasterio.windows import Window

R = 3396190.0
S3 = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/'
JEZ_DTM = S3 + 'mars2020_trn/HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif'
JEZ_ORT = S3 + 'mars2020_trn/HiRISE/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.tif'
GALE_DEM = S3 + 'Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif'
GALE_COL = S3 + 'Mars/MSL/MSL_Gale_HiRISE-LRGB_78quads_sharp_cog.tif'
BYTES = [0]

def eqc(lat, lon):
    return R * math.radians(lon), R * math.radians(lat)

# ---------------------------------------------------------------- raw TIFF strip reader
class StripTiff:
    """Uncompressed, one-row-per-strip (Big)TIFF over HTTP: fetch exactly the bytes of a column span."""
    def __init__(self, url):
        self.url = url
        head = self.get(0, 16)
        self.le = head[:2] == b'II'
        e = '<' if self.le else '>'
        magic = struct.unpack(e + 'H', head[2:4])[0]
        self.big = magic == 43
        if self.big:
            off = struct.unpack(e + 'Q', head[8:16])[0]
        else:
            off = struct.unpack(e + 'I', head[4:8])[0]
        self.e = e
        self.tags = self.read_ifd(off)
        self.width = self.tag_val(256)[0]; self.height = self.tag_val(257)[0]
        bps = self.tag_val(258); self.bpp = bps[0] // 8
        self.spp = self.tag_val(277)[0] if 277 in self.tags else 1
        rps = self.tag_val(278)[0]
        assert rps == 1, f'rows per strip {rps}'
        assert self.tag_val(259)[0] == 1, 'compressed'
        self.offsets = self.tag_val(273)
        self.fmt = self.tag_val(339)[0] if 339 in self.tags else 1
        # geotransform: ModelPixelScale (33550) + ModelTiepoint (33922)
        sc = self.tag_val(33550); tp = self.tag_val(33922)
        self.px, self.py = sc[0], sc[1]
        self.x0, self.y0 = tp[3], tp[4]
    def get(self, start, n):
        req = urllib.request.Request(self.url, headers={'Range': f'bytes={start}-{start + n - 1}'})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
                    data = r.read()
                BYTES[0] += len(data)
                return data
            except Exception as ex:
                if attempt == 4: raise
                time.sleep(1 + attempt)
    def read_ifd(self, off):
        e = self.e
        if self.big:
            n = struct.unpack(e + 'Q', self.get(off, 8))[0]
            raw = self.get(off + 8, n * 20)
            tags = {}
            for i in range(n):
                tag, typ, cnt = struct.unpack(e + 'HHQ', raw[i * 20:i * 20 + 12])
                tags[tag] = (typ, cnt, raw[i * 20 + 12:i * 20 + 20])
        else:
            n = struct.unpack(e + 'H', self.get(off, 2))[0]
            raw = self.get(off + 2, n * 12)
            tags = {}
            for i in range(n):
                tag, typ, cnt = struct.unpack(e + 'HHI', raw[i * 12:i * 12 + 8])
                tags[tag] = (typ, cnt, raw[i * 12 + 8:i * 12 + 12])
        return tags
    def tag_val(self, tag):
        typ, cnt, val = self.tags[tag]
        sizes = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8}
        codes = {1: 'B', 3: 'H', 4: 'I', 11: 'f', 12: 'd', 16: 'Q'}
        size = sizes[typ] * cnt
        inline = 8 if self.big else 4
        if size <= inline:
            data = val[:size]
        else:
            off = struct.unpack(self.e + ('Q' if self.big else 'I'), val)[0]
            data = self.get(off, size)
        return struct.unpack(self.e + codes[typ] * cnt, data)
    def dtype(self):
        e = '<' if self.le else '>'
        if self.fmt == 3: return np.dtype(e + 'f4')
        if self.fmt == 2: return np.dtype(e + {1: 'i1', 2: 'i2', 4: 'i4'}[self.bpp])
        return np.dtype(e + {1: 'u1', 2: 'u2', 4: 'u4'}[self.bpp])
    def rows(self, r0, r1, step, c0, c1):
        """rows r0..r1 (every `step`), columns c0..c1 → array (nrows, c1-c0[, spp])"""
        rows = list(range(r0, r1, step))
        n = c1 - c0
        def one(r):
            off = self.offsets[r] + c0 * self.bpp * self.spp
            return np.frombuffer(self.get(off, n * self.bpp * self.spp), dtype=self.dtype())
        out = []
        with ThreadPoolExecutor(24) as ex:
            for i, a in enumerate(ex.map(one, rows)):
                out.append(a)
                if i % 500 == 0: print(f'   row {i}/{len(rows)}  {BYTES[0] / 1e6:.1f} MB', flush=True)
        a = np.stack(out)
        if self.spp > 1: a = a.reshape(len(rows), n, self.spp)
        return a

def box(a, k):
    """box-downsample columns by k (and rows if 2-D already decimated)"""
    h, w = a.shape[:2]
    w2 = (w // k) * k
    a = a[:, :w2]
    return a.reshape(h, w2 // k, k, *a.shape[2:]).mean(axis=2)

def jezero(cx, cy, rings):
    dtm = StripTiff(JEZ_DTM); ort = StripTiff(JEZ_ORT)
    print(' jezero tiffs', dtm.width, dtm.height, dtm.px, '|', ort.width, ort.height, ort.px, 'big', ort.big, flush=True)
    res = []
    for size, hres, cres, hpx, cpx in rings:
        # heights: rows every (hres/1 m), full columns then box
        n = int(size / hres)
        r0 = int((dtm.y0 - (cy + size / 2)) / dtm.py); c0 = int((cx - size / 2 - dtm.x0) / dtm.px)
        h = dtm.rows(r0, r0 + int(size), int(hres), c0, c0 + int(size)).astype(np.float32)
        h = box(h, int(hres)) if hres > 1 else h
        h[h < -1e30] = np.nan
        # imagery
        step = int(cres / 0.25); k = step
        r0 = int((ort.y0 - (cy + size / 2)) / ort.py); c0 = int((cx - size / 2 - ort.x0) / ort.px)
        ncols = int(size / 0.25)
        c = ort.rows(r0, r0 + ncols, step, c0, c0 + ncols).astype(np.float32)
        c = box(c, k)
        print(f'  ring {size} m: h {h.shape} c {c.shape}  {BYTES[0] / 1e6:.1f} MB so far', flush=True)
        res.append((size, h, c))
    return res

def gale(cx, cy, rings):
    res = []
    with rasterio.open('/vsicurl/' + GALE_DEM) as dem, rasterio.open('/vsicurl/' + GALE_COL) as col:
        for size, hres, cres, hpx, cpx in rings:
            n = int(size / hres)
            row0 = int((dem.transform.f - (cy + size / 2)) / -dem.transform.e)
            col0 = int((cx - size / 2 - dem.transform.c) / dem.transform.a)
            rows = []
            step = int(hres)
            for i in range(n):
                r = row0 + i * step
                a = dem.read(1, window=Window(col0, r, int(size), 1))[0].astype(np.float32)
                rows.append(a)
                if i % 100 == 0: print(f'   dem row {i}/{n}', flush=True)
            h = np.stack(rows)
            h = box(h, step) if step > 1 else h
            h[h <= -32000] = np.nan
            crow0 = int((col.transform.f - (cy + size / 2)) / -col.transform.e)
            ccol0 = int((cx - size / 2 - col.transform.c) / col.transform.a)
            npx = int(size / 0.25)
            outn = int(size / cres)
            c = col.read(window=Window(ccol0, crow0, npx, npx), out_shape=(3, outn, outn), boundless=True, fill_value=0)
            c = np.moveaxis(c, 0, -1).astype(np.float32)
            print(f'  ring {size} m: h {h.shape} c {c.shape}', flush=True)
            res.append((size, h, c))
    return res

SITES = {
    # size (m), height res (m), colour res (m)
    'perseverance': dict(lat=18.4447, lon=77.4508, fn=jezero, rings=[(1000, 1, 0.5, 0, 0), (4000, 4, 2, 0, 0)], ctx='Jezero_CTX_BlockAdj_dd',
                         credit='Jezero arazisi: NASA/JPL-Caltech/UArizona/USGS · HiRISE DTM (1 m) ve ortofoto (25 cm)'),
    'curiosity': dict(lat=-4.5895, lon=137.4417, fn=gale, rings=[(1000, 2, 0.5, 0, 0), (4000, 8, 2, 0, 0)], ctx='Gale_CTX_BlockAdj_dd',
                      credit='Gale arazisi: NASA/JPL-Caltech/UArizona/USGS · HiRISE DEM (1 m) ve renkli mozaik (25 cm)'),
}
def fetch_all(ids, OUT):
  for rid in ids:
    s = SITES[rid]
    cx, cy = eqc(s['lat'], s['lon'])
    print(rid, f'centre x={cx:.0f} y={cy:.0f}', flush=True)
    t0 = time.time()
    rings = s['fn'](cx, cy, s['rings'])
    os.makedirs(f'{OUT}/{rid}', exist_ok=True)
    meta = {'credit': s['credit'], 'rings': []}
    for i, (size, h, c) in enumerate(rings):
        np.save(f'{OUT}/{rid}/ring{i}-h.npy', h); np.save(f'{OUT}/{rid}/ring{i}-c.npy', c.astype(np.uint8))
        meta['rings'].append({'size': size, 'h': list(h.shape), 'c': list(c.shape)})
    json.dump(meta, open(f'{OUT}/{rid}/meta.json', 'w'), ensure_ascii=False, indent=1)
    print(rid, f'done in {time.time() - t0:.0f}s, {BYTES[0] / 1e6:.1f} MB via range requests', flush=True)

from PIL import Image

SSL_CTX = ssl.create_default_context(cafile=certifi.where())
# ---------------------------------------------------------------- far rings
BLEND = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif'
TREK_TILE = 'https://trek.nasa.gov/tiles/Mars/EQ/{layer}/1.0.0//default/default028mm/{z}/{y}/{x}.png'
KM_PER_DEG = 2 * math.pi * 3396.19 / 360          # 59.27 km

def resample(a, n, nearest=False):
    """float array (NaN allowed) → n×n, bilinear on a NaN-filled copy, NaN where the source had none"""
    m = np.isnan(a)
    f = np.where(m, np.nanmean(a) if not m.all() else 0.0, a).astype(np.float32)
    im = Image.fromarray(f).resize((n, n), Image.NEAREST if nearest else Image.BILINEAR)
    out = np.asarray(im, dtype=np.float32).copy()
    if m.any():
        mm = Image.fromarray(m.astype(np.float32)).resize((n, n), Image.BILINEAR)
        out[np.asarray(mm) > 0.5] = np.nan
    return out

def window_deg(lat, lon, size_m):
    dlat = size_m / 1000 / KM_PER_DEG
    dlon = size_m / 1000 / (KM_PER_DEG * math.cos(math.radians(lat)))
    return lon - dlon / 2, lon + dlon / 2, lat - dlat / 2, lat + dlat / 2

# ---------------------------------------------------------------- HRSC+MOLA 200 m blend
def blend_dem(tiff, lat, lon, size_m, n):
    lon0, lon1, lat0, lat1 = window_deg(lat, lon, size_m)
    c0 = int((lon0 - tiff.x0) / tiff.px); c1 = int(math.ceil((lon1 - tiff.x0) / tiff.px)) + 1
    r0 = int((tiff.y0 - lat1) / tiff.py); r1 = int(math.ceil((tiff.y0 - lat0) / tiff.py)) + 1
    a = tiff.rows(r0, r1, 1, c0, c1).astype(np.float32)
    a[a <= -32000] = np.nan
    return resample(a, n)

# ---------------------------------------------------------------- Trek tiles
def trek_mosaic(layer, lat, lon, size_m, z, n):
    span = 180 / 2 ** z; ppd = 256 / span
    lon0, lon1, lat0, lat1 = window_deg(lat, lon, size_m)
    X0, X1 = (lon0 + 180) * ppd, (lon1 + 180) * ppd
    Y0, Y1 = (90 - lat1) * ppd, (90 - lat0) * ppd
    tx0, tx1 = int(X0 // 256), int(X1 // 256); ty0, ty1 = int(Y0 // 256), int(Y1 // 256)
    W = (tx1 - tx0 + 1) * 256; H = (ty1 - ty0 + 1) * 256
    mosaic = np.full((H, W), np.nan, np.float32)
    def one(t):
        tx, ty = t
        req = urllib.request.Request(TREK_TILE.format(layer=layer, z=z, y=ty, x=tx))
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
                    data = r.read()
                BYTES[0] += len(data)
                im = Image.open(io.BytesIO(data)).convert('LA')
                a = np.asarray(im, dtype=np.float32)
                g = a[..., 0].copy(); g[a[..., 1] < 128] = np.nan
                return t, g
            except urllib.error.HTTPError as ex:
                if ex.code == 404: return t, None
                if attempt == 3: raise
            except Exception:
                if attempt == 3: raise
            time.sleep(1 + attempt)
    tiles = [(tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]
    got = 0
    with ThreadPoolExecutor(16) as ex:
        for (tx, ty), g in ex.map(one, tiles):
            if g is None: continue
            got += 1
            mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = g
    print(f'   {layer} z{z}: {got}/{len(tiles)} tiles, {BYTES[0] / 1e6:.1f} MB', flush=True)
    x0 = int(X0 - tx0 * 256); x1 = int(math.ceil(X1 - tx0 * 256)); y0 = int(Y0 - ty0 * 256); y1 = int(math.ceil(Y1 - ty0 * 256))
    return resample(mosaic[y0:y1, x0:x1], n)

# ---------------------------------------------------------------- HiRISE at 32 m for the 16 km ring
def hirise16_jezero(lat, lon, size_m, step):
    cx, cy = eqc(lat, lon)
    dtm = StripTiff(JEZ_DTM)
    n = int(size_m / step)
    r0 = int((dtm.y0 - (cy + size_m / 2)) / dtm.py); c0 = int((cx - size_m / 2 - dtm.x0) / dtm.px)
    # clamp to the file; pad with NaN
    cc0, cc1 = max(0, c0), min(dtm.width, c0 + int(size_m))
    rr0, rr1 = max(0, r0), min(dtm.height, r0 + int(size_m))
    rows = list(range(r0, r0 + int(size_m), step))
    inside = [r for r in rows if rr0 <= r < rr1]
    h = np.full((len(rows), int(size_m)), np.nan, np.float32)
    if inside and cc1 > cc0:
        a = dtm.rows(inside[0], inside[-1] + 1, step, cc0, cc1).astype(np.float32)
        a[a < -1e30] = np.nan
        i0 = rows.index(inside[0])
        h[i0:i0 + a.shape[0], cc0 - c0:cc1 - c0] = a
    return resample(h, n)

def hirise16_gale(lat, lon, size_m, step):
    cx, cy = eqc(lat, lon)
    n = int(size_m / step)
    with rasterio.open('/vsicurl/' + GALE_DEM) as dem:
        row0 = int((dem.transform.f - (cy + size_m / 2)) / -dem.transform.e)
        col0 = int((cx - size_m / 2 - dem.transform.c) / dem.transform.a)
        rows = []
        for i in range(n):
            r = row0 + i * step
            if 0 <= r < dem.height:
                a = dem.read(1, window=Window(col0, r, int(size_m), 1), boundless=True, fill_value=-32768)[0].astype(np.float32)
            else:
                a = np.full(int(size_m), -32768, np.float32)
            rows.append(a)
            if i % 100 == 0: print(f'   gale dem row {i}/{n}', flush=True)
        h = np.stack(rows)
        h[h <= -32000] = np.nan
    return resample(h, n)

HIRISE16 = {'perseverance': hirise16_jezero, 'curiosity': hirise16_gale}
# (size m, height px, colour px, ctx zoom)
FAR = [(16000, 500, 1600, 12), (64000, 320, 2000, 11), (256000, 640, 2000, 9)]
FAR_SIZES = tuple(f[0] for f in FAR)
EXPORT_LUM = 90.0   # mean luminance the imagery is written at (see `lift` in export_site)

def far_all(ids, OUT):
    blend = StripTiff(BLEND)
    print('blend', blend.width, blend.height, blend.px, 'big', blend.big, flush=True)
    for rid in ids:
        s = SITES[rid]; t0 = time.time()
        os.makedirs(f'{OUT}/{rid}', exist_ok=True)
        for size, hn, cn, z in FAR:
            hb = blend_dem(blend, s['lat'], s['lon'], size, hn)
            if size == 16000:
                cache = f'{OUT}/{rid}/far-{size}-hh.npy'
                if os.path.exists(cache): hh = np.load(cache)
                else: hh = HIRISE16[rid](s['lat'], s['lon'], size, 32); np.save(cache, hh)
                ok = ~np.isnan(hh) & ~np.isnan(hb)
                off = float(np.nanmedian(hh[ok] - hb[ok])) if ok.any() else 0.0
                print(f'   hirise vs blend offset {off:.1f} m, hirise coverage {(~np.isnan(hh)).mean():.3f}', flush=True)
                h = np.where(np.isnan(hh), hb + off, hh)
            else:
                h = hb
            c = trek_mosaic(s['ctx'], s['lat'], s['lon'], size, z, cn)
            np.save(f'{OUT}/{rid}/far-{size}-h.npy', h.astype(np.float32))
            np.save(f'{OUT}/{rid}/far-{size}-c.npy', c.astype(np.float32))
            print(f'  {rid} {size} m: h {h.shape} nan {np.isnan(h).mean():.3f} range {np.nanmin(h):.0f}…{np.nanmax(h):.0f}  c {c.shape} nan {np.isnan(c).mean():.3f}  {BYTES[0] / 1e6:.1f} MB', flush=True)
        print(rid, f'far done in {time.time() - t0:.0f}s, {BYTES[0] / 1e6:.1f} MB', flush=True)

# ---------------------------------------------------------------- export
TREK = 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0//default/default028mm'

class VikingField:
    """the Viking globe mosaic around a site (level-7 tiles, ~330 m/px): its tone over the patch's
    footprint and, per ring, its large-scale brightness so the patch follows the globe's albedo"""
    def __init__(self, lat, lon, size_m):
        z = 7; span = 180 / 2 ** z; n = 256
        fx = (lon + 180) / span; fy = (90 - lat) / span
        tx, ty = int(fx), int(fy)
        K = 2  # 5×5 tiles ≈ 415 km: covers the widest ring
        tiles = {}
        for dy in range(-K, K + 1):
            for dx in range(-K, K + 1):
                req = urllib.request.Request(f'{TREK}/{z}/{ty + dy}/{tx + dx}.jpg')
                try:
                    with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
                        tiles[(dx, dy)] = np.asarray(Image.open(io.BytesIO(r.read())).convert('RGB'), dtype=np.float32)
                except Exception:
                    tiles[(dx, dy)] = None
        W = 2 * K + 1
        mosaic = np.zeros((W * n, W * n, 3), np.float32); ok = np.zeros((W * n, W * n), bool)
        for (dx, dy), a in tiles.items():
            if a is None: continue
            mosaic[(dy + K) * n:(dy + K + 1) * n, (dx + K) * n:(dx + K + 1) * n] = a
            ok[(dy + K) * n:(dy + K + 1) * n, (dx + K) * n:(dx + K + 1) * n] = True
        # 3×3 box: the JPEG tiles are noisy at the pixel level
        p = np.pad(mosaic, ((1, 1), (1, 1), (0, 0)), mode='edge')
        self.mosaic = sum(p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9.0
        self.px = K * n + (fx - tx) * n; self.py = K * n + (fy - ty) * n
        self.km_per_px = span * 59.274 / n       # Mars: 59.27 km per degree (equirectangular tiles)
        self.coslat = np.cos(np.radians(lat))
        r = max(2, int(round(size_m / 1000 / self.km_per_px / 2)))
        y0, y1 = int(self.py) - r, int(self.py) + r + 1; x0, x1 = int(self.px) - r, int(self.px) + r + 1
        sel = self.mosaic[y0:y1, x0:x1][ok[y0:y1, x0:x1]]
        self.tone = sel.reshape(-1, 3).mean(axis=0)
        self.lum = float(self.tone.mean())

    def rgb(self, size_m, n):
        """n×n colour of the mosaic over a ring of `size_m`, bilinear, north up / east right"""
        t = (np.arange(n) + 0.5) / n - 0.5
        xs = self.px + t * (size_m / 1000) / self.km_per_px / self.coslat
        ys = self.py + t * (size_m / 1000) / self.km_per_px
        m = self.mosaic
        x0 = np.clip(np.floor(xs).astype(int), 0, m.shape[1] - 2); y0 = np.clip(np.floor(ys).astype(int), 0, m.shape[0] - 2)
        fx = (xs - x0)[None, :, None]; fy = (ys - y0)[:, None, None]
        a = m[y0][:, x0]; b = m[y0][:, x0 + 1]; c = m[y0 + 1][:, x0]; d = m[y0 + 1][:, x0 + 1]
        return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

    def sample(self, size_m, n):
        """n×n luminance of the mosaic over a ring of `size_m`, bilinear, north up / east right"""
        t = (np.arange(n) + 0.5) / n - 0.5
        xs = self.px + t * (size_m / 1000) / self.km_per_px / self.coslat
        ys = self.py + t * (size_m / 1000) / self.km_per_px
        lum = self.mosaic.mean(axis=2)
        x0 = np.clip(np.floor(xs).astype(int), 0, lum.shape[1] - 2); y0 = np.clip(np.floor(ys).astype(int), 0, lum.shape[0] - 2)
        fx = (xs - x0)[None, :]; fy = (ys - y0)[:, None]
        a = lum[y0][:, x0]; b = lum[y0][:, x0 + 1]; c = lum[y0 + 1][:, x0]; d = lum[y0 + 1][:, x0 + 1]
        return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

    def match(self, c, size_m, lp_m=1000.0, lo=0.4, hi=2.5):
        """give imagery `c` (n×n×3) the globe's own large-scale colour: its ~`lp_m` low-pass is
        replaced by the mosaic's, finer HiRISE detail rides on top — the patch then meets the
        globe at every edge and shares its tone"""
        n = c.shape[0]
        low = lowpass(c, max(3, int(round(lp_m / (size_m / n)))))
        detail = np.clip(c / np.maximum(low, 1.0), lo, hi)   # the imagery's own fine structure
        return self.rgb(size_m, n) * detail                  # on the globe's large-scale colour

def lowpass(c, width_px):
    """box blur of width `width_px` (n×n×3), computed at reduced resolution"""
    n = c.shape[0]; d = max(1, width_px // 8)
    small = c.reshape(n // d, d, n // d, d, 3).mean(axis=(1, 3)) if n % d == 0 else c[::d, ::d]
    k = max(1, width_px // d) | 1
    p = np.pad(small, ((k // 2, k // 2), (k // 2, k // 2), (0, 0)), mode='edge')
    cs = np.pad(np.cumsum(np.cumsum(p, axis=0), axis=1), ((1, 0), (1, 0), (0, 0)))
    s = (cs[k:, k:] - cs[:-k, k:] - cs[k:, :-k] + cs[:-k, :-k]) / (k * k)
    return np.stack([np.asarray(Image.fromarray(s[..., i]).resize((n, n), Image.BILINEAR)) for i in range(3)], axis=-1)

def inpaint_nodata(c, thresh=20.0):
    """fill the mosaic's black no-data areas with the smoothed colour of their surroundings"""
    lum = c.mean(axis=2) if c.ndim == 3 else c
    bad = lum < thresh
    if not bad.any(): return c
    # grow the mask a few pixels: JPEG ringing around the footprint edge
    k = 7; p = np.pad(bad.astype(np.float32), k // 2, mode='edge')
    cs = np.pad(np.cumsum(np.cumsum(p, axis=0), axis=1), ((1, 0), (1, 0)))
    bad = (cs[k:, k:] - cs[:-k, k:] - cs[k:, :-k] + cs[:-k, :-k]) > 0
    n = c.shape[0]; d = max(1, n // 250)
    chans = [c] if c.ndim == 2 else [c[..., i] for i in range(3)]
    out = []
    for ch in chans:
        small = ch[::d, ::d].astype(np.float32).copy(); small[bad[::d, ::d]] = np.nan
        for _ in range(8): small = fill_holes(small)
        small = np.nan_to_num(small, nan=float(np.nanmean(small)))
        big = np.asarray(Image.fromarray(small).resize((ch.shape[1], ch.shape[0]), Image.BILINEAR))
        out.append(np.where(bad, big, ch))
    return out[0] if c.ndim == 2 else np.stack(out, axis=-1)

def ctx_fill(c, size_m, sdir, thresh=20.0):
    """black no-data in a near ring (outside the HiRISE footprint) → the 16 km CTX mosaic's grey
    over the same ground, levelled to the ring; only what CTX lacks too is left to inpainting"""
    path = f'{sdir}/far-16000-c.npy'
    if not os.path.exists(path): return c
    lum = c.mean(axis=2) if c.ndim == 3 else c
    bad = lum < thresh
    if not bad.any(): return c
    k = 7; p = np.pad(bad.astype(np.float32), k // 2, mode='edge')
    cs = np.pad(np.cumsum(np.cumsum(p, axis=0), axis=1), ((1, 0), (1, 0)))
    bad = (cs[k:, k:] - cs[:-k, k:] - cs[k:, :-k] + cs[:-k, :-k]) > 0
    far = np.load(path).astype(np.float32); nf = far.shape[0]
    far = np.nan_to_num(far, nan=float(np.nanmean(far)))
    c0 = int(round((0.5 - size_m / 32000.0) * nf)); c1 = int(round((0.5 + size_m / 32000.0) * nf))
    n = c.shape[0]
    ctx = np.asarray(Image.fromarray(far[c0:c1, c0:c1]).resize((n, n), Image.BICUBIC), dtype=np.float32)
    ok = ~bad & (ctx > 1)
    level = float(lum[ok].mean() / max(ctx[ok].mean(), 1.0)) if ok.any() else 1.0
    fill = np.clip(ctx * level, 1.0, 255.0)
    if c.ndim == 3: fill = np.repeat(fill[..., None], 3, axis=2); bad = np.repeat(bad[..., None], 3, axis=2)
    return np.where(bad, fill, c)

def colour_weight(c):
    """1 where a colour mosaic really carries colour, 0 over its greyscale fill (softened a little)"""
    mx = c.max(axis=2); mn = c.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1.0)
    t = np.clip((sat - 0.15) / 0.15, 0, 1)      # JPEG noise gives grey pixels ~0.1
    w = t * t * (3 - 2 * t)
    # 9×9 box blur so the strip boundary does not speckle
    k = 9; p = np.pad(w, k // 2, mode='edge')
    cs = np.cumsum(np.cumsum(p, axis=0), axis=1)
    cs = np.pad(cs, ((1, 0), (1, 0)))
    s = cs[k:, k:] - cs[:-k, k:] - cs[k:, :-k] + cs[:-k, :-k]
    return s / (k * k)

def fill_holes(h):
    h = h.copy()
    bad = np.isnan(h)
    if not bad.any(): return h
    # repeated 3×3 mean of valid neighbours
    for _ in range(64):
        bad = np.isnan(h)
        if not bad.any(): break
        p = np.pad(h, 1, mode='edge')
        acc = np.zeros_like(h); cnt = np.zeros_like(h)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                v = p[1 + dy:1 + dy + h.shape[0], 1 + dx:1 + dx + h.shape[1]]
                ok = ~np.isnan(v)
                acc[ok] += v[ok]; cnt[ok] += 1
        fillable = bad & (cnt > 0)
        h[fillable] = acc[fillable] / cnt[fillable]
    h[np.isnan(h)] = np.nanmean(h)
    return h

def smooth_rows(h):
    """rows were point-sampled (every k-th), columns box-filtered: a light vertical blur evens that"""
    p = np.pad(h, ((1, 1), (0, 0)), mode='edge')
    return 0.25 * p[:-2] + 0.5 * p[1:-1] + 0.25 * p[2:]

def to_png16(h_km, path):
    hmin, hmax = float(h_km.min()), float(h_km.max())
    if hmax - hmin < 1e-9: hmax = hmin + 1e-9
    q = np.round((h_km - hmin) / (hmax - hmin) * 65535).astype(np.uint32)
    rgb = np.zeros((*h_km.shape, 3), dtype=np.uint8)
    rgb[..., 0] = q >> 8; rgb[..., 1] = q & 255
    Image.fromarray(rgb, 'RGB').save(path, optimize=True)
    return hmin, hmax

def export_all(ids, SRC, DST):
  for rid in ids:
    sdir = f'{SRC}/{rid}'; ddir = f'{DST}/{rid}'
    os.makedirs(ddir, exist_ok=True)
    meta_in = json.load(open(f'{sdir}/meta.json'))
    viking = VikingField(SITES[rid]['lat'], SITES[rid]['lon'], 4000); tone = viking.tone
    print(rid, 'viking tone', tone.round(1))
    # near rings: HiRISE (an old 8 km Jezero ring would be superseded by the 16 km far ring)
    rings = [(np.load(f'{sdir}/ring{i}-h.npy'), np.load(f'{sdir}/ring{i}-c.npy'), r['size']) for i, r in enumerate(meta_in['rings']) if r['size'] < 8000]
    # far rings: HiRISE/HRSC+MOLA heights, CTX grey (NaN = no CTX → the Viking globe's own luminance)
    for size in FAR_SIZES:
        if not os.path.exists(f'{sdir}/far-{size}-h.npy'): continue
        h = np.load(f'{sdir}/far-{size}-h.npy'); c = np.load(f'{sdir}/far-{size}-c.npy')
        vl = viking.sample(size, c.shape[0])
        gap = np.isnan(c)
        if gap.any():
            # scale the Viking luminance to CTX's own level over the overlap, then fill
            k = float(np.nanmean(c[~gap]) / max(np.nanmean(vl[~gap]), 1.0)) if (~gap).any() else 1.0
            c = np.where(gap, vl * k, c)
        rings.append((h, c, size))
    # ground level under the vehicle: centre of the finest ring
    h0 = rings[0][0]
    cy, cx = h0.shape[0] // 2, h0.shape[1] // 2
    base = float(np.nanmean(h0[cy - 2:cy + 3, cx - 2:cx + 3]))
    # imagery tone: a single gain for all rings (from the widest) so rings never differ in colour
    cw = inpaint_nodata(rings[min(1, len(rings) - 1)][1].astype(np.float32))
    if cw.ndim == 2:
        gain_grey = tone / float(cw[cw > 0].mean())  # grey → Viking colour
        gain_col = gain_grey
    else:
        # colour mosaics are stitched from colour strips and greyscale fill: the colour pixels get a
        # per-channel balance onto the Viking tone, the grey ones are tinted with it
        w = colour_weight(cw)
        lum = cw.mean(axis=2)
        col = cw[w > 0.5]
        gain_col = tone / col.mean(axis=0) if len(col) else tone / max(float(lum.mean()), 1.0)
        grey = lum[(w <= 0.5) & (lum > 0)]
        gain_grey = tone / float(grey.mean()) if len(grey) else gain_col
    # the maps are written at a comfortable mid level (dark sites such as Jezero's floor would
    # otherwise live in the lowest JPEG codes): `globeTone` is what the globe shows there, `tone`
    # what the maps hold — the renderer scales between them (and to the panorama's tone up close)
    lift = EXPORT_LUM / max(float(tone.mean()), 1.0)
    out = {'rings': [], 'globeTone': [round(float(v), 2) for v in tone], 'tone': [round(float(v * lift), 2) for v in tone]}
    for i, (h, c, size) in enumerate(rings):
        h = fill_holes(h.astype(np.float32)) if size in FAR_SIZES else smooth_rows(fill_holes(h.astype(np.float32)))
        h_km = (h - base) / 1000.0
        hmin, hmax = to_png16(h_km, f'{ddir}/h{i}.png')
        c = c.astype(np.float32) if size in FAR_SIZES else inpaint_nodata(ctx_fill(c.astype(np.float32), size, sdir))
        if c.ndim == 2: c = c[..., None] * gain_grey[None, None, :]
        else:
            w = colour_weight(c)[..., None]
            c = w * (c * gain_col[None, None, :]) + (1 - w) * (c.mean(axis=2)[..., None] * gain_grey[None, None, :])
        # far rings: a wider low-pass and a narrower detail clamp, so CTX shadow slopes do not blow out
        c = viking.match(c, size, 3000.0, 0.5, 1.8) if size in FAR_SIZES else viking.match(c, size)
        img = Image.fromarray(np.clip(c * lift, 0, 255).astype(np.uint8), 'RGB')
        img.save(f'{ddir}/c{i}.jpg', quality=78 if size in FAR_SIZES else 82, optimize=True, progressive=True)
        out['rings'].append({'size': size / 1000.0, 'h': f'h{i}.png', 'hmin': hmin, 'hmax': hmax, 'c': f'c{i}.jpg'})
        print(f'  ring {i}: {size} m  relief {hmin * 1000:.1f}…{hmax * 1000:.1f} m  h {h.shape} c {img.size}')
    json.dump(out, open(f'{ddir}/meta.json', 'w'), indent=1)
    print(rid, 'exported →', ddir, [f'{os.path.getsize(f"{ddir}/{f}") / 1e6:.2f}MB {f}' for f in sorted(os.listdir(ddir))])

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'fetch'
    ids = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] else list(SITES)
    work = sys.argv[3] if len(sys.argv) > 3 else 'terrain-work'
    if cmd == 'fetch': fetch_all(ids, work)
    elif cmd == 'far': far_all(ids, work)
    elif cmd == 'export': export_all(ids, work, sys.argv[4] if len(sys.argv) > 4 else 'public/tour-media/terrain')
    else: sys.exit(f'unknown command {cmd}')
