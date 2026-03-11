# app/model/dto.py
from dataclasses import dataclass
from typing import List, Dict, Tuple, Any

@dataclass
class SceneDTO:
    version: int
    camera_offset: Tuple[float, float]
    listener: Tuple[float, float]
    nodes: List[Dict[str, Any]]