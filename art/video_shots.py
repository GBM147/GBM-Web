"""Cenas do vídeo de apresentação com o celular realista (Blender + Cycles).

Uso (com o Python que tem o bpy, veja art/requirements.txt):
  node art/textures.mjs                      -> logo da traseira em art/out/textures/
  python art/video_shots.py                  -> video/shots/ (imagens, quadros do giro e shots.json)
  python art/video_shots.py --draft          -> prévias rápidas em art/out/video/ (1/4 do tamanho)
  python art/video_shots.py --only site,back -> só algumas cenas

Cenas, no tamanho do palco do vídeo (1080x1920):
  spin  o celular entra girando, de costas para a frente, com a tela apagada (36 quadros)
  site  o celular de frente, com a tela vazada: o video/stage.html encaixa o site rolando atrás
  chat  o celular grande, saindo pela borda de baixo, com a conversa do WhatsApp na tela
  back  o celular de costas com o logo, para a cena final
Em "site" e "chat" sai também um reflexo da tela (-glare) e os cantos da tela vão para
shots.json, para o palco encaixar o conteúdo com matrix3d.
"""
import json
import math
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402,I001  (bpy first: it makes bmesh and mathutils importable)
from bpy_extras.object_utils import world_to_camera_view  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

import phone as phone_model  # noqa: E402
from studio import OUT, ROOT, camera, hex_rgb, material, new_scene  # noqa: E402

WIDTH, HEIGHT = 1080, 1920
SHOTS = os.path.join(ROOT, "video", "shots")
TEXTURES = os.path.join(OUT, "textures")
CAMERA = Vector((0.0, -8.65, 0.0))
LENS = 85
SPIN_FRAMES = 36
FRONT = phone_model.DEPTH / 2 + 0.0016  # height of the Screen plate
BLEED = 0.004  # the site goes this far under the bezel, so no seam shows

POSES = {
    "site": dict(yaw=-20, pitch=-5, roll=-3, location=(0.0, 0.0, -0.36), scale=1.0),
    "spin_start": dict(yaw=160, pitch=-16, roll=9, location=(0.0, 0.0, -0.36), scale=1.0),
    "chat": dict(yaw=-9, pitch=-4, roll=2, location=(0.0, 0.0, -0.98), scale=1.64),
    "back": dict(yaw=205, pitch=-7, roll=-12, location=(0.36, 0.0, -1.33), scale=0.8),
}


def pose_matrix(yaw, pitch, roll, location, scale):
    """Phone standing up and facing the camera, then rolled, tilted back and turned."""
    rotation = (Matrix.Rotation(math.radians(yaw), 4, "Z") @ Matrix.Rotation(math.radians(pitch), 4, "X")
                @ Matrix.Rotation(math.radians(roll), 4, "Y") @ Matrix.Rotation(math.radians(90), 4, "X"))
    return Matrix.Translation(Vector(location)) @ rotation @ Matrix.Scale(scale, 4)


def blend(start, end, k):
    pose = {}
    for key, value in start.items():
        if isinstance(value, tuple):
            pose[key] = tuple(a + (b - a) * k for a, b in zip(value, end[key]))
        else:
            pose[key] = value + (end[key] - value) * k
    return pose


def apply_pose(phone, pose):
    location, rotation, scale = pose_matrix(**pose).decompose()
    phone.location = location
    phone.rotation_quaternion = rotation
    phone.scale = scale


# ---------- materials ----------
def holdout(name="Holdout"):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    mat.node_tree.links.new(nodes.new("ShaderNodeHoldout").outputs[0], output.inputs["Surface"])
    return mat


def back_glass():
    """Frosted dark glass with the GBM logo glossy, from art/textures.mjs."""
    mat = material("BackGlass", "#24221f", roughness=0.42, metallic=0.15, Coat_Weight=0.7, Coat_Roughness=0.3)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    color = nodes.new("ShaderNodeTexImage")
    color.image = bpy.data.images.load(os.path.join(TEXTURES, "back.png"))
    mask = nodes.new("ShaderNodeTexImage")
    mask.image = bpy.data.images.load(os.path.join(TEXTURES, "back-mask.png"))
    mask.image.colorspace_settings.name = "Non-Color"
    links.new(color.outputs["Color"], bsdf.inputs["Base Color"])
    for socket, frosted, glossy in [("Roughness", 0.42, 0.08), ("Coat Roughness", 0.3, 0.03)]:
        ramp = nodes.new("ShaderNodeMapRange")
        ramp.inputs["To Min"].default_value = frosted
        ramp.inputs["To Max"].default_value = glossy
        links.new(mask.outputs["Color"], ramp.inputs["Value"])
        links.new(ramp.outputs["Result"], bsdf.inputs[socket])
    return mat


def phone_materials():
    metal = material("Titanium", "#5b5953", roughness=0.28, metallic=1.0, Anisotropic=0.6, Coat_Weight=0.35, Coat_Roughness=0.2)
    hole = material("Hole", "#050505", roughness=0.6)
    return {
        "Frame": metal,
        "Buttons": metal,
        "Glass": material("BlackGlass", "#050505", roughness=0.05, Coat_Weight=1.0, Coat_Roughness=0.02),
        "Screen": material("ScreenOff", "#020203", roughness=0.035, Coat_Weight=1.0, Coat_Roughness=0.02),
        "Island": material("Island", "#010101", roughness=0.25),
        "Back": back_glass(),
        "Plateau": material("Plateau", "#22211e", roughness=0.2, metallic=0.3, Coat_Weight=1.0, Coat_Roughness=0.05),
        "LensRing": material("LensRing", "#3b3a36", roughness=0.22, metallic=1.0),
        "LensGlass": material("LensGlass", "#090c13", roughness=0.02, Coat_Weight=1.0, Thin_Film_Thickness=380, Thin_Film_IOR=1.6),
        "Flash": material("Flash", "#efe3c6", roughness=0.3),
        "Port": hole,
        "Speaker": hole,
    }


def dress(phone, materials, overrides=None):
    for part in phone.children:
        mat = (overrides or {}).get(part.name, materials[part.name])
        part.data.materials.clear()
        part.data.materials.append(mat)


# ---------- studio ----------
def softbox(name, size, location, target, color="#ffffff", strength=5.0, soft=False, spin=0.0):
    """Light panel seen only in reflections and as light (never by the camera)."""
    width, height = size
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(-width / 2, -height / 2, 0), (width / 2, -height / 2, 0), (width / 2, height / 2, 0), (-width / 2, height / 2, 0)], [], [(0, 1, 2, 3)])
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    facing = (Vector(target) - Vector(location)).to_track_quat("Z", "Y")
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = facing @ Quaternion((0, 0, 1), math.radians(spin))
    mat = bpy.data.materials.new(f"{name}Light")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (*hex_rgb(color), 1)
    emission.inputs["Strength"].default_value = strength
    if soft:
        # Bright in the middle, fading to nothing at the long edges: a soft streak.
        coords = nodes.new("ShaderNodeTexCoord")
        split = nodes.new("ShaderNodeSeparateXYZ")
        ramp = nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.interpolation = "EASE"
        ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
        ramp.color_ramp.elements[1].position = 0.5
        ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
        ramp.color_ramp.elements.new(1.0).color = (0, 0, 0, 1)
        multiply = nodes.new("ShaderNodeMath")
        multiply.operation = "MULTIPLY"
        multiply.inputs[1].default_value = strength
        links.new(coords.outputs["Generated"], split.inputs["Vector"])
        links.new(split.outputs["X"], ramp.inputs["Fac"])
        links.new(ramp.outputs["Color"], multiply.inputs[0])
        links.new(multiply.outputs["Value"], emission.inputs["Strength"])
    links.new(emission.outputs["Emission"], output.inputs["Surface"])
    mesh.materials.append(mat)
    obj.visible_camera = False
    obj.visible_shadow = False
    return obj


def studio(pose, facing=1):
    """Black studio: white key and fill, GBM orange strips behind, a soft streak for the glass."""
    center = Vector(pose["location"])
    scale = pose["scale"]
    at = lambda x, y, z: center + Vector((x, y, z)) * scale  # noqa: E731
    lights = [
        softbox("Key", (3.0 * scale, 2.2 * scale), at(-3.2, -1.4, 2.8), center, strength=9),
        softbox("Fill", (1.6 * scale, 3.0 * scale), at(3.0, -2.2, -0.3), center, "#fff1e6", 2.5),
        softbox("RimLeft", (0.3 * scale, 4.5 * scale), at(-2.2, 1.4, 0.4), center, "#ff5a1f", 40),
        softbox("RimRight", (0.3 * scale, 4.5 * scale), at(2.4, 1.6, 0.8), center, "#ff8c4a", 25),
        softbox("Top", (3.2 * scale, 0.3 * scale), at(0, 0.4, 3.2), center, strength=14),
    ]
    # The streak sits where the glass reflects, so it crosses the upper left of the screen.
    matrix = pose_matrix(**pose)
    normal = (matrix.to_3x3() @ Vector((0, 0, facing))).normalized()
    middle = matrix @ Vector((0, 0, FRONT * facing))
    view = (middle - CAMERA).normalized()
    reflected = view - 2 * view.dot(normal) * normal
    side = reflected.cross(Vector((0, 0, 1))).normalized()
    up = side.cross(reflected).normalized()
    spot = middle + reflected * 7 * scale + (side * 0.45 + up * 0.75) * scale
    lights.append(softbox("Streak", (0.8 * scale, 16 * scale), spot, middle, strength=3.5, soft=True, spin=-38))
    return lights



# ---------- scene ----------
def setup(pose, draft, facing=1):
    scene = new_scene(WIDTH, HEIGHT, samples=24 if draft else 160)
    scene.render.resolution_percentage = 25 if draft else 100
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = "RGBA"
    cycles = scene.cycles
    cycles.adaptive_threshold = 0.02 if draft else 0.01
    cycles.max_bounces = 6
    cycles.diffuse_bounces = 2
    cycles.glossy_bounces = 4
    cycles.transmission_bounces = 2
    cycles.caustics_reflective = False
    cycles.caustics_refractive = False
    cycles.blur_glossy = 0.5
    background = scene.world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (0, 0, 0, 1)
    background.inputs["Strength"].default_value = 0
    camera(tuple(CAMERA), (0, 0, 0), lens=LENS)
    phone = phone_model.build(fresh=False)
    phone.rotation_mode = "QUATERNION"
    apply_pose(phone, pose)
    materials = phone_materials()
    dress(phone, materials)
    studio(pose, facing)
    return scene, phone, materials


def render(scene, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    return path


def webp(png, target, quality=90):
    os.makedirs(os.path.dirname(target), exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", png, "-c:v", "libwebp", "-quality", str(quality), "-pix_fmt", "yuva420p", target], check=True)
    return target


def screen_corners(scene, pose):
    """Screen corners on the 1080x1920 stage: top left, top right, bottom right, bottom left."""
    matrix = pose_matrix(**pose)
    half_w = phone_model.SCREEN_W / 2 + BLEED
    half_h = phone_model.SCREEN_H / 2 + BLEED
    corners = []
    for x, y in [(-half_w, half_h), (half_w, half_h), (half_w, -half_h), (-half_w, -half_h)]:
        point = world_to_camera_view(scene, scene.camera, matrix @ Vector((x, y, FRONT)))
        corners.append([round(point.x * WIDTH, 2), round((1 - point.y) * HEIGHT, 2)])
    return corners


def glass_pass(scene, phone, materials):
    """Only the screen glass with its reflections, transparent elsewhere (the stage adds it with
    mix-blend-mode: screen, which needs the alpha: the phone layers form an isolated group)."""
    hidden = holdout("Hidden")
    dress(phone, materials, {name: hidden for name in materials if name != "Screen"})


# ---------- shots ----------
def shot_screen(name, draft, folder, layout):
    pose = POSES[name]
    scene, phone, materials = setup(pose, draft)
    dress(phone, materials, {"Screen": holdout()})
    base = render(scene, os.path.join(folder, f"{name}.png"))
    glass_pass(scene, phone, materials)
    glare = render(scene, os.path.join(folder, f"{name}-glare.png"))
    layout[name] = {
        "screen": screen_corners(scene, pose),
        "radius": round((phone_model.SCREEN_R + BLEED) / (phone_model.SCREEN_W + 2 * BLEED), 4),
        "aspect": round((phone_model.SCREEN_W + 2 * BLEED) / (phone_model.SCREEN_H + 2 * BLEED), 5),
    }
    if not draft:
        webp(base, os.path.join(SHOTS, f"{name}.webp"))
        webp(glare, os.path.join(SHOTS, f"{name}-glare.webp"))


def shot_back(draft, folder):
    scene, _, _ = setup(POSES["back"], draft, facing=-1)
    png = render(scene, os.path.join(folder, "back.png"))
    if not draft:
        webp(png, os.path.join(SHOTS, "back.webp"))


def shot_spin(draft, folder):
    """Back to front in 36 frames, easing into the exact "site" pose, with motion blur."""
    scene, phone, _ = setup(POSES["site"], draft)
    scene.cycles.samples = 24 if draft else 64
    scene.render.use_motion_blur = True
    scene.render.motion_blur_shutter = 0.5
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    previous = None
    for index in range(SPIN_FRAMES):
        progress = index / (SPIN_FRAMES - 1)
        eased = 1 - (1 - progress) ** 3
        apply_pose(phone, blend(POSES["spin_start"], POSES["site"], eased))
        if previous is not None:
            phone.rotation_quaternion.make_compatible(previous)
        previous = phone.rotation_quaternion.copy()
        for path in ("location", "rotation_quaternion", "scale"):
            phone.keyframe_insert(path, frame=index + 1)
    frames = [1, 9, 18, 27, 36] if draft else range(1, SPIN_FRAMES + 1)
    for frame in frames:
        scene.frame_set(frame)
        png = render(scene, os.path.join(folder, "spin", f"{frame:02d}.png"))
        if not draft:
            webp(png, os.path.join(SHOTS, "spin", f"{frame:02d}.webp"), quality=86)


def main():
    draft = "--draft" in sys.argv
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else ["site", "chat", "back", "spin"]
    folder = os.path.join(OUT, "video", "draft" if draft else "final")
    layout_file = os.path.join(SHOTS, "shots.json")
    layout = json.load(open(layout_file)) if os.path.exists(layout_file) else {}
    for name in only:
        if name in ("site", "chat"):
            shot_screen(name, draft, folder, layout)
        elif name == "back":
            shot_back(draft, folder)
        elif name == "spin":
            shot_spin(draft, folder)
    if not draft:
        os.makedirs(SHOTS, exist_ok=True)
        with open(layout_file, "w") as handle:
            json.dump(layout, handle, indent=2)
    else:
        print(json.dumps(layout))
    print(f"ok: {', '.join(only)} -> {SHOTS if not draft else folder}")


if __name__ == "__main__":
    main()
