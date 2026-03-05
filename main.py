import pygame
import sys
import math
from pygame import mixer
import json
import tkinter as tk
from tkinter import filedialog

pygame.init()
mixer.init()

# --- Constants ---
WIDTH, HEIGHT = 192*4, 108*4
FPS = 60
DEFAULT_NODE_RADIUS = 100
DEFAULT_DOT_RADIUS = 4

try:
    FONT = pygame.font.Font("rec/JMH Typewriter-Bold.ttf", 16)
except pygame.error:
    FONT = pygame.font.Font(None, 16)

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 50, 50)

screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE)
pygame.display.set_caption("ttsound")
clock = pygame.time.Clock()


# ----------------------------
# Data Classes
# ----------------------------

class Node:
    def __init__(self, x, y, name="Node"):
        self.x = x
        self.y = y
        self.name = name
        self.radius = DEFAULT_NODE_RADIUS
        self.playlist = []        # list of pygame.mixer.Sound
        self.playlist_files = []  # list of filenames for save/load
        self.dragging = False
        self.scaling = False

    def distance_to(self, x, y):
        return math.hypot(self.x - x, self.y - y)

    def update_volume(self, listener):
        distance = self.distance_to(listener.x, listener.y)
        for sound in self.playlist:
            volume = max(0, min(1, 1 - distance / self.radius))
            sound.set_volume(volume)

    def draw(self, surface, offset):
        ox, oy = offset
        pygame.draw.circle(surface, RED, (int(self.x + ox), int(self.y + oy)), self.radius, 1)
        pygame.draw.circle(surface, RED, (int(self.x + ox), int(self.y + oy)), DEFAULT_DOT_RADIUS)
        text_surface = FONT.render(self.name, True, WHITE)
        surface.blit(text_surface,
                     (self.x + ox - text_surface.get_width() // 2,
                      self.y + oy - 30))


class Listener:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.name = "Listener"
        self.dragging = False

    def draw(self, surface, offset):
        ox, oy = offset
        pygame.draw.circle(surface, WHITE,
                           (int(self.x + ox), int(self.y + oy)),
                           DEFAULT_DOT_RADIUS)
        text_surface = FONT.render(self.name, True, WHITE)
        surface.blit(text_surface,
                     (self.x + ox - text_surface.get_width() // 2,
                      self.y + oy - 30))


class Button:
    def __init__(self, x, y, w, h, text, callback, blocks_drag=True):
        self.rect = pygame.Rect(x, y, w, h)
        self.text = text
        self.callback = callback
        self.hover = False
        self.blocks_drag = blocks_drag

    def draw(self, surf):
        color = RED if not self.hover else WHITE
        pygame.draw.rect(surf, color, self.rect, 1)
        text_surf = FONT.render(self.text, True, WHITE)
        surf.blit(text_surf, (self.rect.x + 5, self.rect.y + 5))

    def handle_event(self, event):
        if event.type == pygame.MOUSEMOTION:
            self.hover = self.rect.collidepoint(event.pos)
        elif event.type == pygame.MOUSEBUTTONDOWN:
            if self.rect.collidepoint(event.pos):
                self.callback()
                return self.blocks_drag
        return None


# ----------------------------
# Application State
# ----------------------------

class AppState:
    def __init__(self):
        self.nodes = []
        self.listener = Listener(WIDTH // 2, HEIGHT // 2)

        self.offset_x = 0
        self.offset_y = 0

        self.panning = False
        self.pan_start = (0, 0)

        self.editing_node = None
        self.scaling_node = None
        self.dragging_node = None

        # Naming mode
        self.naming_mode = False
        self.naming_node = None
        self.name_buffer = ""
        self.original_name = ""

        # UI
        self.subbuttons = []
        self.tabs = self.create_tabs()

    def create_tabs(self):
        tabs = []
        tab_data = [
            ("Node", [("New Node", lambda: new_node(self), False)]),
            ("Scene", [
                ("New Scene", lambda: new_scene(self), True),
                ("Save Scene", lambda: save_scene(self), True),
                ("Load Scene", lambda: load_scene(self), True),
            ]),
        ]

        x_offset = 5
        for tab_name, actions in tab_data:
            tab_btn = Button(
                x_offset, 5, 80, 30,
                tab_name,
                lambda t=actions: show_subbuttons(self, t)
            )
            tabs.append(tab_btn)
            x_offset += 79

        return tabs


# ----------------------------
# Scene / Button Functions
# ----------------------------

def new_node(state):
    mx, my = pygame.mouse.get_pos()
    state.nodes.append(Node(mx - state.offset_x,
                            my - state.offset_y,
                            name=f"Node {len(state.nodes)+1}"))
    state.subbuttons.clear()


def new_scene(state):
    state.nodes = []
    state.offset_x = 0
    state.offset_y = 0
    state.listener = Listener(WIDTH // 2, HEIGHT // 2)
    state.subbuttons.clear()


def save_scene(state):
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.asksaveasfilename(
        title="Save Scene As",
        defaultextension=".json",
        filetypes=[("JSON Files", "*.json")]
    )
    if not file_path:
        return

    data = {
        "offset": {"x": state.offset_x, "y": state.offset_y},
        "listener": {"x": state.listener.x, "y": state.listener.y},
        "nodes": [
            {
                "x": n.x,
                "y": n.y,
                "name": n.name,
                "radius": n.radius,
                "playlist": n.playlist_files
            } for n in state.nodes
        ]
    }

    with open(file_path, "w") as f:
        json.dump(data, f, indent=4)

    state.subbuttons.clear()


def load_scene(state):
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename(
        title="Select Scene File",
        filetypes=[("JSON Files", "*.json")]
    )
    if not file_path:
        return

    with open(file_path, "r") as f:
        data = json.load(f)

    state.offset_x = data.get("offset", {}).get("x", 0)
    state.offset_y = data.get("offset", {}).get("y", 0)

    state.listener.x = data.get("listener", {}).get("x", state.listener.x)
    state.listener.y = data.get("listener", {}).get("y", state.listener.y)

    state.nodes.clear()
    for n in data.get("nodes", []):
        node = Node(n["x"], n["y"], n["name"])
        node.radius = n.get("radius", 100)
        # Load playlist files as Sound objects
        node.playlist = []
        node.playlist_files = n.get("playlist", [])
        for file in node.playlist_files:
            try:
                sound = mixer.Sound(file)
                node.playlist.append(sound)
                sound.play(-1)  # loop indefinitely
            except Exception as e:
                print(f"Failed to load {file}: {e}")
        state.nodes.append(node)

    state.subbuttons.clear()


def show_subbuttons(state, actions):
    state.subbuttons.clear()
    y_offset = 40
    for i, (name, callback, blocks_drag) in enumerate(actions):
        btn = Button(5, y_offset + i*35, 120, 30,
                     name, callback, blocks_drag)
        state.subbuttons.append(btn)


def show_editbuttons(state, node):
    state.subbuttons.clear()
    actions = [
        ("Name", lambda: name_node(state), True),
        ("Scale (drag)", lambda: scale_node(state), True),
        ("Playlist", lambda: playlist(state), True),
    ]
    for i, (name, callback, blocks_drag) in enumerate(actions):
        btn = Button(node.x + state.offset_x,
                     i*35 + node.y + state.offset_y,
                     120, 30,
                     name,
                     callback,
                     blocks_drag)
        state.subbuttons.append(btn)


def name_node(state):
    if state.editing_node:
        state.naming_mode = True
        state.naming_node = state.editing_node
        state.original_name = state.editing_node.name
        state.name_buffer = state.editing_node.name
    state.subbuttons.clear()


def scale_node(state):
    if state.editing_node:
        state.scaling_node = state.editing_node
        state.scaling_node.scaling = True
    state.subbuttons.clear()


def playlist(state):
    state.subbuttons.clear()
    if state.editing_node is None:
        return
    files = filedialog.askopenfilenames(
        title="Select MP3 Files",
        filetypes=[("MP3 Files", "*.mp3")]
    )
    if not files:
        return
    state.editing_node.playlist_files = []
    state.editing_node.playlist = []
    for file in files:
        try:
            sound = mixer.Sound(file)
            sound.play(-1)  # loop indefinitely
            state.editing_node.playlist.append(sound)
            state.editing_node.playlist_files.append(file)
        except Exception as e:
            print(f"Failed to load {file}: {e}")


# ----------------------------
# Event Handling
# ----------------------------

def handle_event(state, event):
    mx, my = pygame.mouse.get_pos()
    button_clicked = False
    drag_blocked = False

    # Buttons
    for btn in state.tabs + state.subbuttons:
        result = btn.handle_event(event)
        if result is not None:
            button_clicked = True
            drag_blocked = result

    # --- Naming Mode ---
    if state.naming_mode and event.type == pygame.KEYDOWN:
        if event.key == pygame.K_RETURN:
            state.naming_node.name = state.name_buffer.strip() or state.original_name
            state.naming_mode = False
            state.naming_node = None
        elif event.key == pygame.K_ESCAPE:
            state.naming_node.name = state.original_name
            state.naming_mode = False
            state.naming_node = None
        elif event.key == pygame.K_BACKSPACE:
            state.name_buffer = state.name_buffer[:-1]
        elif event.unicode.isprintable():
            state.name_buffer += event.unicode
        return state

    # --- Mouse Events ---
    if event.type == pygame.MOUSEBUTTONDOWN:
        if not button_clicked and event.button != 3:
            state.subbuttons.clear()
            state.editing_node = None

        clicked_node = None
        for node in state.nodes:
            if node.distance_to(mx - state.offset_x, my - state.offset_y) < node.radius:
                clicked_node = node
                break

        if event.button == 1 and not drag_blocked:
            if math.hypot(state.listener.x - (mx - state.offset_x),
                          state.listener.y - (my - state.offset_y)) < 20:
                state.listener.dragging = True
            elif clicked_node:
                state.dragging_node = clicked_node
                clicked_node.dragging = True

        elif event.button == 2:
            state.panning = True
            state.pan_start = event.pos

        elif event.button == 3:
            if clicked_node:
                state.editing_node = clicked_node
                show_editbuttons(state, clicked_node)

    elif event.type == pygame.MOUSEBUTTONUP:
        state.dragging_node = None
        state.listener.dragging = False
        state.panning = False
        if state.scaling_node:
            state.scaling_node.scaling = False
            state.scaling_node = None
        for node in state.nodes:
            node.dragging = False

    elif event.type == pygame.MOUSEMOTION:
        if state.dragging_node:
            state.dragging_node.x = mx - state.offset_x
            state.dragging_node.y = my - state.offset_y
        if state.listener.dragging:
            state.listener.x = mx - state.offset_x
            state.listener.y = my - state.offset_y
        if state.panning:
            dx = event.pos[0] - state.pan_start[0]
            dy = event.pos[1] - state.pan_start[1]
            state.offset_x += dx
            state.offset_y += dy
            state.pan_start = event.pos
        if state.scaling_node and state.scaling_node.scaling:
            world_x = mx - state.offset_x
            world_y = my - state.offset_y
            state.scaling_node.radius = max(10, int(math.hypot(
                state.scaling_node.x - world_x, state.scaling_node.y - world_y)))

    return state


# ----------------------------
# Rendering
# ----------------------------

def render(state):
    screen.fill(BLACK)

    if state.naming_mode and state.naming_node:
        state.naming_node.name = state.name_buffer + "|"

    for node in state.nodes:
        node.update_volume(state.listener)
        node.draw(screen, (state.offset_x, state.offset_y))

    state.listener.draw(screen, (state.offset_x, state.offset_y))

    for btn in state.tabs + state.subbuttons:
        btn.draw(screen)

    text_surface = FONT.render("LMB/RMB to drag/edit nodes & MMB to pan", True, WHITE)
    screen.blit(text_surface, (screen.get_width()/2 - 180, 10))

    pygame.display.flip()


# ----------------------------
# Main Loop
# ----------------------------

def main():
    state = AppState()
    running = True

    while running:
        clock.tick(FPS)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            state = handle_event(state, event)

        render(state)

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()