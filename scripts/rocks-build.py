# Build the rocks scattered over the landing ground from Poly Haven (CC0) photoscanned rocks.
#
#   blender -b --factory-startup --python scripts/rocks-build.py -- <dir> public/ground/cc0/rocks.glb
#
# <dir> holds one folder per rock with its glTF (<id>/<id>.gltf + .bin; the textures are not used).
# Each rock is joined, scaled to 1 (its wider horizontal extent), centred, its base sunk a fifth of
# its height below 0, stripped of materials and UVs (the shader colours it from the ground), and
# decimated into levels of detail `rock<i>_0` (near) … `rock<i>_2` (far), Y up.
import bpy, sys, os

src, out = sys.argv[sys.argv.index("--") + 1:][:2]
LODS = (1400, 260, 60)

bpy.ops.wm.read_factory_settings(use_empty=True)
done = []
for i, name in enumerate(sorted(os.listdir(src))):
    before = {o.name for o in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=os.path.join(src, name, name + ".gltf"))
    new = [o.name for o in bpy.data.objects if o.name not in before]
    meshes = [bpy.data.objects[n] for n in new if bpy.data.objects[n].type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    if len(meshes) > 1:
        bpy.ops.object.join()
    rock = bpy.context.view_layer.objects.active
    for n in new:
        if n != rock.name and n in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[n])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = rock.data
    me.materials.clear()
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    s = 1.0 / max(max(xs) - min(xs), max(ys) - min(ys))
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    z0 = min(zs) + 0.2 * (max(zs) - min(zs))
    for v in me.vertices:
        v.co.x, v.co.y, v.co.z = (v.co.x - cx) * s, (v.co.y - cy) * s, (v.co.z - z0) * s
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    for lod, target in enumerate(LODS):
        o = rock.copy(); o.data = me.copy(); o.name = o.data.name = f"rock{i}_{lod}"
        bpy.context.collection.objects.link(o)
        if tris > target:
            m = o.modifiers.new("decimate", "DECIMATE"); m.ratio = target / tris
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
        for p in o.data.polygons:
            p.use_smooth = True
        done.append(o)
    print(f"{name}: {tris} tris → rock{i}, height {(max(zs) - min(zs)) * s:.2f}")
    bpy.data.objects.remove(rock)

bpy.ops.object.select_all(action="DESELECT")
for o in done:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_materials="NONE",
                          export_normals=True, export_apply=True, export_yup=True)
print("wrote", out, os.path.getsize(out) // 1024, "KB")
