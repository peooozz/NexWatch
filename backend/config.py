import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "CityEye AI Video Analytics Engine"
    API_V1_PREFIX: str = "/api"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/cityeye")
    CORS_ORIGINS: Union[List[str], str] = ["*"]
    WS_BROADCAST_INTERVAL: float = float(os.getenv("WS_BROADCAST_INTERVAL_SEC", "10.0"))

    # Twilio WhatsApp Dispatch Configuration
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_WHATSAPP_FROM: str = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+17372508034")
    TWILIO_WHATSAPP_TO: str = os.getenv("TWILIO_WHATSAPP_TO", "+919322166721")
    TWILIO_AUTO_DISPATCH: bool = os.getenv("TWILIO_AUTO_DISPATCH", "true").lower() in ["1", "true", "yes"]

    # Demo simulation toggle (default False — real EventBus detection stream only)
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "false").lower() in ["1", "true", "yes"]

    # Render / Ngrok Mobile Live Stream Configuration (Dedicated to /dashboard/events)
    MOBILE_STREAM_URL: str = os.getenv("MOBILE_STREAM_URL", os.getenv("NGROK_STREAM_URL", ""))
    FRAME_SAMPLE_RATE: int = int(os.getenv("FRAME_SAMPLE_RATE", "3"))  # Process every 3rd frame (~8-10 FPS)
    LIVE_MODEL_NAME: str = os.getenv("LIVE_MODEL_NAME", "yolo11s.pt")  # High-accuracy Small model for cloud CPU

    # Push-Based Mobile Camera Ingestion Configuration
    # Maps camera ID -> secret authentication key for field devices
    CAMERA_INGEST_KEYS: Union[dict, str] = os.getenv(
        "CAMERA_INGEST_KEYS",
        '{"CAM-MOBILE-01": "nexwatch-mobile-key-alpha", "CAM-MOBILE-02": "nexwatch-mobile-key-beta"}'
    )
    REQUIRE_SECURE_WS: bool = os.getenv("REQUIRE_SECURE_WS", "false").lower() in ["1", "true", "yes"]
    INGEST_QUEUE_MAXSIZE: int = int(os.getenv("INGEST_QUEUE_MAXSIZE", "2"))

    @field_validator("CAMERA_INGEST_KEYS", mode="before")
    @classmethod
    def assemble_camera_keys(cls, v: Union[dict, str]) -> dict:
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except Exception:
                # Support comma-separated key:value pairs like CAM-MOBILE-01:key1,CAM-MOBILE-02:key2
                res = {}
                for pair in v.split(","):
                    if ":" in pair:
                        k, val = pair.split(":", 1)
                        res[k.strip()] = val.strip()
                return res if res else {"CAM-MOBILE-01": "nexwatch-mobile-key-alpha"}
        return {"CAM-MOBILE-01": "nexwatch-mobile-key-alpha"}

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        elif isinstance(v, str) and v.startswith("["):
            import json
            try:
                return json.loads(v)
            except Exception:
                return [v]
        return ["*"]

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

