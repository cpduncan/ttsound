# app/app.py
import sys
import pygame
from pygame.math import Vector2
from pygame import mixer

from core.camera import Camera
from model.scene import Scene, Node, Listener
from ui.ui_state import UIState, Mode
from ui.render import render
from ui.widgets import Button
from systems.update_system import update
from audio.pygame_engine import PygameAudio
from fileio.persistence import save_scene_to_path, load_scene_from_path
from fileio.dialogs import pick_audio_files, pick_save_scene_path, pick_load_scene_path

WIDTH, HEIGHT = 192 * 4, 108 * 4
FPS = 60

pygame.init()
mixer.init()

try:
    FONT = pygame.font.Font("rec/JMH Typewriter-Bold.ttf", 16)
except pygame.error:
    FONT = pygame.font.Font(None, 16)

WHITE = (255, 255, 255)
RED = (255, 50, 50)

screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE)
pygame.display.set_caption("ttsound")
clock = pygame.time.Clock()


class AppState:
    def __init__(self):
        self.scene = Scene(
            nodes=[],
            listener=Listener(pos=Vector2(WIDTH // 2, HEIGHT // 2), name="Listener")
        )
        self.camera = Camera()
        self.ui = UIState()
        self.tabs, self.subbuttons = self._create_tabs()
        self.editing_node_idx: int | None = None  # For context menu actions
        self.audio = PygameAudio()  # IAudioEngine implementation

    def _create_tabs(self):
        tabs = []
        subbuttons = []

        def show(actions):
            subbuttons.clear()
            y0 = 40
            for i, (label, cb, blocks_drag) in enumerate(actions):
                subbuttons.append(Button(5, y0 + i * 35, 140, 30, label, cb, blocks_drag))

        node_tab_actions = [
            ("New Node", lambda: add_new_node(self), False),
        ]
        scene_tab_actions = [
            ("New Scene", lambda: new_scene(self), True),
            ("Save Scene", lambda: save_scene(self), True),
            ("Load Scene", lambda: load_scene(self), True),
        ]

        x = 5
        tabs.append(Button(x, 5, 80, 30, "Node", lambda: show(node_tab_actions))); x += 79
        tabs.append(Button(x, 5, 80, 30, "Scene", lambda: show(scene_tab_actions))); x += 79

        return tabs, subbuttons


# ---------- Button Callbacks ----------
def add_new_node(state: AppState):
    mx, my = pygame.mouse.get_pos()
    world = state.camera.screen_to_world(mx, my)
    state.scene.nodes.append(Node(pos=world, name=f"Node {len(state.scene.nodes) + 1}"))
    state.subbuttons.clear()


def new_scene(state: AppState):
    # Stop all audio
    state.audio.prune(retain_only=set())
    state.scene = Scene(
        nodes=[],
        listener=Listener(pos=Vector2(WIDTH // 2, HEIGHT // 2), name="Listener")
    )
    state.camera.offset.update(0, 0)
    state.ui = UIState()
    state.subbuttons.clear()


def save_scene(state: AppState):
    path = pick_save_scene_path()
    if not path:
        return
    save_scene_to_path(
        path,
        scene=state.scene,
        camera_offset=(float(state.camera.offset.x), float(state.camera.offset.y)),
        version=1
    )
    state.subbuttons.clear()


def load_scene(state: AppState):
    path = pick_load_scene_path()
    if not path:
        return
    scene, cam_off = load_scene_from_path(path)
    # Stop audio for old scene
    state.audio.prune(retain_only=set())
    # Swap scene and camera
    state.scene = scene
    state.camera.offset.update(cam_off[0], cam_off[1])
    state.subbuttons.clear()


def show_node_context_menu(state: AppState, node_idx: int):
    state.subbuttons.clear()
    node = state.scene.nodes[node_idx]
    sx, sy = state.camera.world_to_screen(node.pos)
    actions = [
        ("Name", lambda: start_rename(state, node_idx), True),
        ("Scale (drag)", lambda: start_scale(state, node_idx), True),
        ("Playlist", lambda: pick_playlist(state, node_idx), True),
    ]
    for i, (label, cb, blocks_drag) in enumerate(actions):
        state.subbuttons.append(Button(sx, sy + i * 35, 140, 30, label, cb, blocks_drag))


def start_rename(state: AppState, node_idx: int):
    state.ui.mode = Mode.NAME_NODE
    state.ui.selected_node_idx = node_idx
    state.ui.naming_buffer = state.scene.nodes[node_idx].name
    state.subbuttons.clear()


def start_scale(state: AppState, node_idx: int):
    state.ui.mode = Mode.SCALE_NODE
    state.ui.selected_node_idx = node_idx
    state.subbuttons.clear()


def pick_playlist(state: AppState, node_idx: int):
    files = pick_audio_files()
    if not files:
        return
    state.scene.nodes[node_idx].playlist_files = list(files)
    state.subbuttons.clear()


# ---------- Input Handling ----------
def handle_event(state: AppState, event):
    mx, my = pygame.mouse.get_pos()
    world = state.camera.screen_to_world(mx, my)

    # UI Buttons first
    consumed = False
    for btn in state.tabs + state.subbuttons:
        result = btn.handle_event(event)
        if result is not None:
            consumed = True
            if result:  # blocks drag
                return
    if consumed:
        return

    # Keyboard: naming mode
    if state.ui.mode == Mode.NAME_NODE and event.type == pygame.KEYDOWN:
        node = state.scene.nodes[state.ui.selected_node_idx] if state.ui.selected_node_idx is not None else None
        if event.key == pygame.K_RETURN and node:
            node.name = state.ui.naming_buffer.strip() or node.name
            state.ui.mode = Mode.IDLE
        elif event.key == pygame.K_ESCAPE:
            state.ui.mode = Mode.IDLE
        elif event.key == pygame.K_BACKSPACE:
            state.ui.naming_buffer = state.ui.naming_buffer[:-1]
        elif event.unicode and event.unicode.isprintable():
            state.ui.naming_buffer += event.unicode
        return

    # Mouse
    if event.type == pygame.MOUSEBUTTONDOWN:
        # Right-click context menu
        if event.button == 3:
            idx = hit_node_index(state, world)
            if idx is not None:
                state.editing_node_idx = idx
                show_node_context_menu(state, idx)
            else:
                state.editing_node_idx = None
                state.subbuttons.clear()
            return

        # Middle mouse: start panning
        if event.button == 2:
            state.ui.mode = Mode.PAN
            state.ui.mouse_last = Vector2(event.pos)
            return

        # Left mouse
        if event.button == 1:
            # Clear context menu when clicking empty space
            state.subbuttons.clear()
            idx = hit_node_index(state, world)
            if idx is not None:
                # If scaling mode was requested via menu, keep it
                if state.ui.mode != Mode.SCALE_NODE:
                    state.ui.mode = Mode.DRAG_NODE
                    state.ui.selected_node_idx = idx
            else:
                # Listener drag?
                if world.distance_to(state.scene.listener.pos) < 20:
                    state.ui.mode = Mode.DRAG_LISTENER
                else:
                    state.ui.mode = Mode.IDLE
            return

    elif event.type == pygame.MOUSEBUTTONUP:
        if state.ui.mode in (Mode.DRAG_NODE, Mode.DRAG_LISTENER, Mode.PAN, Mode.SCALE_NODE):
            state.ui.mode = Mode.IDLE
        return

    elif event.type == pygame.MOUSEMOTION:
        if state.ui.mode == Mode.DRAG_NODE and state.ui.selected_node_idx is not None:
            state.scene.nodes[state.ui.selected_node_idx].pos = world
        elif state.ui.mode == Mode.DRAG_LISTENER:
            state.scene.listener.pos = world
        elif state.ui.mode == Mode.PAN:
            dx = event.pos[0] - state.ui.mouse_last.x
            dy = event.pos[1] - state.ui.mouse_last.y
            state.camera.offset += Vector2(dx, dy)
            state.ui.mouse_last = Vector2(event.pos)
        elif state.ui.mode == Mode.SCALE_NODE and state.ui.selected_node_idx is not None:
            node = state.scene.nodes[state.ui.selected_node_idx]
            node.radius = max(10, int(node.pos.distance_to(world)))


def hit_node_index(state: AppState, world_pos: Vector2) -> int | None:
    for i, node in enumerate(state.scene.nodes):
        if world_pos.distance_to(node.pos) < node.radius:
            return i
    return None


def main():
    state = AppState()
    instruction_text = "LMB/RMB to drag/edit nodes • MMB to pan"

    running = True
    while running:
        dt = clock.tick(FPS) / 1000.0

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            handle_event(state, event)

        # Update (audio, caret blink, etc.)
        update(dt, state.scene, state.ui, state.audio)

        # Render (pure)
        render(
            state=state,
            screen=screen,
            font=FONT,
            buttons=(state.tabs + state.subbuttons),
            instruction_text=instruction_text,
        )

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()