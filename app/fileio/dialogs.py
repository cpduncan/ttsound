# app/fileio/dialogs.py
import tkinter as tk
from tkinter import filedialog

def pick_audio_files() -> list[str] | None:
    root = tk.Tk(); root.withdraw()
    files = filedialog.askopenfilenames(
        title="Select Audio Files",
        filetypes=[("Audio Files", "*.mp3;*.wav;*.ogg;*.flac;*.aac;*.m4a")]
    )
    return list(files) if files else None

def pick_save_scene_path() -> str | None:
    root = tk.Tk(); root.withdraw()
    path = filedialog.asksaveasfilename(
        title="Save Scene As",
        defaultextension=".json",
        filetypes=[("JSON Files", "*.json")]
    )
    return path or None

def pick_load_scene_path() -> str | None:
    root = tk.Tk(); root.withdraw()
    path = filedialog.askopenfilename(
        title="Select Scene File",
        filetypes=[("JSON Files", "*.json")]
    )
    return path or None