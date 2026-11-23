"""Fotos de produto dos três exemplos, renderizadas no Cycles por código.

Uso:
  python art/demos.py                  -> as três, em public/assets/demos/*.webp
  python art/demos.py barbearia --fast -> só uma, em qualidade de rascunho (art/out/)
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from studio import (ROOT, area_light, assign, camera, cylinder, floor, lathe, material, new_scene, render,  # noqa: E402
                    rounded_box, scatter, slab, sphere, sweep, textured, to_webp, torus)

WIDTH, HEIGHT = 1200, 1300


def steel():
    """Polished steel with fine brushing and micro scratches (anisotropic, like real tools)."""
    mat = textured("Steel", ["#c4c7cb", "#e3e5e8", "#b9bcc0"], scale=420, roughness=(0.08, 0.2), bump=0.035, metallic=1.0, stretch=(1, 60, 1))
    mat.node_tree.nodes["Principled BSDF"].inputs["Anisotropic"].default_value = 0.55
    return mat


def clippings(count, spots, rng, color="#1b130e"):
    """Short cut hairs lying on the surface around the given (x, y, radius) spots."""
    import bpy
    data = bpy.data.curves.new("Hair", "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = 0.00022
    data.bevel_resolution = 1
    for _ in range(count):
        cx, cy, radius = rng.choice(spots)
        angle = rng.random() * math.tau
        distance = radius * math.sqrt(rng.random())
        x, y = cx + distance * math.cos(angle), cy + distance * math.sin(angle)
        length = rng.uniform(0.003, 0.014)
        heading = rng.random() * math.tau
        bend = rng.uniform(-0.55, 0.55)
        spline = data.splines.new("POLY")
        spline.points.add(5)
        for index, point in enumerate(spline.points):
            t = index / 5
            direction = heading + bend * t
            point.co = (x + math.cos(direction) * length * t, y + math.sin(direction) * length * t, 0.00024 + 0.0004 * math.sin(t * math.pi) * rng.random(), 1)
    obj = bpy.data.objects.new("Hair", data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material("HairStrand", color, roughness=0.32, Coat_Weight=0.4, Coat_Roughness=0.2))
    return obj


def razor_and_tools():
    """Época Barbearia: straight razor, scissors and comb on dark slate, copper rim light."""
    floor(slate())
    chrome = steel()
    horn = textured("Horn", ["#0d0b0a", "#1d1512", "#2a1d16", "#120e0c"], scale=30, roughness=(0.18, 0.3), bump=0.02, stretch=(1, 6, 1))
    brass = material("Brass", "#b8864b", roughness=0.28, metallic=1.0)
    # Straight razor, open: handle along -X from the pivot, blade swung out to +X.
    handle = slab("RazorHandle", [(0.0, -0.011), (-0.125, -0.008), (-0.132, 0.0), (-0.125, 0.009), (0.0, 0.012), (0.012, 0.0)], 0.009, bevel=0.003)
    assign(handle, horn)
    blade = slab("RazorBlade", [(0.004, -0.005), (0.07, -0.01), (0.083, -0.004), (0.088, 0.006), (0.082, 0.013), (0.004, 0.009)], 0.0024, bevel=0.0007)
    assign(blade, chrome)
    blade.location = (0.006, 0.0, 0.0)
    pin = cylinder("RazorPin", 0.0035, 0.0105, location=(0, 0, 0), bevel=0.001)
    assign(pin, brass)
    for part in (handle, blade, pin):
        part.location.z += 0.0045
    razor = [handle, blade, pin]
    for part in razor:
        x, y = part.location.x, part.location.y
        angle = math.radians(-18)
        part.location.x, part.location.y = x * math.cos(angle) - y * math.sin(angle) - 0.005, x * math.sin(angle) + y * math.cos(angle) + 0.085
        part.rotation_euler.z += angle
    blade.rotation_euler.z += math.radians(14)
    # Barber scissors: two long blades crossing at a screw, oval finger rings.
    for side in (-1, 1):
        cut = slab("ScissorBlade", [(0.0, -0.0045), (0.11, -0.0008), (0.112, 0.0008), (0.0, 0.0045), (-0.012, 0.0)], 0.0028, bevel=0.0008)
        assign(cut, chrome)
        arm = slab("ScissorArm", [(0.0, -0.003), (-0.05, -0.0035), (-0.05, 0.0035), (0.0, 0.003)], 0.0035, bevel=0.001)
        assign(arm, chrome)
        ring = torus("ScissorRing", 0.012, 0.0028, location=(-0.062, 0, 0), scale=(1.25, 1.0, 1.0))
        assign(ring, chrome)
        for part in (cut, arm, ring):
            angle = math.radians(-100 + side * 7)
            x, y = part.location.x, part.location.y
            part.location = (x * math.cos(angle) - y * math.sin(angle) + 0.08, x * math.sin(angle) + y * math.cos(angle) - 0.035, 0.0035 + (0.0028 if side > 0 else 0))
            part.rotation_euler.z += angle
    screw = cylinder("ScissorScrew", 0.0032, 0.009, location=(0.08, -0.035, 0.0045), bevel=0.001)
    assign(screw, chrome)
    # Comb: tortoiseshell spine with fine teeth.
    # Acetate: light passes through the thin teeth and glows warm, like the real thing.
    tortoise = textured("Tortoise", ["#1a0b05", "#2a140a", "#7a4520", "#c2843f", "#2a1309", "#120704"], scale=110, roughness=(0.12, 0.2), bump=0.01, detail=4)
    tortoise_bsdf = tortoise.node_tree.nodes["Principled BSDF"]
    tortoise_bsdf.inputs["Subsurface Weight"].default_value = 0.25
    tortoise_bsdf.inputs["Subsurface Radius"].default_value = (0.002, 0.001, 0.0005)
    tortoise_bsdf.inputs["Coat Weight"].default_value = 0.7
    tortoise_bsdf.inputs["Coat Roughness"].default_value = 0.06
    spine = rounded_box("CombSpine", (0.15, 0.012, 0.004), location=(-0.06, -0.075, 0.002), bevel=0.0018)
    assign(spine, tortoise)
    tooth = rounded_box("CombTooth", (0.0016, 0.022, 0.0032), location=(0, 0, 0), bevel=0.0006)
    assign(tooth, tortoise)
    scatter(tooth, 44, lambda i: ((-0.13 + i * 0.0032, -0.092, 0.0017), (0, 0, 0), (1, 1, 1)))
    bpy_delete(tooth)
    # Fresh clippings from the last cut, around the comb and under the scissors.
    spots = [(-0.07, -0.09, 0.05), (0.06, -0.05, 0.045), (-0.02, 0.02, 0.06), (0.1, 0.06, 0.03)]
    clippings(220, spots, random.Random(5))
    clippings(70, spots, random.Random(6), color="#5a4a3c")
    area_light("Key", (-0.35, 0.25, 0.55), (0, 0, 0), 9, size=(0.6, 0.4), color="#ffe7d2")
    area_light("Copper", (0.4, -0.35, 0.12), (0, 0, 0.01), 16, size=(0.12, 0.5), color="#e07a3c")
    area_light("Fill", (0.1, 0.5, 0.3), (0, 0, 0), 1.2, size=(0.8, 0.8), color="#fff3e6")
    # A thin strip high on the right: the long glints along the blades.
    area_light("Glint", (0.25, 0.35, 0.5), (0, 0, 0), 6, size=(0.04, 0.6), color="#ffffff")
    camera((0.0, -0.3, 0.44), (0.0, -0.01, 0.0), lens=58, aperture=2.8)


def slate():
    """Dark slate: cleft layers, fine grain, a little dust caught in the texture."""
    import bpy
    mat = textured("Slate", ["#111213", "#1b1c1d", "#262626", "#141414"], scale=22, roughness=(0.55, 0.9), bump=0.5)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    coords = nodes.new("ShaderNodeTexCoord")
    # Cleft: stretched wave bands, darker in the grooves.
    cleft = nodes.new("ShaderNodeTexWave")
    cleft.inputs["Scale"].default_value = 9
    cleft.inputs["Distortion"].default_value = 14
    cleft.inputs["Detail"].default_value = 6
    links.new(coords.outputs["Object"], cleft.inputs["Vector"])
    # Dust: sparse pale specks.
    dust = nodes.new("ShaderNodeTexNoise")
    dust.inputs["Scale"].default_value = 900
    dust.inputs["Detail"].default_value = 2
    links.new(coords.outputs["Object"], dust.inputs["Vector"])
    specks = nodes.new("ShaderNodeMapRange")
    specks.inputs["From Min"].default_value = 0.66
    specks.inputs["From Max"].default_value = 0.72
    links.new(dust.outputs["Fac"], specks.inputs["Value"])
    base = bsdf.inputs["Base Color"].links[0].from_socket
    groove = nodes.new("ShaderNodeMix")
    groove.data_type = "RGBA"
    groove.blend_type = "MULTIPLY"
    groove.inputs["Factor"].default_value = 0.35
    links.new(base, groove.inputs["A"])
    links.new(cleft.outputs["Color"], groove.inputs["B"])
    dusty = nodes.new("ShaderNodeMix")
    dusty.data_type = "RGBA"
    dusty.inputs["B"].default_value = (0.09, 0.085, 0.08, 1)
    links.new(specks.outputs["Result"], dusty.inputs["Factor"])
    links.new(groove.outputs["Result"], dusty.inputs["A"])
    links.new(dusty.outputs["Result"], bsdf.inputs["Base Color"])
    return mat


def table_setting():
    """Terra & Mesa: caprese on a ceramic plate, cutlery on green linen and a glass of wine, seen from above."""
    floor(textured("Oak", ["#9c6f43", "#b88a58", "#8a5f37", "#c49a6a"], scale=9, roughness=(0.45, 0.62), bump=0.06, stretch=(1, 16, 1)))
    linen = textured("Linen", ["#2f4129", "#3c5233", "#33472c"], scale=180, roughness=(0.8, 0.95), bump=0.12)
    napkin = rounded_box("Napkin", (0.12, 0.3, 0.004), location=(0.2, -0.01, 0.002), bevel=0.003)
    assign(napkin, linen)
    glaze = material("Glaze", "#f1ece2", roughness=0.16, Coat_Weight=0.6, Coat_Roughness=0.05)
    plate = lathe("Plate", [(0.0, 0.004), (0.07, 0.004), (0.075, 0.0), (0.08, 0.0), (0.085, 0.004), (0.125, 0.017), (0.135, 0.021),
                            (0.137, 0.024), (0.133, 0.0255), (0.122, 0.0215), (0.085, 0.0115), (0.0, 0.0115)])
    assign(plate, glaze)
    rim = torus("PlateRim", 0.1345, 0.0012, location=(0, 0, 0.0245))
    assign(rim, material("Terracotta", "#a64625", roughness=0.4))
    # Caprese: real tomato slices (skin, flesh walls, gel and seeds), soft irregular mozzarella,
    # folded basil leaves, then olive oil, cracked pepper and flaky salt on top.
    cheese = mozzarella()
    basil = basil_material()
    rng = random.Random(3)
    for index in range(10):
        angle = index / 10 * math.tau
        radius = 0.058
        x, y = radius * math.cos(angle), radius * math.sin(angle)
        size = 0.027 if index % 2 else 0.029
        piece = organic_disc("Slice", size, 0.0085 if index % 2 else 0.011, rng, wobble=0.05 if index % 2 else 0.09)
        piece.location = (x, y, 0.016 + index * 0.0009)
        piece.rotation_euler = (0.08 * math.sin(angle), 0.08 * math.cos(angle), rng.random() * math.tau)
        assign(piece, tomato_slice(f"Tomato{index}", size) if index % 2 else cheese)
    for index in range(7):
        angle = rng.random() * math.tau
        radius = 0.03 + rng.random() * 0.045
        leaf = basil_leaf(0.032 + rng.random() * 0.012, rng)
        leaf.location = (radius * math.cos(angle), radius * math.sin(angle), 0.03)
        leaf.rotation_euler = (rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), rng.random() * math.tau)
        assign(leaf, basil)
    settle_on_plate(rng)
    cutlery = steel()
    knife = slab("Knife", [(-0.11, -0.006), (0.0, -0.007), (0.115, -0.004), (0.12, 0.004), (0.0, 0.007), (-0.11, 0.006), (-0.114, 0.0)], 0.0035, bevel=0.0012)
    knife.rotation_euler.z = math.radians(90)
    knife.location = (0.215, 0.0, 0.0065)
    assign(knife, cutlery)
    fork_outline = [(-0.11, -0.006), (0.02, -0.006), (0.035, -0.012), (0.085, -0.012), (0.085, -0.009), (0.045, -0.0085), (0.045, -0.0055),
                    (0.085, -0.0055), (0.085, -0.0025), (0.045, -0.0022), (0.045, 0.0022), (0.085, 0.0025), (0.085, 0.0055), (0.045, 0.0055),
                    (0.045, 0.0085), (0.085, 0.009), (0.085, 0.012), (0.035, 0.012), (0.02, 0.006), (-0.11, 0.006), (-0.114, 0.0)]
    fork = slab("Fork", fork_outline, 0.0035, bevel=0.001)
    fork.rotation_euler.z = math.radians(90)
    fork.location = (0.188, 0.0, 0.0065)
    assign(fork, cutlery)
    glass = material("Glass", "#ffffff", roughness=0.0, Transmission_Weight=1.0, IOR=1.45)
    wine = material("Wine", "#5c0d17", roughness=0.02, Transmission_Weight=0.9, IOR=1.34)
    goblet = lathe("Goblet", [(0.0, 0.0), (0.038, 0.0), (0.038, 0.003), (0.005, 0.006), (0.004, 0.09), (0.03, 0.115), (0.042, 0.15),
                              (0.038, 0.2), (0.036, 0.2), (0.04, 0.15), (0.028, 0.117), (0.002, 0.095), (0.0, 0.095)])
    goblet.location = (-0.17, 0.13, 0.0)
    assign(goblet, glass)
    liquid = lathe("Wine", [(0.0, 0.096), (0.026, 0.117), (0.037, 0.145), (0.037, 0.148), (0.0, 0.148)])
    liquid.location = goblet.location
    assign(liquid, wine)
    # Low window light raking across the table: relief, soft shadows and glints on the oil.
    area_light("Window", (-0.75, 0.3, 0.32), (0, 0, 0), 30, size=(0.9, 1.3), color="#fff1de")
    area_light("Fill", (0.6, -0.4, 0.8), (0, 0, 0), 1.6, size=(1.0, 1.0), color="#fff8ef")
    camera((0.02, -0.09, 0.62), (0.02, 0.02, 0.0), lens=42, aperture=5.6)


def pet_still_life():
    """Pata Club: lilac ceramic bowl with kibble, bone treats, a ball and a collar on a soft lavender sweep."""
    sweep(textured("Lavender", ["#e6dcf6", "#ece4f8", "#e1d5f3"], scale=4, roughness=(0.85, 0.95), bump=0.02), width=3, depth=2, height=2, radius=0.5)
    glaze = material("Glaze", "#8d55c8", roughness=0.12, Coat_Weight=1.0, Coat_Roughness=0.03)
    bowl = lathe("Bowl", [(0.0, 0.0), (0.075, 0.0), (0.08, 0.004), (0.095, 0.05), (0.096, 0.056), (0.09, 0.057), (0.08, 0.01), (0.0, 0.01)])
    bowl.location = (-0.03, 0.05, 0.0)
    assign(bowl, glaze)
    kibble = sphere("Kibble", 0.0075, scale=(1.0, 0.85, 0.7), segments=20)
    assign(kibble, kibble_material())
    random.seed(11)

    def place(index):
        angle = random.random() * math.tau
        radius = math.sqrt(random.random()) * 0.072
        height = 0.012 + (1 - (radius / 0.075) ** 2) * 0.03 + random.random() * 0.006
        size = random.uniform(0.82, 1.18)
        return ((bowl.location.x + radius * math.cos(angle), bowl.location.y + radius * math.sin(angle), height),
                (random.random() * math.tau, random.random() * math.tau, random.random() * math.tau),
                (size, size * random.uniform(0.8, 1.1), size * random.uniform(0.75, 1.05)))
    scatter(kibble, 260, place)

    # A few pieces that fell out of the bowl.
    def spill(index):
        angle = random.uniform(-2.4, -0.6)
        radius = random.uniform(0.105, 0.16)
        size = random.uniform(0.8, 1.1)
        return ((bowl.location.x + radius * math.cos(angle), bowl.location.y + radius * math.sin(angle), 0.0048 * size),
                (0, 0, random.random() * math.tau), (size, size, size))
    scatter(kibble, 6, spill)
    bpy_delete(kibble)
    treat = biscuit()
    for index, (x, y, angle) in enumerate([(0.11, -0.05, 0.4), (0.075, -0.1, -0.5), (0.15, 0.0, 1.2)]):
        bone_biscuit(x, y, angle, treat)
    ball = sphere("Ball", 0.034, location=(-0.13, -0.07, 0.034))
    felt = textured("Felt", ["#f2c40a", "#ffd21a", "#e9b908"], scale=2600, roughness=(0.8, 0.95), bump=0.35)
    felt_bsdf = felt.node_tree.nodes["Principled BSDF"]
    felt_bsdf.inputs["Sheen Weight"].default_value = 0.6
    felt_bsdf.inputs["Sheen Roughness"].default_value = 0.35
    felt_bsdf.inputs["Sheen Tint"].default_value = (1.0, 0.85, 0.3, 1)
    assign(ball, felt)
    seam = torus("Seam", 0.0342, 0.0014, location=ball.location, rotation=(math.radians(60), math.radians(35), 0))
    assign(seam, material("SeamWhite", "#f4efe2", roughness=0.85, Sheen_Weight=0.6))
    collar = torus("Collar", 0.05, 0.008, location=(0.07, -0.085, 0.0035), scale=(1, 1, 0.42))
    # Woven nylon strap: fine ribs across it.
    assign(collar, textured("Strap", ["#e9b94e", "#f6cc62", "#dcae45"], scale=900, roughness=(0.45, 0.6), bump=0.4, kind="wave", stretch=(1, 1, 30)))
    gold = material("Gold", "#d9b14a", roughness=0.18, metallic=1.0)
    ring = torus("DRing", 0.008, 0.0016, location=(0.07, -0.138, 0.006), rotation=(math.radians(80), 0, 0))
    assign(ring, gold)
    tag = cylinder("Tag", 0.014, 0.0022, location=(0.07, -0.156, 0.0014), bevel=0.0008)
    assign(tag, gold)
    area_light("Key", (-0.4, -0.3, 0.6), (0, 0, 0), 11, size=(0.7, 0.7), color="#fff1e6")
    area_light("Lilac", (0.5, -0.1, 0.25), (0, 0, 0.02), 6, size=(0.5, 0.8), color="#b48ae6")
    area_light("Back", (0.0, 0.6, 0.5), (0, 0, 0), 4, size=(1.0, 0.4), color="#ffffff")
    camera((0.0, -0.5, 0.36), (0.0, 0.02, 0.02), lens=56, aperture=2.8)


def bone_biscuit(x, y, angle, mat):
    """One smooth dog-bone biscuit (metaballs: a shaft and two knobs at each end), a bit flat."""
    import bpy
    data = bpy.data.metaballs.new("Bone")
    data.resolution = 0.0012
    data.render_resolution = 0.0008
    shaft = data.elements.new(type="CAPSULE")
    shaft.size_x = 0.026
    shaft.radius = 0.0125
    for dx in (-0.031, 0.031):
        for dy in (-0.0078, 0.0078):
            knob = data.elements.new(type="BALL")
            knob.co = (dx, dy, 0)
            knob.radius = 0.0138
    obj = bpy.data.objects.new("Bone", data)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.scale = (1, 1, 0.72)
    obj.location = (x, y, 0.0085)
    obj.rotation_euler.z = angle
    bpy.ops.object.shade_smooth()
    assign(obj, mat)
    return obj


def kibble_material():
    """Dry food: each piece a slightly different bake, porous surface."""
    import bpy
    from studio import hex_rgb
    mat = bpy.data.materials.new("Kibble")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    info = nodes.new("ShaderNodeObjectInfo")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*hex_rgb("#4e2d15"), 1)
    ramp.color_ramp.elements[1].color = (*hex_rgb("#9c6a37"), 1)
    ramp.color_ramp.elements.new(0.5).color = (*hex_rgb("#7a4824"), 1)
    links.new(info.outputs["Random"], ramp.inputs["Fac"])
    coords = nodes.new("ShaderNodeTexCoord")
    pores = nodes.new("ShaderNodeTexVoronoi")
    pores.inputs["Scale"].default_value = 900
    links.new(coords.outputs["Object"], pores.inputs["Vector"])
    shade = nodes.new("ShaderNodeMix")
    shade.data_type = "RGBA"
    shade.blend_type = "MULTIPLY"
    shade.inputs["Factor"].default_value = 0.25
    links.new(ramp.outputs["Color"], shade.inputs["A"])
    links.new(pores.outputs["Distance"], shade.inputs["B"])
    links.new(shade.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.72
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.0006
    links.new(pores.outputs["Distance"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def biscuit():
    """Baked dog treat: pale dough with darker baked patches, porous surface."""
    mat = textured("Treat", ["#b9844f", "#d6ab72", "#c99a62", "#a8743f"], scale=160, roughness=(0.65, 0.85), bump=0.0)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    coords = nodes.new("ShaderNodeTexCoord")
    pores = nodes.new("ShaderNodeTexVoronoi")
    pores.inputs["Scale"].default_value = 700
    links.new(coords.outputs["Object"], pores.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    bump.inputs["Distance"].default_value = 0.0005
    links.new(pores.outputs["Distance"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def organic_disc(name, radius, thickness, rng, wobble=0.06, points=56):
    """A slice cut by hand: round, but never a perfect circle."""
    phases = [rng.random() * math.tau for _ in range(4)]
    outline = []
    for index in range(points):
        angle = index / points * math.tau
        r = radius * (1 + wobble * (0.6 * math.sin(2 * angle + phases[0]) + 0.3 * math.sin(3 * angle + phases[1])
                                    + 0.2 * math.sin(5 * angle + phases[2]) + 0.1 * math.sin(7 * angle + phases[3])) / 1.2)
        outline.append((r * math.cos(angle), r * math.sin(angle)))
    return slab(name, outline, thickness, bevel=min(0.0038, thickness * 0.4), segments=5)


def tomato_slice(name, radius):
    """Cut tomato: glossy skin ring, red flesh walls, translucent gel chambers with seeds."""
    import bpy
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.22
    bsdf.inputs["Coat Weight"].default_value = 0.8
    bsdf.inputs["Coat Roughness"].default_value = 0.08
    bsdf.inputs["Subsurface Radius"].default_value = (0.004, 0.0012, 0.0008)
    coords = nodes.new("ShaderNodeTexCoord")
    flat = nodes.new("ShaderNodeVectorMath")
    flat.operation = "MULTIPLY"
    flat.inputs[1].default_value = (1, 1, 0)
    links.new(coords.outputs["Object"], flat.inputs[0])
    length = nodes.new("ShaderNodeVectorMath")
    length.operation = "LENGTH"
    links.new(flat.outputs["Vector"], length.inputs[0])
    r = nodes.new("ShaderNodeMath")
    r.operation = "DIVIDE"
    r.inputs[1].default_value = radius
    links.new(length.outputs["Value"], r.inputs[0])

    def band(low, high, soft=0.04):
        """1 between low and high (of the radius), soft edges."""
        up = nodes.new("ShaderNodeMapRange")
        up.inputs["From Min"].default_value = low - soft
        up.inputs["From Max"].default_value = low + soft
        down = nodes.new("ShaderNodeMapRange")
        down.inputs["From Min"].default_value = high + soft
        down.inputs["From Max"].default_value = high - soft
        links.new(r.outputs["Value"], up.inputs["Value"])
        links.new(r.outputs["Value"], down.inputs["Value"])
        both = nodes.new("ShaderNodeMath")
        both.operation = "MULTIPLY"
        links.new(up.outputs["Result"], both.inputs[0])
        links.new(down.outputs["Result"], both.inputs[1])
        return both.outputs["Value"]

    # Chambers: Voronoi cells, walls along the cell edges.
    cells = nodes.new("ShaderNodeTexVoronoi")
    cells.feature = "DISTANCE_TO_EDGE"
    cells.inputs["Scale"].default_value = 2.6 / radius
    cells.inputs["Randomness"].default_value = 0.85
    links.new(coords.outputs["Object"], cells.inputs["Vector"])
    gel_inside = nodes.new("ShaderNodeMapRange")
    gel_inside.inputs["From Min"].default_value = 0.05
    gel_inside.inputs["From Max"].default_value = 0.16
    links.new(cells.outputs["Distance"], gel_inside.inputs["Value"])
    gel = nodes.new("ShaderNodeMath")
    gel.operation = "MULTIPLY"
    links.new(gel_inside.outputs["Result"], gel.inputs[0])
    links.new(band(0.22, 0.74), gel.inputs[1])
    # Seeds: small cells inside the gel.
    seeds_tex = nodes.new("ShaderNodeTexVoronoi")
    seeds_tex.inputs["Scale"].default_value = 15 / radius
    links.new(coords.outputs["Object"], seeds_tex.inputs["Vector"])
    seed_dot = nodes.new("ShaderNodeMapRange")
    seed_dot.inputs["From Min"].default_value = 0.22
    seed_dot.inputs["From Max"].default_value = 0.12
    links.new(seeds_tex.outputs["Distance"], seed_dot.inputs["Value"])
    seeds = nodes.new("ShaderNodeMath")
    seeds.operation = "MULTIPLY"
    links.new(seed_dot.outputs["Result"], seeds.inputs[0])
    links.new(gel.outputs["Value"], seeds.inputs[1])
    skin = band(0.9, 2.0, soft=0.03)

    def mix(a, b, factor):
        node = nodes.new("ShaderNodeMix")
        node.data_type = "RGBA"
        if isinstance(a, tuple):
            node.inputs["A"].default_value = a
        else:
            links.new(a, node.inputs["A"])
        node.inputs["B"].default_value = b
        links.new(factor, node.inputs["Factor"])
        return node.outputs["Result"]

    from studio import hex_rgb
    color = mix((*hex_rgb("#c22a1a"), 1), (*hex_rgb("#e8553a"), 1), gel.outputs["Value"])
    color = mix(color, (*hex_rgb("#e9cf86"), 1), seeds.outputs["Value"])
    color = mix(color, (*hex_rgb("#8f140c"), 1), skin)
    links.new(color, bsdf.inputs["Base Color"])
    sss = nodes.new("ShaderNodeMapRange")
    sss.inputs["To Min"].default_value = 0.25
    sss.inputs["To Max"].default_value = 0.75
    links.new(gel.outputs["Value"], sss.inputs["Value"])
    links.new(sss.outputs["Result"], bsdf.inputs["Subsurface Weight"])
    # Wet, slightly uneven cut surface.
    grain = nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 900
    links.new(coords.outputs["Object"], grain.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.15
    bump.inputs["Distance"].default_value = 0.0004
    links.new(grain.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def mozzarella():
    mat = textured("Mozzarella", ["#f1ece0", "#e8e1d2", "#f4f0e6"], scale=380, roughness=(0.3, 0.45), bump=0.25)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Subsurface Weight"].default_value = 0.85
    bsdf.inputs["Subsurface Radius"].default_value = (0.006, 0.005, 0.004)
    bsdf.inputs["Coat Weight"].default_value = 0.35
    bsdf.inputs["Coat Roughness"].default_value = 0.18
    return mat


def basil_material():
    mat = textured("Basil", ["#1f4f1d", "#2f6b2a", "#3e7f33"], scale=160, roughness=(0.22, 0.35), bump=0.0, kind="wave", stretch=(1, 7, 1))
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Subsurface Weight"].default_value = 0.3
    bsdf.inputs["Subsurface Radius"].default_value = (0.001, 0.002, 0.0008)
    bsdf.inputs["Coat Weight"].default_value = 0.5
    bsdf.inputs["Coat Roughness"].default_value = 0.12
    # Veins: fine cells pressed into the leaf.
    coords = nodes.new("ShaderNodeTexCoord")
    veins = nodes.new("ShaderNodeTexVoronoi")
    veins.feature = "DISTANCE_TO_EDGE"
    veins.inputs["Scale"].default_value = 260
    links.new(coords.outputs["Object"], veins.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.0003
    links.new(veins.outputs["Distance"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def basil_leaf(length, rng):
    """Pointed leaf, folded along the middle vein and curled a little."""
    import bmesh
    import bpy
    bm = bmesh.new()
    rows, cols = 14, 8
    width = length * 0.32
    fold = rng.uniform(0.25, 0.45)
    curl = rng.uniform(-0.18, 0.25)
    grid = []
    for i in range(rows + 1):
        t = i / rows
        half = width * (math.sin(math.pi * t) ** 0.85) * (1 - 0.25 * t) + 1e-5
        row = []
        for j in range(cols + 1):
            v = j / cols * 2 - 1
            x = (t - 0.5) * length
            y = v * half
            z = fold * abs(y) + curl * length * (t - 0.45) ** 2
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for i in range(rows):
        for j in range(cols):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("Basil")
    bm.to_mesh(mesh)
    bm.free()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj = bpy.data.objects.new("Basil", mesh)
    bpy.context.scene.collection.objects.link(obj)
    solid = obj.modifiers.new("Thickness", "SOLIDIFY")
    solid.thickness = 0.0004
    return obj


def settle_on_plate(rng):
    """Drops the leaves onto the slices, then dresses the plate: olive oil, pepper, salt."""
    import bpy
    from mathutils import Vector
    scene = bpy.context.scene
    depsgraph = bpy.context.evaluated_depsgraph_get()

    def surface(x, y, ignore=()):
        hit, location, normal, _, obj, _ = scene.ray_cast(depsgraph, Vector((x, y, 0.2)), Vector((0, 0, -1)))
        return (location, normal) if hit else (Vector((x, y, 0.0115)), Vector((0, 0, 1)))

    for leaf in [obj for obj in scene.objects if obj.name.startswith("Basil")]:
        leaf.hide_set(True)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for leaf in [obj for obj in scene.objects if obj.name.startswith("Basil")]:
        location, _ = surface(leaf.location.x, leaf.location.y)
        leaf.location.z = location.z + 0.0012
        leaf.hide_set(False)
    depsgraph.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    oil = material("OliveOil", "#d9c45c", roughness=0.02, Transmission_Weight=1.0, IOR=1.47)
    pepper = material("Pepper", "#1d1712", roughness=0.62)
    salt = material("Salt", "#fbfaf6", roughness=0.15, Transmission_Weight=0.6, IOR=1.54)
    for index in range(34):
        angle, radius = rng.random() * math.tau, 0.025 + rng.random() * 0.065
        location, normal = surface(radius * math.cos(angle), radius * math.sin(angle))
        size = rng.uniform(0.002, 0.0055)
        drop = sphere("Oil", size, scale=(1, rng.uniform(0.7, 1.0), 0.22), location=tuple(location + normal * size * 0.15), segments=24)
        assign(drop, oil)
    for index in range(110):
        angle, radius = rng.random() * math.tau, 0.02 + rng.random() * 0.08
        location, normal = surface(radius * math.cos(angle), radius * math.sin(angle))
        grain = sphere("Pepper", rng.uniform(0.0004, 0.0009), scale=(1, rng.uniform(0.6, 1), rng.uniform(0.4, 0.8)), location=tuple(location + normal * 0.0003), segments=8)
        grain.rotation_euler = (rng.random() * 3, rng.random() * 3, rng.random() * 3)
        assign(grain, pepper)
    for index in range(40):
        angle, radius = rng.random() * math.tau, 0.02 + rng.random() * 0.075
        location, normal = surface(radius * math.cos(angle), radius * math.sin(angle))
        flake = rounded_box("Salt", (rng.uniform(0.0008, 0.0016), rng.uniform(0.0008, 0.0014), 0.0004), location=tuple(location + normal * 0.0003), rotation=(0, 0, rng.random() * 3), bevel=0.0001)
        assign(flake, salt)


def bpy_delete(obj):
    import bpy
    bpy.data.objects.remove(obj, do_unlink=True)


SCENES = {"barbearia": razor_and_tools, "restaurante": table_setting, "petshop": pet_still_life}

if __name__ == "__main__":
    names = [name for name in sys.argv[1:] if name in SCENES] or list(SCENES)
    fast = "--fast" in sys.argv
    for name in names:
        scene = new_scene(WIDTH // 2 if fast else WIDTH, HEIGHT // 2 if fast else HEIGHT, samples=32 if fast else 192)
        SCENES[name]()
        png = render(scene, f"demo-{name}{'-fast' if fast else ''}")
        if not fast:
            print(to_webp(png, os.path.join(ROOT, "public", "assets", "demos", f"{name}.webp")))
        else:
            print(png)
