from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.alert import IncidentAlert
from backend.schemas.alert import (
    IncidentAlertCreate,
    IncidentAlertResponse,
    IncidentAlertUpdate,
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
    return alert

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
