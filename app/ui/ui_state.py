# app/ui/ui_state.py
from dataclasses import dataclass
from enum import Enum, auto
from pygame.math import Vector2

class Mode(Enum):
    IDLE = auto()
    DRAG_NODE = auto()
    DRAG_LISTENER = auto()
    PAN = auto()
    SCALE_NODE = auto()
    NAME_NODE = auto()

@dataclass
class UIState:
    mode: Mode = Mode.IDLE
    selected_node_idx: int | None = None
    naming_buffer: str = ""
    caret_timer: float = 0.0
    caret_visible: bool = True
    mouse_last: Vector2 = Vector2(0, 0)