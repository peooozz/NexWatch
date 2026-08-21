"""
FastAPI Endpoints for Dedicated Mobile Phone / Ngrok Live Stream Detection
==========================================================================
Route Prefix: /api/live (used specifically by http://localhost:3000/dashboard/events)
"""

import json
import logging
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException

from backend.config import settings
from backend.services.mobile_stream_detector import mobile_live_detector

logger = logging.getLogger("LiveStreamRoutes")

router = APIRouter(prefix="/live", tags=["Live Mobile Stream"])

class FrameProcessRequest(BaseModel):
    image: str  # Base64 data URL or JPEG string
    camera_id: Optional[str] = "PHONE-IP-01"
    camera_name: Optional[str] = "Live Mobile Stream"

class StreamConfigUpdate(BaseModel):
    stream_url: Optional[str] = None
    sample_rate: Optional[int] = 3

@router.get("/status")
def get_live_detector_status():
    """Returns the current configuration of the lightweight mobile live detector."""
    return {
        "status": "online",
        "model": mobile_live_detector.model_name,
        "sample_rate": mobile_live_detector.sample_rate,
        "active_stream_url": mobile_live_detector.active_stream_url,
        "total_frames_processed": mobile_live_detector.frame_counter,
        "description": "Dedicated lightweight YOLOv11 Nano detector for /dashboard/events route",
    }

@router.get("/detections")
def get_live_detections():
    """Returns the latest bounding boxes, speeds, and incidents for the live stream."""
    return mobile_live_detector.get_latest_state()

@router.post("/config")
def update_live_stream_config(payload: StreamConfigUpdate):
    """Updates the active ngrok URL or frame sampling rate dynamically."""
    if payload.stream_url is not None:
        mobile_live_detector.set_stream_url(payload.stream_url)
    if payload.sample_rate is not None:
        mobile_live_detector.set_sample_rate(payload.sample_rate)
    return {
        "success": True,
        "active_stream_url": mobile_live_detector.active_stream_url,
        "sample_rate": mobile_live_detector.sample_rate,
    }

@router.post("/process-frame")
def process_client_frame(payload: FrameProcessRequest):
    """
    Ingests and processes a live camera/mobile frame sent from /dashboard/events.
    Runs sampled YOLOv11 Nano + ByteTrack inference.
    """
    if not payload.image:
        raise HTTPException(status_code=400, detail="Image frame cannot be empty")

    result = mobile_live_detector.process_b64_frame(payload.image)
    return result

@router.websocket("/ws/stream")
async def live_stream_websocket(websocket: WebSocket):
    """
    Bidirectional WebSocket stream for ultra-low latency frame ingestion and detection broadcast.
    Client sends base64 frames -> Server returns detected bounding boxes and tracking tags.
    """
    await websocket.accept()
    logger.info("[LiveWS] Client connected to dedicated /dashboard/events WebSocket pipeline.")
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                frame_b64 = msg.get("image", "")
                if frame_b64:
                    result = mobile_live_detector.process_b64_frame(frame_b64)
                    await websocket.send_text(json.dumps(result))
                else:
                    await websocket.send_text(json.dumps({"success": False, "error": "No image field"}))
            except json.JSONDecodeError:
                # Raw base64 string fallback
                result = mobile_live_detector.process_b64_frame(data)
                await websocket.send_text(json.dumps(result))
    except WebSocketDisconnect:
        logger.info("[LiveWS] Client disconnected from live stream WebSocket.")
    except Exception as e:
        logger.error(f"[LiveWS] Error: {e}")
