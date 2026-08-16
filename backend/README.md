# CityEye AI Video Analytics Backend & Real-Time Engine

Production-grade FastAPI backend for **CityEye / NexWatch**, supporting live WebSockets alert streaming, PostgreSQL persistence with SQLAlchemy ORM, and Ultralytics YOLO vehicle detection.

---

## 1. Setup & Installation

### Create & Activate Virtual Environment
```bash
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate
```

### Install Dependencies
```bash
pip install -r backend/requirements.txt
```

---

## 2. Environment Variables

Create `.env` file in the root or `backend/` directory:
```env
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cityeye

# WebSocket broadcast interval (seconds)
WS_BROADCAST_INTERVAL_SEC=10

# Allowed CORS origins
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

---

## 3. Running the Server

Start the FastAPI backend server with Uvicorn:
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Once running:
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Live WebSocket Alert Stream**: `ws://localhost:8000/ws/alerts`
- **Camera Nodes REST API**: [http://localhost:8000/api/cameras](http://localhost:8000/api/cameras)
- **Incident Alerts REST API**: [http://localhost:8000/api/alerts](http://localhost:8000/api/alerts)

---

## 4. Running YOLO Vehicle Detection & Tracking CLI

From `backend/vehicle_counter`:
```bash
# Static Image Detection:
python backend/vehicle_counter/main.py --mode image --source data/images/sample.jpg --weights yolo11m.pt

# Video Tracking & Cumulative Counting:
python backend/vehicle_counter/main.py --mode video --source data/videos/sample.mp4 --weights yolo11m.pt --display
```
