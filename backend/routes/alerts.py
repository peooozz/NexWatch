from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.config import settings
from backend.models.alert import IncidentAlert
from backend.schemas.alert import (
    IncidentAlertCreate,
    IncidentAlertResponse,
    IncidentAlertUpdate,
)
from backend.services.whatsapp_dispatcher import (
    dispatch_whatsapp_notification,
    format_whatsapp_alert_message,
    generate_whatsapp_click_url,
)

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("", response_model=List[IncidentAlertResponse])
def get_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    camera_id: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    try:
        q = db.query(IncidentAlert)
        if status and status != "all":
            q = q.filter(IncidentAlert.status == status)
        if severity and severity != "all":
            q = q.filter(IncidentAlert.severity == severity)
        if camera_id and camera_id != "all":
            q = q.filter(IncidentAlert.camera_id == camera_id)
        return q.order_by(IncidentAlert.detected_at.desc()).limit(limit).all()
    except Exception:
        return []

@router.post("", response_model=IncidentAlertResponse)
def create_alert(payload: IncidentAlertCreate, db: Session = Depends(get_db)):
    alert_dict = payload.model_dump()
    if not alert_dict.get("id"):
        import random
        alert_dict["id"] = f"ALT-{random.randint(100, 999)}"
    alert = IncidentAlert(**alert_dict)
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Automatic Twilio WhatsApp Dispatch for critical severity / accidents / overcrowding
    if settings.TWILIO_AUTO_DISPATCH and alert.severity in ["critical", "high"]:
        try:
            dispatch_whatsapp_notification({
                "camera_id": alert.camera_id,
                "camera_name": alert.camera_name,
                "event_type": alert.event_type,
                "severity": alert.severity,
                "confidence": alert.confidence,
                "track_id": alert.track_id,
                "vehicle_details": alert.vehicle_details,
                "detected_at": alert.detected_at.isoformat() if alert.detected_at else None,
            }, phone=settings.TWILIO_WHATSAPP_TO)
        except Exception as e:
            print(f"Auto-dispatch WhatsApp error: {e}")

    return alert

@router.post("/dispatch-whatsapp")
def dispatch_whatsapp_direct(payload: Dict[str, Any] = Body(...)):
    """
    Triggers an immediate Twilio WhatsApp emergency notification for any given alert payload.
    """
    phone = payload.get("recipient_phone") or settings.TWILIO_WHATSAPP_TO
    result = dispatch_whatsapp_notification(payload, phone=phone)
    return result

@router.post("/{alert_id}/dispatch-whatsapp")
def dispatch_whatsapp_for_alert(
    alert_id: str,
    phone: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Dispatches a WhatsApp emergency notification for a specific alert in the database.
    """
    alert = db.query(IncidentAlert).filter(IncidentAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Incident alert not found")

    target_phone = phone or settings.TWILIO_WHATSAPP_TO
    result = dispatch_whatsapp_notification({
        "camera_id": alert.camera_id,
        "camera_name": alert.camera_name,
        "event_type": alert.event_type,
        "severity": alert.severity,
        "confidence": alert.confidence,
        "track_id": alert.track_id,
        "vehicle_details": alert.vehicle_details,
        "detected_at": alert.detected_at.isoformat() if alert.detected_at else None,
    }, phone=target_phone)
    return result

@router.patch("/{alert_id}/status", response_model=IncidentAlertResponse)
def update_alert_status(
    alert_id: str,
    payload: IncidentAlertUpdate,
    db: Session = Depends(get_db),
):
    alert = db.query(IncidentAlert).filter(IncidentAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Incident alert not found")

    if payload.status:
        alert.status = payload.status
        if payload.status == "resolved":
            alert.resolved_at = datetime.utcnow()
    if payload.acknowledged_by:
        alert.acknowledged_by = payload.acknowledged_by
    if payload.notes:
        alert.notes = payload.notes

    db.commit()
    db.refresh(alert)
    return alert

