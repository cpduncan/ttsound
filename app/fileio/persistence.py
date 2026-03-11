# app/fileio/persistence.py
import json
from typing import Tuple
from pygame.math import Vector2
from model.dto import SceneDTO
from model.scene import Scene, Node, Listener, DEFAULT_NODE_RADIUS

def save_scene_to_path(path: str, scene: Scene, camera_offset: tuple[float, float], version: int = 1) -> None:
    dto = SceneDTO(
        version=version,
        camera_offset=camera_offset,
        listener=(float(scene.listener.pos.x), float(scene.listener.pos.y)),
        nodes=[
            {
                "x": float(n.pos.x),
                "y": float(n.pos.y),
                "name": n.name,
                "radius": int(n.radius),
                "playlist": list(n.playlist_files),
            }
            for n in scene.nodes
        ],
    )
    with open(path, "w", encoding="utf-8") as f:
        json.dump(dto.__dict__, f, indent=4)

def load_scene_from_path(path: str) -> Tuple[Scene, tuple[float, float]]:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    # Basic migration guard
    version = raw.get("version", 1)
    if version != 1:
        # You can add migrations here in the future
        pass

    cam_off = raw.get("camera_offset", (0.0, 0.0))
    listener_xy = raw.get("listener", (0.0, 0.0))
    nodes_raw = raw.get("nodes", [])

    scene = Scene(
        nodes=[
            Node(
                pos=Vector2(float(n.get("x", 0.0)), float(n.get("y", 0.0))),
                name=n.get("name", "Node"),
                radius=int(n.get("radius", DEFAULT_NODE_RADIUS)),
                playlist_files=list(n.get("playlist", [])),
            )
            for n in nodes_raw
        ],
        listener=Listener(pos=Vector2(float(listener_xy[0]), float(listener_xy[1])), name="Listener")
    )
    return scene, (float(cam_off[0]), float(cam_off[1]))
