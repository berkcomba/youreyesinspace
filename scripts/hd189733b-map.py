# Cloud deck of HD 189733 b (blue, wind-sheared silicate clouds), rendered from
# hd189733b-map.osl into an equirectangular map.
#
#   blender -b --factory-startup --python scripts/hd189733b-map.py -- map <out.png> 2048 3.7 1.0 3.4
#   blender -b --factory-startup --python scripts/hd189733b-map.py -- preview <map.png> <out.png> [save.blend]
#
# public/maps/hd189733b-c.webp is the map with a zero alpha channel (lossy WebP, q88);
# hd189733b-n.webp is the same flat normal map as the other gas giants.
import bpy
import math
import os
import sys

argv = sys.argv[sys.argv.index('--') + 1:]
mode = argv[0]
HERE = os.path.dirname(os.path.abspath(__file__))

scn = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
scn.render.engine = 'CYCLES'
scn.cycles.device = 'CPU'
scn.view_settings.view_transform = 'Standard'
scn.view_settings.look = 'None'
scn.render.image_settings.file_format = 'PNG'
scn.render.image_settings.color_mode = 'RGB'
scn.render.image_settings.color_depth = '8'
scn.render.film_transparent = False
world = bpy.data.worlds.new('w')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)
scn.world = world


def camera(loc, rot, ortho=None, lens=50):
    cam = bpy.data.cameras.new('cam')
    if ortho:
        cam.type = 'ORTHO'
        cam.ortho_scale = ortho
    else:
        cam.lens = lens
    ob = bpy.data.objects.new('cam', cam)
    scn.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    scn.camera = ob


if mode == 'map':
    out, width = argv[1], int(argv[2])
    seed, jet, warp = (float(x) for x in (argv[3:6] if len(argv) >= 6 else ('3.7', '1.0', '3.4')))
    scn.cycles.shading_system = True  # OSL
    scn.cycles.samples = 4
    scn.cycles.use_denoising = False
    scn.cycles.filter_width = 0.8
    scn.render.resolution_x, scn.render.resolution_y = width, width // 2
    scn.render.resolution_percentage = 100
    bpy.ops.mesh.primitive_plane_add(size=1)
    plane = bpy.context.object
    plane.scale = (2, 1, 1)
    mat = bpy.data.materials.new('deck')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord')
    osl = nt.nodes.new('ShaderNodeScript')
    osl.mode = 'EXTERNAL'
    osl.filepath = os.path.join(HERE, 'hd189733b-map.osl')
    osl.update()
    em = nt.nodes.new('ShaderNodeEmission')
    outn = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tc.outputs['UV'], osl.inputs['UV'])
    osl.inputs['Seed'].default_value = seed
    osl.inputs['Jet'].default_value = jet
    osl.inputs['Warp'].default_value = warp
    nt.links.new(osl.outputs['Col'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], outn.inputs['Surface'])
    plane.data.materials.append(mat)
    camera((0, 0, 5), (0, 0, 0), ortho=2)
    scn.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('wrote', out)

elif mode == 'preview':
    src, out = argv[1], argv[2]
    scn.cycles.samples = 64
    scn.cycles.use_denoising = True
    scn.view_settings.view_transform = 'AgX'
    scn.render.resolution_x, scn.render.resolution_y = 960, 686
    bpy.ops.mesh.primitive_uv_sphere_add(segments=256, ring_count=128, radius=1)
    sph = bpy.context.object
    bpy.ops.object.shade_smooth()
    sph.rotation_euler = (math.radians(12), 0, math.radians(200))
    mat = bpy.data.materials.new('planet')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    img = nt.nodes.new('ShaderNodeTexImage')
    img.image = bpy.data.images.load(src)
    nt.links.new(img.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.9
    sph.data.materials.append(mat)
    # a thin blue rim of haze
    bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=1.025)
    haze = bpy.context.object
    bpy.ops.object.shade_smooth()
    hm = bpy.data.materials.new('haze')
    hm.use_nodes = True
    hn = hm.node_tree
    hn.nodes.clear()
    vol = hn.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (0.2, 0.45, 1.0, 1)
    vol.inputs['Density'].default_value = 1.2
    ho = hn.nodes.new('ShaderNodeOutputMaterial')
    hn.links.new(vol.outputs['Volume'], ho.inputs['Volume'])
    haze.data.materials.append(hm)
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 4.5
    so = bpy.data.objects.new('sun', sun)
    scn.collection.objects.link(so)
    # lit from the right and a little in front, as in the impression
    so.rotation_euler = (math.radians(95), 0, math.radians(58))
    camera((0, -4.6, 0), (math.radians(90), 0, 0), lens=50)
    scn.render.filepath = out
    bpy.ops.render.render(write_still=True)
    if len(argv) > 3:
        bpy.ops.wm.save_as_mainfile(filepath=argv[3])
    print('wrote', out)
