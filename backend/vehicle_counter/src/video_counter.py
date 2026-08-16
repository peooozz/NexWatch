"""Module for video vehicle tracking and cumulative counting."""

import logging
from pathlib import Path
from typing import Dict, Set, Tuple, Optional

import cv2
import numpy as np
from ultralytics import YOLO
from src.config import DEFAULT_TRACKER, TARGET_CLASS_IDS, VEHICLE_CLASSES

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


class VideoVehicleCounter:
    """Tracks and counts unique vehicles across video frames using ByteTrack."""

    def __init__(
        self,
        model_path: str,
        conf_threshold: float = 0.40,
        iou_threshold: float = 0.45,
        tracker: str = DEFAULT_TRACKER,
    ):
        self.model = YOLO(model_path)
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.tracker = tracker
        self.target_classes = TARGET_CLASS_IDS

    def process_video(
        self,
        video_path: str,
        output_path: Optional[str] = None,
        display: bool = False,
    ) -> Tuple[int, Dict[str, int]]:
        """
        Processes video frames, assigns persistent track IDs, and counts unique vehicles.
        """
        vid_path = Path(video_path)
        if not vid_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(str(vid_path))
        if not cap.isOpened():
            raise ValueError(f"Could not open video stream: {video_path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30

        writer: Optional[cv2.VideoWriter] = None
        if output_path:
            out_file = Path(output_path)
            out_file.parent.mkdir(parents=True, exist_ok=True)
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(str(out_file), fourcc, fps, (width, height))

        # Stores unique track IDs encountered throughout the entire video
        unique_vehicle_ids: Set[int] = set()
        unique_class_counts: Dict[str, Set[int]] = {name: set() for name in VEHICLE_CLASSES.values()}

        try:
            while cap.isOpened():
                success, frame = cap.read()
                if not success:
                    break

                # Multi-object tracking with persistent state across frames
                results = self.model.track(
                    source=frame,
                    persist=True,
                    classes=self.target_classes,
                    conf=self.conf_threshold,
                    iou=self.iou_threshold,
                    tracker=self.tracker,
                    verbose=False,
                )

                boxes = results[0].boxes
                current_frame_count = 0

                if boxes is not None and boxes.id is not None:
                    track_ids = boxes.id.int().cpu().tolist()
                    class_ids = boxes.cls.int().cpu().tolist()
                    xyxy_boxes = boxes.xyxy.int().cpu().tolist()
                    confidences = boxes.conf.cpu().tolist()

                    for box, track_id, cls_id, conf in zip(xyxy_boxes, track_ids, class_ids, confidences):
                        current_frame_count += 1
                        unique_vehicle_ids.add(track_id)

                        cls_name = VEHICLE_CLASSES.get(cls_id, "unknown")
                        if cls_name in unique_class_counts:
                            unique_class_counts[cls_name].add(track_id)

                        # Draw bounding box and Track ID
                        x1, y1, x2, y2 = box
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 128, 0), 2)
                        label = f"ID: {track_id} {cls_name} {conf:.2f}"
                        cv2.putText(
                            frame,
                            label,
                            (x1, max(y1 - 10, 20)),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.5,
                            (255, 128, 0),
                            2,
                        )

                # Render dashboard
                total_cumulative = len(unique_vehicle_ids)
                breakdown = {k: len(v) for k, v in unique_class_counts.items()}
                self._draw_video_dashboard(frame, current_frame_count, total_cumulative, breakdown)

                if writer:
                    writer.write(frame)

                if display:
                    cv2.imshow("Real-Time Vehicle Tracker & Counter", frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        logging.info("Tracking terminated by user.")
                        break

        finally:
            cap.release()
            if writer:
                writer.release()
            cv2.destroyAllWindows()

        final_breakdown = {k: len(v) for k, v in unique_class_counts.items()}
        logging.info(f"Finished processing. Total unique vehicles detected: {len(unique_vehicle_ids)}")
        return len(unique_vehicle_ids), final_breakdown

    @staticmethod
    def _draw_video_dashboard(
        frame: np.ndarray,
        live_count: int,
        cumulative_count: int,
        breakdown: Dict[str, int],
    ) -> None:
        """Renders HUD with both real-time presence and cumulative unique counts."""
        overlay = frame.copy()
        cv2.rectangle(overlay, (20, 20), (360, 190), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)

        cv2.putText(frame, f"Live In Frame: {live_count}", (30, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(frame, f"Total Unique Count: {cumulative_count}", (30, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

        y = 110
        for name, count in breakdown.items():
            cv2.putText(
                frame,
                f"Total {name.capitalize()}s: {count}",
                (30, y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (200, 200, 200),
                1,
            )
            y += 20
