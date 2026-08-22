import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.database import Base, engine
from backend.routes.alerts import router as alerts_router
from backend.routes.cameras import router as cameras_router
from backend.routes.websocket import router as ws_router
from backend.routes.live_stream import router as live_stream_router
from backend.routes.camera_ingest import router as camera_ingest_router
from backend.services.detection_service import start_detection_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s",
)
logger = logging.getLogger("cityeye-backend")

async def periodic_whatsapp_sos_loop():
    """Background task that automatically sends a critical CCTV incident alert every 10 minutes (600 seconds)."""
    from backend.services.whatsapp_dispatcher import dispatch_whatsapp_notification
    import random

    CRITICAL_SCENARIOS = [
        {
            "camera_id": "CAM-003",
            "camera_name": "Dharampeth Traffic Circle",
            "event_type": "accident_collision",
            "severity": "critical",
            "confidence": 1.0,
            "track_id": "TRK-301 x TRK-303",
            "license_plate": "MH 31 TC 3341 & BEST-904",
            "vehicle_class": "Auto-Rickshaw / City Bus",
        },
        {
            "camera_id": "CAM-004",
            "camera_name": "Ambazari Lake Promenade",
            "event_type": "crowd_density",
            "severity": "critical",
            "confidence": 0.98,
            "track_id": "CRWD-401",
            "license_plate": "PEDESTRIAN ZONE",
            "vehicle_class": "High-Density Surge (140+ Pedestrians)",
        },
        {
            "camera_id": "CAM-001",
            "camera_name": "Wardha Road 4-Way Junction",
            "event_type": "wrong_way",
            "severity": "critical",
            "confidence": 0.97,
            "track_id": "TRK-108",
            "license_plate": "MH 31 ER 8821",
            "vehicle_class": "Auto-Rickshaw (Contraflow)",
        },
        {
            "camera_id": "CAM-002",
            "camera_name": "Sitabuldi Metro Interchange",
            "event_type": "stopped_vehicle_accident",
            "severity": "critical",
            "confidence": 0.99,
            "track_id": "TRK-204",
            "license_plate": "MH 31 BJ 4410",
            "vehicle_class": "Auto-Rickshaw (Immobilized/Crash)",
        },
    ]

    await asyncio.sleep(5)  # Initial startup delay
    while True:
        try:
            scenario = random.choice(CRITICAL_SCENARIOS)
            logger.info(f"[10-Min Auto-SOS] Dispatching WhatsApp alert for {scenario['camera_name']} to {settings.TWILIO_WHATSAPP_TO}...")
            dispatch_whatsapp_notification(scenario, phone=settings.TWILIO_WHATSAPP_TO)
        except Exception as e:
            logger.warning(f"[10-Min Auto-SOS] Dispatch error: {e}")
        await asyncio.sleep(600)  # Exactly 10 minutes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize PostgreSQL tables if database connection is available
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("PostgreSQL database tables initialized successfully.")
    except Exception as e:
        logger.warning(
            f"Could not automatically create database tables on startup (PostgreSQL server may be offline): {e}"
        )

    # 2. Launch background AI detection and real-time WebSocket publisher loop
    detection_task = asyncio.create_task(start_detection_loop())
    # 3. Launch 10-minute automated WhatsApp SOS scheduler
    whatsapp_task = asyncio.create_task(periodic_whatsapp_sos_loop())
    yield
    # Shutdown
    detection_task.cancel()
    whatsapp_task.cancel()
    try:
        await asyncio.gather(detection_task, whatsapp_task, return_exceptions=True)
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="CityEye AI Video Analytics Engine, Live WebSockets & PostgreSQL Alert Management API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for Next.js App
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(cameras_router, prefix=settings.API_V1_PREFIX)
app.include_router(alerts_router, prefix=settings.API_V1_PREFIX)
app.include_router(live_stream_router, prefix=settings.API_V1_PREFIX)
app.include_router(camera_ingest_router)
app.include_router(ws_router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "CityEye AI Video Analytics Engine",
        "version": "1.0.0",
        "websocket_endpoint": "/ws/alerts",
        "api_docs": "/docs",
    }
