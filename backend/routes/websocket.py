import json
import logging
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])

class ConnectionManager:
    """Manages active real-time WebSocket subscriber connections."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(
            f"[WebSocket] Client connected. Active clients: {len(self.active_connections)}"
        )

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(
                f"[WebSocket] Client disconnected. Active clients: {len(self.active_connections)}"
            )

    async def broadcast_json(self, message: dict):
        """Broadcasts a JSON dictionary payload to all connected clients."""
        dead_connections = []
        payload = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.warning(f"[WebSocket] Broadcast failed for client: {e}")
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)

manager = ConnectionManager()

@router.websocket("/ws/alerts")
async def websocket_alert_endpoint(websocket: WebSocket):
    """
    Live WebSocket stream for incident alerts and vehicle count telemetry.
    Next.js clients connect here to receive streaming detection updates.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Keep socket open and accept incoming control pings from frontend
            data = await websocket.receive_text()
            logger.debug(f"[WebSocket] Ping received from client: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"[WebSocket] Exception occurred: {e}")
        manager.disconnect(websocket)
