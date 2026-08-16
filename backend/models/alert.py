from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from backend.database import Base

class IncidentAlert(Base):
    __tablename__ = "incident_alerts"

    id = Column(String(50), primary_key=True, index=True)  # e.g., 'ALT-489'
    camera_id = Column(
        String(50),
        ForeignKey("camera_nodes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    camera_name = Column(String(150), nullable=True)
    event_type = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), nullable=False, default="high")  # critical, high, medium, low
    confidence = Column(Float, default=0.90)
    track_id = Column(String(50), nullable=True)
    vehicle_count = Column(Integer, default=1)
    object_class = Column(String(50), default="Sedan")
    license_plate = Column(String(50), nullable=True)
    speed_kmph = Column(Float, nullable=True)
    latency_ms = Column(Integer, default=14)
    status = Column(String(30), default="new", index=True)  # new, acknowledged, resolved, false_positive
    snapshot_url = Column(String(255), default="/snapshots/sample.jpg")
    notes = Column(Text, nullable=True)
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
    delivered_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(String(100), nullable=True)
