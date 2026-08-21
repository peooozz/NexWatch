"""
NexWatch Dedicated Live Mobile / Ngrok Stream Detector
======================================================
Optimized specifically for Cloud deployments (Render / AWS / GCP) & Mobile Phone IP Webcam feeds:
  1. Uses Lightweight YOLOv11 Nano (yolo11n.pt) for ultra-fast CPU inference (< 25ms).
  2. Frame Sampling: Ingestion loop processes every 3rd or 5th frame (~5-10 FPS) to prevent CPU starvation.
  3. Real-Time Detection: Returns bounding boxes, track IDs, speed estimations, and traffic safety flags.
  4. Environment-Aware: Dynamically reads NGROK_STREAM_URL or accepts client WebSocket/REST frames.
"""

import os
import cv2
import time
import base64
import logging
import numpy as np
from typing import Optional, Dict, Any, List
from collections import defaultdict, deque
from ultralytics import YOLO

from backend.config import settings

logger = logging.getLogger("NexWatchMobileDetector")

# Class mappings
CLASS_PERSON = 0
CLASS_BICYCLE = 1
CLASS_CAR = 2
CLASS_MOTORCYCLE = 3
CLASS_BUS = 5
CLASS_TRUCK = 7

VEHICLE_CLASSES = {
    CLASS_BICYCLE: "bicycle",
    CLASS_CAR: "car",
    CLASS_MOTORCYCLE: "motorcycle",
    CLASS_BUS: "bus",
    CLASS_TRUCK: "truck",
}

class MobileLiveDetector:
    """Dedicated lightweight detector for the /dashboard/events live stream route."""

    def __init__(self, model_name: Optional[str] = None, sample_rate: int = 3):
        self.model_name = model_name or settings.LIVE_MODEL_NAME
        self.sample_rate = sample_rate or settings.FRAME_SAMPLE_RATE
        self.model: Optional[YOLO] = None
        self.trajectories: Dict[int, deque] = defaultdict(lambda: deque(maxlen=20))
        self.frame_counter: int = 0
        self.active_stream_url: str = settings.MOBILE_STREAM_URL
        self._last_detections: List[Dict[str, Any]] = []

    def load_model(self):
        if self.model is None:
            logger.info(f"Loading lightweight live inference model: {self.model_name} (Nano for Cloud CPU)...")
            self.model = YOLO(self.model_name)
            logger.info("YOLOv11 Nano model loaded successfully.")

    def set_stream_url(self, url: str):
        self.active_stream_url = url.strip()
        logger.info(f"Updated live mobile stream URL to: {self.active_stream_url}")

    def set_sample_rate(self, rate: int):
        self.sample_rate = max(1, min(10, rate))
        logger.info(f"Updated frame sampling rate to: every {self.sample_rate} frame(s)")

    def process_b64_frame(self, b64_str: str) -> Dict[str, Any]:
        """Processes a base64 encoded image frame sent from the /dashboard/events client."""
        try:
            if "," in b64_str:
                b64_str = b64_str.split(",")[1]
            img_bytes = base64.b64decode(b64_str)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return {"success": False, "error": "Invalid image payload", "detections": []}
            return self.process_frame(img)
        except Exception as e:
            logger.error(f"Frame decode error: {e}")
            return {"success": False, "error": str(e), "detections": []}

    def process_frame(self, frame: np.ndarray) -> Dict[str, Any]:
        """Runs lightweight sampled inference on a single OpenCV BGR frame."""
        self.load_model()
        self.frame_counter += 1

        # Frame Sampling: Process only every N-th frame to keep CPU usage low on Render
        if self.frame_counter % self.sample_rate != 0 and len(self._last_detections) > 0:
            return {
                "success": True,
                "sampled": True,
                "frame_idx": self.frame_counter,
                "sample_rate": self.sample_rate,
                "detections": self._last_detections,
            }

        h, w = frame.shape[:2]
        # Resize to standard lightweight 640x360 for fast CPU inference if larger
        infer_frame = frame
        scale_x, scale_y = 1.0, 1.0
        if w > 640 or h > 360:
            target_w, target_h = 640, int(640 * (h / w))
            infer_frame = cv2.resize(frame, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
            scale_x = w / target_w
            scale_y = h / target_h

        t_start = time.time()
        results = self.model.track(
            source=infer_frame,
            persist=True,
            classes=[CLASS_PERSON, CLASS_BICYCLE, CLASS_CAR, CLASS_MOTORCYCLE, CLASS_BUS, CLASS_TRUCK],
            conf=0.30,
            iou=0.45,
            tracker="bytetrack.yaml",
            verbose=False,
        )
        infer_latency_ms = round((time.time() - t_start) * 1000, 1)

        detections = []
        if results and results[0].boxes is not None and len(results[0].boxes) > 0:
            boxes = results[0].boxes
            for box in boxes:
                cls_id = int(box.cls[0].item()) if box.cls is not None else 0
                conf = float(box.conf[0].item()) if box.conf is not None else 0.0
                track_id = int(box.id[0].item()) if box.id is not None else 0

                xyxy = box.xyxy[0].cpu().numpy()
                x1 = float(xyxy[0] * scale_x)
                y1 = float(xyxy[1] * scale_y)
                x2 = float(xyxy[2] * scale_x)
                y2 = float(xyxy[3] * scale_y)

                cls_name = "person" if cls_id == CLASS_PERSON else VEHICLE_CLASSES.get(cls_id, "vehicle")
                cx = (x1 + x2) / 2.0
                cy = (y1 + y2) / 2.0

                self.trajectories[track_id].append((cx, cy))
                traj = self.trajectories[track_id]

                # Approximate speed & heading
                speed_kmh = 0.0
                tags = []
                is_incident = False

                if len(traj) >= 4:
                    dx = traj[-1][0] - traj[0][0]
                    dy = traj[-1][1] - traj[0][1]
                    pixel_speed = float(np.hypot(dx, dy)) / len(traj)
                    speed_kmh = round(pixel_speed * 4.2, 1)

                    # Quick heading violation check (contraflow)
                    if dy < -15 and cy > h * 0.35:
                        tags.append("🚨 CONTRAFLOW")
                        is_incident = True

                if cls_name == "motorcycle":
                    tags.append("🏍️ TWO-WHEELER")
                elif cls_name == "car":
                    tags.append("🚗 SEDAN")
                elif cls_name == "person":
                    tags.append("PEDESTRIAN")

                detections.append({
                    "id": f"LIVE-{track_id}",
                    "track_id": track_id,
                    "class_name": cls_name,
                    "confidence": round(conf, 2),
                    "confidence_pct": f"{int(conf * 100)}%",
                    "speed": speed_kmh,
                    "box": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                    "tags": tags,
                    "isIncident": is_incident,
                })

        self._last_detections = detections
        return {
            "success": True,
            "sampled": False,
            "frame_idx": self.frame_counter,
            "sample_rate": self.sample_rate,
            "latency_ms": infer_latency_ms,
            "detections": detections,
        }


# Global singleton instance for the /dashboard/events route
mobile_live_detector = MobileLiveDetector()
