# app/core/camera.py
from pygame.math import Vector2

class Camera:
    def __init__(self):
        self.offset = Vector2(0, 0)

    def world_to_screen(self, pos: Vector2) -> tuple[int, int]:
        p = pos + self.offset
        return int(p.x), int(p.y)

    def screen_to_world(self, x: int, y: int) -> Vector2:
        return Vector2(x, y) - self.offset
