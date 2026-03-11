# app/core/commands.py
from dataclasses import dataclass
from pygame.math import Vector2
from model.scene import Scene, Node

class Command:
    def do(self, scene: Scene): ...
    def undo(self, scene: Scene): ...

@dataclass
class AddNode(Command):
    pos: Vector2
    name: str
    radius: int = 100

    def do(self, scene: Scene):
        scene.nodes.append(Node(pos=self.pos, name=self.name, radius=self.radius))

@dataclass
class MoveNode(Command):
    idx: int
    new_pos: Vector2
    _prev_pos: Vector2 | None = None

    def do(self, scene: Scene):
        self._prev_pos = scene.nodes[self.idx].pos
        scene.nodes[self.idx].pos = self.new_pos

    def undo(self, scene: Scene):
        if self._prev_pos is not None:
            scene.nodes[self.idx].pos = self._prev_pos

@dataclass
class RenameNode(Command):
    idx: int
    new_name: str
    _prev_name: str | None = None

    def do(self, scene: Scene):
        self._prev_name = scene.nodes[self.idx].name
        scene.nodes[self.idx].name = self.new_name

    def undo(self, scene: Scene):
        if self._prev_name is not None:
            scene.nodes[self.idx].name = self._prev_name
