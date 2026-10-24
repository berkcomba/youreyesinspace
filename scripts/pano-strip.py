"""Rover 360° panorama → the horizon strip drawn around the vehicle (see src/render/Terrain.ts).

    python scripts/pano-strip.py <pano.jpg> <terrain dir> [--horizon ROW] [--north U] [--fix x0,e0,x1,e1,shift ...]

Input: a cylindrical 360° panorama as NASA/JPL publishes them (full circle across the width, so
one pixel is 360/width degrees either way), with the astronomical horizon on row `--horizon`
(default: the middle row, i.e. an equirectangular image). Unimaged black above the photo and
rows above its top become a smooth sky continuing each column's own sky colour.
Output, into the terrain directory (the HiRISE rings exported by terrain-scene.py):
  pano.jpg      8192×820 strip covering elevations ELEV_MIN…ELEV_MAX (row 0 = top)
  meta.json     gains a `pano` entry: {file, elevMin, elevMax, north, tone}
    north  the strip's u (0…1) that looks north — found by matching the photo's skyline with the
           skyline the terrain rings give from the vehicle (override with --north)
    tone   mean colour of the photo's ground just below the horizon: the renderer lifts the
           terrain to it when the camera is on the ground, so photo and relief share one tone

--fix re-fills a rectangle (fractions of width × elevations in degrees) with the ground `shift`
(fraction of width) to the left: its own low-pass colour is kept, only the detail is copied, so
patched rover hardware does not leave a brighter or darker box.

Sources used: Curiosity — "Curiosity's 360-degree view atop Mont Mercou" (PIA24626, NASA/JPL-
Caltech/MSSS), horizon row 700 of the 9721-px-wide release; Perseverance — Mastcam-Z "Van Zyl
Overlook" 360° panorama (NASA/JPL-Caltech/ASU/MSSS), horizon row 165 of the 9400-px-wide release.
"""
import json, math, sys
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

ELEV_MIN, ELEV_MAX = -6.0, 30.0        # degrees; below −5° the strip is never visible
STRIP_W = 8192
PANO_LUM = 100.0                        # ground luminance both rovers' strips are levelled to
PANO_SAT = 0.8                          # chroma kept: the photos' sky-lit ground is vivid, and the
                                        # renderer adds its own saturation and warm sunlight

def blur(a, sigma):
    """≈gaussian blur of a float array (n×m or n×m×3): three passes of a separable box filter"""
    if a.ndim == 3: return np.stack([blur(a[..., i], sigma) for i in range(3)], axis=-1)
    r = max(1, int(round(sigma * 0.9)))
    out = a.astype(np.float64)
    for _ in range(3):
        for axis in (0, 1):
            p = np.pad(out, [(r + 1, r) if ax == axis else (0, 0) for ax in (0, 1)], mode='edge')
            cs = np.cumsum(p, axis=axis)
            out = (np.take(cs, range(2 * r + 1, cs.shape[axis]), axis=axis) - np.take(cs, range(0, cs.shape[axis] - 2 * r - 1), axis=axis)) / (2 * r + 1)
    return out.astype(np.float32)

def refill(img, x0, y0, x1, y1, shift, pad=48, sigma=24.0):
    """replace img[y0:y1, x0:x1] by the ground `shift` px to the left: low-pass colour from the
    rectangle's own surroundings, detail from the source, feathered at the border"""
    h, w = img.shape[:2]
    Y0, Y1 = max(0, y0 - pad), min(h, y1 + pad); X0, X1 = max(0, x0 - pad), min(w, x1 + pad)
    region = img[Y0:Y1, X0:X1].copy()
    # low-pass colour inside the rectangle: the smoothed colour on its four sides (sampled just
    # outside), interpolated across — top↔bottom and left↔right, each weighted by nearness
    low = blur(region, sigma)
    yy, xx = np.mgrid[Y0:Y1, X0:X1]
    m = int(sigma)   # sampling distance outside the rectangle
    ya, yb = max(Y0, y0 - m) - Y0, min(Y1 - 1, y1 - 1 + m) - Y0
    xa, xb = max(X0, x0 - m) - X0, min(X1 - 1, x1 - 1 + m) - X0
    ty = np.clip((yy - (ya + Y0)) / max(yb - ya, 1), 0, 1)[..., None]
    tx = np.clip((xx - (xa + X0)) / max(xb - xa, 1), 0, 1)[..., None]
    vert = low[ya][None, :, :] * (1 - ty) + low[yb][None, :, :] * ty
    horz = low[:, xa][:, None, :] * (1 - tx) + low[:, xb][:, None, :] * tx
    # (a tall narrow stripe is bridged sideways, a wide flat box top to bottom)
    aspect = (x1 - x0) / max(y1 - y0, 1)
    wv = aspect / (np.minimum(ty, 1 - ty) + 0.05); wh = 1.0 / aspect / (np.minimum(tx, 1 - tx) + 0.05)
    low_dst = (vert * wv + horz * wh) / (wv + wh)
    src = np.roll(img, shift, axis=1)[Y0:Y1, X0:X1]
    # narrow stripes take only gentle texture: a copied skyline edge would not line up
    lo, hi = (0.4, 2.5) if aspect > 0.5 else (0.75, 1.35)
    detail = np.clip(src / np.maximum(blur(src, sigma), 1.0), lo, hi)
    fill = low_dst * detail
    # feather: 1 inside the rectangle shrunk by 10 px, 0 outside it
    d = np.minimum.reduce([yy - y0, y1 - 1 - yy, xx - x0, x1 - 1 - xx]).astype(np.float32)
    f = np.clip((d + 2) / 12.0, 0, 1)[..., None]
    img[Y0:Y1, X0:X1] = fill * f + region * (1 - f)

def band_from(src, horizon, ppd):
    """the ELEV_MIN…ELEV_MAX band of a cylindrical panorama whose astronomical horizon is on
    `horizon` (row); rows above the photo (and its unimaged black) become a smooth sky continuing
    each column's own topmost sky colour, darkening a little toward the zenith"""
    H, W = src.shape[:2]
    n = int(round((ELEV_MAX - ELEV_MIN) * ppd))
    top = horizon - ELEV_MAX * ppd                       # source row of the band's first row
    rows = np.clip(np.round(top + np.arange(n)).astype(int), 0, H - 1)
    band = src[rows].copy()
    valid = (band.max(axis=2) >= 16) & ((top + np.arange(n)) >= 0)[:, None] & ((top + np.arange(n)) <= H - 1)[:, None]
    # the dark fringe along the unimaged edge: shrink the valid area by a few pixels
    k = 4
    for ax in (0, 1):
        for d in (-k, k):
            valid &= np.roll(valid, d, axis=ax)
    # per column: the first valid row and the sky colour just below it
    first = np.where(valid.any(axis=0), valid.argmax(axis=0), n - 1)
    depth = max(2, int(ppd * 0.5))
    sky = np.zeros((W, 3), np.float32)
    for x in range(W):
        r0 = first[x]; seg = band[r0:r0 + depth, x][valid[r0:r0 + depth, x]]
        sky[x] = seg.mean(axis=0) if len(seg) else np.nan
    bad = np.isnan(sky[:, 0])
    if bad.any(): sky[bad] = sky[~bad].mean(axis=0)
    sky = blur(np.tile(sky, (3, 1, 1)), ppd * 2.0)[1]    # smooth around the circle
    r = np.arange(n)[:, None]
    t = np.clip((first[None, :] - r) / (30.0 * ppd), 0, 1)[..., None]
    fill = sky[None, :, :] * (1 - 0.3 * t * t)
    above = r < first[None, :]
    band[above] = fill[above]
    # anything else unimaged (holes inside the terrain): the nearest valid pixel in its row
    hole = ~valid & ~above
    if hole.any():
        idx = np.where(valid | above, np.arange(W)[None, :], -1)
        left = np.maximum.accumulate(idx, axis=1)
        for y in np.where(hole.any(axis=1))[0]:
            l = left[y]; l[l < 0] = l[l >= 0][0] if (l >= 0).any() else 0
            band[y][hole[y]] = band[y][l[hole[y]]]
    return band

def skyline_photo(strip, ppd):
    """per column, the elevation (deg) of the highest pixel that is not sky: down a column the sky
    only brightens smoothly toward the horizon, so the first clear drop below the brightest sky
    seen so far (holding for a few rows) is where the terrain begins"""
    h, w = strip.shape[:2]
    lum = blur(strip.mean(axis=2), 2.0)
    peak = np.maximum.accumulate(lum, axis=0)
    dark = lum < 0.85 * peak
    k = max(2, int(ppd * 0.4))                           # must hold for ~0.4°
    run = np.ones_like(dark[:-k])
    for i in range(k): run &= dark[i:h - k + i]
    first = np.where(run.any(axis=0), run.argmax(axis=0), h - 1)
    return ELEV_MAX - first / ppd

def skyline_terrain(tdir, meta, n_az=360):
    """per azimuth (deg from north, clockwise), the highest elevation angle of the rings' relief as
    seen from 1.5 m above the vehicle's ground"""
    fields = []
    for r in meta['rings']:
        im = np.asarray(Image.open(f'{tdir}/{r["h"]}').convert('RGB')).astype(np.float32)
        hm = r['hmin'] + (im[..., 0] * 256 + im[..., 1]) * (r['hmax'] - r['hmin']) / 65535.0
        fields.append((r['size'] / 2.0, hm))             # km half-size, km heights
    R = 3389.5
    dists = np.geomspace(0.03, fields[-1][0] * 0.98, 400)   # km
    out = np.zeros(n_az)
    for k in range(n_az):
        az = math.radians(k)
        x = np.sin(az) * dists; z = -np.cos(az) * dists     # +X east, +Z south
        hts = np.full_like(dists, np.nan)
        for half, hm in fields:                             # coarse → fine, finest wins
            n = hm.shape[0]
            u = (x / (2 * half) + 0.5) * (n - 1); v = (z / (2 * half) + 0.5) * (n - 1)
            ok = (u >= 0) & (v >= 0) & (u <= n - 1) & (v <= n - 1)
            hts[ok] = hm[np.clip(np.round(v[ok]).astype(int), 0, n - 1), np.clip(np.round(u[ok]).astype(int), 0, n - 1)]
        drop = dists ** 2 / (2 * R)
        elev = np.degrees(np.arctan2(hts - 0.0015 - drop, dists))
        out[k] = np.nanmax(elev)
    return out

def best_north(photo, terrain):
    """u of the photo column that looks north: the circular shift that best correlates the two skylines"""
    w = len(photo)
    p = photo - photo.mean(); t = terrain - terrain.mean()
    # resample the photo skyline to 1° bins
    pb = np.array([p[int(i * w / 360):int((i + 1) * w / 360)].mean() for i in range(360)])
    best, score = 0, -1e9
    for s in range(360):
        # column facing azimuth a is pano azimuth (a - s): photo bin (a - s) ↔ terrain bin a
        c = float((np.roll(pb, s) * t).sum())
        if c > score: best, score = s, c
    return (-best / 360.0) % 1.0, score

def main():
    src, tdir = sys.argv[1], sys.argv[2]
    north = None; fixes = []; horizon = None
    args = sys.argv[3:]
    while args:
        a = args.pop(0)
        if a == '--north': north = float(args.pop(0))
        elif a == '--horizon': horizon = float(args.pop(0))
        elif a == '--fix': fixes.append([float(v) for v in args.pop(0).split(',')])
    pano = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    H, W = pano.shape[:2]
    ppd = W / 360.0
    if horizon is None: horizon = H / 2.0
    strip = band_from(pano, horizon, ppd)
    for x0, e0, x1, e1, shift in fixes:
        refill(strip, int(x0 * W), int(round((ELEV_MAX - e1) * ppd)), int(x1 * W), int(round((ELEV_MAX - e0) * ppd)), int(round(shift * W)))
    # level: the ground just below the horizon — what meets the relief at the band's radius
    g0, g1 = int(round((ELEV_MAX - -0.3) * ppd)), int(round((ELEV_MAX - -2.0) * ppd))
    ground = strip[g0:g1]
    tone = ground.reshape(-1, 3).mean(axis=0)
    strip = strip * (PANO_LUM / max(float(tone.mean()), 1.0))
    lum = strip.mean(axis=2, keepdims=True)
    strip = lum + (strip - lum) * PANO_SAT
    tone = strip[g0:g1].reshape(-1, 3).mean(axis=0)
    meta = json.load(open(f'{tdir}/meta.json'))
    if north is None:
        north, score = best_north(skyline_photo(strip, ppd), skyline_terrain(tdir, meta))
        print(f'north u = {north:.4f} (skyline match {score:.1f})')
    out = Image.fromarray(np.clip(strip, 0, 255).astype(np.uint8), 'RGB')
    if out.size[0] != STRIP_W: out = out.resize((STRIP_W, round(out.size[1] * STRIP_W / out.size[0])), Image.LANCZOS)
    out.save(f'{tdir}/pano.jpg', quality=80, optimize=True, progressive=True)
    meta['pano'] = {'file': 'pano.jpg', 'elevMin': ELEV_MIN, 'elevMax': ELEV_MAX, 'north': round(north, 4), 'tone': [round(float(v), 2) for v in tone]}
    json.dump(meta, open(f'{tdir}/meta.json', 'w'), indent=1)
    print(f'{tdir}/pano.jpg {out.size}  tone {np.round(tone, 1)}  terrain tone {meta.get("tone")}')

if __name__ == '__main__':
    main()
