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
from backend.services.detection_service import start_detection_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s",
)
logger = logging.getLogger("cityeye-backend")

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
    yield
    # Shutdown
    detection_task.cancel()
    try:
        await detection_task
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
