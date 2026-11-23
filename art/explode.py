"""Celular "por dentro": vista explodida do celular da GBM Web, renderizada no Blender (Cycles).

As camadas se separam quadro a quadro (vidro, tela, estrutura, placa e bateria, traseira) e o
site rola essa sequência junto com a página, na seção "O que vem no seu site".

Uso (com o Python que tem o bpy, veja art/requirements.txt):
  node art/textures.mjs              -> logo da traseira em art/out/textures/
  python art/explode.py              -> public/assets/explode/{desk,mob}/NN.webp (60 quadros)
  python art/explode.py --draft      -> prévias rápidas em art/out/explode/draft/
  python art/explode.py --frames 0,36,71  -> só alguns quadros (com --draft ou não)
"""
import math
import os
import random
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402,I001  (bpy first: it makes bmesh and mathutils importable)
from mathutils import Matrix, Vector  # noqa: E402

import phone as phone_model  # noqa: E402
from studio import OUT, ROOT, camera, hex_rgb, material, new_scene, textured  # noqa: E402
from video_shots import phone_materials, pose_matrix, softbox  # noqa: E402

WIDTH, HEIGHT = 1000, 1000
FRAMES = 60
TARGET = os.path.join(ROOT, "public", "assets", "explode")
SCREEN_IMAGE = os.path.join(ROOT, "public", "assets", "screens", "barbearia.webp")
CAMERA = Vector((0.0, -7.8, 0.0))
LENS = 85
D = phone_model.DEPTH
FRONT, BACK = D / 2, -D / 2

# Layer, how far it travels toward the front when fully open, and when it moves (0..1 of the scroll).
LAYERS = [
    ("glass", 1.9, (0.1, 0.62)),
    ("display", 1.42, (0.18, 0.7)),
    ("frame", 0.96, (0.26, 0.78)),
    ("inside", 0.5, (0.34, 0.86)),
    ("back", 0.0, (0.0, 1.0)),
]
# Standing and facing the camera, then lying back and turned sideways as the layers open.
START = dict(yaw=-16, pitch=-3, roll=-4)
END = dict(yaw=-22, pitch=-56, roll=68)


# ---------- helpers ----------
def smooth(edge0, edge1, x):
    t = min(1.0, max(0.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def box(name, size, center, mat, bevel=0.003, parent=None):
    """Rounded box in phone units: size (x, y, z), center (x, y, z)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        modifier = obj.modifiers.new("Bevel", "BEVEL")
        modifier.width = min(bevel, min(size) * 0.45)
        modifier.segments = 3
        modifier.limit_method = "NONE"
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def disc(name, radius, depth, center, mat, parent=None, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center)
    obj = bpy.context.object
    obj.name = name
    modifier = obj.modifiers.new("Bevel", "BEVEL")
    modifier.width = min(depth * 0.3, radius * 0.2)
    modifier.segments = 2
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def ring(name, radius, minor, center, mat, parent=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=minor, major_segments=96, minor_segments=10, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (1, 1, 0.35)
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def empty(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def hollow_frame():
    """The phone.py frame without its top and bottom caps, plus an inner wall: a real ring."""
    frame = phone_model.body()
    mesh = frame.data
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(mesh)
    caps = [face for face in bm.faces if len(face.verts) > 4]
    rims = [list(face.verts) for face in caps]
    bmesh.ops.delete(bm, geom=caps, context="FACES_ONLY")
    # Bridge the two open outlines with an inner wall.
    if len(rims) == 2 and len(rims[0]) == len(rims[1]):
        top, bottom = sorted(rims, key=lambda verts: verts[0].co.z, reverse=True)
        bottom_by_xy = {(round(v.co.x, 5), round(v.co.y, 5)): v for v in bottom}
        pairs = [(v, bottom_by_xy.get((round(v.co.x, 5), round(v.co.y, 5)))) for v in top]
        if all(b for _, b in pairs):
            for i in range(len(pairs)):
                a1, b1 = pairs[i]
                a2, b2 = pairs[(i + 1) % len(pairs)]
                try:
                    bm.faces.new((a1, a2, b2, b1))
                except ValueError:
                    pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return frame


# ---------- materials ----------
def screen_material():
    """The barbearia site glowing on the display (top of the tall print)."""
    mat = bpy.data.materials.new("Display")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1)
    bsdf.inputs["Roughness"].default_value = 0.18
    coords = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    visible = (phone_model.SCREEN_H / phone_model.SCREEN_W) * 780 / 3000
    mapping.inputs["Scale"].default_value = (1, visible, 1)
    mapping.inputs["Location"].default_value = (0, 1 - visible, 0)
    image = nodes.new("ShaderNodeTexImage")
    image.image = bpy.data.images.load(SCREEN_IMAGE)
    image.extension = "EXTEND"
    links.new(coords.outputs["UV"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], image.inputs["Vector"])
    links.new(image.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.15
    return mat


def cover_glass():
    """Clear cover glass: see-through (so the alpha stays clear) with Fresnel reflections."""
    mat = bpy.data.materials.new("CoverGlass")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    clear = nodes.new("ShaderNodeBsdfTransparent")
    clear.inputs["Color"].default_value = (0.93, 0.95, 0.96, 1)
    gloss = nodes.new("ShaderNodeBsdfGlossy")
    gloss.inputs["Roughness"].default_value = 0.02
    fresnel = nodes.new("ShaderNodeFresnel")
    fresnel.inputs["IOR"].default_value = 1.52
    boost = nodes.new("ShaderNodeMath")
    boost.operation = "MULTIPLY_ADD"
    boost.inputs[1].default_value = 1.0
    boost.inputs[2].default_value = 0.02
    boost.use_clamp = True
    # Seen from inside (the far face of the slab) the Fresnel term turns into total internal
    # reflection and the glass would look solid: only the near face reflects.
    geometry = nodes.new("ShaderNodeNewGeometry")
    front = nodes.new("ShaderNodeMath")
    front.operation = "SUBTRACT"
    front.inputs[0].default_value = 1.0
    only_front = nodes.new("ShaderNodeMath")
    only_front.operation = "MULTIPLY"
    mix = nodes.new("ShaderNodeMixShader")
    links.new(fresnel.outputs["Fac"], boost.inputs[0])
    links.new(geometry.outputs["Backfacing"], front.inputs[1])
    links.new(boost.outputs["Value"], only_front.inputs[0])
    links.new(front.outputs["Value"], only_front.inputs[1])
    links.new(only_front.outputs["Value"], mix.inputs["Fac"])
    links.new(clear.outputs[0], mix.inputs[1])
    links.new(gloss.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    return mat


def internals_materials():
    return {
        "pcb": textured("PCB", ["#10241a", "#163024", "#0d1c15"], scale=40, roughness=(0.35, 0.55), bump=0.05),
        "chip": material("Chip", "#0d0d0e", roughness=0.28, Coat_Weight=0.4, Coat_Roughness=0.25),
        "shield": textured("Shield", ["#b9b6ae", "#d2cfc8", "#a9a69f"], scale=60, roughness=(0.26, 0.38), bump=0.02, metallic=1.0, stretch=(1, 30, 1)),
        "gold": material("Gold", "#d9a54a", roughness=0.22, metallic=1.0),
        "cap": material("Capacitor", "#8a6e4f", roughness=0.45),
        "capdark": material("CapacitorDark", "#2a2826", roughness=0.4),
        "battery": textured("Battery", ["#121212", "#1a1a1a", "#101010"], scale=6, roughness=(0.32, 0.5), bump=0.04),
        "label": material("Label", "#3a3936", roughness=0.62),
        "flex": material("Flex", "#c8651c", roughness=0.32, Coat_Weight=0.6, Coat_Roughness=0.1, Subsurface_Weight=0.2),
        "steel": textured("Steel", ["#8d8a84", "#a8a59f", "#7f7c76"], scale=80, roughness=(0.22, 0.34), bump=0.01, metallic=1.0, stretch=(40, 1, 1)),
        "module": material("Module", "#2c2b29", roughness=0.3, metallic=0.8),
        "lens": material("LensTop", "#07090d", roughness=0.02, Coat_Weight=1.0, Thin_Film_Thickness=380, Thin_Film_IOR=1.6),
        "graphite": textured("Graphite", ["#0d0d0d", "#141414", "#0b0b0b"], scale=12, roughness=(0.45, 0.65), bump=0.03),
        "copper": material("Copper", "#c4733b", roughness=0.24, metallic=1.0),
        "magnet": material("Magnet", "#3a3936", roughness=0.4, metallic=0.6),
        "panel": material("OLED", "#050505", roughness=0.3, metallic=0.2),
        "speaker": textured("Grille", ["#151515", "#2a2a2a"], scale=300, roughness=(0.4, 0.6), bump=0.2),
    }


# ---------- build ----------
def build_layers(m):
    """Builds the phone in layers. Returns (root, {layer: empty})."""
    root = empty("Root")
    root.rotation_mode = "QUATERNION"
    layers = {name: empty(name.capitalize(), root) for name, _, _ in LAYERS}
    phone_mats = phone_materials()

    # Back: the phone.py back with the camera plateau, and an inner face with the charging coil.
    phone = phone_model.build(fresh=False)
    keep = {"Back", "Plateau", "LensRing", "LensGlass", "Flash"}
    to_frame = {"Buttons", "Port", "Speaker"}
    for part in list(phone.children):
        if part.name in keep:
            part.data.materials.clear()
            part.data.materials.append(phone_mats[part.name])
            part.parent = layers["back"]
        elif part.name in to_frame:
            part.data.materials.clear()
            part.data.materials.append(phone_mats[part.name])
            part.parent = layers["frame"]
        else:
            bpy.data.objects.remove(part, do_unlink=True)
    bpy.data.objects.remove(phone, do_unlink=True)
    plate_box("BackInner", 0.95, 2.01, 0.004, phone_model.CORNER - 0.02, (0, 0, BACK + 0.004), m["graphite"], layers["back"])
    coil_center = (0, -0.06, BACK + 0.0075)
    for index in range(14):
        ring(f"Coil{index}", 0.11 + index * 0.0115, 0.0042, coil_center, m["copper"], layers["back"])
    ring("Magnets", 0.33, 0.016, coil_center, m["magnet"], layers["back"])
    disc("CoilCore", 0.095, 0.004, coil_center, m["graphite"], layers["back"])

    # Frame: a hollow titanium ring with the buttons, port and speaker holes from phone.py.
    frame = hollow_frame()
    frame.data.materials.append(phone_mats["Frame"])
    frame.parent = layers["frame"]

    # Inside: logic board up top, battery below, cameras, taptic engine and speaker.
    inside = layers["inside"]
    z = -0.012
    box("Board", (0.86, 0.66, 0.012), (0, 0.63, z), m["pcb"], bevel=0.004, parent=inside)
    top = z + 0.006
    box("SoC", (0.2, 0.2, 0.016), (-0.17, 0.66, top + 0.008), m["chip"], bevel=0.004, parent=inside)
    box("SoCLid", (0.13, 0.13, 0.002), (-0.17, 0.66, top + 0.0165), m["shield"], bevel=0.001, parent=inside)
    box("ShieldA", (0.3, 0.2, 0.018), (0.2, 0.8, top + 0.009), m["shield"], bevel=0.004, parent=inside)
    box("ShieldB", (0.26, 0.15, 0.015), (0.22, 0.47, top + 0.0075), m["shield"], bevel=0.004, parent=inside)
    box("Ram", (0.12, 0.09, 0.01), (-0.2, 0.43, top + 0.005), m["chip"], bevel=0.002, parent=inside)
    random.seed(11)
    for index in range(16):
        w, h = random.uniform(0.025, 0.06), random.uniform(0.02, 0.045)
        x, y = random.uniform(-0.38, 0.38), random.uniform(0.33, 0.93)
        if abs(x + 0.17) < 0.13 and abs(y - 0.66) < 0.13:
            continue
        if x > 0.03 and (abs(y - 0.8) < 0.12 or abs(y - 0.47) < 0.1):
            continue
        box(f"Chip{index}", (w, h, 0.007), (x, y, top + 0.0035), m["chip"], bevel=0.0015, parent=inside)
    for index in range(70):
        x, y = random.uniform(-0.4, 0.4), random.uniform(0.32, 0.94)
        size = random.choice([(0.014, 0.007), (0.007, 0.014), (0.01, 0.005)])
        mat = m["cap"] if random.random() < 0.55 else m["capdark"]
        box(f"Cap{index}", (*size, 0.006), (x, y, top + 0.003), mat, bevel=0.0012, parent=inside)
    for x in (-0.39, 0.39):
        for y in (0.33, 0.93):
            disc(f"Screw{x}{y}", 0.014, 0.008, (x, y, top + 0.004), m["steel"], inside, vertices=24)
            disc(f"ScrewSlot{x}{y}", 0.005, 0.0085, (x, y, top + 0.0042), m["chip"], inside, vertices=6)
    box("Connector", (0.16, 0.05, 0.008), (0.0, 0.36, top + 0.004), m["gold"], bevel=0.001, parent=inside)
    for index, (dx, dy) in enumerate([(-0.075, 0.075), (-0.075, -0.085), (0.085, -0.005)]):
        cx, cy = 0.215 + dx, phone_model.HEIGHT / 2 - 0.255 + dy
        # Camera modules hang behind the board, lenses toward the back glass.
        box(f"CamBase{index}", (0.15, 0.15, 0.012), (cx, cy, z - 0.012), m["module"], bevel=0.004, parent=inside)
        disc(f"CamBarrel{index}", 0.058, 0.016, (cx, cy, z - 0.026), m["module"], inside)
        disc(f"CamGlass{index}", 0.04, 0.003, (cx, cy, z - 0.034), m["lens"], inside)
    box("Battery", (0.84, 1.16, 0.04), (0, -0.33, -0.004), m["battery"], bevel=0.012, parent=inside)
    box("BatteryLabel", (0.5, 0.34, 0.001), (0, -0.2, 0.0165), m["label"], bevel=0.0005, parent=inside)
    box("BatteryFlex", (0.12, 0.16, 0.004), (0.26, 0.3, 0.008), m["flex"], bevel=0.0015, parent=inside)
    box("DisplayFlex", (0.08, 0.2, 0.004), (-0.36, 0.84, 0.004), m["flex"], bevel=0.0015, parent=inside)
    box("Taptic", (0.3, 0.1, 0.034), (-0.22, -0.93, 0.0), m["steel"], bevel=0.008, parent=inside)
    box("SpeakerBox", (0.26, 0.1, 0.034), (0.24, -0.93, 0.0), m["speaker"], bevel=0.008, parent=inside)
    box("PortFlex", (0.5, 0.05, 0.004), (0.0, -0.995, 0.012), m["flex"], bevel=0.0015, parent=inside)

    # Display: OLED panel, the site glowing on it, the island and its flex.
    display = layers["display"]
    plate_box("Panel", 0.95, 2.01, 0.008, phone_model.CORNER - 0.02, (0, 0, FRONT - 0.006), m["panel"], display)
    screen = phone_model.plate("Screen", phone_model.SCREEN_W, phone_model.SCREEN_H, phone_model.SCREEN_R, FRONT - 0.0015)
    screen.data.materials.append(screen_material())
    screen.parent = display
    island = phone_model.rounded_box("Island", 0.25, 0.072, 0.002, 0.036, bevel=0, center=(0, phone_model.SCREEN_H / 2 - 0.085, FRONT - 0.0003))
    island.data.materials.append(phone_mats["Island"])
    island.parent = display
    box("PanelFlex", (0.3, 0.06, 0.004), (0, -0.99, FRONT - 0.012), m["flex"], bevel=0.0015, parent=display)

    # Glass: a real, thin, clear cover glass.
    plate_box("Cover", 0.97, 2.03, 0.012, phone_model.CORNER - 0.015, (0, 0, FRONT + 0.004), cover_glass(), layers["glass"], bevel=0.004)
    return root, layers


def plate_box(name, width, height, depth, radius, center, mat, parent, bevel=0.0015):
    """Rounded-rectangle slab (the outline of the phone), from phone.py."""
    obj = phone_model.rounded_box(name, width, height, depth, radius, bevel=bevel, center=center)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


# ---------- studio ----------
def lights():
    center = Vector((0, 0, 0))
    softbox("Key", (3.6, 2.8), Vector((-3.4, -4.2, 4.2)), center, strength=7.5)
    softbox("Fill", (1.8, 3.2), Vector((3.8, -3.4, -0.4)), center, "#fff1e6", 2.4)
    # Lights the open layers from above without showing up as a white sheet on the glass.
    softbox("Top", (4.2, 2.4), Vector((0.4, 0.6, 5.2)), center, strength=4.5).visible_glossy = False
    softbox("RimLeft", (0.35, 5.0), Vector((-3.0, 2.0, 0.6)), center, "#ff5a1f", 20)
    softbox("RimRight", (0.35, 5.0), Vector((3.1, 2.1, 1.0)), center, "#ff8c4a", 13)
    softbox("Streak", (0.9, 14), Vector((-2.2, -6.0, 4.6)), center, strength=2.4, soft=True, spin=-35)
    # A warm bounce from below, like a lit table out of frame.
    softbox("Bounce", (4.0, 1.2), Vector((0.5, -2.5, -3.6)), center, "#ff9a5c", 1.4)


# ---------- animation ----------
def pose_at(t):
    k = smooth(0.0, 1.0, t)
    return {key: START[key] + (END[key] - START[key]) * k for key in START}


def place(root, layers, t):
    offsets = {}
    for name, distance, (a, b) in LAYERS:
        offsets[name] = distance * smooth(a, b, t)
        layers[name].location = (0, 0, offsets[name])
    pose = pose_at(t)
    rotation = pose_matrix(pose["yaw"], pose["pitch"], pose["roll"], (0, 0, 0), 1.0)
    # Keep the stack centered: shift back by half of the open depth.
    middle = (max(offsets.values()) + min(offsets.values())) / 2
    shift = rotation.to_3x3() @ Vector((0, 0, -middle))
    root.matrix_world = Matrix.Translation(shift) @ rotation


def studio_world(world):
    """Dark for light and shadows, but a soft grey studio in reflections (brighter above),
    so glass and metal reflect a room instead of black."""
    nodes, links = world.node_tree.nodes, world.node_tree.links
    background = nodes["Background"]
    coords = nodes.new("ShaderNodeTexCoord")
    split = nodes.new("ShaderNodeSeparateXYZ")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (*hex_rgb("#141210"), 1)
    ramp.color_ramp.elements[1].position = 0.85
    ramp.color_ramp.elements[1].color = (*hex_rgb("#8c8781"), 1)
    height = nodes.new("ShaderNodeMapRange")
    height.inputs["From Min"].default_value = -1
    height.inputs["From Max"].default_value = 1
    path = nodes.new("ShaderNodeLightPath")
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (*hex_rgb("#2a2622"), 1)
    links.new(coords.outputs["Generated"], split.inputs["Vector"])
    links.new(split.outputs["Z"], height.inputs["Value"])
    links.new(height.outputs["Result"], ramp.inputs["Fac"])
    links.new(path.outputs["Is Glossy Ray"], mix.inputs["Factor"])
    links.new(ramp.outputs["Color"], mix.inputs["B"])
    links.new(mix.outputs["Result"], background.inputs["Color"])
    strength = nodes.new("ShaderNodeMix")
    strength.data_type = "FLOAT"
    strength.inputs["A"].default_value = 0.25
    strength.inputs["B"].default_value = 0.9
    links.new(path.outputs["Is Glossy Ray"], strength.inputs["Factor"])
    links.new(strength.outputs["Result"], background.inputs["Strength"])


def setup(draft):
    scene = new_scene(WIDTH, HEIGHT, samples=32 if draft else 48)
    scene.render.resolution_percentage = 40 if draft else 100
    scene.render.film_transparent = True
    scene.cycles.film_transparent_glass = True
    scene.render.image_settings.color_mode = "RGBA"
    cycles = scene.cycles
    cycles.adaptive_threshold = 0.03 if draft else 0.012
    cycles.max_bounces = 8
    cycles.diffuse_bounces = 2
    cycles.glossy_bounces = 4
    cycles.transmission_bounces = 6
    cycles.caustics_reflective = False
    cycles.caustics_refractive = False
    cycles.blur_glossy = 0.5
    studio_world(scene.world)
    cam = camera(tuple(CAMERA), (0, 0, 0), lens=LENS)
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 9
    cam.data.dof.focus_distance = CAMERA.length
    root, layers = build_layers(internals_materials())
    lights()
    return scene, root, layers


def render_png(scene, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    return path


def webp(png, target, width, quality):
    os.makedirs(os.path.dirname(target), exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", png, "-vf", f"scale={width}:-1:flags=lanczos",
                    "-c:v", "libwebp", "-quality", str(quality), "-pix_fmt", "yuva420p", target], check=True)


def main():
    draft = "--draft" in sys.argv
    frames = list(range(FRAMES))
    if "--frames" in sys.argv:
        frames = [int(value) for value in sys.argv[sys.argv.index("--frames") + 1].split(",")]
    scene, root, layers = setup(draft)
    folder = os.path.join(OUT, "explode", "draft" if draft else "final")
    for index in frames:
        place(root, layers, index / (FRAMES - 1))
        png = os.path.join(folder, f"{index:02d}.png")
        if not (draft is False and os.path.exists(png) and "--force" not in sys.argv):
            render_png(scene, png)
        if not draft:
            webp(png, os.path.join(TARGET, "desk", f"{index:02d}.webp"), 1000, 80)
            webp(png, os.path.join(TARGET, "mob", f"{index:02d}.webp"), 600, 74)
        print(f"frame {index}", flush=True)


if __name__ == "__main__":
    main()
