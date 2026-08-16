from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class CameraLocation(BaseModel):
    lat: float
    lng: float

class CameraNodeBase(BaseModel):
    id: str = Field(..., description="Camera ID e.g. CAM-001")
    name: str = Field(..., description="Camera Location Name")
    zone: str = Field(..., description="City Zone")
    location_lat: float = Field(..., description="Latitude")
    location_lng: float = Field(..., description="Longitude")
    status: str = Field("online", description="Status (online, offline, degraded)")
    fps: int = Field(30, description="Frames Per Second")
    resolution: str = Field("3840x2160 (4K)", description="Resolution")
    bitrate: str = Field("8.4 Mbps", description="Stream Bitrate")
    bearing: int = Field(145, description="Direction angle in degrees")
    fov_angle: int = Field(78, description="Field of View cone angle")
    lens_type: str = Field("Varifocal 4.8-120mm PTZ", description="Lens specification")
    stream_url: Optional[str] = Field(None, description="Local or remote stream URL")

class CameraNodeCreate(CameraNodeBase):
    pass

class CameraNodeUpdate(BaseModel):
    name: Optional[str] = None
    zone: Optional[str] = None
    status: Optional[str] = None
    fps: Optional[int] = None
    resolution: Optional[str] = None
    bitrate: Optional[str] = None
    stream_url: Optional[str] = None

class CameraNodeResponse(CameraNodeBase):
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
