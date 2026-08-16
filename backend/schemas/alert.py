from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class VehicleDetails(BaseModel):
    objectClass: str = "Sedan"
    licensePlate: Optional[str] = "MH-31-EQ-4892"
    plateConfidence: Optional[float] = 0.94
    speedKmph: Optional[float] = 58.0
    make: Optional[str] = "Hyundai"
    model: Optional[str] = "Creta"
    color: Optional[str] = "White"

class IncidentAlertBase(BaseModel):
    camera_id: str = Field(..., description="Camera ID")
    camera_name: Optional[str] = Field(None, description="Camera Name")
    event_type: str = Field("illegal_parking", description="Incident type")
    severity: str = Field("high", description="Severity (critical, high, medium, low)")
    confidence: float = Field(0.92, description="AI model confidence")
    track_id: Optional[str] = Field("TRK-856", description="Tracker ID")
    vehicle_count: int = Field(1, description="Number of vehicles involved")
    object_class: str = Field("Sedan", description="Detected object class")
    license_plate: Optional[str] = Field("MH-31-EQ-4892", description="License plate number")
    speed_kmph: Optional[float] = Field(None, description="Estimated vehicle speed")
    latency_ms: int = Field(14, description="Edge inference latency in ms")
    status: str = Field("new", description="Status (new, acknowledged, resolved, false_positive)")
    snapshot_url: str = Field("/snapshots/sample.jpg", description="Snapshot capture path")
    notes: Optional[str] = Field(None, description="Operator triage notes")

class IncidentAlertCreate(IncidentAlertBase):
    id: Optional[str] = None

class IncidentAlertUpdate(BaseModel):
    status: Optional[str] = None
    acknowledged_by: Optional[str] = None
    notes: Optional[str] = None

class IncidentAlertResponse(IncidentAlertBase):
    id: str
    detected_at: datetime
    delivered_at: datetime
    resolved_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None

    class Config:
        from_attributes = True

class AlertBroadcastPayload(BaseModel):
    id: str
    camera_id: str
    camera_name: str
    event_type: str
    severity: str
    confidence: float
    track_id: str
    vehicle_count: int
    detected_at: str
    delivered_at: str
    latency_ms: int
    status: str
    snapshot_url: str
    vehicle_details: VehicleDetails
    notes: Optional[str] = None
