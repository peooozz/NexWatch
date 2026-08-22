"""
NexWatch — Push-Based Mobile Camera Ingestion Route & WebSocket Engine
=======================================================================
Enables mobile phones and edge devices to push live video frames outbound to the
cloud (Render / FastAPI) over WebSockets, completely bypassing CGNAT, mobile firewalls,
and dynamic IP changes.

Key Features:
  - WebSocket Ingestion: wss://<host>/ws/stream?cam_id=<id>&key=<secret>
  - Per-Camera Authentication: Validates credentials against provisioned keys.
  - Backpressure Queue: Bounded asyncio queue (size=2) with "latest frame wins" eviction.
  - Low-Latency Processing: Binary JPEG decoding via OpenCV and direct integration with AI detection engine.
  - Zero-Restart Auto-Recovery: Seamlessly handles disconnects and re-accepts new sessions for the same cam_id.
  - Operational Telemetry & Health Checks: Detailed per-camera connection lifecycle logging & health metrics.
"""

import time
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from collections import deque

import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException, status
from pydantic import BaseModel

from backend.config import settings
from backend.services.mobile_stream_detector import mobile_live_detector
from backend.services.event_bus import event_bus

logger = logging.getLogger("CameraIngest")

router = APIRouter(tags=["Camera Push Ingestion"])

# WebSocket Closure Codes
WS_CLOSE_UNAUTHORIZED = 4001
WS_CLOSE_CONFLICT = 4002
WS_CLOSE_INSECURE = 4003
WS_CLOSE_RATE_LIMITED = 4004


# ═════════════════════════════════════════════════════════════════════════════
# Ingestion Camera State & Lifecycle Registry
# ═════════════════════════════════════════════════════════════════════════════

class CameraStreamState:
    """Tracks the real-time operational state of a registered camera stream."""

    def __init__(self, camera_id: str, name: str = "Mobile Camera Node"):
        self.camera_id = camera_id
        self.name = name
        self.status = "never_connected"  # "never_connected" | "online" | "offline"
        self.active_websocket: Optional[WebSocket] = None
        self.connected_at: Optional[datetime] = None
        self.last_frame_at: Optional[datetime] = None
        self.last_disconnect_at: Optional[datetime] = None
        self.last_disconnect_reason: Optional[str] = None
        self.total_frames_received: int = 0
        self.total_frames_processed: int = 0
        self.total_frames_dropped: int = 0
        self.resolution: str = "Unknown"
        self.disconnect_count: int = 0
        self._frame_times: deque = deque(maxlen=30)
        self.achieved_fps: float = 0.0
        self.last_infer_latency_ms: float = 0.0

    def mark_connected(self, websocket: WebSocket):
        self.active_websocket = websocket
        self.status = "online"
        self.connected_at = datetime.utcnow()
        self.last_disconnect_reason = None
        self._frame_times.clear()
        self.achieved_fps = 0.0

    def record_frame(self, w: int, h: int, latency_ms: float):
        now = time.time()
        self.total_frames_received += 1
        self.last_frame_at = datetime.utcnow()
        self.resolution = f"{w}x{h}"
        self.last_infer_latency_ms = latency_ms

        self._frame_times.append(now)
        if len(self._frame_times) >= 2:
            duration = self._frame_times[-1] - self._frame_times[0]
            if duration > 0:
                self.achieved_fps = round((len(self._frame_times) - 1) / duration, 1)

    def mark_disconnected(self, reason: str = "Client disconnected"):
        self.active_websocket = None
        self.status = "offline"
        self.last_disconnect_at = datetime.utcnow()
        self.last_disconnect_reason = reason
        self.disconnect_count += 1
        self.achieved_fps = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "camera_id": self.camera_id,
            "name": self.name,
            "status": self.status,
            "is_streaming": self.status == "online",
            "connected_at": self.connected_at.isoformat() + "Z" if self.connected_at else None,
            "last_frame_at": self.last_frame_at.isoformat() + "Z" if self.last_frame_at else None,
            "last_disconnect_at": self.last_disconnect_at.isoformat() + "Z" if self.last_disconnect_at else None,
            "last_disconnect_reason": self.last_disconnect_reason,
            "total_frames_received": self.total_frames_received,
            "total_frames_processed": self.total_frames_processed,
            "total_frames_dropped": self.total_frames_dropped,
            "achieved_fps": self.achieved_fps,
            "resolution": self.resolution,
            "disconnect_count": self.disconnect_count,
            "last_infer_latency_ms": self.last_infer_latency_ms,
        }


class CameraIngestRegistry:
    """Global in-memory registry managing all push-capable mobile & edge camera slots."""

    def __init__(self):
        self._cameras: Dict[str, CameraStreamState] = {}
        self._initialize_from_config()

    def _initialize_from_config(self):
        keys = settings.CAMERA_INGEST_KEYS
        if isinstance(keys, dict):
            for cam_id in keys.keys():
                self._cameras[cam_id] = CameraStreamState(
                    camera_id=cam_id,
                    name=f"Mobile Rapid Deployment ({cam_id})"
                )

    def get_or_create(self, camera_id: str) -> CameraStreamState:
        if camera_id not in self._cameras:
            self._cameras[camera_id] = CameraStreamState(camera_id=camera_id)
        return self._cameras[camera_id]

    def authenticate(self, camera_id: str, secret_key: str) -> bool:
        keys = settings.CAMERA_INGEST_KEYS
        if not isinstance(keys, dict):
            return False
        expected_key = keys.get(camera_id)
        if not expected_key:
            return False
        return expected_key == secret_key

    def get_all_states(self) -> Dict[str, Dict[str, Any]]:
        return {cam_id: state.to_dict() for cam_id, state in self._cameras.items()}


# Global singleton registry
camera_ingest_registry = CameraIngestRegistry()


# ═════════════════════════════════════════════════════════════════════════════
# WebSocket Ingestion Endpoint: wss://<host>/ws/stream
# ═════════════════════════════════════════════════════════════════════════════

@router.websocket("/ws/stream")
async def websocket_camera_ingest(
    websocket: WebSocket,
    cam_id: str = Query(..., description="Camera ID e.g. CAM-MOBILE-01"),
    key: str = Query(..., description="Secret per-camera authentication token"),
):
    """
    Production-Grade Push Ingestion Endpoint.
    Mobile phones stream JPEG frames outbound to this endpoint.

    Query Parameters:
      - cam_id: Registered camera identifier
      - key: Per-camera authentication key
    """
    # 1. Transport Security Check (Enforce WSS in production if configured)
    if settings.REQUIRE_SECURE_WS:
        forwarded_proto = websocket.headers.get("x-forwarded-proto", "")
        if forwarded_proto and forwarded_proto != "https":
            logger.warning(f"[IngestWS] Insecure connection attempt rejected for {cam_id}")
            await websocket.close(code=WS_CLOSE_INSECURE, reason="Secure WSS required")
            return

    # 2. Authentication Check
    if not camera_ingest_registry.authenticate(cam_id, key):
        logger.warning(f"[IngestWS] Auth failed for camera '{cam_id}' with key '{key[:4] if key else ''}***'")
        await websocket.close(code=WS_CLOSE_UNAUTHORIZED, reason="Invalid camera ID or secret key")
        return

    # 3. Session Conflict Check (Single active connection per camera slot)
    state = camera_ingest_registry.get_or_create(cam_id)
    if state.active_websocket is not None:
        logger.warning(f"[IngestWS] Camera '{cam_id}' already has an active stream. Closing existing connection.")
        try:
            await state.active_websocket.close(
                code=WS_CLOSE_CONFLICT, reason="New connection superseded this session"
            )
        except Exception:
            pass

    # Accept WebSocket connection
    await websocket.accept()
    state.mark_connected(websocket)
    logger.info(f"[IngestWS] 🟢 Camera '{cam_id}' connected and authenticated successfully.")

    # 4. Backpressure Frame Queue (Bounded size, "latest frame wins")
    frame_queue: asyncio.Queue = asyncio.Queue(maxsize=max(1, settings.INGEST_QUEUE_MAXSIZE))
    stop_event = asyncio.Event()

    # Background detection worker consuming from the frame queue
    async def detection_worker():
        while not stop_event.is_set():
            try:
                # Wait for next frame with timeout to permit clean cancellation
                raw_bytes = await asyncio.wait_for(frame_queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break

            try:
                # Decode JPEG bytes to BGR image array via OpenCV
                np_arr = np.frombuffer(raw_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

                if frame is not None:
                    h, w = frame.shape[:2]
                    # Run sampled AI inference & tracking via MobileLiveDetector
                    infer_result = mobile_live_detector.process_frame(frame)
                    latency = infer_result.get("latency_ms", 15.0)

                    state.total_frames_processed += 1
                    state.record_frame(w, h, latency)

                    # If an incident was detected, dispatch event to the shared event_bus
                    detections = infer_result.get("detections", [])
                    for d in detections:
                        if d.get("isIncident"):
                            event_obj = {
                                "id": f"ALT-{cam_id}-{int(time.time()*1000) % 100000}",
                                "timestamp": datetime.utcnow().isoformat() + "Z",
                                "camera_id": cam_id,
                                "cctv_area_name": state.name,
                                "event_type": d.get("tags", ["incident"])[0].replace("🚨", "").strip().lower(),
                                "severity": "critical" if "COLLISION" in str(d.get("tags")) else "high",
                                "confidence": d.get("confidence", 0.95),
                                "track_id": f"TRK-{d.get('track_id')}",
                                "vehicle_class": d.get("class_name", "Vehicle").title(),
                                "license_plate": "MH-31-LIVE-MOB",
                                "location_details": f"{state.name} (Live Ingest)",
                                "speed_kmh": d.get("speed", 0.0),
                                "description": f"Real-time violation detected on mobile feed {cam_id}",
                            }
                            await event_bus.publish(event_obj)
                else:
                    logger.warning(f"[IngestWS] Corrupt frame received from {cam_id}; cv2.imdecode returned None")
            except Exception as ex:
                logger.error(f"[IngestWS] Error processing frame from {cam_id}: {ex}")
            finally:
                frame_queue.task_done()

    worker_task = asyncio.create_task(detection_worker())
    frame_counter = 0

    try:
        while True:
            # Receive binary frame bytes from mobile client
            message = await websocket.receive()
            msg_type = message.get("type", "")
            if msg_type == "websocket.disconnect":
                logger.info(f"[IngestWS] Disconnect message received for {cam_id}")
                break

            if "bytes" in message and message["bytes"]:
                frame_bytes = message["bytes"]
            elif "text" in message and message["text"]:
                # Base64 fallback if client sends text data URL
                import base64
                text_data = message["text"]
                if "," in text_data:
                    text_data = text_data.split(",")[1]
                frame_bytes = base64.b64decode(text_data)
            else:
                continue

            frame_counter += 1

            # Backpressure: If queue is full, discard oldest unread frame
            if frame_queue.full():
                try:
                    _ = frame_queue.get_nowait()
                    frame_queue.task_done()
                    state.total_frames_dropped += 1
                except (asyncio.QueueEmpty, ValueError):
                    pass

            await frame_queue.put(frame_bytes)

            # Send lightweight frame ACK to unblock client-side transmission loop
            await websocket.send_json({
                "status": "ack",
                "frame": frame_counter,
                "fps": state.achieved_fps,
                "latency_ms": state.last_infer_latency_ms,
            })

    except WebSocketDisconnect:
        logger.info(f"[IngestWS] 🔴 Camera '{cam_id}' disconnected cleanly.")
        state.mark_disconnected(reason="Client disconnected cleanly")
    except Exception as e:
        logger.warning(f"[IngestWS] ⚠️ Connection dropped for camera '{cam_id}': {e}")
        state.mark_disconnected(reason=f"Connection error: {e}")
    finally:
        stop_event.set()
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass


# ═════════════════════════════════════════════════════════════════════════════
# Health & Status REST Endpoints
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/api/ingest/health")
def get_ingest_health():
    """
    Detailed operational health status for on-call debugging and monitoring.
    Distinguishes:
      - never_connected: Camera provisioned but field staff has not started stream.
      - online: Actively receiving frames with current FPS.
      - offline: Was connected earlier, currently dropped.
    """
    states = camera_ingest_registry.get_all_states()
    active_count = sum(1 for s in states.values() if s["status"] == "online")
    total_count = len(states)

    return {
        "status": "healthy",
        "service": "NexWatch Mobile Push Ingestion Engine",
        "active_streams": active_count,
        "provisioned_slots": total_count,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "cameras": states,
    }


class CameraProvisionRequest(BaseModel):
    camera_id: str
    name: Optional[str] = None
    secret_key: str


@router.post("/api/ingest/provision")
def provision_camera_slot(payload: CameraProvisionRequest):
    """Dynamically registers or updates a camera slot with a secure authentication key."""
    if not payload.camera_id or not payload.secret_key:
        raise HTTPException(status_code=400, detail="camera_id and secret_key are required")

    keys = settings.CAMERA_INGEST_KEYS
    if isinstance(keys, dict):
        keys[payload.camera_id] = payload.secret_key
    state = camera_ingest_registry.get_or_create(payload.camera_id)
    if payload.name:
        state.name = payload.name

    logger.info(f"[IngestProvision] Provisioned camera '{payload.camera_id}' ({state.name})")
    return {
        "success": True,
        "camera_id": payload.camera_id,
        "name": state.name,
        "websocket_url": f"/ws/stream?cam_id={payload.camera_id}&key={payload.secret_key}",
    }


@router.get("/api/ingest/cameras")
def list_ingest_cameras():
    """Lists all provisioned mobile camera slots and their live streaming status."""
    return {
        "success": True,
        "cameras": camera_ingest_registry.get_all_states(),
    }
