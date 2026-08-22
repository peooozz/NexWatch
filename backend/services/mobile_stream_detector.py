"""
NexWatch Dedicated Live Mobile / Ngrok Stream Detector
======================================================
Optimized specifically for Cloud deployments (Render / AWS / GCP) & Mobile Phone IP Webcam feeds:
  1. Uses Lightweight YOLOv11 (Nano/Small) for fast CPU inference.
  2. Background Stream Thread: Ingests directly from active_stream_url (Local Wi-Fi, 5G IPv6, or Ngrok).
  3. Frame Sampling: Ingestion loop processes every 3rd or 5th frame (~5-10 FPS) to prevent CPU starvation.
  4. Homography & Wrong-Way v2: Physical ground-plane calibration for real speed and contraflow detection.
  5. Incident Queue: Dispatches contraflow, speeding, and safety events.
"""

import os
import cv2
import time
import base64
import logging
import threading
import numpy as np
from datetime import datetime
from typing import Optional, Dict, Any, List
from collections import defaultdict, deque
from shapely.geometry import Polygon
from ultralytics import YOLO

from backend.config import settings
from scripts.live_event_detector import Homography, LaneZone, WrongWayDetector

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
        self.trajectories: Dict[int, deque] = defaultdict(lambda: deque(maxlen=25))
        self.frame_counter: int = 0
        self.active_stream_url: str = settings.MOBILE_STREAM_URL
        self._last_detections: List[Dict[str, Any]] = []
        self._last_jpeg: Optional[bytes] = None
        self._recent_events: deque = deque(maxlen=100)
        self._is_running: bool = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self.last_infer_latency: float = 18.0

        # Physical Ground-Plane Homography & Contraflow Engine
        self.homography: Optional[Homography] = None
        self.wrong_way_detector: Optional[WrongWayDetector] = None

    def calibrate(
        self,
        src_pts: List[List[float]],
        dst_pts: List[List[float]],
        flow_vector: List[float],
        fps: float = 10.0,
    ):
        """
        Calibrates the perspective transform for a live phone/IP stream.
        Called once via /api/live/calibrate after operator defines 4 road points and world dimensions.
        """
        h = Homography(np.array(src_pts, dtype=np.float32), np.array(dst_pts, dtype=np.float32))
        max_x = max(p[0] for p in dst_pts)
        max_y = max(p[1] for p in dst_pts)
        zone = LaneZone(
            name="mobile_calibrated_corridor",
            polygon_world=Polygon([(0, 0), (max_x, 0), (max_x, max_y), (0, max_y)]),
            flow_vector=np.array(flow_vector, dtype=np.float32),
        )
        self.homography = h
        self.wrong_way_detector = WrongWayDetector(h, [zone], fps=fps)
        logger.info("Mobile live stream homography and lane corridor calibrated successfully.")

    def load_model(self):
        if self.model is None:
            logger.info(f"Loading live inference model: {self.model_name}...")
            self.model = YOLO(self.model_name)
            logger.info(f"Model {self.model_name} loaded successfully.")

    def set_stream_url(self, url: str):
        cleaned = url.strip()
        if cleaned != self.active_stream_url:
            self.active_stream_url = cleaned
            logger.info(f"Updated live mobile stream URL to: {self.active_stream_url}")
            self.restart_background_stream()

    def set_sample_rate(self, rate: int):
        self.sample_rate = max(1, min(10, rate))
        logger.info(f"Updated frame sampling rate to: every {self.sample_rate} frame(s)")

    def start_background_stream(self):
        """Starts background stream reader thread if not already running."""
        if not self._is_running and self.active_stream_url:
            self._is_running = True
            self._thread = threading.Thread(target=self._stream_worker, daemon=True)
            self._thread.start()
            logger.info(f"[LiveStream] Started background ingestion for: {self.active_stream_url}")

    def stop_background_stream(self):
        self._is_running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
        logger.info("[LiveStream] Stopped background ingestion.")

    def restart_background_stream(self):
        self.stop_background_stream()
        self.start_background_stream()

    def _stream_worker(self):
        """Worker thread that continuously reads from active_stream_url."""
        self.load_model()
        retry_delay = 2.0

        while self._is_running:
            url = self.active_stream_url
            if not url:
                time.sleep(1.0)
                continue

            cap = cv2.VideoCapture(url)
            if not cap.isOpened():
                logger.warning(f"[LiveStream] Could not open video stream: {url}. Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
                continue

            logger.info(f"[LiveStream] VideoCapture connected successfully to: {url}")
            fps_sleep = 1.0 / 30.0

            while self._is_running and cap.isOpened():
                ret, frame = cap.read()
                if not ret or frame is None:
                    time.sleep(0.1)
                    break

                self.process_frame(frame)
                time.sleep(fps_sleep)

            cap.release()
            time.sleep(retry_delay)

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

        # Frame Sampling
        if self.frame_counter % self.sample_rate != 0 and len(self._last_detections) > 0:
            return {
                "success": True,
                "sampled": True,
                "frame_idx": self.frame_counter,
                "sample_rate": self.sample_rate,
                "latency_ms": self.last_infer_latency,
                "calibrated": self.homography is not None,
                "detections": self._last_detections,
            }

        h, w = frame.shape[:2]
        infer_frame = frame

        # Resize to standard lightweight 640x360 for fast CPU inference
        target_w, target_h = 640, int(640 * (h / w))
        infer_frame = cv2.resize(frame, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
        scale_box_x = 1280.0 / target_w
        scale_box_y = 720.0 / target_h

        t_start = time.time()
        results = self.model.track(
            source=infer_frame,
            persist=True,
            classes=[CLASS_PERSON, CLASS_BICYCLE, CLASS_CAR, CLASS_MOTORCYCLE, CLASS_BUS, CLASS_TRUCK],
            conf=0.25,
            iou=0.45,
            tracker="bytetrack.yaml",
            verbose=False,
        )
        infer_latency_ms = round((time.time() - t_start) * 1000, 1)
        self.last_infer_latency = infer_latency_ms

        detections = []
        if results and results[0].boxes is not None and len(results[0].boxes) > 0:
            boxes = results[0].boxes
            for box in boxes:
                cls_id = int(box.cls[0].item()) if box.cls is not None else 0
                conf = float(box.conf[0].item()) if box.conf is not None else 0.0
                track_id = int(box.id[0].item()) if box.id is not None else 0

                xyxy = box.xyxy[0].cpu().numpy()
                x1 = float(xyxy[0] * scale_box_x)
                y1 = float(xyxy[1] * scale_box_y)
                x2 = float(xyxy[2] * scale_box_x)
                y2 = float(xyxy[3] * scale_box_y)

                cls_name = "person" if cls_id == CLASS_PERSON else VEHICLE_CLASSES.get(cls_id, "vehicle")
                cx = (x1 + x2) / 2.0
                cy = (y1 + y2) / 2.0

                self.trajectories[track_id].append((cx, cy))

                speed_kmh = 0.0
                tags = []
                is_incident = False

                # Ground-Plane Calibrated Physics or Uncalibrated Tag
                if self.wrong_way_detector and self.homography:
                    alert = self.wrong_way_detector.update(
                        track_id=str(track_id),
                        px=cx,
                        py=cy,
                        vehicle_class=cls_name,
                        frame_idx=self.frame_counter,
                    )
                    state = self.wrong_way_detector.tracks.get(str(track_id))
                    speed_kmh = (
                        round(
                            self.wrong_way_detector._speed_kmh(
                                state.world_history, state.frame_history
                            ),
                            1,
                        )
                        if state
                        else 0.0
                    )

                    if state and state.alerted:
                        tags.append("🚨 CONTRAFLOW")
                        is_incident = True
                        self._log_incident("wrong_way", track_id, cls_name, speed_kmh, conf)

                    if speed_kmh > 60.0:
                        tags.append(f"⚡ SPEEDING ({speed_kmh} km/h)")
                        is_incident = True
                        self._log_incident("speed_violation", track_id, cls_name, speed_kmh, conf)
                else:
                    tags.append("⚙ UNCALIBRATED — calibrate for speed/contraflow")

                if cls_name == "motorcycle":
                    tags.append("🏍️ TWO-WHEELER")
                elif cls_name == "car":
                    tags.append("🚗 VEHICLE")
                elif cls_name == "bus":
                    tags.append("🚌 BUS")
                elif cls_name == "truck":
                    tags.append("🚛 HEAVY")
                elif cls_name == "person":
                    tags.append("🚶 PEDESTRIAN")

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

        # Encode compressed JPEG for live streaming to frontend
        ret, jpeg_buf = cv2.imencode('.jpg', infer_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])

        with self._lock:
            self._last_detections = detections
            if ret:
                self._last_jpeg = jpeg_buf.tobytes()

        return {
            "success": True,
            "sampled": False,
            "frame_idx": self.frame_counter,
            "sample_rate": self.sample_rate,
            "latency_ms": infer_latency_ms,
            "calibrated": self.homography is not None,
            "detections": detections,
        }

    def _log_incident(self, ev_type: str, track_id: int, cls_name: str, speed: float, conf: float):
        """Records an incident to the recent events buffer."""
        now = datetime.now()
        event_obj = {
            "id": f"EVT-LIVE-{int(time.time()*1000) % 100000}",
            "timestamp": now.strftime("%H:%M:%S"),
            "camera_id": "PHONE-LIVE-01",
            "camera_name": "Mobile IP Live Feed",
            "event": ev_type,
            "vehicle_id": f"LIVE-{track_id} ({cls_name.upper()})",
            "speed": speed,
            "confidence": round(conf, 2),
            "severity": "critical" if ev_type == "collision" else "high",
        }
        # Deduplicate recent events for same track_id within 3 seconds
        if not any(e["vehicle_id"] == event_obj["vehicle_id"] and e["event"] == ev_type for e in list(self._recent_events)[-5:]):
            self._recent_events.appendleft(event_obj)

    def get_latest_state(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "success": True,
                "frame_counter": self.frame_counter,
                "latency_ms": self.last_infer_latency,
                "calibrated": self.homography is not None,
                "detections": list(self._last_detections),
                "events": list(self._recent_events),
                "stream_active": self._is_running or (self._last_jpeg is not None),
            }

    def get_latest_jpeg(self) -> Optional[bytes]:
        with self._lock:
            return self._last_jpeg


# Global singleton instance for the /dashboard/events route
mobile_live_detector = MobileLiveDetector()
