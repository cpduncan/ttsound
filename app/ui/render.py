# app/ui/render.py
import pygame
from pygame import Surface
from ui.ui_state import UIState, Mode
from model.scene import Node, Listener

WHITE = (255, 255, 255)
RED = (255, 50, 50)
BLACK = (0, 0, 0)
DEFAULT_DOT_RADIUS = 4

def draw_node(surface: Surface, node: Node, camera, font, ui: UIState, node_idx: int):
    sx, sy = camera.world_to_screen(node.pos)

    # Node radius
    pygame.draw.circle(surface, RED, (sx, sy), node.radius, 1)
    # Node center
    pygame.draw.circle(surface, RED, (sx, sy), DEFAULT_DOT_RADIUS)

    # Label (use UIState when naming)
    is_naming = (ui.mode == Mode.NAME_NODE and ui.selected_node_idx == node_idx)
    label = ui.naming_buffer if is_naming else node.name
    text_surface = font.render(label, True, WHITE)
    tx, ty = sx - text_surface.get_width() // 2, sy - 30
    surface.blit(text_surface, (tx, ty))

    # Caret (visual only)
    if is_naming and ui.caret_visible:
        caret_x = tx + text_surface.get_width() + 2
        pygame.draw.line(surface, WHITE, (caret_x, ty), (caret_x, ty + text_surface.get_height()), 1)

def draw_listener(surface: Surface, listener: Listener, camera, font):
    sx, sy = camera.world_to_screen(listener.pos)
    pygame.draw.circle(surface, WHITE, (sx, sy), DEFAULT_DOT_RADIUS)
    text_surface = font.render(listener.name, True, WHITE)
    surface.blit(text_surface, (sx - text_surface.get_width() // 2, sy - 30))

def render(state, screen: Surface, font, buttons, instruction_text: str):
    screen.fill(BLACK)

    # Draw nodes
    for idx, node in enumerate(state.scene.nodes):
        draw_node(screen, node, state.camera, font, state.ui, idx)

    # Draw listener
    draw_listener(screen, state.scene.listener, state.camera, font)

    # Draw UI buttons
    for btn in buttons:
        btn.draw(screen)

    # Draw instruction text
    text_surface = font.render(instruction_text, True, WHITE)
    screen.blit(text_surface, (screen.get_width() / 2 - text_surface.get_width() / 2, 10))

    pygame.display.flip()