# app/audio/pygame_engine.py
import pygame
from audio.engine import IAudioEngine
from typing import Set

class PygameAudio(IAudioEngine):
    def __init__(self):
        self.cache: dict[str, pygame.mixer.Sound] = {}
        self.channels: dict[str, pygame.mixer.Channel | None] = {}
        # Pre-allocate some channels if desired
        if pygame.mixer.get_num_channels() < 32:
            pygame.mixer.set_num_channels(32)

    def ensure_loaded(self, path: str) -> None:
        if path not in self.cache:
            self.cache[path] = pygame.mixer.Sound(path)

    def play_loop(self, path: str) -> None:
        self.ensure_loaded(path)
        ch = self.channels.get(path)
        # If there's already a channel, keep it
        if ch and ch.get_busy():
            return
        # Play sound and remember the channel
        assigned = self.cache[path].play(loops=-1, fade_ms=150)
        self.channels[path] = assigned

    def set_volume(self, path: str, volume: float) -> None:
        v = max(0.0, min(1.0, volume))
        snd = self.cache.get(path)
        if snd:
            # Sound volume affects all channels of that sound
            snd.set_volume(v)

    def stop(self, path: str) -> None:
        ch = self.channels.get(path)
        if ch:
            try:
                ch.fadeout(150)
            except Exception:
                pass

    def unload(self, path: str) -> None:
        self.stop(path)
        self.cache.pop(path, None)
        self.channels.pop(path, None)

    def prune(self, retain_only: Set[str]) -> None:
        # Stop/unload everything not in retain_only
        for path in list(self.cache.keys()):
            if path not in retain_only:
                self.unload(path)