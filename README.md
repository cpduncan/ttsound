## TTSOUND -- Live MP3 Playlist Mixer

An app for those who run TTRPG games seeking a solution that smoothly plays and mixes your songs and playlists with minimal effort. No more tabbing through spotify playlist folders!

- Bpm smoothing soon to come.
- Songs are stored and loaded via .mp3
- .wav not supported
- One or more songs can be loaded into a node at a time. 
- Make sure to save your scenes!
- Built with python, pygame, ktinker and (in the future) https://github.com/nakami/BPM-extractor

## REQ / RUNNING

### 1) python ver supporting pygame (3.10 recommended)

***windows***

```bash
> winget install Python.Python.3.10
```

***linux***

```bash
> sudo apt install python3.10
```

### 2) pygame >= 2.5.0

```bash
> py -3.10 -m pip install pygame
```

### 3) run from appropriate directory (so python can reach the packages)

```bash
> cd app
> py -3.10 -m main
```
