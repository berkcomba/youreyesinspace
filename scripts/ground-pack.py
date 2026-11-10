# Pack a baked tile (ground-bake.py) into a ground material texture (step 2 of 2).
#
#   python scripts/ground-pack.py <raw.npy> <tile> public/ground/<name>.png [sun elevation deg]
#
# RGBA8, read by terrain.frag's groundLayer:
#   R, G  the slope ∂h/∂x, ∂h/∂y over ±slope (rise over run: the same at every size the tile is laid at)
#   B     the albedo factor (the material's colour mix, ÷ its mean) over 0…albedo
#   A     the height over its range (÷ the tile's size: height), for the shadows
# The three ranges are printed (and saved next to the raw bake as JSON): they go into the world's
# `appearance.ground` (solarSystem.ts). A preview lit by a low Sun is saved there too.
import sys, json
import numpy as np
from PIL import Image

raw, TILE, OUT = sys.argv[1], float(sys.argv[2]), sys.argv[3]
SUN = float(sys.argv[4]) if len(sys.argv) > 4 else 15.0
px = np.load(raw)
H, Nn, M = px[..., 0], px[..., 1], px[..., 2]
res = H.shape[0]
step = TILE / res

grad = lambda f: ((np.roll(f, -1, 1) - np.roll(f, 1, 1)) / (2 * step), (np.roll(f, -1, 0) - np.roll(f, 1, 0)) / (2 * step))
# the material's relief: true displacement 0.12·H, then three Bump nodes (H, fine noise, mix) that
# each tilt the normal a tenth of the way toward their own (steep) bump normal
h = 0.12 * H
sx, sy = grad(h)
for f in (H, Nn, M):
    bx, by = grad(f)
    k = 0.1 / np.sqrt(1 + bx * bx + by * by)
    sx, sy = sx + k * bx, sy + k * by
SMAX = float(np.percentile(np.abs(np.concatenate([sx.ravel(), sy.ravel()])), 99.7))
hmin, hmax = float(h.min()), float(h.max())
# the material mixes its light and dark grey by M
c1, c2 = 0.0918, 0.0100
alb = c1 + (c2 - c1) * np.clip(M, 0, 1)
fac = alb / alb.mean()
FMAX = float(np.percentile(fac, 99.8))

enc = lambda v, lo, hi: np.clip(np.round((v - lo) / (hi - lo) * 255), 0, 255).astype(np.uint8)
rgba = np.stack([enc(sx, -SMAX, SMAX), enc(sy, -SMAX, SMAX), enc(fac, 0, FMAX), enc(h, hmin, hmax)], -1)
Image.fromarray(rgba, "RGBA").save(OUT, optimize=True)
meta = {"slope": round(SMAX, 4), "albedo": round(FMAX, 4), "height": round((hmax - hmin) / TILE, 5)}
json.dump(meta, open(raw.replace("-raw.npy", ".json"), "w"))
print(json.dumps(meta))

# preview: Sun from +x at SUN°, Lambert and hard shadows (heights marched toward the Sun)
t = np.tan(np.radians(SUN))
lit = np.ones_like(h, dtype=bool)
for k in range(1, res // 3):
    lit &= np.roll(h, -k, 1) <= h + k * step * t
n = np.stack([-sx, -sy, np.ones_like(h)], -1)
n /= np.linalg.norm(n, axis=-1, keepdims=True)
l = np.array([np.cos(np.radians(SUN)), 0, np.sin(np.radians(SUN))])
shade = np.clip(n @ l, 0, None) * lit * fac
img = np.clip(shade / np.percentile(shade, 99.5), 0, 1) ** (1 / 2.2)
Image.fromarray((img * 255).astype(np.uint8)).save(raw.replace("-raw.npy", "-preview.png"))
