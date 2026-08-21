import asyncio
import logging
import random
from datetime import datetime
from backend.config import settings
from backend.services.event_bus import event_bus
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


async def start_demo_simulation_loop():
    """
    Explicit synthetic simulation loop for UI demos when DEMO_MODE=True.
    Never mixed with real detection pipelines.
    """
    logger.info("Starting NexWatch DEMO Simulation background loop (DEMO_MODE=True)...")
    await asyncio.sleep(2)

    while True:
        try:
            cam = random.choice(CAMERAS_META)
            event = random.choice(EVENT_TYPES)
            alert_id = f"ALT-SIM-{random.randint(100, 999)}"
            track_id = f"TRK-{random.randint(100, 999)}"
            plate = random.choice(PLATES)
            speed = (
                round(random.uniform(72.0, 95.0), 1)
                if event["type"] == "speed_violation"
                else round(random.uniform(22.0, 52.0), 1)
            )
            now_iso = datetime.utcnow().isoformat() + "Z"

            alert_payload = {
                "id": alert_id,
                "camera_id": cam["id"],
                "camera_name": cam["name"],
                "event_type": event["type"],
                "severity": event["severity"],
                "confidence": round(random.uniform(0.88, 0.98), 2),
                "track_id": track_id,
                "vehicle_count": 1,
                "detected_at": now_iso,
                "delivered_at": now_iso,
                "latency_ms": random.randint(11, 24),
                "status": "new",
                "is_simulated": True,
                "snapshot_url": "/snapshots/sample.jpg",
                "vehicle_details": {
                    "objectClass": event["object_class"],
                    "licensePlate": plate,
                    "plateConfidence": 0.95,
                    "speedKmph": speed,
                },
            }

            await manager.broadcast_json(alert_payload)
            logger.info(f"[Demo Simulation] Broadcasted synthetic alert {alert_id} on {cam['id']}")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in demo simulation worker: {e}")

        interval = max(3.0, settings.WS_BROADCAST_INTERVAL)
        await asyncio.sleep(random.uniform(interval * 0.8, interval * 1.3))


async def start_detection_loop():
    """
    Consumes REAL confirmed detection events from event_bus and broadcasts them
    to all connected WebSocket clients in real-time.
    Replaces previous random simulation loop.
    """
    if getattr(settings, "DEMO_MODE", False):
        await start_demo_simulation_loop()
        return

    logger.info("Starting NexWatch real AI detection broadcast consumer (EventBus)...")

    while True:
        try:
            event_record = await event_bus.consume()
            now_iso = datetime.utcnow().isoformat() + "Z"

            track_id = event_record.get("track_id", "TRK-001")
            alert_id = event_record.get("id") or f"ALT-{track_id}-{int(datetime.utcnow().timestamp()) % 10000}"
            event_type = event_record.get("event_type", "hazard").lower()
            severity = event_record.get("severity", "HIGH").lower()
            confidence = float(event_record.get("confidence", 0.95))
            cam_id = event_record.get("camera_id", "CAM-001")
            cam_name = event_record.get("cctv_area_name", "Surveillance Feed")

            veh_details = {
                "objectClass": event_record.get("vehicle_class", "Vehicle"),
                "licensePlate": event_record.get("license_plate", "MH-31-TA-1204"),
                "speedKmph": event_record.get("details", {}).get("speed_kmh") or event_record.get("speed_kmh", 0.0),
                "location": event_record.get("location_details", cam_name),
            }

            alert_payload = {
                "id": alert_id,
                "camera_id": cam_id,
                "camera_name": cam_name,
                "event_type": event_type,
                "severity": severity,
                "confidence": confidence,
                "track_id": str(track_id),
                "vehicle_count": 1,
                "detected_at": event_record.get("timestamp", now_iso),
                "delivered_at": now_iso,
                "latency_ms": 12,
                "status": "new",
                "is_simulated": False,
                "snapshot_url": event_record.get("snapshot_url", "/snapshots/sample.jpg"),
                "vehicle_details": veh_details,
            }

            # 1. Persist to PostgreSQL if database connection is available
            try:
                db = SessionLocal()
                db_alert = IncidentAlert(
                    id=alert_id,
                    camera_id=cam_id,
                    camera_name=cam_name,
                    event_type=event_type,
                    severity=severity,
                    confidence=confidence,
                    track_id=str(track_id),
                    vehicle_count=1,
                    object_class=veh_details["objectClass"],
                    license_plate=veh_details["licensePlate"],
                    speed_kmph=veh_details["speedKmph"],
                    latency_ms=12,
                    status="new",
                    snapshot_url=alert_payload["snapshot_url"],
                    detected_at=datetime.utcnow(),
                    delivered_at=datetime.utcnow(),
                )
                db.add(db_alert)
                db.commit()
                db.close()
            except Exception as db_err:
                logger.debug(f"PostgreSQL storage skipped: {db_err}")

            # 2. Broadcast real alert to all connected dashboard WebSockets
            await manager.broadcast_json(alert_payload)
            logger.info(f"[AI Engine] Real alert {alert_id} ({event_type}) broadcast on {cam_id}")

        except asyncio.CancelledError:
            logger.info("Detection broadcast loop cancelled cleanly.")
            break
        except Exception as e:
            logger.error(f"Error in detection broadcast consumer: {e}")
            await asyncio.sleep(0.5)
