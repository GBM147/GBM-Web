"""Ferramentas comuns das renderizações (Blender + Cycles): cena, materiais,
formas, luzes, câmera e saída em WebP. Usado por art/demos.py e art/video_shots.py."""
import math
import os
import random
import subprocess

import bpy  # noqa: I001  (bpy first: it makes bmesh and mathutils importable)
import addon_utils
import bmesh
from mathutils import Euler, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "art", "out")


# ---------- scene ----------
def new_scene(width, height, samples=160):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    addon_utils.enable("cycles", default_set=True, persistent=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.018, 0.016, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.4
    scene.world = world
    random.seed(7)
    return scene


def render(scene, name, quality=80):
    """Renders to art/out/<name>.png and returns the path."""
    os.makedirs(OUT, exist_ok=True)
    png = os.path.join(OUT, f"{name}.png")
    scene.render.filepath = png
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    return png


def to_webp(png, target, quality=80):
    os.makedirs(os.path.dirname(target), exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", png, "-c:v", "libwebp", "-quality", str(quality), target], check=True)
    return target


# ---------- materials ----------
def material(name, color, roughness=0.5, metallic=0.0, **inputs):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*hex_rgb(color), 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    for key, value in inputs.items():
        socket = bsdf.inputs.get(key.replace("_", " "))
        if socket is None:
            continue
        socket.default_value = (*hex_rgb(value), 1) if isinstance(value, str) else value
    return mat


def textured(name, colors, scale=8.0, roughness=(0.45, 0.7), bump=0.15, metallic=0.0, detail=8.0, kind="noise", stretch=(1, 1, 1)):
    """Procedural surface: color variation, roughness variation and bump from one noise."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Metallic"].default_value = metallic
    coords = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = stretch
    links.new(coords.outputs["Object"], mapping.inputs["Vector"])
    if kind == "wave":
        tex = nodes.new("ShaderNodeTexWave")
        tex.inputs["Scale"].default_value = scale
        tex.inputs["Distortion"].default_value = 6
        tex.inputs["Detail"].default_value = detail
        out = tex.outputs["Fac"]
    else:
        tex = nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = scale
        tex.inputs["Detail"].default_value = detail
        tex.inputs["Roughness"].default_value = 0.6
        out = tex.outputs["Fac"]
    links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    elements = ramp.color_ramp.elements
    elements[0].color = (*hex_rgb(colors[0]), 1)
    elements[1].color = (*hex_rgb(colors[-1]), 1)
    for index, color in enumerate(colors[1:-1], start=1):
        element = elements.new(index / (len(colors) - 1))
        element.color = (*hex_rgb(color), 1)
    links.new(out, ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    rough = nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = roughness[0]
    rough.inputs["To Max"].default_value = roughness[1]
    links.new(out, rough.inputs["Value"])
    links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
    if bump:
        bump_node = nodes.new("ShaderNodeBump")
        bump_node.inputs["Strength"].default_value = bump
        bump_node.inputs["Distance"].default_value = 0.02
        links.new(out, bump_node.inputs["Height"])
        links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def image_material(name, path, roughness=0.35):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    image = nodes.new("ShaderNodeTexImage")
    image.image = bpy.data.images.load(path)
    links.new(image.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(image.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def hex_rgb(value):
    value = value.lstrip("#")
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


# ---------- shapes ----------
def link(name, mesh):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def finish(bm, name, smooth=True):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return link(name, mesh)


def lathe(name, profile, segments=96, smooth=True):
    """Solid of revolution around Z from (radius, height) points."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=segments, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name, smooth)


def slab(name, outline, thickness, bevel=0.0, segments=3):
    """Flat outline (x, y) extruded by thickness, with optional rounded edges."""
    bm = bmesh.new()
    face = bm.faces.new([bm.verts.new((x, y, -thickness / 2)) for x, y in outline])
    if face.normal.z > 0:
        face.normal_flip()
    result = bmesh.ops.extrude_face_region(bm, geom=[face])
    top = [element for element in result["geom"] if isinstance(element, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=Vector((0, 0, thickness)), verts=top)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True)
    return finish(bm, name)


def sphere(name, radius=1.0, scale=(1, 1, 1), location=(0, 0, 0), segments=48):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=segments // 2, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.shade_smooth()
    return obj


def cylinder(name, radius, depth, location=(0, 0, 0), rotation=(0, 0, 0), vertices=64, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    if bevel:
        modifier = obj.modifiers.new("Bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    bpy.ops.object.shade_smooth()
    return obj


def torus(name, major, minor, location=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=96, minor_segments=32, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.shade_smooth()
    return obj


def rounded_box(name, size, location=(0, 0, 0), rotation=(0, 0, 0), bevel=0.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    modifier = obj.modifiers.new("Bevel", "BEVEL")
    modifier.width = bevel
    modifier.segments = 4
    bpy.ops.object.shade_smooth()
    return obj


def floor(mat, size=30, z=0.0):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = "Floor"
    return assign(obj, mat)


def sweep(mat, width=20, depth=12, height=10, radius=3):
    """Seamless studio backdrop: floor curving up into a wall behind."""
    bm = bmesh.new()
    points = [(y, 0.0) for y in (-depth, 0.0)]
    for step in range(1, 13):
        angle = math.pi / 2 * step / 12
        points.append((radius * math.sin(angle), radius * (1 - math.cos(angle))))
    points.append((radius, height))
    left = [bm.verts.new((-width / 2, y, z)) for y, z in points]
    right = [bm.verts.new((width / 2, y, z)) for y, z in points]
    for i in range(len(points) - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    obj = finish(bm, "Backdrop")
    return assign(obj, mat)


# ---------- light and camera ----------
def area_light(name, location, target, power, size=(2, 2), color="#ffffff"):
    data = bpy.data.lights.new(name, "AREA")
    data.shape = "RECTANGLE"
    data.size, data.size_y = size
    data.energy = power
    data.color = hex_rgb(color)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    aim(obj, target)
    return obj


def camera(location, target, lens=70, aperture=None, focus=None):
    data = bpy.data.cameras.new("Camera")
    data.lens = lens
    if aperture:
        data.dof.use_dof = True
        data.dof.aperture_fstop = aperture
        data.dof.focus_distance = focus if focus else (Vector(location) - Vector(target)).length
    obj = bpy.data.objects.new("Camera", data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    aim(obj, target)
    bpy.context.scene.camera = obj
    return obj


def aim(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def scatter(source, count, place):
    """Linked copies of `source` placed by place(index) -> (location, rotation, scale)."""
    copies = []
    for index in range(count):
        copy = source.copy()
        bpy.context.scene.collection.objects.link(copy)
        location, rotation, scale = place(index)
        copy.location = location
        copy.rotation_euler = Euler(rotation)
        copy.scale = scale
        copies.append(copy)
    return copies
