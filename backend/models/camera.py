from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime
from backend.database import Base

class CameraNode(Base):
    __tablename__ = "camera_nodes"

    id = Column(String(50), primary_key=True, index=True)  # e.g., 'CAM-001'
    name = Column(String(150), nullable=False)
    zone = Column(String(100), nullable=False)
    location_lat = Column(Float, nullable=False)
    location_lng = Column(Float, nullable=False)
    status = Column(String(20), default="online")  # online, offline, degraded
    fps = Column(Integer, default=30)
    resolution = Column(String(50), default="1920x1080 (FHD)")
    bitrate = Column(String(30), default="6.2 Mbps")
    bearing = Column(Integer, default=0)
    fov_angle = Column(Integer, default=80)
    lens_type = Column(String(100), default="Varifocal PTZ")
    stream_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
