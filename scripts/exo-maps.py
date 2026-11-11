# Global maps of the famous planets of other stars, rendered from exo-gas.osl / exo-rocky.osl
# after the artist's impressions and simulations they are known by (the settings below).
#
#   blender -b --factory-startup --python scripts/exo-maps.py -- <work dir> <width> [name …]
#   python scripts/exo-maps-pack.py <work dir> public/maps [name …]
#
# This step leaves <name>-col.npy (linear albedo) and, for the rocky worlds, <name>-data.npy
# (height, flag) in the work directory; the second packs them into public/maps/<name>-c.webp and
# <name>-n.webp (SkinLibrary.ts: MAPS). u = 0.5 of a map faces the star on a tidally locked planet.
import bpy
import os
import sys

import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
work, width = argv[0], int(argv[1])
HERE = os.path.dirname(os.path.abspath(__file__))

# Colours are written as they should look on screen (sRGB).
GAS = {
    # 51 Pegasi b (ESO/M. Kornmesser/N. Risinger): cream and tan zones, orange-brown belts, one
    # blue-grey belt in the south
    '51pegb': dict(
        Style=0, Seed=1.3, Bands=15.0, Fine=1.3, Wave=0.045, Turb=0.3, Jet=0.8, Warp=2.4, Stretch=4.5,
        C=[(0.33, 0.19, 0.11), (0.58, 0.35, 0.17), (0.76, 0.54, 0.3), (0.87, 0.72, 0.47), (0.94, 0.85, 0.66)],
        CStreak=(0.96, 0.9, 0.76), Streak=0.3, StreakDark=0.22,
        CAccent=(0.66, 0.7, 0.76), Accent=0.9, AccentLat=-0.5, AccentWidth=0.065,
        CPole=(0.4, 0.26, 0.16), Pole=0.55, PoleLat=0.78,
        CSpot=(0.47, 0.27, 0.3), CSpotRim=(0.8, 0.62, 0.45), Spots=4, SpotSize=0.05, SpotLat=0.5, SpotMix=0.55),
    # HD 209458 b "Osiris" (ESA/A. Vidal-Madjar/NASA): a grey-blue giant, pale tan zones
    'hd209458b': dict(
        Style=0, Seed=4.1, Bands=9.0, Fine=0.8, Wave=0.07, Turb=0.5, Jet=1.0, Warp=2.8, Stretch=3.5,
        C=[(0.27, 0.33, 0.43), (0.4, 0.47, 0.57), (0.55, 0.6, 0.67), (0.7, 0.68, 0.62), (0.84, 0.8, 0.7)],
        CStreak=(0.9, 0.9, 0.88), Streak=0.22, StreakDark=0.12,
        CPole=(0.25, 0.3, 0.4), Pole=0.45, PoleLat=0.75),
    # KELT-9 b (NASA/JPL-Caltech): glowing orange, broad darker cloud, hardly a belt
    'kelt9b': dict(
        Style=0, Seed=2.2, Bands=5.0, Fine=0.4, Wave=0.14, Turb=1.0, Jet=0.5, Warp=3.2, Stretch=2.2,
        C=[(0.58, 0.18, 0.06), (0.77, 0.3, 0.09), (0.89, 0.43, 0.14), (0.96, 0.56, 0.21), (1.0, 0.69, 0.32)],
        CStreak=(1.0, 0.78, 0.45), Streak=0.15,
        CBlotch=(0.56, 0.18, 0.07), Blotch=0.45),
    # beta Pictoris b (ESO/L. Calçada/N. Risinger): tan, faintly belted
    'betpicb': dict(
        Style=0, Seed=6.4, Bands=11.0, Fine=1.0, Wave=0.05, Turb=0.3, Jet=0.6, Warp=2.2, Stretch=4.0,
        C=[(0.27, 0.19, 0.14), (0.46, 0.33, 0.23), (0.63, 0.49, 0.34), (0.77, 0.64, 0.47), (0.87, 0.77, 0.61)],
        CStreak=(0.92, 0.84, 0.7), Streak=0.15, StreakDark=0.2,
        CPole=(0.3, 0.22, 0.17), Pole=0.4, PoleLat=0.8),
    # HR 8799 e (ESO/L. Calçada): gold and orange, the rings of a planet-wide storm
    'hr8799e': dict(
        Style=0, Seed=8.7, Bands=6.0, Fine=0.5, Wave=0.12, Turb=0.7, Jet=0.4, Warp=3.0, Stretch=2.5,
        C=[(0.8, 0.36, 0.14), (0.92, 0.5, 0.2), (0.98, 0.64, 0.3), (1.0, 0.76, 0.42), (1.0, 0.86, 0.58)],
        CBlotch=(0.85, 0.42, 0.18), Blotch=0.2,
        CSpot=(0.9, 0.48, 0.2), CSpotRim=(1.0, 0.82, 0.5), Spots=2, SpotSize=0.42, SpotLat=0.35, SpotRings=7.0, SpotMix=0.3),
    # HD 80606 b (NASA/JPL-Caltech/J. Langton, UC Santa Cruz: the simulation of its periastron storms)
    'hd80606b': dict(
        Style=1, Seed=3.3, Jet=0.5, Warp=2.5, Stretch=3.0,
        C=[(0.05, 0.0, 0.0), (0.3, 0.02, 0.02), (0.62, 0.06, 0.04), (0.9, 0.16, 0.08), (1.0, 0.4, 0.25)]),
    # K2-18 b (ESA/Hubble, M. Kornmesser): white cloud swept across a blue haze
    'k218b': dict(
        Style=2, Seed=5.6, Jet=0.6, Warp=2.3, Stretch=5.0, Tilt=0.55, Cover=0.0,
        C=[(0.24, 0.35, 0.52), (0.32, 0.46, 0.66), (0.44, 0.59, 0.79), (0.62, 0.7, 0.82), (0.79, 0.83, 0.89)],
        CStreak=(0.9, 0.92, 0.95), Streak=0.6),
}
# exo-rocky.osl: Kind, Seed
ROCKY = {
    '55cnce': (0, 2.7),        # NASA/JPL-Caltech (R. Hurt)
    'proximab': (1, 5.1),      # ESO/M. Kornmesser
    'trappist1e': (2, 1.9),    # NASA/JPL-Caltech
    'kepler186f': (3, 7.4),    # NASA Ames/SETI Institute/JPL-Caltech
    'lhs3844b': (4, 3.8),      # NASA/JPL-Caltech/R. Hurt (IPAC)
    'kepler452b': (5, 6.2),    # NASA Ames/JPL-Caltech/T. Pyle
}


def lin(c):
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


scn = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
scn.render.engine = 'CYCLES'
scn.cycles.device = 'CPU'
scn.cycles.shading_system = True  # OSL
scn.cycles.samples = 4
scn.cycles.use_denoising = False
scn.cycles.filter_width = 0.8
scn.render.resolution_x, scn.render.resolution_y = width, width // 2
scn.render.resolution_percentage = 100
scn.render.film_transparent = False
scn.render.image_settings.file_format = 'OPEN_EXR'
scn.render.image_settings.color_mode = 'RGB'
scn.render.image_settings.color_depth = '32'
world = bpy.data.worlds.new('w')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)
scn.world = world

bpy.ops.mesh.primitive_plane_add(size=1)
plane = bpy.context.object
plane.scale = (2, 1, 1)
cam = bpy.data.cameras.new('cam')
cam.type = 'ORTHO'
cam.ortho_scale = 2
camo = bpy.data.objects.new('cam', cam)
scn.collection.objects.link(camo)
camo.location = (0, 0, 5)
scn.camera = camo

mat = bpy.data.materials.new('map')
mat.use_nodes = True
nt = mat.node_tree
nt.nodes.clear()
tc = nt.nodes.new('ShaderNodeTexCoord')
em = nt.nodes.new('ShaderNodeEmission')
outn = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(em.outputs['Emission'], outn.inputs['Surface'])
plane.data.materials.append(mat)


def script(file):
    osl = nt.nodes.new('ShaderNodeScript')
    osl.mode = 'EXTERNAL'
    osl.filepath = os.path.join(HERE, file)
    osl.update()
    nt.links.new(tc.outputs['UV'], osl.inputs['UV'])
    return osl


def render(osl, output, name, suffix):
    for l in list(em.inputs['Color'].links):
        nt.links.remove(l)
    nt.links.new(osl.outputs[output], em.inputs['Color'])
    exr = os.path.join(work, f'{name}-{suffix}.exr')
    scn.render.filepath = exr
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(exr)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    os.remove(exr)
    # top row first, as an image file has it
    np.save(os.path.join(work, f'{name}-{suffix}.npy'), px.reshape(h, w, 4)[::-1, :, :3])
    print('wrote', name, suffix)


names = argv[2:] or [*GAS, *ROCKY]
os.makedirs(work, exist_ok=True)
gas, rocky = script('exo-gas.osl'), script('exo-rocky.osl')
for name in names:
    if name in GAS:
        for k, v in GAS[name].items():
            if k == 'C':
                for i, c in enumerate(v):
                    gas.inputs[f'C{i}'].default_value = lin(c)
            elif isinstance(v, tuple):
                gas.inputs[k].default_value = lin(v)
            else:
                gas.inputs[k].default_value = v
        render(gas, 'Col', name, 'col')
        # the next planet starts from the shader's defaults again
        nt.nodes.remove(gas)
        gas = script('exo-gas.osl')
    elif name in ROCKY:
        rocky.inputs['Kind'].default_value, rocky.inputs['Seed'].default_value = ROCKY[name]
        render(rocky, 'Col', name, 'col')
        render(rocky, 'Data', name, 'data')
    else:
        print('unknown planet', name)
