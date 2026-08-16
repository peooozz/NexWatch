import asyncio
import logging
import random
from datetime import datetime
from backend.config import settings
from backend.database import SessionLocal
from backend.models.alert import IncidentAlert
from backend.routes.websocket import manager

logger = logging.getLogger(__name__)

CAMERAS_META = [
    {"id": "CAM-001", "name": "Wardha Road Junction"},
    {"id": "CAM-002", "name": "Sitabuldi Metro Interchange"},
    {"id": "CAM-003", "name": "Dharampeth Traffic Circle"},
    {"id": "CAM-004", "name": "Ambazari Lake Promenade"},
]

EVENT_TYPES = [
    {"type": "illegal_parking", "severity": "high", "object_class": "Sedan"},
    {"type": "wrong_way", "severity": "critical", "object_class": "Motorcycle"},
    {"type": "speed_violation", "severity": "high", "object_class": "SUV"},
    {"type": "loitering", "severity": "medium", "object_class": "Pedestrian"},
    {"type": "crowd_density", "severity": "critical", "object_class": "Crowd Group"},
    {"type": "restricted_perimeter", "severity": "high", "object_class": "Truck"},
]

PLATES = [
    "MH-31-EQ-4892",
    "MH-31-AB-1204",
    "MH-40-TR-8812",
    "MH-31-DF-9021",
    "MH-49-K-4421",
    "MH-31-ZZ-9901",
]

async def start_detection_loop():
    """
    Background simulation & AI orchestration worker that generates incident detections,
    records them to the PostgreSQL database, and broadcasts them via WebSockets
    to all active Next.js dashboard clients.
    """
    logger.info("Starting CityEye Live AI Detection background pipeline...")
    await asyncio.sleep(2)  # Startup warmup

    while True:
        try:
            cam = random.choice(CAMERAS_META)
            event = random.choice(EVENT_TYPES)
            alert_id = f"ALT-{random.randint(100, 999)}"
            track_id = f"TRK-{random.randint(100, 999)}"
            plate = random.choice(PLATES)
            speed = (
                round(random.uniform(72.0, 95.0), 1)
                if event["type"] == "speed_violation"
                else round(random.uniform(22.0, 52.0), 1)
            )
            vehicle_count = (
                random.randint(1, 5)
                if event["type"] != "crowd_density"
                else random.randint(15, 60)
            )
            confidence = round(random.uniform(0.88, 0.98), 2)
            latency_ms = random.randint(11, 24)
            now_iso = datetime.utcnow().isoformat() + "Z"

            # 1. Prepare JSON payload for WebSockets
            alert_payload = {
                "id": alert_id,
                "camera_id": cam["id"],
                "camera_name": cam["name"],
                "event_type": event["type"],
                "severity": event["severity"],
                "confidence": confidence,
                "track_id": track_id,
                "vehicle_count": vehicle_count,
                "detected_at": now_iso,
                "delivered_at": now_iso,
                "latency_ms": latency_ms,
                "status": "new",
                "snapshot_url": "/snapshots/sample.jpg",
                "vehicle_details": {
                    "objectClass": event["object_class"],
                    "licensePlate": plate,
                    "plateConfidence": round(random.uniform(0.91, 0.99), 2),
                    "speedKmph": speed,
                },
            }

            # 2. Persist to PostgreSQL
            try:
                db = SessionLocal()
                db_alert = IncidentAlert(
                    id=alert_id,
                    camera_id=cam["id"],
                    camera_name=cam["name"],
                    event_type=event["type"],
                    severity=event["severity"],
                    confidence=confidence,
                    track_id=track_id,
                    vehicle_count=vehicle_count,
                    object_class=event["object_class"],
                    license_plate=plate,
                    speed_kmph=speed,
                    latency_ms=latency_ms,
                    status="new",
                    snapshot_url="/snapshots/sample.jpg",
                    detected_at=datetime.utcnow(),
                    delivered_at=datetime.utcnow(),
                )
                db.add(db_alert)
                db.commit()
                db.close()
            except Exception as db_err:
                logger.debug(
                    f"PostgreSQL storage log skipped (DB may be offline during development): {db_err}"
                )

            # 3. Broadcast to all connected WebSocket clients
            await manager.broadcast_json(alert_payload)
            logger.info(
                f"[AI Engine] Live alert {alert_id} ({event['type']}) broadcasted on {cam['id']}"
            )

        except asyncio.CancelledError:
            logger.info("Detection loop cancelled cleanly.")
            break
        except Exception as e:
            logger.error(f"Error in detection worker: {e}")

        # Sleep between detection intervals (e.g. 8-14 seconds)
        interval = max(3.0, settings.WS_BROADCAST_INTERVAL)
        sleep_sec = random.uniform(interval * 0.8, interval * 1.3)
        await asyncio.sleep(sleep_sec)
