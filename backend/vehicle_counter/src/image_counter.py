"""Module for static image vehicle detection and counting."""

import logging
from pathlib import Path
from typing import Dict, Tuple, Optional

import cv2
import numpy as np
from ultralytics import YOLO
from src.config import TARGET_CLASS_IDS, VEHICLE_CLASSES

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


class ImageVehicleCounter:
    """Detects and counts vehicles in a single static image."""

    def __init__(self, model_path: str, conf_threshold: float = 0.40):
        self.model = YOLO(model_path)
        self.conf_threshold = conf_threshold
        self.target_classes = TARGET_CLASS_IDS

    def count_vehicles(self, image_path: str, output_path: Optional[str] = None) -> Tuple[int, Dict[str, int]]:
        """
        Runs detection on an image, counts vehicles by category, and writes annotations.
        """
        img_path = Path(image_path)
        if not img_path.exists():
            raise FileNotFoundError(f"Image not found at path: {image_path}")

        frame = cv2.imread(str(img_path))
        if frame is None:
            raise ValueError(f"Could not decode image at: {image_path}")

        # Run inference filtering by vehicle classes
        results = self.model.predict(
            source=frame,
            classes=self.target_classes,
            conf=self.conf_threshold,
            verbose=False,
        )

        class_counts: Dict[str, int] = {name: 0 for name in VEHICLE_CLASSES.values()}
        result = results[0]
        boxes = result.boxes

        total_vehicles = len(boxes) if boxes is not None else 0

        if boxes is not None:
            for box in boxes:
                cls_id = int(box.cls[0].item())
                cls_name = VEHICLE_CLASSES.get(cls_id, "unknown")
                if cls_name in class_counts:
                    class_counts[cls_name] += 1

                # Draw bounding boxes and labels
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                conf = float(box.conf[0].item())

                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                label = f"{cls_name} {conf:.2f}"
                cv2.putText(
                    frame,
                    label,
                    (x1, max(y1 - 10, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 255, 0),
                    2,
                )

        # Overlay summary statistics banner
        self._draw_summary(frame, total_vehicles, class_counts)

        # Save output image
        if output_path:
            out_file = Path(output_path)
            out_file.parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(out_file), frame)
            logging.info(f"Annotated image saved to: {out_file}")

        return total_vehicles, class_counts

    @staticmethod
    def _draw_summary(frame: np.ndarray, total: int, class_counts: Dict[str, int]) -> None:
        """Draws a semi-transparent HUD overlay with vehicle count metrics."""
        overlay = frame.copy()
        cv2.rectangle(overlay, (20, 20), (320, 160), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

        cv2.putText(frame, f"Total Vehicles: {total}", (30, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

        y_offset = 80
        for name, count in class_counts.items():
            cv2.putText(
                frame,
                f"{name.capitalize()}: {count}",
                (30, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                1,
            )
            y_offset += 25
