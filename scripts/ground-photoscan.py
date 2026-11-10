# Pack a Poly Haven (CC0) photoscanned ground material into a ground material texture.
#
#   python scripts/ground-photoscan.py <polyhaven id> public/ground/cc0/<name>.webp [res]
#
# Same RGBA8 encoding as ground-pack.py (read by terrain.frag's groundLayer):
#   R, G  the slope ∂h/∂x, ∂h/∂y over ±slope, from the scan's normal map
#   B     the albedo factor over 0…albedo: the scan's luminance ÷ its local mean (the colour itself
#         is the globe's; only the grain's light and dark is kept, without the blotches a repeated
#         tile would show)
#   A     the height over its range (÷ the tile's size: height), the displacement scaled to agree
#         with the normal map's slopes
# The ranges are printed as the GroundMaterial entry (src/data/groundMaterials.ts); a preview lit
# by a low Sun is written next to the downloads.
import sys, os, io, json, urllib.request
import numpy as np
from PIL import Image

ID, OUT = sys.argv[1], sys.argv[2]
RES = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
CACHE = os.path.join(os.environ.get("TEMP", "/tmp"), "yeis-ground", ID)
os.makedirs(CACHE, exist_ok=True)


def fetch(url, name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": "yeis-ground-photoscan"})
        open(path, "wb").write(urllib.request.urlopen(req).read())
    return path


files = json.load(open(fetch(f"https://api.polyhaven.com/files/{ID}", "files.json")))
src = "2k" if RES > 1024 else "1k"
img = lambda key, fmt: Image.open(fetch(files[key][src][fmt]["url"], f"{key}.{fmt}"))


def size(im):
    # resampled as the tile it is (wrapped), so its edges stay seamless
    a = np.asarray(im, np.float32)
    if a.shape[0] == RES:
        return a.astype(np.float64)
    chans = [a] if a.ndim == 2 else [a[..., c] for c in range(a.shape[2])]
    out = [np.asarray(Image.fromarray(np.tile(c, (3, 3))).resize((3 * RES, 3 * RES), Image.LANCZOS))[RES:2 * RES, RES:2 * RES] for c in chans]
    return np.stack(out, -1).astype(np.float64) if a.ndim == 3 else out[0].astype(np.float64)


disp = size(img("Displacement", "png").convert("F"))
disp = (disp - disp.min()) / max(1e-9, disp.max() - disp.min())
nor = size(img("nor_gl", "png").convert("RGB")) / 255 * 2 - 1
lum = np.clip(size(img("Diffuse", "jpg").convert("RGB")) / 255, 0, 1)
lum = (lum ** 2.2) @ np.array([0.2126, 0.7152, 0.0722])

# slopes in tile units (the tile 1 wide): the normal map is GL (green up), rows run down
nz = np.maximum(nor[..., 2], 0.15)
sx, sy = -nor[..., 0] / nz, nor[..., 1] / nz
step = 1.0 / RES
grad = lambda f: ((np.roll(f, -1, 1) - np.roll(f, 1, 1)) / (2 * step), (np.roll(f, -1, 0) - np.roll(f, 1, 0)) / (2 * step))
dx, dy = grad(disp)
k = float((dx * sx + dy * sy).sum() / max(1e-12, (dx * dx + dy * dy).sum()))
if k <= 0:
    sys.exit(f"{ID}: the displacement does not agree with the normal map (k = {k:.4g})")
h = k * disp
corr = float(np.corrcoef(np.concatenate([dx.ravel(), dy.ravel()]), np.concatenate([sx.ravel(), sy.ravel()]))[0, 1])


def blur(f, sigma):
    # periodic gaussian (the tile wraps)
    fy = np.fft.fftfreq(f.shape[0])[:, None]
    fx = np.fft.fftfreq(f.shape[1])[None, :]
    return np.real(np.fft.ifft2(np.fft.fft2(f) * np.exp(-2 * (np.pi * sigma) ** 2 * (fx * fx + fy * fy))))


fac = lum / np.maximum(blur(lum, RES / 10), 1e-4)
fac /= fac.mean()

SMAX = float(np.percentile(np.abs(np.concatenate([sx.ravel(), sy.ravel()])), 99.7))
FMAX = float(np.percentile(fac, 99.8))
hmin, hmax = float(h.min()), float(h.max())
enc = lambda v, lo, hi: np.clip(np.round((v - lo) / (hi - lo) * 255), 0, 255).astype(np.uint8)
rgba = np.stack([enc(sx, -SMAX, SMAX), enc(sy, -SMAX, SMAX), enc(fac, 0, FMAX), enc(h, hmin, hmax)], -1)
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
im = Image.fromarray(rgba, "RGBA")
if OUT.endswith(".webp"):
    im.save(OUT, lossless=True, quality=100, method=6, exact=True)
else:
    im.save(OUT, optimize=True)
name = os.path.splitext(os.path.basename(OUT))[0]
meta = {"slope": round(SMAX, 4), "albedo": round(FMAX, 4), "height": round(hmax - hmin, 5)}
print(json.dumps({"name": name, "id": ID, **meta, "fit": round(corr, 3), "kb": os.path.getsize(OUT) // 1024}))

# preview: Sun from +x at 15°, Lambert and hard shadows marched toward the Sun
t = np.tan(np.radians(15))
lit = np.ones_like(h, dtype=bool)
for j in range(1, RES // 3):
    lit &= np.roll(h, -j, 1) <= h + j * step * t
n = np.stack([-sx, -sy, np.ones_like(h)], -1)
n /= np.linalg.norm(n, axis=-1, keepdims=True)
l = np.array([np.cos(np.radians(15)), 0, np.sin(np.radians(15))])
shade = np.clip(n @ l, 0, None) * lit * fac
prev = np.clip(shade / np.percentile(shade, 99.5), 0, 1) ** (1 / 2.2)
Image.fromarray((prev * 255).astype(np.uint8)).resize((256, 256), Image.LANCZOS).save(os.path.join(CACHE, "preview.png"))
