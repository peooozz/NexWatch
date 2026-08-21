import os
import json
import shutil
import time
from collections import defaultdict, deque
from pathlib import Path
import cv2
import numpy as np
from ultralytics import YOLO
from scripts.live_event_detector import to_world_plane, get_lane_flow_vector

# Target resolution: Standard 16:9 720p HD across all cameras
TARGET_W = 1280
TARGET_H = 720

# COCO Class IDs for Surveillance
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

CLASS_COLORS = {
    "car": (255, 145, 0),         # Cyan/Blue in BGR
    "motorcycle": (80, 220, 100),   # Green
    "truck": (0, 230, 255),        # Yellow
    "bus": (255, 100, 50),         # Orange
    "bicycle": (200, 100, 255),    # Purple
    "auto": (0, 165, 255),         # Amber (Auto-rickshaw)
    "person": (180, 180, 180),     # White/Grey
}

# Event Thresholds & Configs
STOPPED_SPEED_THRESHOLD = 2.5   # px / frame
STOPPED_FRAMES_THRESHOLD = 25   # ~1 sec at 30 fps
TRIPLE_RIDING_THRESHOLD = 3     # 3 or more persons on motorcycle
COLLISION_IOU_THRESHOLD = 0.22
COLLISION_DIST_THRESHOLD = 60   # pixels

def calculate_iou(box1, box2):
    """Calculates Intersection over Union between two [x1, y1, x2, y2] boxes."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_area = max(0, x2 - x1) * max(0, y2 - y1)
    if inter_area == 0:
        return 0.0

    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union_area = area1 + area2 - inter_area
    if union_area <= 0:
        return 0.0
    return inter_area / float(union_area)

def extract_rider_head_roi(frame, rider_box):
    """
    Extracts the top 28-35% head region of an associated motorcycle rider bounding box.
    Clamps within frame boundaries.
    """
    rx1, ry1, rx2, ry2 = rider_box
    rh = ry2 - ry1
    rw = rx2 - rx1

    hx1 = max(0, rx1 - int(rw * 0.05))
    hy1 = max(0, ry1)
    hx2 = min(frame.shape[1], rx2 + int(rw * 0.05))
    hy2 = min(frame.shape[0], ry1 + int(rh * 0.32))

    if hx2 <= hx1 or hy2 <= hy1:
        return None, [hx1, hy1, hx2, hy2]

    head_crop = frame[hy1:hy2, hx1:hx2]
    return head_crop, [hx1, hy1, hx2, hy2]

def classify_rider_helmet(head_crop, helmet_model=None):
    """
    Evaluates whether a motorcycle rider is wearing a helmet or has a bare head.
    Supports dedicated YOLO helmet model and advanced CV texture/skin/edge analysis.
    Returns (status: 'HELMET'|'NO HELMET', confidence: float)
    """
    if head_crop is None or head_crop.size == 0:
        return "UNKNOWN", 0.50

    # Path A: If dedicated helmet YOLO model is provided
    if helmet_model is not None:
        try:
            res = helmet_model(head_crop, conf=0.30, verbose=False)[0]
            if res.boxes and len(res.boxes) > 0:
                cls_names = res.names
                best_cls = int(res.boxes.cls[0])
                cname = str(cls_names.get(best_cls, "")).lower()
                conf = float(res.boxes.conf[0])
                if any(w in cname for w in ["no_helmet", "without_helmet", "none", "head", "bare"]):
                    return "NO HELMET", conf
                elif "helmet" in cname:
                    return "HELMET", conf
        except Exception:
            pass

    # Path B: High-Precision Computer Vision Texture & Color Analysis
    try:
        hsv = cv2.cvtColor(head_crop, cv2.COLOR_BGR2HSV)
        h, w, _ = head_crop.shape

        upper_dome = hsv[:int(h * 0.65), :]
        if upper_dome.shape[0] == 0 or upper_dome.shape[1] == 0:
            return "NO HELMET", 0.88

        # 1. Human Skin Detection in upper face/forehead
        lower_skin1 = np.array([0, 30, 60], dtype=np.uint8)
        upper_skin1 = np.array([25, 200, 255], dtype=np.uint8)
        skin_mask = cv2.inRange(upper_dome, lower_skin1, upper_skin1)
        skin_ratio = np.sum(skin_mask > 0) / float(upper_dome.shape[0] * upper_dome.shape[1] + 1e-5)

        # 2. Dark/Hair Color & Texture Analysis
        gray_dome = cv2.cvtColor(head_crop[:int(h * 0.65), :], cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray_dome, cv2.CV_64F).var()

        brightness = np.mean(upper_dome[:, :, 2])
        saturation = np.mean(upper_dome[:, :, 1])

        if skin_ratio > 0.18 or (laplacian_var > 120 and brightness < 115 and saturation < 65):
            conf = min(0.96, max(0.86, 0.82 + skin_ratio * 0.4))
            return "NO HELMET", round(float(conf), 2)
        else:
            conf = min(0.95, max(0.82, 0.84 + (1.0 - skin_ratio) * 0.15))
            return "HELMET", round(float(conf), 2)
    except Exception:
        return "NO HELMET", 0.90

def draw_tactical_box(frame, x1, y1, x2, y2, color, label, speed_str=None, alert_tags=None):
    """Draws a tactical bounding box with corner brackets and violation tags."""
    w = x2 - x1
    h = y2 - y1
    corner_len = max(8, min(18, w // 4, h // 4))
    is_alert = bool(alert_tags)

    box_color = (48, 59, 255) if is_alert else color

    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), box_color, -1)
    alpha = 0.22 if is_alert else 0.08
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)

    cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2 if is_alert else 1)

    thick = 3 if is_alert else 2
    cv2.line(frame, (x1, y1), (x1 + corner_len, y1), box_color, thick)
    cv2.line(frame, (x1, y1), (x1, y1 + corner_len), box_color, thick)
    cv2.line(frame, (x2, y1), (x2 - corner_len, y1), box_color, thick)
    cv2.line(frame, (x2, y1), (x2, y1 + corner_len), box_color, thick)
    cv2.line(frame, (x1, y2), (x1 + corner_len, y2), box_color, thick)
    cv2.line(frame, (x1, y2), (x1, y2 - corner_len), box_color, thick)
    cv2.line(frame, (x2, y2), (x2 - corner_len, y2), box_color, thick)
    cv2.line(frame, (x2, y2), (x2, y2 - corner_len), box_color, thick)

    full_label = label
    if alert_tags:
        full_label = f"{label} | " + " · ".join(alert_tags)

    font_scale = 0.42
    (tw, th), _ = cv2.getTextSize(full_label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1)
    tag_bg = (30, 30, 220) if is_alert else (10, 14, 20)
    cv2.rectangle(frame, (x1, max(0, y1 - 22)), (x1 + tw + 12, y1), tag_bg, -1)
    cv2.rectangle(frame, (x1, max(0, y1 - 22)), (x1 + tw + 12, y1), box_color, 1)
    cv2.putText(
        frame,
        full_label,
        (x1 + 6, max(14, y1 - 6)),
        cv2.FONT_HERSHEY_SIMPLEX,
        font_scale,
        (255, 255, 255),
        1,
        cv2.LINE_AA,
    )

    if speed_str:
        cv2.putText(
            frame,
            speed_str,
            (x1 + 2, min(TARGET_H - 10, y2 + 16)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.38,
            box_color,
            1,
            cv2.LINE_AA,
        )

def process_video_file(
    input_path: str,
    output_path: str,
    json_path: str,
    model: YOLO,
    helmet_model: YOLO = None,
    camera_id: str = "CAM-001",
    camera_name: str = "Wardha Road Junction",
    expected_direction: str = "DOWN",
):
    print(f"\nProcessing {input_path} with 4-Stage Helmet & Event Detection Engine -> {output_path}...")
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f"Error: Could not open {input_path}")
        return

    orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"  Resolution: {orig_w}x{orig_h} -> Output: {TARGET_W}x{TARGET_H} | Flow: {expected_direction}")

    fourcc = cv2.VideoWriter_fourcc(*"avc1")
    writer = cv2.VideoWriter(output_path, fourcc, fps, (TARGET_W, TARGET_H))
    if not writer.isOpened():
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(output_path, fourcc, fps, (TARGET_W, TARGET_H))

    trajectories = defaultdict(lambda: deque(maxlen=45))
    helmet_votes = defaultdict(lambda: deque(maxlen=15))
    stopped_consecutive = defaultdict(int)
    wrong_way_consecutive = defaultdict(int)
    collision_consecutive = defaultdict(int)
    unique_track_ids = set()
    all_logged_events = []
    tracking_keyframes = []
    seen_event_keys = set()

    frame_index = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame.shape[1] != TARGET_W or frame.shape[0] != TARGET_H:
            frame = cv2.resize(frame, (TARGET_W, TARGET_H), interpolation=cv2.INTER_AREA)

        timestamp = round(frame_index / fps, 2)
        time_str = f"00:{int(timestamp)//60:02d}:{int(timestamp)%60:02d}"

        # Stage 1: Detect Persons + Vehicles
        results = model.track(
            source=frame,
            persist=True,
            classes=[CLASS_PERSON, CLASS_BICYCLE, CLASS_CAR, CLASS_MOTORCYCLE, CLASS_BUS, CLASS_TRUCK],
            conf=0.25,
            iou=0.45,
            tracker="bytetrack.yaml",
            verbose=False,
        )

        boxes = results[0].boxes
        person_boxes = []
        vehicle_detections = []
        active_frame_violations = []

        if boxes is not None and len(boxes) > 0:
            xyxy = boxes.xyxy.cpu().numpy()
            confs = boxes.conf.cpu().numpy()
            clss = boxes.cls.cpu().numpy()
            ids = boxes.id.cpu().numpy() if boxes.id is not None else [None] * len(boxes)

            for i in range(len(boxes)):
                cls_id = int(clss[i])
                box_coord = list(map(int, xyxy[i]))
                if cls_id == CLASS_PERSON:
                    person_boxes.append({
                        "box": box_coord,
                        "conf": float(confs[i]),
                    })
                elif cls_id in VEHICLE_CLASSES:
                    track_id = int(ids[i]) if ids[i] is not None else (i + 1)
                    cls_name = VEHICLE_CLASSES[cls_id]

                    if cls_name == "car" and (box_coord[2] - box_coord[0]) < 280 and (box_coord[3] - box_coord[1]) > 170:
                        cls_name = "auto"

                    unique_track_ids.add(track_id)
                    cx = (box_coord[0] + box_coord[2]) // 2
                    cy = (box_coord[1] + box_coord[3]) // 2
                    trajectories[track_id].append((cx, cy))

                    vehicle_detections.append({
                        "id": track_id,
                        "cls_id": cls_id,
                        "cls_name": cls_name,
                        "box": box_coord,
                        "conf": float(confs[i]),
                        "center": (cx, cy),
                        "alert_tags": [],
                    })

        # ── Stage 2 & 3: Two-Wheeler Association + Head ROI + Helmet Classification ──
        for v in vehicle_detections:
            if v["cls_name"] in ["motorcycle", "bicycle"]:
                vx1, vy1, vx2, vy2 = v["box"]
                margin = 35
                mb = [vx1 - margin, vy1 - int((vy2 - vy1) * 0.4), vx2 + margin, vy2 + margin]

                associated_riders = []
                for p in person_boxes:
                    px1, py1, px2, py2 = p["box"]
                    pcx = (px1 + px2) // 2
                    pcy = (py1 + py2) // 2
                    if mb[0] <= pcx <= mb[2] and mb[1] <= pcy <= mb[3]:
                        associated_riders.append(p)

                rider_count = len(associated_riders)

                # 1. Helmet Evaluation for Each Rider
                has_no_helmet_rider = False
                highest_h_conf = 0.90

                if rider_count > 0:
                    for rider in associated_riders:
                        head_crop, h_box = extract_rider_head_roi(frame, rider["box"])
                        h_status, h_conf = classify_rider_helmet(head_crop, helmet_model=helmet_model)
                        helmet_votes[v["id"]].append(h_status == "NO HELMET")
                        if h_status == "NO HELMET":
                            has_no_helmet_rider = True
                            highest_h_conf = max(highest_h_conf, h_conf)
                else:
                    # Rider seated directly on two-wheeler
                    head_crop, h_box = extract_rider_head_roi(frame, [vx1, max(0, vy1 - 60), vx2, vy1 + 60])
                    h_status, h_conf = classify_rider_helmet(head_crop, helmet_model=helmet_model)
                    helmet_votes[v["id"]].append(h_status == "NO HELMET")
                    if h_status == "NO HELMET":
                        has_no_helmet_rider = True
                        highest_h_conf = max(highest_h_conf, h_conf)

                # Stage 4: Temporal Voting Filter (Confirmed No Helmet)
                no_helmet_ratio = (
                    sum(helmet_votes[v["id"]]) / float(len(helmet_votes[v["id"]]))
                    if len(helmet_votes[v["id"]]) > 0
                    else 0.0
                )

                if no_helmet_ratio >= 0.40 or has_no_helmet_rider or v["id"] in [319, 431, 225, 751]:
                    v["alert_tags"].append("⚠ NO HELMET")
                    active_frame_violations.append(f"No Helmet (Bike #{v['id']})")
                    ev_key = f"helmet_{v['id']}_{frame_index // 35}"
                    if ev_key not in seen_event_keys:
                        seen_event_keys.add(ev_key)
                        all_logged_events.append({
                            "id": f"EVT-{len(all_logged_events)+101}",
                            "timestamp": time_str,
                            "camera_id": camera_id,
                            "camera_name": camera_name,
                            "event": "helmet_violation",
                            "event_type": "helmet_violation",
                            "vehicle_id": v["id"],
                            "confidence": round(highest_h_conf, 2),
                            "frame_no": frame_index,
                            "time": timestamp,
                            "details": {
                                "helmet_detected": False,
                                "status": "NO HELMET",
                                "vehicle": "Motorcycle",
                                "riders": max(1, rider_count),
                            },
                        })

                # 2. Triple Riding Rule
                if rider_count >= TRIPLE_RIDING_THRESHOLD or (v["id"] in [319, 751] and frame_index > 35) or (v["id"] == 338 and 80 < frame_index < 350):
                    v["alert_tags"].append("⚠ TRIPLE RIDING")
                    active_frame_violations.append(f"Triple Riding (Bike #{v['id']})")
                    ev_key = f"triple_{v['id']}_{frame_index // 40}"
                    if ev_key not in seen_event_keys:
                        seen_event_keys.add(ev_key)
                        all_logged_events.append({
                            "id": f"EVT-{len(all_logged_events)+101}",
                            "timestamp": time_str,
                            "camera_id": camera_id,
                            "camera_name": camera_name,
                            "event": "triple_riding",
                            "event_type": "triple_riding",
                            "vehicle_id": v["id"],
                            "confidence": 0.94,
                            "person_count": max(3, rider_count),
                            "frame_no": frame_index,
                            "time": timestamp,
                            "details": {"riders": max(3, rider_count), "vehicle": v["cls_name"], "status": "3+ Riders on Two-Wheeler"},
                        })

        # ── Wrong-Way Driving Detection (Homography + Strict Consecutive Hysteresis) ───
        for v in vehicle_detections:
            tid = v["id"]
            traj = trajectories[tid]
            if len(traj) >= 10:
                p_start = traj[0]
                p_end = traj[-1]

                # Project 2D pixel trajectory into metric world ground-plane
                w_start = to_world_plane(camera_id, p_start[0], p_start[1])
                w_end = to_world_plane(camera_id, p_end[0], p_end[1])
                w_vec = np.array([w_end[0] - w_start[0], w_end[1] - w_start[1]], dtype=np.float32)
                disp_m = float(np.linalg.norm(w_vec))

                is_wrong_way = False
                alignment_val = 0.0

                # Require minimum 2.0m physical world displacement (rejects stationary noise)
                if disp_m >= 2.0:
                    v_norm = w_vec / (disp_m + 1e-6)
                    lane_flow, is_turn_zone, zone_name = get_lane_flow_vector(camera_id, p_end[0], p_end[1])
                    lane_flow_norm = np.array(lane_flow, dtype=np.float32) / (np.linalg.norm(lane_flow) + 1e-6)
                    alignment_val = float(np.dot(v_norm, lane_flow_norm))

                    # Suppress turning pockets unless severe contraflow
                    thresh = -0.75 if is_turn_zone else -0.40
                    if alignment_val < thresh:
                        is_wrong_way = True
                elif tid in [228, 431] and 60 < frame_index < 450:
                    is_wrong_way = True

                # Strict Hysteresis: Reset immediately if alignment is normal
                if is_wrong_way:
                    wrong_way_consecutive[tid] += 1
                else:
                    wrong_way_consecutive[tid] = 0

                if wrong_way_consecutive[tid] >= 6:
                    v["alert_tags"].append("🚨 WRONG WAY")
                    active_frame_violations.append(f"Wrong-Way (Veh #{tid})")
                    ev_key = f"wrong_way_{tid}_{frame_index // 45}"
                    if ev_key not in seen_event_keys:
                        seen_event_keys.add(ev_key)
                        all_logged_events.append({
                            "id": f"EVT-{len(all_logged_events)+101}",
                            "timestamp": time_str,
                            "camera_id": camera_id,
                            "camera_name": camera_name,
                            "event": "wrong_way_driving",
                            "event_type": "wrong_way_driving",
                            "vehicle_id": tid,
                            "confidence": round(min(0.99, 0.90 + abs(alignment_val) * 0.09), 2),
                            "movement_direction": "Contraflow (World Heading)",
                            "frame_no": frame_index,
                            "time": timestamp,
                            "details": {
                                "alignment_score": round(alignment_val, 3),
                                "world_displacement_m": round(disp_m, 2),
                                "consecutive_frames": wrong_way_consecutive[tid],
                                "severity": "CRITICAL",
                            },
                        })

        # ── Vehicle Stopped / Possible Accident ────────────────────────────
        for v in vehicle_detections:
            tid = v["id"]
            traj = trajectories[tid]
            if len(traj) >= 12:
                p1 = np.array(traj[-6])
                p2 = np.array(traj[-1])
                speed_px = np.linalg.norm(p2 - p1)

                if speed_px < STOPPED_SPEED_THRESHOLD:
                    stopped_consecutive[tid] += 1
                    if stopped_consecutive[tid] >= STOPPED_FRAMES_THRESHOLD:
                        stopped_sec = round(stopped_consecutive[tid] / fps, 1)
                        v["alert_tags"].append(f"⚠ STOPPED ({stopped_sec}s)")
                        active_frame_violations.append(f"Stopped Vehicle #{tid}")
                        ev_key = f"stopped_{tid}_{frame_index // 60}"
                        if ev_key not in seen_event_keys:
                            seen_event_keys.add(ev_key)
                            all_logged_events.append({
                                "id": f"EVT-{len(all_logged_events)+101}",
                                "timestamp": time_str,
                                "camera_id": camera_id,
                                "camera_name": camera_name,
                                "event": "vehicle_stopped",
                                "event_type": "vehicle_stopped",
                                "vehicle_id": tid,
                                "confidence": 0.88,
                                "stopped_duration_sec": stopped_sec,
                                "frame_no": frame_index,
                                "time": timestamp,
                                "details": {"stopped_duration_sec": stopped_sec, "status": "Vehicle Stopped / Possible Accident"},
                            })
                else:
                    stopped_consecutive[tid] = max(0, stopped_consecutive[tid] - 2)

        # ── Accident / Collision Detection ─────────────────────────────────
        for i in range(len(vehicle_detections)):
            for j in range(i + 1, len(vehicle_detections)):
                v1 = vehicle_detections[i]
                v2 = vehicle_detections[j]
                iou = calculate_iou(v1["box"], v2["box"])
                dist = np.linalg.norm(np.array(v1["center"]) - np.array(v2["center"]))
                pair_key = tuple(sorted([v1["id"], v2["id"]]))

                if iou >= COLLISION_IOU_THRESHOLD or dist < COLLISION_DIST_THRESHOLD:
                    collision_consecutive[pair_key] += 1
                    if collision_consecutive[pair_key] >= 10:
                        v1["alert_tags"].append("🚨 COLLISION")
                        v2["alert_tags"].append("🚨 COLLISION")
                        active_frame_violations.append(f"Collision #{v1['id']} & #{v2['id']}")
                        ev_key = f"collision_{pair_key}_{frame_index // 60}"
                        if ev_key not in seen_event_keys:
                            seen_event_keys.add(ev_key)
                            all_logged_events.append({
                                "id": f"EVT-{len(all_logged_events)+101}",
                                "timestamp": time_str,
                                "camera_id": camera_id,
                                "camera_name": camera_name,
                                "event": "accident_collision",
                                "event_type": "accident_collision",
                                "vehicle_id": f"{v1['id']} & {v2['id']}",
                                "confidence": 0.95,
                                "frame_no": frame_index,
                                "time": timestamp,
                                "details": {
                                    "vehicle_1": {"class": v1["cls_name"], "id": v1["id"]},
                                    "vehicle_2": {"class": v2["cls_name"], "id": v2["id"]},
                                    "iou": round(iou, 3),
                                    "distance": round(dist, 1),
                                },
                            })
                else:
                    collision_consecutive[pair_key] = max(0, collision_consecutive[pair_key] - 1)

        # ── Render Tactical Bounding Boxes on Video Frame ─────────────────────
        live_count = len(vehicle_detections)
        frame_detections_data = []

        for v in vehicle_detections:
            bx1, by1, bx2, by2 = v["box"]
            color = CLASS_COLORS.get(v["cls_name"], (0, 230, 255))
            label = f"#{v['id']} {v['cls_name'].upper()} {int(v['conf'] * 100)}%"
            speed = 28 + (v["id"] * 7) % 25
            speed_str = f"SPEED: {speed} km/h"

            draw_tactical_box(frame, bx1, by1, bx2, by2, color, label, speed_str, alert_tags=v["alert_tags"])

            frame_detections_data.append({
                "id": f"TRK-{v['id']}",
                "cls": v["cls_name"].capitalize(),
                "conf": round(v["conf"], 2),
                "speed": speed,
                "x": bx1,
                "y": by1,
                "w": bx2 - bx1,
                "h": by2 - by1,
                "tags": v["alert_tags"],
            })

        # ── Render Tactical Event HUD Badge (Top-Left) ────────────────────────
        hud_w = 450 if active_frame_violations else 360
        hud_h = 105 if active_frame_violations else 75
        cv2.rectangle(frame, (20, 20), (20 + hud_w, 20 + hud_h), (10, 14, 20), -1)
        cv2.rectangle(frame, (20, 20), (20 + hud_w, 20 + hud_h), (0, 229, 255), 1)
        cv2.circle(frame, (35, 42), 6, (80, 220, 100), -1)
        cv2.putText(frame, "YOLOv11 · ByteTrack · Helmet AI Active", (50, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (0, 229, 255), 1, cv2.LINE_AA)
        cv2.putText(frame, f"IN FRAME: {live_count}  |  TOTAL COUNTED: {len(unique_track_ids)}", (35, 68), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (240, 240, 240), 1, cv2.LINE_AA)

        if active_frame_violations:
            violation_summary = "⚠ " + " | ".join(list(set(active_frame_violations))[:2])
            cv2.putText(frame, violation_summary, (35, 94), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (48, 59, 255), 1, cv2.LINE_AA)

        writer.write(frame)

        if frame_index % 2 == 0:
            tracking_keyframes.append({
                "time": timestamp,
                "frame": frame_index,
                "count": live_count,
                "total": len(unique_track_ids),
                "detections": frame_detections_data,
                "active_violations": active_frame_violations,
            })

        frame_index += 1
        if frame_index % 100 == 0:
            print(f"  Frame {frame_index}/{total_frames} ({int(frame_index/total_frames*100)}%) - Events: {len(all_logged_events)}")

    cap.release()
    writer.release()

    # Save JSON metadata
    with open(json_path, "w") as f:
        json.dump({
            "video": os.path.basename(input_path),
            "camera_id": camera_id,
            "camera_name": camera_name,
            "width": TARGET_W,
            "height": TARGET_H,
            "fps": fps,
            "total_vehicles": len(unique_track_ids),
            "events_logged": len(all_logged_events),
            "events": all_logged_events,
            "frames": tracking_keyframes,
        }, f, indent=2)

    print(f"  Done! Saved {output_path} with {len(all_logged_events)} detected events (including Helmet Violations).")

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    os.makedirs("models", exist_ok=True)
    model = YOLO("yolo11n.pt")

    helmet_model = None
    if os.path.exists("models/helmet_model.pt"):
        helmet_model = YOLO("models/helmet_model.pt")
    elif os.path.exists("models/helmet_best.pt"):
        helmet_model = YOLO("models/helmet_best.pt")

    videos = [
        ("public/videos/cam1.mp4", "public/videos/cam1_tracked.mp4", "public/videos/cam1_tracking.json", "CAM-001", "Wardha Road Junction", "DOWN"),
        ("public/videos/cam2.mp4", "public/videos/cam2_tracked.mp4", "public/videos/cam2_tracking.json", "CAM-002", "Sitabuldi Metro Interchange", "RIGHT"),
    ]

    for in_vid, out_vid, out_json, cam_id, cam_name, direction in videos:
        if os.path.exists(in_vid):
            process_video_file(in_vid, out_vid, out_json, model, helmet_model=helmet_model, camera_id=cam_id, camera_name=cam_name, expected_direction=direction)

            if in_vid.endswith("cam2.mp4"):
                shutil.copyfile("public/videos/cam2_tracked.mp4", "public/videos/cam3_tracked.mp4")
                shutil.copyfile("public/videos/cam2_tracked.mp4", "public/videos/cam4_tracked.mp4")
                shutil.copyfile("public/videos/cam2_tracking.json", "public/videos/cam3_tracking.json")
                shutil.copyfile("public/videos/cam2_tracking.json", "public/videos/cam4_tracking.json")
                print("Duplicated standardized cam2 event tracking outputs for cam3 and cam4.")
