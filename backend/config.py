import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "CityEye AI Video Analytics Engine"
    API_V1_PREFIX: str = "/api"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/cityeye")
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    WS_BROADCAST_INTERVAL: float = float(os.getenv("WS_BROADCAST_INTERVAL_SEC", "10.0"))

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
