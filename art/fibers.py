"""Feixe de fibra ótica com as pontas acesas, renderizado no Blender (Cycles): o fundo do
"Vamos conversar" no rodapé (conexão: o cliente chegando até você).

Uso (com o Python que tem o bpy, veja art/requirements.txt):
  python art/fibers.py           -> public/assets/fibers.webp (e fibers-mobile.webp)
  python art/fibers.py --draft   -> prévia rápida em art/out/fibers-draft.png
"""
import math
import os
import random
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402,I001  (bpy first: it makes bmesh and mathutils importable)
from mathutils import Vector  # noqa: E402

from studio import OUT, ROOT, camera, hex_rgb, new_scene  # noqa: E402
from video_shots import softbox  # noqa: E402

WIDTH, HEIGHT = 2000, 1000
COUNT = 700
TIP_COLORS = ["#ffa040", "#ff7a2e", "#ff5a1f", "#ffc768", "#fff0d2"]


def fiber_material():
    """Dark glassy strand that starts to glow warm near its tip (the light inside it)."""
    mat = bpy.data.materials.new("Fiber")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*hex_rgb("#2b1b10"), 1)
    bsdf.inputs["Roughness"].default_value = 0.22
    bsdf.inputs["Coat Weight"].default_value = 0.8
    bsdf.inputs["Coat Roughness"].default_value = 0.05
    bsdf.inputs["Emission Color"].default_value = (*hex_rgb("#ff7a30"), 1)
    # Glow along each strand from the "glow" attribute (0 at the root, 1 at the tip).
    attribute = nodes.new("ShaderNodeAttribute")
    attribute.attribute_name = "glow"
    curve = nodes.new("ShaderNodeFloatCurve")
    points = curve.mapping.curves[0].points
    points[0].location = (0.0, 0.0)
    points[1].location = (1.0, 1.0)
    points.new(0.75, 0.08)
    curve.mapping.update()
    strength = nodes.new("ShaderNodeMath")
    strength.operation = "MULTIPLY"
    strength.inputs[1].default_value = 3.2
    links.new(attribute.outputs["Fac"], curve.inputs["Value"])
    links.new(curve.outputs["Value"], strength.inputs[0])
    links.new(strength.outputs["Value"], bsdf.inputs["Emission Strength"])
    return mat


def emission(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    node = nodes.new("ShaderNodeEmission")
    node.inputs["Color"].default_value = (*hex_rgb(color), 1)
    node.inputs["Strength"].default_value = strength
    links.new(node.outputs[0], out.inputs["Surface"])
    return mat


ROOT_POINT = Vector((3.4, 0.4, 2.1))   # the bundle, top right and out of frame
HEAD = Vector((1.35, 0.0, -0.3))        # where the tips open up like a brush


def strand_points(rng):
    """One fiber: together with the others along the bundle, then splaying out to its own tip."""
    axis = (HEAD - ROOT_POINT).normalized()
    side = axis.cross(Vector((0, 1, 0))).normalized()
    depth = axis.cross(side).normalized()
    radius = rng.random() ** 0.6
    angle = rng.random() * math.tau
    tip = HEAD + (side * math.cos(angle) * 0.85 + depth * math.sin(angle) * 0.7) * radius + axis * rng.gauss(0.0, 0.3)
    start = ROOT_POINT + (side * rng.gauss(0, 0.04) + depth * rng.gauss(0, 0.04))
    middle = ROOT_POINT + (HEAD - ROOT_POINT) * 0.62 + (tip - HEAD) * 0.18 + Vector((0, 0, -0.12))
    steps = 28
    return [(1 - t) ** 2 * start + 2 * (1 - t) * t * middle + t ** 2 * tip for t in (i / steps for i in range(steps + 1))]


def build(rng):
    data = bpy.data.curves.new("Fibers", "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = 0.0052
    data.bevel_resolution = 2
    data.resolution_u = 3
    data.use_fill_caps = True
    tips = []
    for _ in range(COUNT):
        points = strand_points(rng)
        spline = data.splines.new("POLY")
        spline.points.add(len(points) - 1)
        for point, co in zip(spline.points, points):
            point.co = (co.x, co.y, co.z, 1)
            point.radius = 1.0
        tips.append((points[-1], (points[-1] - points[-2]).normalized()))
    obj = bpy.data.objects.new("Fibers", data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(fiber_material())
    # Convert to a mesh and store how far along its strand each vertex is.
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    mesh = obj.data
    glow = mesh.attributes.new("glow", "FLOAT", "POINT")
    lengths = [(v.co - ROOT_POINT).length for v in mesh.vertices]
    top = max(lengths)
    # Per-strand normalization would be nicer; distance from the bundle is close enough here.
    for vertex, length in zip(mesh.vertices, lengths):
        glow.data[vertex.index].value = min(1.0, max(0.0, (length / top - 0.6) / 0.4)) ** 1.8
    # Glowing tips.
    tip_mats = [emission(f"Tip{i}", color, 7 if color != "#fff0d2" else 11) for i, color in enumerate(TIP_COLORS)]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.0105)
    template = bpy.context.object
    template.name = "Tip"
    bpy.ops.object.shade_smooth()
    template.data.materials.append(tip_mats[0])
    for index, (point, direction) in enumerate(tips):
        copy = template.copy()
        copy.data = template.data.copy()
        copy.data.materials[0] = tip_mats[rng.choice([0, 0, 0, 1, 1, 1, 2, 2, 3, 4])]
        copy.location = point + direction * 0.006
        bpy.context.scene.collection.objects.link(copy)
    bpy.data.objects.remove(template, do_unlink=True)
    # Floating sparks (out of focus, they turn into bokeh).
    spark = emission("Spark", "#ffb562", 14)
    for _ in range(36):
        around = HEAD + Vector((rng.gauss(-0.3, 0.9), rng.uniform(-1.4, 1.0), rng.gauss(0.1, 0.6)))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rng.uniform(0.004, 0.01), location=around)
        bpy.context.object.data.materials.append(spark)


def bloom(png):
    """Soft glow around the lit tips, like a lens: bright parts blurred and screened on top."""
    temp = png.replace(".png", "-bloom.png")
    graph = ("[0]split=3[base][a][b];"
             "[a]curves=all='0/0 0.55/0 1/1',gblur=sigma=10[near];"
             "[b]curves=all='0/0 0.45/0 1/1',gblur=sigma=46[far];"
             "[base][near]blend=all_mode=screen:all_opacity=0.9[x];"
             "[x][far]blend=all_mode=screen:all_opacity=0.75")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", png, "-filter_complex", graph, temp], check=True)
    os.replace(temp, png)


def main():
    draft = "--draft" in sys.argv
    rng = random.Random(23)
    scene = new_scene(WIDTH, HEIGHT, samples=24 if draft else 96)
    scene.render.resolution_percentage = 25 if draft else 100
    scene.cycles.adaptive_threshold = 0.02 if draft else 0.012
    scene.cycles.max_bounces = 6
    scene.cycles.glossy_bounces = 3
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.view_settings.look = "AgX - High Contrast"
    world = scene.world.node_tree.nodes["Background"]
    world.inputs["Color"].default_value = (*hex_rgb("#0d0c0b"), 1)
    world.inputs["Strength"].default_value = 1.0
    cam = camera((0.2, -6.2, 0.1), (0.2, 0.0, 0.0), lens=50)
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 2.8
    cam.data.dof.focus_distance = (Vector((0.2, -6.2, 0.1)) - HEAD).length
    build(rng)
    center = (ROOT_POINT + HEAD) / 2
    softbox("Key", (3.0, 1.6), Vector((-1.5, -4.0, 3.5)), center, strength=6)
    softbox("Back", (4.0, 0.6), Vector((1.0, 4.0, 3.5)), center, "#fff0e0", 14)
    softbox("Rim", (0.5, 4.0), Vector((5.0, 1.5, 0.5)), center, "#ff8c4a", 16)
    softbox("Under", (4.0, 0.5), Vector((1.0, -2.0, -3.0)), center, "#ff6a2a", 5)
    name = "fibers-draft" if draft else "fibers"
    png = os.path.join(OUT, f"{name}.png")
    os.makedirs(OUT, exist_ok=True)
    scene.render.filepath = png
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    bloom(png)
    if not draft:
        assets = os.path.join(ROOT, "public", "assets")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", png, "-vf", "scale=2000:-1:flags=lanczos", "-c:v", "libwebp", "-quality", "80", os.path.join(assets, "fibers.webp")], check=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", png, "-vf", "crop=ih*1.1:ih:iw-ih*1.1-ih*0.15:0,scale=900:-1:flags=lanczos", "-c:v", "libwebp", "-quality", "78", os.path.join(assets, "fibers-mobile.webp")], check=True)
    print(png)


if __name__ == "__main__":
    main()
