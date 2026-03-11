# app/ui/widgets.py
import pygame

WHITE = (255, 255, 255)
RED = (255, 50, 50)

class Button:
    def __init__(self, x, y, w, h, text, callback, blocks_drag=True, font=None):
        self.rect = pygame.Rect(x, y, w, h)
        self.text = text
        self.callback = callback
        self.hover = False
        self.blocks_drag = blocks_drag
        self.font = font  # optional override

    def draw(self, surf):
        font = self.font or pygame.font.Font(None, 16)
        color = RED if not self.hover else WHITE
        pygame.draw.rect(surf, color, self.rect, 1)
        text_surf = font.render(self.text, True, WHITE)
        surf.blit(text_surf, (self.rect.x + 5, self.rect.y + 5))

    def handle_event(self, event):
        if event.type == pygame.MOUSEMOTION:
            self.hover = self.rect.collidepoint(event.pos)
        elif event.type == pygame.MOUSEBUTTONDOWN:
            if self.rect.collidepoint(event.pos):
                self.callback()
                return self.blocks_drag
        return None