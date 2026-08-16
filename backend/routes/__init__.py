from backend.routes.cameras import router as cameras_router
from backend.routes.alerts import router as alerts_router
from backend.routes.websocket import router as websocket_router, manager

__all__ = ["cameras_router", "alerts_router", "websocket_router", "manager"]
