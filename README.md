# NexWatch (CityEye) — AI Surveillance & Real-Time Traffic Analytics

NexWatch is a production-grade AI-based CCTV traffic violation and accident detection platform. It uses **YOLOv11 + ByteTrack** for real-time computer vision inference, **FastAPI + WebSockets** for live alert streaming, **Twilio WhatsApp** for instant emergency dispatch, and a modern **Next.js** analytics dashboard.

---

## Architecture Overview

```
[Mobile Phone / Edge Node]                     [Render / Cloud Backend]                        [Dashboard]
  (Browser: /mobile-cam)                        (FastAPI + YOLOv11 Engine)                 (Next.js Dashboard)
            |                                               |                                       |
            |--- Push Binary JPEG (8-10 FPS via WSS) ------>|                                       |
            |    wss://<host>/ws/stream?cam_id=...&key=...  |--- Decodes JPEG (cv2.imdecode)        |
            |                                               |--- Sampled YOLOv11 + ByteTrack        |
            |<-- ACK Frame (Status, FPS, Latency) ----------|--- Evaluates Violations & Physics     |
                                                            |                                       |
                                                            |--- Real-Time Incident Alerts (WS) --->|
                                                            |--- Twilio Emergency SOS Dispatch ---->| [WhatsApp / PCR]
```

---

## 🚀 Push-Based Mobile Camera Ingestion (Zero-Install)

NexWatch replaces fragile pull-based RTSP/HTTP streams with an **outbound push ingestion pipeline over WebSockets**.

### Why Push Ingestion?
* **Bypasses CGNAT & Mobile Firewalls**: Mobile devices initiate outbound TLS connections to Render (`wss://...`).
* **Immune to Dynamic IPs & IPv6 SLAAC changes**: No port forwarding, VPNs, or IP tracking required.
* **Zero App Installs**: Works directly from mobile browsers (Chrome on Android, Safari on iOS) via `navigator.mediaDevices.getUserMedia()`.
* **Sub-Second Latency & Backpressure**: Uses bounded `asyncio.Queue` ("latest frame wins") and client-side throttled transmission (8–10 FPS @ 640×480).

---

## 📱 Field Operator Quickstart (How to Stream from a Phone)

1. Open the mobile camera client on the smartphone browser:
   * **URL Format**: `https://<your-domain>/mobile-cam?cam_id=CAM-MOBILE-01&key=nexwatch-mobile-key-alpha`
   * Or as standalone static HTML: `https://<your-domain>/mobile-cam.html?cam_id=CAM-MOBILE-01&key=nexwatch-mobile-key-alpha`
2. Tap the large blue button: **START TRANSMITTING**.
3. Allow camera access when prompted by the browser.
4. The status banner turns **🟢 LIVE STREAMING TO CLOUD — ACTIVE**, streaming compressed JPEG frames to the AI detection engine.
5. The live stream and any detected violations automatically appear on the main dashboard (`/dashboard/events`).

---

## 🔐 Provisioning New Camera Slots & Security Keys

### 1. Configure Environment Variables
In your `.env` or Render environment settings, configure the per-camera authentication keys:

```env
# JSON mapping of Camera ID -> Secret Token
CAMERA_INGEST_KEYS='{"CAM-MOBILE-01": "nexwatch-mobile-key-alpha", "CAM-MOBILE-02": "nexwatch-mobile-key-beta"}'

# Enforce secure WSS in production
REQUIRE_SECURE_WS=false

# Bounded ingestion queue size (default 2)
INGEST_QUEUE_MAXSIZE=2
```

### 2. Runtime API Provisioning
You can also dynamically register a new camera at runtime without restarting the server:

```bash
curl -X POST "http://localhost:8000/api/ingest/provision" \
     -H "Content-Type: application/json" \
     -d '{"camera_id": "CAM-MOBILE-03", "name": "Sitabuldi Patrol Squad", "secret_key": "sec-token-778899"}'
```

---

## 🩺 Operational Health Checks & Telemetry

Check the real-time operational status of all mobile cameras via the health endpoint:

```bash
curl http://localhost:8000/api/ingest/health
```

**Sample Response**:
```json
{
  "status": "healthy",
  "service": "NexWatch Mobile Push Ingestion Engine",
  "active_streams": 1,
  "provisioned_slots": 2,
  "timestamp": "2026-08-22T08:15:26Z",
  "cameras": {
    "CAM-MOBILE-01": {
      "camera_id": "CAM-MOBILE-01",
      "name": "Mobile Rapid Deployment Unit",
      "status": "online",
      "is_streaming": true,
      "achieved_fps": 9.4,
      "resolution": "640x480",
      "total_frames_processed": 1420,
      "last_infer_latency_ms": 18.2
    },
    "CAM-MOBILE-02": {
      "camera_id": "CAM-MOBILE-02",
      "status": "never_connected"
    }
  }
}
```

---

## ☁️ Cloud & Render Production Deployment Notes

* **TLS Termination & WebSockets**: Render automatically terminates SSL/TLS. Frontend and mobile clients should connect via `wss://<service-name>.onrender.com/ws/stream`.
* **Keep-Alive & Frame Rate**: The mobile client sends frames every ~100ms (10 FPS) and receives acknowledgements, preventing cloud proxy idle timeouts.
* **Automatic Exponential Reconnect**: If a mobile phone switches between Wi-Fi and 5G/4G, the client automatically backs off (1s, 2s, 4s, 8s, max 15s) and reconnects without manual intervention.
* **CPU Optimization on Cloud Tiers**: The ingestion pipeline resizes incoming frames to 640×360 and applies configurable frame sampling (`FRAME_SAMPLE_RATE=3` $\rightarrow$ every 3rd frame) so YOLOv11 runs with minimal CPU overhead.

---

## 💻 Local Development Setup

### Terminal 1: FastAPI Backend
```bash
.\venv\Scripts\activate
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### Terminal 2: Next.js Frontend
```bash
npm run dev
```

* **Main Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
* **Live Events & Radar**: [http://localhost:3000/dashboard/events](http://localhost:3000/dashboard/events)
* **Mobile Ingestion Client**: [http://localhost:3000/mobile-cam](http://localhost:3000/mobile-cam)
* **Backend Ingest Health**: [http://localhost:8000/api/ingest/health](http://localhost:8000/api/ingest/health)
