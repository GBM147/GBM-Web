"""Modela o celular da GBM Web no Blender (por código) e exporta para o site.

Uso:
  /caminho/do/venv/bin/python art/phone.py  -> public/assets/3d/phone.glb
  (art/video_shots.py reaproveita build() para as cenas do vídeo)

O modelo é próprio (sem copiar aparelhos de marcas). Cada peça tem um nome
(Frame, Glass, Screen, Island, Back, Plateau, LensGlass, LensRing, Flash,
Buttons, Port, Speaker) para o site aplicar os materiais e trocar a imagem da
tela. Medidas em unidades do site: altura 2.06, largura 1, espessura 0.105.
"""
import math
import os

import bpy  # noqa: I001  (bpy must come first: it makes bmesh and mathutils importable)
import bmesh
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WIDTH, HEIGHT, DEPTH = 1.0, 2.06, 0.105
CORNER = 0.15
SCREEN_W, SCREEN_H, SCREEN_R = 0.93, 1.99, 0.125


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def new_object(name, mesh):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def rounded_rect(bm, width, height, radius, segments=12, z=0.0):
    """Adds a flat rounded rectangle (facing +Z) and returns its face."""
    points = []
    corners = [(width / 2 - radius, height / 2 - radius, 0), (-width / 2 + radius, height / 2 - radius, 90),
               (-width / 2 + radius, -height / 2 + radius, 180), (width / 2 - radius, -height / 2 + radius, 270)]
    for cx, cy, start in corners:
        for step in range(segments + 1):
            angle = math.radians(start + 90 * step / segments)
            points.append(bm.verts.new((cx + radius * math.cos(angle), cy + radius * math.sin(angle), z)))
    return bm.faces.new(points)


def planar_uv(bm, width, height, flip_x=False):
    """UVs from 0 to 1 across the rectangle, so textures fill it."""
    uv = bm.loops.layers.uv.verify()
    for face in bm.faces:
        for loop in face.loops:
            x, y = loop.vert.co.x, loop.vert.co.y
            u = (x + width / 2) / width
            loop[uv].uv = ((1 - u) if flip_x else u, (y + height / 2) / height)


def plate(name, width, height, radius, z, flip=False, uv=True):
    bm = bmesh.new()
    face = rounded_rect(bm, width, height, radius, segments=14, z=z)
    if flip:
        face.normal_flip()
    if uv:
        planar_uv(bm, width, height, flip_x=flip)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return new_object(name, mesh)


def body():
    """Frame: rounded slab with softened front and back edges."""
    bm = bmesh.new()
    face = rounded_rect(bm, WIDTH, HEIGHT, CORNER, segments=16, z=-DEPTH / 2)
    face.normal_flip()
    extruded = bmesh.ops.extrude_face_region(bm, geom=[face])
    top = [element for element in extruded["geom"] if isinstance(element, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=Vector((0, 0, DEPTH)), verts=top)
    bm.normal_update()
    # Soften the rim where the frame meets front and back glass.
    rim = [edge for edge in bm.edges if abs(abs(edge.verts[0].co.z) - DEPTH / 2) < 1e-6 and abs(abs(edge.verts[1].co.z) - DEPTH / 2) < 1e-6 and len(edge.link_faces) == 2]
    rim = [edge for edge in rim if any(abs(face.normal.z) < 0.5 for face in edge.link_faces)]
    bmesh.ops.bevel(bm, geom=rim, offset=0.022, segments=5, profile=0.5, affect="EDGES")
    uv = bm.loops.layers.uv.verify()
    for face in bm.faces:
        for loop in face.loops:
            co = loop.vert.co
            loop[uv].uv = ((math.atan2(co.y, co.x) / (2 * math.pi)) % 1, (co.z + DEPTH / 2) / DEPTH)
    mesh = bpy.data.meshes.new("Frame")
    bm.to_mesh(mesh)
    bm.free()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return new_object("Frame", mesh)


def rounded_box(name, width, height, depth, radius, bevel=0.006, center=(0, 0, 0)):
    bm = bmesh.new()
    face = rounded_rect(bm, width, height, radius, segments=10, z=-depth / 2)
    face.normal_flip()
    extruded = bmesh.ops.extrude_face_region(bm, geom=[face])
    top = [element for element in extruded["geom"] if isinstance(element, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=Vector((0, 0, depth)), verts=top)
    bm.normal_update()
    edges = [edge for edge in bm.edges if len(edge.link_faces) == 2 and any(abs(face.normal.z) > 0.9 for face in edge.link_faces) and any(abs(face.normal.z) < 0.5 for face in edge.link_faces)]
    if bevel:
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=3, profile=0.5, affect="EDGES")
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return new_object(name, mesh)


def cylinder(name, radius, depth, center, segments=40, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=depth)
    if bevel:
        caps = [edge for edge in bm.edges if len(edge.link_faces) == 2 and any(abs(face.normal.z) > 0.9 for face in edge.link_faces)]
        bmesh.ops.bevel(bm, geom=caps, offset=bevel, segments=3, profile=0.5, affect="EDGES")
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return new_object(name, mesh)


def join(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = name
    objects[0].data.name = name
    return objects[0]


def build(fresh=True):
    """Builds the phone under an empty named Phone; fresh=False keeps the current scene."""
    if fresh:
        reset()
    parts = [body()]
    front = DEPTH / 2
    back = -DEPTH / 2
    # Front: black glass edge to edge, the display on top and the camera island.
    parts.append(plate("Glass", WIDTH - 0.03, HEIGHT - 0.03, CORNER - 0.015, front + 0.0008, uv=False))
    parts.append(plate("Screen", SCREEN_W, SCREEN_H, SCREEN_R, front + 0.0016))
    island = rounded_box("Island", 0.25, 0.072, 0.002, 0.036, bevel=0, center=(0, SCREEN_H / 2 - 0.085, front + 0.0026))
    parts.append(island)
    # Back: frosted glass panel and the camera plateau with three lenses and a flash.
    parts.append(plate("Back", WIDTH - 0.03, HEIGHT - 0.03, CORNER - 0.015, back - 0.0008, flip=True))
    plateau_center = (0.215, HEIGHT / 2 - 0.255, back - 0.012)
    parts.append(rounded_box("Plateau", 0.42, 0.42, 0.024, 0.11, bevel=0.008, center=plateau_center))
    rings, glasses = [], []
    for dx, dy, radius in [(-0.075, 0.075, 0.075), (-0.075, -0.085, 0.075), (0.085, -0.005, 0.075)]:
        cx, cy = plateau_center[0] + dx, plateau_center[1] + dy
        rings.append(cylinder("LensRing", radius, 0.03, (cx, cy, back - 0.033), bevel=0.006))
        glasses.append(cylinder("LensGlass", radius * 0.72, 0.004, (cx, cy, back - 0.0485)))
    parts.append(join(rings, "LensRing"))
    parts.append(join(glasses, "LensGlass"))
    parts.append(cylinder("Flash", 0.03, 0.004, (plateau_center[0] + 0.1, plateau_center[1] + 0.12, back - 0.0245)))
    # Side buttons (volume on the left, power on the right) and the bottom details.
    buttons = [
        rounded_box("Button", 0.022, 0.16, 0.05, 0.01, bevel=0.004, center=(-WIDTH / 2 - 0.006, 0.5, 0)),
        rounded_box("Button", 0.022, 0.16, 0.05, 0.01, bevel=0.004, center=(-WIDTH / 2 - 0.006, 0.3, 0)),
        rounded_box("Button", 0.022, 0.24, 0.05, 0.01, bevel=0.004, center=(WIDTH / 2 + 0.006, 0.38, 0)),
    ]
    parts.append(join(buttons, "Buttons"))
    # Port and speaker holes face the bottom edge: built at the origin, turned and then moved.
    face_down = Matrix.Rotation(math.radians(90), 4, "X")
    port = rounded_box("Port", 0.13, 0.026, 0.05, 0.012, bevel=0)
    place(port, face_down, (0, -HEIGHT / 2 + 0.008, 0))
    parts.append(port)
    holes = []
    for x in [-0.32, -0.29, -0.26, -0.23, 0.23, 0.26, 0.29, 0.32]:
        hole = cylinder("Speaker", 0.0085, 0.05, (0, 0, 0), segments=16)
        place(hole, face_down, (x, -HEIGHT / 2 + 0.004, 0))
        holes.append(hole)
    parts.append(join(holes, "Speaker"))
    phone = bpy.data.objects.new("Phone", None)
    bpy.context.scene.collection.objects.link(phone)
    for part in parts:
        part.parent = phone
    return phone


def place(obj, rotation, location):
    obj.data.transform(rotation)
    obj.data.transform(Matrix.Translation(Vector(location)))


def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=False, export_texcoords=True, export_normals=True, export_materials="NONE")


if __name__ == "__main__":
    build()
    target = os.path.join(ROOT, "public", "assets", "3d", "phone.glb")
    export(target)
    print(f"{target}: {os.path.getsize(target) // 1024} KB")
