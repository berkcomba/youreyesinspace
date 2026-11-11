# Packs the maps rendered by exo-maps.py into the skin format of SkinLibrary.ts:
#   <name>-c.webp  rgb albedo (sRGB), a flag (1 open water, < 0.5 lava glow / 2)
#   <name>-n.webp  rgb normal × 0.5 + 0.5 in the body's frame, a height   (rocky worlds only)
#
#   python scripts/exo-maps-pack.py <work dir> <out dir> [--preview] [name …]
#
# --preview also leaves <work dir>/<name>-preview.jpg: the globe lit from the star's side, from
# three longitudes. Needs numpy and Pillow.
import os
import sys

import numpy as np
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith('--')]
preview = '--preview' in sys.argv
work, out = args[0], args[1]
names = args[2:] or sorted(f[:-8] for f in os.listdir(work) if f.endswith('-col.npy'))
# normal tilt (rise over run) at the 95th percentile: the relief reads at a glance, as the library skins' does
TILT = {'lhs3844b': 0.3, '55cnce': 0.26}
# worlds whose flag is read as lava glow (appearance.volcanic)
LAVA = {'55cnce'}


def srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def frame(H, W):
    """Unit vectors of the body's frame per texel: outward, east, north (skin_common.glsl: skinUV)"""
    lat = ((0.5 - (np.arange(H) + 0.5) / H) * np.pi)[:, None] * np.ones((1, W))
    lon = (((np.arange(W) + 0.5) / W) * 2 * np.pi)[None, :] * np.ones((H, 1))
    P = np.stack([-np.cos(lat) * np.cos(lon), np.sin(lat), np.cos(lat) * np.sin(lon)], axis=2)
    E = np.stack([np.sin(lon), np.zeros_like(lon), np.cos(lon)], axis=2)
    N = np.stack([np.sin(lat) * np.cos(lon), np.cos(lat), -np.sin(lat) * np.sin(lon)], axis=2)
    return P, E, N, lat


def normals(h, tilt95):
    H, W = h.shape
    P, E, Nn, lat = frame(H, W)
    cosl = np.maximum(np.cos(lat), 0.03)
    dlon = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / (4 * np.pi / W) / cosl
    dlat = -np.gradient(h, axis=0) / (np.pi / H)
    mid = slice(H // 6, 5 * H // 6)
    k = tilt95 / max(np.percentile(np.hypot(dlon[mid], dlat[mid]), 95), 1e-6)
    n = P - k * (dlon[..., None] * E + dlat[..., None] * Nn)
    return n / np.linalg.norm(n, axis=2, keepdims=True), k


def globe(col, n, glow, size=420):
    """Three views of the globe, the star over longitude 0 (u = 0.5), lit as a Lambert sphere"""
    H, W = col.shape[:2]
    y, x = np.mgrid[0:size, 0:size]
    x = (x + 0.5) / size * 2.2 - 1.1
    y = 1.1 - (y + 0.5) / size * 2.2
    r2 = x * x + y * y
    z = np.sqrt(np.clip(1 - r2, 0, 1))
    sun = np.array([1.0, 0.0, 0.0])
    tiles = []
    for az in (-25, 60, 150):
        a, e = np.radians(az), np.radians(12)
        # the view axis and its right / up vectors in the body's frame (east is −Z)
        f = np.array([np.cos(e) * np.cos(a), np.sin(e), -np.cos(e) * np.sin(a)])
        right = np.cross([0, 1, 0], f)
        right /= np.linalg.norm(right)
        up = np.cross(f, right)
        d = x[..., None] * right + y[..., None] * up + z[..., None] * f
        u = (np.arctan2(d[..., 2], -d[..., 0]) / (2 * np.pi)) % 1.0
        v = 0.5 - np.arcsin(np.clip(d[..., 1], -1, 1)) / np.pi
        iu, iv = np.minimum((u * W).astype(int), W - 1), np.minimum((v * H).astype(int), H - 1)
        alb = col[iv, iu]
        nn = n[iv, iu] if n is not None else d
        lit = np.clip((nn * sun).sum(2), 0, 1) * np.clip((d * sun).sum(2) * 4 + 0.6, 0, 1)
        img = alb * (lit[..., None] * 1.15 + 0.012)
        if glow is not None:
            img += glow[iv, iu][..., None] * np.array([1.0, 0.35, 0.05])
        img[r2 > 1] = 0
        tiles.append(srgb(img))
    return np.concatenate(tiles, axis=1)


for name in names:
    col = np.load(os.path.join(work, f'{name}-col.npy')).astype(np.float64)
    H, W = col.shape[:2]
    rgb = (srgb(col) * 255 + 0.5).astype(np.uint8)
    data_file = os.path.join(work, f'{name}-data.npy')
    n = flag = None
    c = np.zeros((H, W, 4), np.uint8)
    c[..., :3] = rgb
    note = ''
    if os.path.exists(data_file):
        data = np.load(data_file).astype(np.float64)
        h, flag = np.clip(data[..., 0], 0, 1), np.clip(data[..., 1], 0, 1)
        c[..., 3] = (flag * 255 + 0.5).astype(np.uint8)
        n, k = normals(h, TILT.get(name, 0.22))
        nm = np.zeros((H, W, 4), np.uint8)
        nm[..., :3] = (np.clip(n * 0.5 + 0.5, 0, 1) * 255 + 0.5).astype(np.uint8)
        nm[..., 3] = (h * 255 + 0.5).astype(np.uint8)
        # (alpha_quality only thins the height's levels, 176 of 256 here: the ground under a landing reads it)
        Image.fromarray(nm, 'RGBA').save(os.path.join(out, f'{name}-n.webp'), 'WEBP', quality=80, alpha_quality=80, method=6, exact=True)
        area = np.cos(frame(H, W)[3])
        water = float((area * (flag > 0.75)).sum() / area.sum())
        glow = float((area * ((flag > 0.02) & (flag < 0.6))).sum() / area.sum())
        note = f'  water {water:.2f}  glow {glow:.2f}  height {h.min():.2f}…{h.max():.2f} (mean {h.mean():.2f})  n {os.path.getsize(os.path.join(out, f"{name}-n.webp")) // 1024} KB'
    # a lava world's flag is a glow, fine in 48 levels; a sea's is all or nothing
    Image.fromarray(c, 'RGBA').save(os.path.join(out, f'{name}-c.webp'), 'WEBP', quality=86, alpha_quality=72 if name in LAVA else 100, method=6, exact=True)
    print(f'{name}: {W}x{H}  c {os.path.getsize(os.path.join(out, f"{name}-c.webp")) // 1024} KB{note}')
    if preview:
        small = Image.fromarray(rgb).resize((1260, 630), Image.LANCZOS)
        g = (globe(col, n, np.where(flag < 0.6, flag * 2, 0) if name in LAVA else None) * 255 + 0.5).astype(np.uint8)
        sheet = Image.new('RGB', (1260, 630 + 420))
        sheet.paste(small, (0, 0))
        sheet.paste(Image.fromarray(g), (0, 630))
        sheet.save(os.path.join(work, f'{name}-preview.jpg'), quality=88)
