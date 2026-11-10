# Generate the landing ground's rock families with the Rock & Boulder Generator add-on (GPL-3.0,
# Z. E. Güzel, Superhive): each family's rocks as levels of detail, and one atlas of their surface.
#
#   blender -b --factory-startup --python scripts/rocks-gen.py -- <add-on dir named rock_generator> <out dir>
#   python scripts/rocks-gen.py <out dir>          (then: the atlases → public/ground/rocks/*.webp)
#
# Every rock is built at the add-on's high detail, decimated into `rock<i>_0` (near) … `rock<i>_2`
# (far) that keep its UVs, and the detailed rock is baked onto the near level: the surface normal
# in the rock's own frame (Y up, as exported) and the albedo's luminance over its mean. Each rock
# owns one tile of the family's 4 × 2 atlas (RGB normal × 0.5 + 0.5, A luminance / 2), its UVs
# moved into it; the far levels use the same map (object-space normals fit any of them). The mesh
# is scaled to 1 (its wider horizontal extent), centred, its base sunk a fifth of its height.
import sys, os, random

FAMILIES = {
    # airless and volcanic worlds: fractured blocks, vesicular basalt
    "angular": [("CLIFF_CHUNK", 3), ("GRANITE_BLOCK", 2), ("VOLCANIC", 3)],
    # Mars and the deserts: bedded sandstone, varnished blocks
    "layered": [("DESERT_VARNISH", 3), ("SANDSTONE_STRATA", 3), ("CLIFF_CHUNK", 2)],
    # ice, temperate and Titan: weathered boulders and cobbles
    "rounded": [("GRANITE_BOULDER", 3), ("LIMESTONE", 2), ("RIVER_COBBLE", 3)],
}
LODS = (1400, 260, 60)
COLS, ROWS, TILE, PAD = 4, 2, 512, 12
BAKE = 1024


def blender_main(addon, out):
    import bpy
    import numpy as np
    sys.path.insert(0, os.path.dirname(addon))
    import rock_generator
    from rock_generator import generator
    from rock_generator.operators import _decimated_copy

    def gpu():
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("OPTIX", "CUDA", "HIP", "ONEAPI"):
            try:
                prefs.compute_device_type = kind
                prefs.get_devices()
                if any(d.type == kind for d in prefs.devices):
                    break
            except TypeError:
                continue
        for d in prefs.devices:
            d.use = True

    def bake(src, dst, kind):
        """bake src's surface onto dst's UVs: 'NORMAL' (object space) or 'DIFFUSE' (colour)"""
        img = bpy.data.images.new(f"{dst.name}_{kind}", BAKE, BAKE, alpha=True, float_buffer=True)
        img.colorspace_settings.name = "Non-Color"
        img.generated_color = (0, 0, 0, 0)
        mat = bpy.data.materials.new(f"{dst.name}_bake")
        mat.use_nodes = True
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = img
        mat.node_tree.nodes.active = node
        dst.data.materials.clear()
        dst.data.materials.append(mat)
        bpy.ops.object.select_all(action="DESELECT")
        src.select_set(True)
        dst.select_set(True)
        bpy.context.view_layer.objects.active = dst
        reach = max(src.dimensions) * 0.03
        kw = dict(type=kind, margin=6, use_clear=True, use_selected_to_active=True, cage_extrusion=reach, max_ray_distance=reach * 2)
        if kind == "NORMAL":
            kw["normal_space"] = "OBJECT"
        else:
            kw["pass_filter"] = {"COLOR"}
        bpy.ops.object.bake(**kw)
        px = np.empty(BAKE * BAKE * 4, np.float32)
        img.pixels.foreach_get(px)
        return px.reshape(BAKE, BAKE, 4)

    for fam, specs in FAMILIES.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        if not hasattr(bpy.types.Object, "rock_generator"):
            rock_generator.register()
        gpu()
        scene = bpy.context.scene
        scene.render.engine = "CYCLES"
        scene.cycles.device = "GPU"
        scene.cycles.samples = 8
        atlas = np.zeros((ROWS * TILE, COLS * TILE, 4), np.float32)
        done = []
        i = 0
        for preset, count in specs:
            for k in range(count):
                obj = generator.create_rock(bpy.context, preset, (0.0, 0.0, 0.0))
                s = obj.rock_generator
                s.seed = 101 + 37 * i + k * 7
                s.resolution = "HIGH"
                # the add-on fits a rock to its preset's box: vary the box too
                rnd = random.Random(s.seed)
                s.size_y *= rnd.uniform(0.8, 1.15)
                s.size_z *= rnd.uniform(0.7, 1.3)
                generator.rebuild(obj)
                faces = sum(len(p.vertices) - 2 for p in obj.data.polygons)
                lods = [_decimated_copy(bpy.context, obj, min(1.0, t / faces), f"rock{i}_{lod}", True) for lod, t in enumerate(LODS)]
                nrm = bake(obj, lods[0], "NORMAL")
                col = bake(obj, lods[0], "DIFFUSE")
                # down to the tile, the baked texels only (the bake leaves the rest at 0, its margin not)
                cover = nrm[..., :3].sum(-1) > 1e-3
                n = nrm[..., :3] * 2 - 1
                n = np.stack([n[..., 0], n[..., 2], -n[..., 1]], -1)   # Blender Z up → Y up
                lum = col[..., 0] * 0.2126 + col[..., 1] * 0.7152 + col[..., 2] * 0.0722
                lum = np.where(cover, lum / max(float(lum[cover].mean()), 1e-4), 1.0)
                q = BAKE // (TILE - 2 * PAD)
                inner = TILE - 2 * PAD
                def down(a):
                    a = a[:inner * q, :inner * q]
                    return a.reshape(inner, q, inner, q, *a.shape[2:]).mean((1, 3))
                n = down(np.where(cover[..., None], n, [0.0, 1.0, 0.0]))
                n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)
                tile = np.concatenate([n * 0.5 + 0.5, np.clip(down(lum), 0, 2)[..., None] / 2], -1)
                tile = np.pad(tile, ((PAD, PAD), (PAD, PAD), (0, 0)), mode="edge")
                # image rows run bottom-up (v = 0 at the bottom), like the UVs
                r, c = divmod(i, COLS)
                atlas[r * TILE:(r + 1) * TILE, c * TILE:(c + 1) * TILE] = tile
                xs, ys, zs = (np.array([v.co[a] for v in obj.data.vertices]) for a in range(3))
                sc = 1.0 / max(np.ptp(xs), np.ptp(ys))
                cx, cy, z0 = (xs.max() + xs.min()) / 2, (ys.max() + ys.min()) / 2, zs.min() + 0.2 * np.ptp(zs)
                for o in lods:
                    me = o.data
                    for v in me.vertices:
                        v.co.x, v.co.y, v.co.z = (v.co.x - cx) * sc, (v.co.y - cy) * sc, (v.co.z - z0) * sc
                    uv = me.uv_layers.active.data
                    for l in uv:
                        u, w = l.uv
                        l.uv = ((c * TILE + PAD + u * inner) / (COLS * TILE), (r * TILE + PAD + w * inner) / (ROWS * TILE))
                    while len(me.uv_layers) > 1:
                        me.uv_layers.remove(me.uv_layers[-1])
                    for name in [a.name for a in me.attributes if a.name.startswith("rock_")]:
                        me.attributes.remove(me.attributes[name])
                    me.materials.clear()
                    for p in me.polygons:
                        p.use_smooth = True
                    done.append(o)
                print(f"{fam} rock{i} {preset}: {faces} tris, height {np.ptp(zs) * sc:.2f}, baked {cover.mean():.2f}, LODs {[len(o.data.polygons) for o in lods]}", flush=True)
                bpy.data.objects.remove(obj)
                i += 1
        np.save(os.path.join(out, f"rocks-{fam}-atlas.npy"), (np.clip(atlas, 0, 1) * 255 + 0.5).astype(np.uint8))
        bpy.ops.object.select_all(action="DESELECT")
        for o in done:
            o.select_set(True)
        path = os.path.join(out, f"rocks-{fam}.glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_materials="NONE",
                                  export_normals=True, export_apply=True, export_yup=True)
        print("wrote", path, os.path.getsize(path) // 1024, "KB", flush=True)


def pack_main(out):
    import numpy as np
    from PIL import Image
    for fam in FAMILIES:
        a = np.load(os.path.join(out, f"rocks-{fam}-atlas.npy"))
        # rows bottom-up → an image's top row first
        Image.fromarray(a[::-1], "RGBA").save(os.path.join(out, f"rocks-{fam}.webp"), "WEBP", quality=85, alpha_quality=100, method=4)
        print(fam, os.path.getsize(os.path.join(out, f"rocks-{fam}.webp")) // 1024, "KB")


if "bpy" in sys.modules or "--" in sys.argv:
    a = sys.argv[sys.argv.index("--") + 1:]
    blender_main(a[0], a[1])
else:
    pack_main(sys.argv[1])
