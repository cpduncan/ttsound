# app/model/scene.py
from dataclasses import dataclass, field
from pygame.math import Vector2

DEFAULT_NODE_RADIUS = 100

@dataclass
class Node:
    pos: Vector2
    name: str = "Node"
    radius: int = DEFAULT_NODE_RADIUS
    playlist_files: list[str] = field(default_factory=list)

@dataclass
class Listener:
    pos: Vector2
    name: str = "Listener"

@dataclass
class Scene:
    nodes: list[Node]
    listener: Listener