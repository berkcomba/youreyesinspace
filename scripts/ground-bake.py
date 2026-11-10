# Bake a Blender surface material into a seamless ground tile (step 1 of 2; then ground-pack.py).
#
#   blender -b <material.blend> --python scripts/ground-bake.py -- <node group> <tile> <res> <out-prefix>
#
# Written for the "Procedural Moon Surface Material" (Ryan King Art, BlendSwap 32868 — a licensed
# asset: the .blend stays out of the repo, and so does the baked tile, see .gitignore). The group's
# object coordinates are swapped for a flat (Clifford) torus in 4D, so its noise and Voronoi
# textures wrap without a seam and without stretching over a `tile`-unit square; three of its
# internal channels are baked as emission at 2× and averaged down to `res`:
#   H  the crater relief (the Voronoi colour ramp, also the material's displacement)
#   N  the fine noise
#   M  the mix of the two that picks the colour and drives the last bump
# and saved as <out-prefix>-raw.npy.
import sys, math
import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
GROUP, TILE, RES, OUT = argv[0], float(argv[1]), int(argv[2]), argv[3]
SS = 2

src = bpy.data.node_groups[GROUP]
g = src.copy()
g.name = "bake"
N = g.nodes
L = g.links

for name in ("H", "N", "M"):
    g.interface.new_socket(name=name, in_out="OUTPUT", socket_type="NodeSocketFloat")
gout = N["Group Output"]
L.new(N["Color Ramp"].outputs["Color"], gout.inputs["H"])
L.new(N["Hue/Saturation/Value"].outputs["Color"], gout.inputs["N"])
L.new(N["Map Range"].outputs["Result"], gout.inputs["M"])

# torus coordinates from UV: (R cos 2πu, R sin 2πu, R cos 2πv) and W = R sin 2πv
for l in list(L):
    if l.from_node.name == "Texture Coordinate":
        L.remove(l)
sep = N.new("ShaderNodeSeparateXYZ")
L.new(N["Texture Coordinate"].outputs["UV"], sep.inputs[0])
R = TILE / (2 * math.pi)

def circle(sock, fn):
    m = N.new("ShaderNodeMath"); m.operation = "MULTIPLY"; m.inputs[1].default_value = 2 * math.pi
    L.new(sock, m.inputs[0])
    t = N.new("ShaderNodeMath"); t.operation = fn
    L.new(m.outputs[0], t.inputs[0])
    s = N.new("ShaderNodeMath"); s.operation = "MULTIPLY"; s.inputs[1].default_value = R
    L.new(t.outputs[0], s.inputs[0])
    return s.outputs[0]

cx, sx = circle(sep.outputs["X"], "COSINE"), circle(sep.outputs["X"], "SINE")
cy, sy = circle(sep.outputs["Y"], "COSINE"), circle(sep.outputs["Y"], "SINE")
comb = N.new("ShaderNodeCombineXYZ")
L.new(cx, comb.inputs[0]); L.new(sx, comb.inputs[1]); L.new(cy, comb.inputs[2])
L.new(comb.outputs[0], N["Mapping"].inputs["Vector"])
for name in ("Noise Texture", "Noise Texture.001"):
    N[name].noise_dimensions = "4D"
    L.new(sy, N[name].inputs["W"])
N["Voronoi Texture"].voronoi_dimensions = "4D"
L.new(sy, N["Voronoi Texture"].inputs["W"])

# a plane whose material shows the three channels as emission
bpy.ops.mesh.primitive_plane_add(size=2)
plane = bpy.context.active_object
mat = bpy.data.materials.new("bakeMat")
nt = mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
gn = nt.nodes.new("ShaderNodeGroup"); gn.node_tree = g
# the settings the asset's own material uses for this group
user = next(n for m in bpy.data.materials if m.node_tree for n in m.node_tree.nodes if n.bl_idname == "ShaderNodeGroup" and n.node_tree == src)
for i in user.inputs:
    if i.name in gn.inputs and hasattr(i, "default_value"):
        gn.inputs[i.name].default_value = i.default_value
cc = nt.nodes.new("ShaderNodeCombineColor")
nt.links.new(gn.outputs["H"], cc.inputs[0]); nt.links.new(gn.outputs["N"], cc.inputs[1]); nt.links.new(gn.outputs["M"], cc.inputs[2])
em = nt.nodes.new("ShaderNodeEmission")
nt.links.new(cc.outputs[0], em.inputs["Color"])
out = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(em.outputs[0], out.inputs["Surface"])
img = bpy.data.images.new("bake", RES * SS, RES * SS, float_buffer=True, alpha=False)
img.colorspace_settings.name = "Non-Color"
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
nt.nodes.active = tex
plane.data.materials.clear(); plane.data.materials.append(mat)

scn = bpy.context.scene
scn.render.engine = "CYCLES"
scn.cycles.samples = 4
scn.cycles.use_denoising = False
scn.render.bake.margin = 0
for o in bpy.context.view_layer.objects:
    o.select_set(o == plane)
bpy.context.view_layer.objects.active = plane
bpy.ops.object.bake(type="EMIT")

px = np.empty(RES * SS * RES * SS * 4, dtype=np.float32)
img.pixels.foreach_get(px)
px = px.reshape(RES * SS, RES * SS, 4)[:, :, :3]
px = px.reshape(RES, SS, RES, SS, 3).mean(axis=(1, 3))
np.save(OUT + "-raw.npy", px)
print("baked", px.shape, [(float(px[..., c].min()), float(px[..., c].mean()), float(px[..., c].max())) for c in range(3)])
