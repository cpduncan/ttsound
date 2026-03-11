# app/systems/update_system.py
from pygame.math import Vector2
from model.scene import Scene
from ui.ui_state import UIState
from audio.engine import IAudioEngine

def update(dt: float, scene: Scene, ui: UIState, audio: IAudioEngine):
    # Caret blink for naming
    ui.caret_timer += dt
    if ui.caret_timer >= 0.5:
        ui.caret_timer = 0.0
        ui.caret_visible = not ui.caret_visible

    # Build the set of active audio paths in the scene
    active_paths: set[str] = set()
    for node in scene.nodes:
        for p in node.playlist_files:
            active_paths.add(p)

    # Ensure only active paths are kept by the engine
    audio.prune(retain_only=active_paths)

    # Ensure playback & set volumes based on distance
    listener_pos: Vector2 = scene.listener.pos
    for node in scene.nodes:
        # lazy play any missing
        for path in node.playlist_files:
            audio.ensure_loaded(path)
            audio.play_loop(path)

        # compute volume
        d = node.pos.distance_to(listener_pos)
        vol = 0.0
        if node.radius > 0:
            vol = max(0.0, min(1.0, 1.0 - d / node.radius))

        for path in node.playlist_files:
            audio.set_volume(path, vol)