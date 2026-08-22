from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.camera import CameraNode
from backend.schemas.camera import CameraNodeCreate, CameraNodeResponse, CameraNodeUpdate

router = APIRouter(prefix="/cameras", tags=["Cameras"])

# Nagpur Smart City Default Camera Grid
DEFAULT_CAMERAS = [
    {
        "id": "CAM-001",
        "name": "Wardha Road Junction",
        "zone": "South Arterial Corridor",
        "location_lat": 21.1256,
        "location_lng": 79.0725,
        "status": "online",
        "fps": 30,
        "resolution": "3840x2160 (4K)",
        "bitrate": "8.4 Mbps",
        "bearing": 145,
        "fov_angle": 78,
        "lens_type": "Varifocal 4.8-120mm PTZ",
        "stream_url": "/videos/cam1.mp4",
    },
    {
        "id": "CAM-002",
        "name": "Sitabuldi Metro Interchange",
        "zone": "Central Business District",
        "location_lat": 21.1458,
        "location_lng": 79.0882,
        "status": "online",
        "fps": 30,
        "resolution": "1920x1080 (FHD)",
        "bitrate": "6.2 Mbps",
        "bearing": 42,
        "fov_angle": 90,
        "lens_type": "Wide Fixed 2.8mm",
        "stream_url": "/videos/cam2.mp4",
    },
    {
        "id": "CAM-003",
        "name": "Dharampeth Traffic Circle",
        "zone": "West Commercial Sector",
        "location_lat": 21.1432,
        "location_lng": 79.0652,
        "status": "online",
        "fps": 30,
        "resolution": "2560x1440 (2K)",
        "bitrate": "7.1 Mbps",
        "bearing": 260,
        "fov_angle": 85,
        "lens_type": "Motorized 3.6-11mm",
        "stream_url": "/videos/cam3.mp4",
    },
    {
        "id": "CAM-004",
        "name": "Ambazari Lake Promenade",
        "zone": "Public Recreation Perimeter",
        "location_lat": 21.1349,
        "location_lng": 79.0498,
        "status": "online",
        "fps": 25,
        "resolution": "1920x1080 (FHD)",
        "bitrate": "5.5 Mbps",
        "bearing": 210,
        "fov_angle": 110,
        "lens_type": "Panoramic 180° Multi-sensor",
        "stream_url": "/videos/cam4.mp4",
    },
]

@router.get("", response_model=List[CameraNodeResponse])
def get_all_cameras(db: Session = Depends(get_db)):
    from backend.routes.camera_ingest import camera_ingest_registry
    ingest_states = camera_ingest_registry.get_all_states()

    try:
        cams = db.query(CameraNode).all()
        if not cams:
            for d in DEFAULT_CAMERAS:
                cam = CameraNode(**d)
                db.add(cam)
            db.commit()
            cams = db.query(CameraNode).all()
        
        # Dynamically reflect real-time status for mobile streams
        for cam in cams:
            if cam.id in ingest_states:
                m_state = ingest_states[cam.id]
                cam.status = "online" if m_state["status"] == "online" else "offline"
                if m_state.get("achieved_fps"):
                    cam.fps = int(m_state["achieved_fps"])
        return cams
    except Exception:
        # Fallback to seeded nodes if DB is currently unmigrated
        response_list = []
        for d in DEFAULT_CAMERAS:
            c = dict(d)
            if c["id"] in ingest_states:
                m_state = ingest_states[c["id"]]
                c["status"] = "online" if m_state["status"] == "online" else "offline"
                if m_state.get("achieved_fps"):
                    c["fps"] = int(m_state["achieved_fps"])
            response_list.append(CameraNodeResponse(**c))
        return response_list

@router.get("/{camera_id}", response_model=CameraNodeResponse)
def get_camera(camera_id: str, db: Session = Depends(get_db)):
    cam = db.query(CameraNode).filter(CameraNode.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera node not found")
    return cam

@router.post("", response_model=CameraNodeResponse)
def create_camera(payload: CameraNodeCreate, db: Session = Depends(get_db)):
    existing = db.query(CameraNode).filter(CameraNode.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Camera ID already exists")
    cam = CameraNode(**payload.model_dump())
    db.add(cam)
    db.commit()
    db.refresh(cam)
    return cam

@router.patch("/{camera_id}", response_model=CameraNodeResponse)
def update_camera(
    camera_id: str, payload: CameraNodeUpdate, db: Session = Depends(get_db)
):
    cam = db.query(CameraNode).filter(CameraNode.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera node not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(cam, key, value)
    db.commit()
    db.refresh(cam)
    return cam
