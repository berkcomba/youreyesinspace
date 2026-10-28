"""Real relief for the tour's Olympus Mons postcard: heights and imagery around the volcano.

    python3 scripts/olympus-relief.py [public/tour-media/terrain/olympus]

Heights: the USGS HRSC+MOLA blended DEM (200 m, read with byte-range requests through
terrain-scene.py's StripTiff), box-filtered to ~1.75 km. Imagery: the Viking MDIM 2.1 colour
mosaic from NASA Trek (the globe's own layer, so the relief meets it without a seam).
Writes h.png (16-bit height in the R,G bytes, km above the surrounding plains), c.jpg (north up,
east right, same square footprint) and meta.json, consumed by src/render/Relief.ts.
Needs numpy, rasterio, Pillow, certifi (a throw-away venv is fine).
"""

import importlib.util, io, json, math, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('terrain_scene', os.path.join(HERE, 'terrain-scene.py'))
ts = importlib.util.module_from_spec(spec); spec.loader.exec_module(ts)

LAT, LON = 18.65, -133.8          # summit caldera
SIZE_KM = 900.0                   # square footprint (the aureole's inner lobes included)
HN, CN = 513, 2048                # height grid, imagery pixels
KM_PER_DEG = 2 * math.pi * 3396.19 / 360
VIKING = 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0//default/default028mm/{z}/{y}/{x}.jpg'

def window():
    dlat = SIZE_KM / KM_PER_DEG / 2
    dlon = SIZE_KM / (KM_PER_DEG * math.cos(math.radians(LAT))) / 2
    return LON - dlon, LON + dlon, LAT - dlat, LAT + dlat

def heights():
    t = ts.StripTiff(ts.BLEND)
    lon0, lon1, lat0, lat1 = window()
    c0 = int((lon0 - t.x0) / t.px); c1 = int(math.ceil((lon1 - t.x0) / t.px)) + 1
    r0 = int((t.y0 - lat1) / t.py); r1 = int(math.ceil((t.y0 - lat0) / t.py)) + 1
    step = 4
    a = t.rows(r0, r1, step, c0, c1).astype(np.float32)
    a[a <= -32000] = np.nan
    a = ts.box(a, step)
    return ts.resample(ts.fill_holes(a), HN)

def imagery():
    z = 7; span = 180 / 2 ** z; ppd = 256 / span
    lon0, lon1, lat0, lat1 = window()
    X0, X1 = (lon0 + 180) * ppd, (lon1 + 180) * ppd
    Y0, Y1 = (90 - lat1) * ppd, (90 - lat0) * ppd
    tx0, tx1 = int(X0 // 256), int(X1 // 256); ty0, ty1 = int(Y0 // 256), int(Y1 // 256)
    m = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256, 3), np.uint8)
    def one(t):
        tx, ty = t
        with urllib.request.urlopen(VIKING.format(z=z, y=ty, x=tx), timeout=60, context=ts.SSL_CTX) as r:
            return t, np.asarray(Image.open(io.BytesIO(r.read())).convert('RGB'))
    tiles = [(tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]
    with ThreadPoolExecutor(12) as ex:
        for (tx, ty), a in ex.map(one, tiles):
            m[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = a
    x0 = int(X0 - tx0 * 256); x1 = int(math.ceil(X1 - tx0 * 256)); y0 = int(Y0 - ty0 * 256); y1 = int(math.ceil(Y1 - ty0 * 256))
    print(f' viking z{z}: {len(tiles)} tiles, crop {x1 - x0}×{y1 - y0}', flush=True)
    return Image.fromarray(m[y0:y1, x0:x1]).resize((CN, CN), Image.LANCZOS)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'public/tour-media/terrain/olympus'
    os.makedirs(out, exist_ok=True)
    h = heights()
    # datum: the plains around the volcano (median of the outer ring of the footprint)
    yy, xx = np.mgrid[0:HN, 0:HN]
    r = np.hypot(xx - (HN - 1) / 2, yy - (HN - 1) / 2) / (HN - 1) * SIZE_KM
    base = float(np.median(h[(r > 380) & (r < 450)]))
    h_km = (h - base) / 1000.0
    hmin, hmax = ts.to_png16(h_km, f'{out}/h.png')
    imagery().save(f'{out}/c.jpg', quality=84, optimize=True, progressive=True)
    json.dump({'lat': LAT, 'lon': LON, 'size': SIZE_KM, 'hmin': hmin, 'hmax': hmax,
               'credit': 'Olympus Mons: USGS HRSC+MOLA DEM (NASA/JPL/GSFC, ESA/DLR/FU Berlin) · Viking MDIM 2.1 (NASA/USGS)'},
              open(f'{out}/meta.json', 'w'), indent=1)
    print('base', round(base), 'm  relief', round(hmin, 2), '…', round(hmax, 2), 'km →', out,
          [f'{os.path.getsize(f"{out}/{f}") / 1e6:.2f}MB {f}' for f in sorted(os.listdir(out))])
