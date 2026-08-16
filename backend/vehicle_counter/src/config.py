"""Configuration constants and model settings for vehicle counting."""

from pathlib import Path
from typing import Dict, List

# COCO Vehicle Class IDs
# 2: car, 3: motorcycle, 5: bus, 7: truck
VEHICLE_CLASSES: Dict[int, str] = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

TARGET_CLASS_IDS: List[int] = list(VEHICLE_CLASSES.keys())

# Default Model & Inference Config
DEFAULT_MODEL_WEIGHTS: str = "yolo11m.pt"  # Pre-trained COCO model (or yolov8m.pt)
DEFAULT_CONF_THRESHOLD: float = 0.40
DEFAULT_IOU_THRESHOLD: float = 0.45
DEFAULT_TRACKER: str = "bytetrack.yaml"

# Path Defaults
PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_DIR: Path = PROJECT_ROOT / "outputs"
