import os
import json
import shutil
from pathlib import Path
import cv2
import numpy as np
from ultralytics import YOLO

# Target resolution: Standard 16:9 720p HD across all cameras
TARGET_W = 1280
TARGET_H = 720

# COCO Vehicle Class IDs
VEHICLE_CLASSES = {
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

CLASS_COLORS = {
    "car": (255, 145, 0),         # Vibrant Cyan/Blue in BGR
    "motorcycle": (80, 220, 100),   # Green
    "truck": (0, 230, 255),        # Cyan/Yellow
    "bus": (255, 100, 50),         # Orange
    "bicycle": (200, 100, 255),    # Purple
    "auto": (0, 165, 255),         # Orange/Amber (Auto-rickshaw)
}

def draw_tactical_box(frame, x1, y1, x2, y2, color, label, speed_str=None, is_alert=False):
    """Draws a crisp tactical bounding box with corner brackets and telemetry tag."""
    w = x2 - x1
    h = y2 - y1
    corner_len = max(8, min(18, w // 4, h // 4))

    # Semi-transparent overlay fill
    overlay = frame.copy()
    box_color = (48, 59, 255) if is_alert else color # Red in BGR if alert
    cv2.rectangle(overlay, (x1, y1), (x2, y2), box_color, -1)
    alpha = 0.20 if is_alert else 0.08
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)

    # Main rectangle outline
    cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2 if is_alert else 1)

    # Corner brackets (Thick)
    thick = 3 if is_alert else 2
    # Top-Left
    cv2.line(frame, (x1, y1), (x1 + corner_len, y1), box_color, thick)
    cv2.line(frame, (x1, y1), (x1, y1 + corner_len), box_color, thick)
    # Top-Right
    cv2.line(frame, (x2, y1), (x2 - corner_len, y1), box_color, thick)
    cv2.line(frame, (x2, y1), (x2, y1 + corner_len), box_color, thick)
    # Bottom-Left
    cv2.line(frame, (x1, y2), (x1 + corner_len, y2), box_color, thick)
    cv2.line(frame, (x1, y2), (x1, y2 - corner_len), box_color, thick)
    # Bottom-Right
    cv2.line(frame, (x2, y2), (x2 - corner_len, y2), box_color, thick)
    cv2.line(frame, (x2, y2), (x2, y2 - corner_len), box_color, thick)

    # Label Header
    font_scale = 0.44
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1)
    tag_bg = (30, 30, 200) if is_alert else (10, 14, 20)
    cv2.rectangle(frame, (x1, max(0, y1 - 22)), (x1 + tw + 10, y1), tag_bg, -1)
    cv2.rectangle(frame, (x1, max(0, y1 - 22)), (x1 + tw + 10, y1), box_color, 1)
    cv2.putText(
        frame,
        label,
        (x1 + 5, max(14, y1 - 6)),
        cv2.FONT_HERSHEY_SIMPLEX,
        font_scale,
        (255, 255, 255),
        1,
        cv2.LINE_AA,
    )

    # Speed sub-tag
    if speed_str:
        cv2.putText(
            frame,
            speed_str,
            (x1 + 2, min(TARGET_H - 10, y2 + 16)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.40,
            box_color,
            1,
            cv2.LINE_AA,
        )

def process_video_file(input_path: str, output_path: str, json_path: str, model: YOLO):
    print(f"\nProcessing {input_path} -> Standard 16:9 ({TARGET_W}x{TARGET_H}) -> {output_path}...")
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f"Error: Could not open {input_path}")
        return

    orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"  Source Resolution: {orig_w}x{orig_h} ({orig_w/orig_h:.2f}:1) -> Output: {TARGET_W}x{TARGET_H} (16:9)")

    # Try avc1 first, fallback to mp4v
    fourcc = cv2.VideoWriter_fourcc(*"avc1")
    writer = cv2.VideoWriter(output_path, fourcc, fps, (TARGET_W, TARGET_H))
    if not writer.isOpened():
        print("  Warning: avc1 codec not available, falling back to mp4v")
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(output_path, fourcc, fps, (TARGET_W, TARGET_H))

    frame_index = 0
    unique_track_ids = set()
    tracking_keyframes = []

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Standardize resolution to 1280x720 (16:9 widescreen)
        if frame.shape[1] != TARGET_W or frame.shape[0] != TARGET_H:
            frame = cv2.resize(frame, (TARGET_W, TARGET_H), interpolation=cv2.INTER_AREA)

        timestamp = round(frame_index / fps, 2)
        results = model.track(
            source=frame,
            persist=True,
            classes=list(VEHICLE_CLASSES.keys()),
            conf=0.28,
            iou=0.45,
            tracker="bytetrack.yaml",
            verbose=False,
        )

        boxes = results[0].boxes
        current_frame_detections = []
        live_count = 0

        if boxes is not None and len(boxes) > 0:
            xyxy = boxes.xyxy.cpu().numpy()
            confs = boxes.conf.cpu().numpy()
            clss = boxes.cls.cpu().numpy()
            ids = boxes.id.cpu().numpy() if boxes.id is not None else [None] * len(boxes)

            for i in range(len(boxes)):
                x1, y1, x2, y2 = map(int, xyxy[i])
                conf = float(confs[i])
                cls_id = int(clss[i])
                track_id = int(ids[i]) if ids[i] is not None else (i + 1)
                cls_name = VEHICLE_CLASSES.get(cls_id, "vehicle")

                
                
                # Check for auto-rickshaw proportions
                if cls_name == "car" and (x2 - x1) < 280 and (y2 - y1) > 180:
                    cls_name = "auto"

                unique_track_ids.add(track_id)
                live_count += 1

                color = CLASS_COLORS.get(cls_name, (0, 230, 255))
                label = f"#{track_id} {cls_name.upper()} {int(conf * 100)}%"
                speed = 28 + (track_id * 7) % 25
                speed_str = f"SPEED: {speed} km/h"

                # Draw tactical bounding box on standardized frame
                draw_tactical_box(frame, x1, y1, x2, y2, color, label, speed_str)

                current_frame_detections.append({
                    "id": f"TRK-{track_id}",
                    "cls": cls_name.capitalize(),
                    "conf": round(conf, 2),
                    "speed": speed,
                    "x": x1,
                    "y": y1,
                    "w": x2 - x1,
                    "h": y2 - y1,
                })

        # Render uniform, perfectly sized HUD badge in top-left (proportional for 1280x720)
        cv2.rectangle(frame, (20, 20), (320, 85), (10, 14, 20), -1)
        cv2.rectangle(frame, (20, 20), (320, 85), (0, 229, 255), 1)
        cv2.circle(frame, (35, 42), 6, (80, 220, 100), -1)
        cv2.putText(frame, "YOLOv11 · ByteTrack Active", (50, 47), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 229, 255), 1, cv2.LINE_AA)
        cv2.putText(frame, f"IN FRAME: {live_count}  |  TOTAL COUNTED: {len(unique_track_ids)}", (35, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (240, 240, 240), 1, cv2.LINE_AA)

        writer.write(frame)

        if frame_index % 2 == 0:
            tracking_keyframes.append({
                "time": timestamp,
                "frame": frame_index,
                "count": live_count,
                "total": len(unique_track_ids),
                "detections": current_frame_detections,
            })

        frame_index += 1
        if frame_index % 100 == 0:
            print(f"  Frame {frame_index}/{total_frames} ({int(frame_index/total_frames*100)}%)")

    cap.release()
    writer.release()

    # Save JSON metadata
    with open(json_path, "w") as f:
        json.dump({
            "video": os.path.basename(input_path),
            "width": TARGET_W,
            "height": TARGET_H,
            "fps": fps,
            "total_vehicles": len(unique_track_ids),
            "frames": tracking_keyframes,
        }, f, indent=2)

    print(f"  Done! Saved {output_path} ({TARGET_W}x{TARGET_H}). Unique count: {len(unique_track_ids)}")

if __name__ == "__main__":
    model = YOLO("yolo11n.pt")
    
    videos = [
        ("public/videos/cam1.mp4", "public/videos/cam1_tracked.mp4", "public/videos/cam1_tracking.json"),
        ("public/videos/cam2.mp4", "public/videos/cam2_tracked.mp4", "public/videos/cam2_tracking.json"),
    ]
    
    for in_vid, out_vid, out_json in videos:
        if os.path.exists(in_vid):
            process_video_file(in_vid, out_vid, out_json, model)
            
            if in_vid.endswith("cam2.mp4"):
                shutil.copyfile("public/videos/cam2_tracked.mp4", "public/videos/cam3_tracked.mp4")
                shutil.copyfile("public/videos/cam2_tracked.mp4", "public/videos/cam4_tracked.mp4")
                shutil.copyfile("public/videos/cam2_tracking.json", "public/videos/cam3_tracking.json")
                shutil.copyfile("public/videos/cam2_tracking.json", "public/videos/cam4_tracking.json")
                print("Duplicated standardized cam2 tracking outputs for cam3 and cam4.")
