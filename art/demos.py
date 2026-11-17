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
    return material("Steel", "#d9dcdf", roughness=0.12, metallic=1.0)


def razor_and_tools():
    """Época Barbearia: straight razor, scissors and comb on dark slate, copper rim light."""
    floor(textured("Slate", ["#111213", "#1b1c1d", "#262626", "#141414"], scale=22, roughness=(0.55, 0.9), bump=0.5))
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
    tortoise = textured("Tortoise", ["#2a140a", "#6b3a1c", "#b7783f", "#3a1d0e"], scale=22, roughness=(0.15, 0.25), bump=0.01)
    spine = rounded_box("CombSpine", (0.15, 0.012, 0.004), location=(-0.06, -0.075, 0.002), bevel=0.0018)
    assign(spine, tortoise)
    tooth = rounded_box("CombTooth", (0.0016, 0.022, 0.0032), location=(0, 0, 0), bevel=0.0006)
    assign(tooth, tortoise)
    scatter(tooth, 44, lambda i: ((-0.13 + i * 0.0032, -0.092, 0.0017), (0, 0, 0), (1, 1, 1)))
    bpy_delete(tooth)
    area_light("Key", (-0.35, 0.25, 0.55), (0, 0, 0), 9, size=(0.6, 0.4), color="#ffe7d2")
    area_light("Copper", (0.4, -0.35, 0.12), (0, 0, 0.01), 16, size=(0.12, 0.5), color="#e07a3c")
    area_light("Fill", (0.1, 0.5, 0.3), (0, 0, 0), 1.2, size=(0.8, 0.8), color="#fff3e6")
    camera((0.0, -0.3, 0.44), (0.0, -0.01, 0.0), lens=52, aperture=3.2)


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
    tomato = material("Tomato", "#b4231a", roughness=0.25, Subsurface_Weight=0.3, Coat_Weight=0.4)
    cheese = material("Mozzarella", "#f4f1e8", roughness=0.45, Subsurface_Weight=0.5)
    basil = material("Basil", "#2f6b2a", roughness=0.3, Coat_Weight=0.5)
    random.seed(3)
    for index in range(10):
        angle = index / 10 * math.tau
        radius = 0.058
        x, y = radius * math.cos(angle), radius * math.sin(angle)
        slice_ = cylinder("Slice", 0.027 if index % 2 else 0.029, 0.006, location=(x, y, 0.0145 + index * 0.0007), rotation=(0.08 * math.sin(angle), 0.08 * math.cos(angle), 0), bevel=0.0015)
        assign(slice_, tomato if index % 2 else cheese)
    for index in range(7):
        angle = random.random() * math.tau
        radius = 0.03 + random.random() * 0.045
        leaf = sphere("Basil", 0.012, scale=(1.9, 0.9, 0.12), location=(radius * math.cos(angle), radius * math.sin(angle), 0.024 + random.random() * 0.004))
        leaf.rotation_euler = (random.uniform(-0.25, 0.25), random.uniform(-0.25, 0.25), random.random() * math.tau)
        assign(leaf, basil)
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
    area_light("Window", (-0.7, 0.2, 0.6), (0, 0, 0), 26, size=(0.9, 1.3), color="#fff3e2")
    area_light("Fill", (0.6, -0.4, 0.8), (0, 0, 0), 3, size=(1.0, 1.0), color="#fff8ef")
    camera((0.02, -0.09, 0.62), (0.02, 0.02, 0.0), lens=42, aperture=5.6)


def pet_still_life():
    """Pata Club: lilac ceramic bowl with kibble, bone treats, a ball and a collar on a soft lavender sweep."""
    sweep(textured("Lavender", ["#e6dcf6", "#ece4f8", "#e1d5f3"], scale=4, roughness=(0.85, 0.95), bump=0.02), width=3, depth=2, height=2, radius=0.5)
    glaze = material("Glaze", "#8d55c8", roughness=0.12, Coat_Weight=1.0, Coat_Roughness=0.03)
    bowl = lathe("Bowl", [(0.0, 0.0), (0.075, 0.0), (0.08, 0.004), (0.095, 0.05), (0.096, 0.056), (0.09, 0.057), (0.08, 0.01), (0.0, 0.01)])
    bowl.location = (-0.03, 0.05, 0.0)
    assign(bowl, glaze)
    kibble_material = textured("Kibble", ["#5a3519", "#8a5a34", "#a8743f"], scale=60, roughness=(0.55, 0.8), bump=0.4)
    kibble = sphere("Kibble", 0.0075, scale=(1.0, 0.85, 0.7), segments=20)
    assign(kibble, kibble_material)
    random.seed(11)

    def place(index):
        angle = random.random() * math.tau
        radius = math.sqrt(random.random()) * 0.072
        height = 0.012 + (1 - (radius / 0.075) ** 2) * 0.03 + random.random() * 0.006
        return ((bowl.location.x + radius * math.cos(angle), bowl.location.y + radius * math.sin(angle), height),
                (random.random() * math.tau, random.random() * math.tau, random.random() * math.tau), (1, 1, 1))
    scatter(kibble, 260, place)
    bpy_delete(kibble)
    treat = textured("Treat", ["#c99a62", "#dcb47c", "#b9844f"], scale=40, roughness=(0.6, 0.85), bump=0.5)
    for index, (x, y, angle) in enumerate([(0.11, -0.05, 0.4), (0.075, -0.1, -0.5), (0.15, 0.0, 1.2)]):
        parts = [cylinder("Bone", 0.0085, 0.06, location=(0, 0, 0), rotation=(0, math.pi / 2, 0))]
        for dx in (-0.031, 0.031):
            for dy in (-0.0075, 0.0075):
                parts.append(sphere("BoneEnd", 0.0105, location=(dx, dy, 0)))
        for part in parts:
            assign(part, treat)
            px, py = part.location.x, part.location.y
            part.location = (x + px * math.cos(angle) - py * math.sin(angle), y + px * math.sin(angle) + py * math.cos(angle), 0.0105)
            part.rotation_euler.z += angle
    ball = sphere("Ball", 0.034, location=(-0.13, -0.07, 0.034))
    assign(ball, material("Felt", "#ffcf0a", roughness=0.75, Sheen_Weight=0.25, Sheen_Roughness=0.5))
    seam = torus("Seam", 0.0345, 0.0021, location=ball.location, rotation=(math.radians(60), math.radians(35), 0))
    assign(seam, material("SeamWhite", "#fbf7ef", roughness=0.7))
    collar = torus("Collar", 0.05, 0.008, location=(0.07, -0.085, 0.0035), scale=(1, 1, 0.42))
    assign(collar, material("Strap", "#f6cc62", roughness=0.45, Coat_Weight=0.3))
    gold = material("Gold", "#d9b14a", roughness=0.18, metallic=1.0)
    ring = torus("DRing", 0.008, 0.0016, location=(0.07, -0.138, 0.006), rotation=(math.radians(80), 0, 0))
    assign(ring, gold)
    tag = cylinder("Tag", 0.014, 0.0022, location=(0.07, -0.156, 0.0014), bevel=0.0008)
    assign(tag, gold)
    area_light("Key", (-0.4, -0.3, 0.6), (0, 0, 0), 11, size=(0.7, 0.7), color="#fff1e6")
    area_light("Lilac", (0.5, -0.1, 0.25), (0, 0, 0.02), 6, size=(0.5, 0.8), color="#b48ae6")
    area_light("Back", (0.0, 0.6, 0.5), (0, 0, 0), 4, size=(1.0, 0.4), color="#ffffff")
    camera((0.0, -0.5, 0.36), (0.0, 0.02, 0.02), lens=56, aperture=4.0)


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
