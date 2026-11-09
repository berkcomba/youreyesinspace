#!/usr/bin/env python3
"""Stitches whole-globe maps for the telescope view (public/wiki/scope.js) from NASA Solar System
Treks WMTS tiles (public domain): public/scope/<body>.jpg, equirectangular, longitude -180..180
left to right, north up.

    python3 scripts/fetch-scope-maps.py
"""
import io
import os
import subprocess

from PIL import Image

TREK = 'https://trek.nasa.gov/tiles'
OUT = 'public/scope'
UA = 'YourEyesInSpace/0.3 (https://youreyesinspace.com; asset pipeline)'

# body, Trek body, layer, level (tile 256 px covers 180 / 2^level degrees)
MAPS = [
    ('moon', 'Moon', 'LRO_WAC_Mosaic_Global_303ppd_v02', 2),
    ('mars', 'Mars', 'Mars_Viking_MDIM21_ClrMosaic_global_232m', 1),
]


def tile(body, layer, z, x, y):
    url = f'{TREK}/{body}/EQ/{layer}/1.0.0//default/default028mm/{z}/{y}/{x}.jpg'
    # curl: the python.org builds on macOS ship without a CA bundle
    data = subprocess.run(['curl', '-sfL', '-A', UA, '--max-time', '60', url], check=True, capture_output=True).stdout
    return Image.open(io.BytesIO(data)).convert('RGB')


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, body, layer, z in MAPS:
        nx, ny = 2 << z, 1 << z
        img = Image.new('RGB', (nx * 256, ny * 256))
        for y in range(ny):
            for x in range(nx):
                img.paste(tile(body, layer, z, x, y), (x * 256, y * 256))
        if name == 'moon':
            img = img.convert('L')
        path = os.path.join(OUT, f'{name}.jpg')
        img.save(path, quality=76 if name == 'moon' else 84, optimize=True, progressive=True)
        print(name, img.size, os.path.getsize(path) // 1024, 'KB')


if __name__ == '__main__':
    main()
