import asyncio
from typing import Dict, Any

class EventBus:
    """Shared queue between detection engines and the WebSocket broadcaster."""
    def __init__(self, maxsize: int = 500):
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=maxsize)

    async def publish(self, alert_payload: Dict[str, Any]) -> None:
        if self._queue.full():
            try:
                _ = self._queue.get_nowait()  # drop oldest rather than block detection
            except asyncio.QueueEmpty:
                pass
        await self._queue.put(alert_payload)

    async def consume(self) -> Dict[str, Any]:
        return await self._queue.get()

event_bus = EventBus()
