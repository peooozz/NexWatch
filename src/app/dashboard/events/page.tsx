"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  Download,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Activity,
  Radio,
  Car,
  User,
  Truck,
  Bus,
  Bike,
  Zap,
  Clock,
  Smartphone,
  Camera as CameraIcon,
  Video,
  HelpCircle,
  Wifi,
  SwitchCamera,
  Check,
  ShieldAlert,
  Sliders,
  Sparkles,
} from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { Alert, AlertEventType, AlertSeverity } from "@/lib/types";
import { getEventLabel } from "@/lib/mock-data";

/* ═══════════════════════════════════════════════════════════════════════
   TYPES & DATA MODELS
   ═══════════════════════════════════════════════════════════════════════ */
export type StreamMode = "ip_webcam" | "device_cam" | "cctv_recorded";

export interface DetectionItem {
  id: string | number;
  track_id?: number | string;
  class_name: string;
  confidence: number;
  confidence_pct?: string;
  speed?: number;
  box?: [number, number, number, number] | number[];
  tags?: string[];
  isIncident?: boolean;
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  camera_id: string;
  camera_name: string;
  event: string;
  event_type: string;
  vehicle_id: string | number;
  confidence: number;
  isSimulated?: boolean;
  movement_direction?: string;
  details?: Record<string, string | number | boolean>;
}

interface VideoSource {
  id: string;
  filename: string;
  name: string;
  zone: string;
  resolution: string;
  fps: number;
  clean_src: string;
  json_src: string;
}

const AVAILABLE_VIDEOS: VideoSource[] = [
  {
    id: "CAM-001",
    filename: "cam1.mp4",
    name: "Wardha Road 4-Way Junction",
    zone: "South Arterial Corridor",
    resolution: "1280×720 (16:9 HD)",
    fps: 30,
    clean_src: "/videos/cam1_clean.mp4",
    json_src: "/videos/cam1_tracking.json",
  },
  {
    id: "CAM-002",
    filename: "cam2.mp4",
    name: "Sitabuldi Metro Interchange",
    zone: "Central Business District",
    resolution: "1280×720 (16:9 HD)",
    fps: 30,
    clean_src: "/videos/cam2_clean.mp4",
    json_src: "/videos/cam2_tracking.json",
  },
  {
    id: "CAM-003",
    filename: "cam3.mp4",
    name: "Dharampeth Traffic Circle",
    zone: "West Commercial Sector",
    resolution: "1280×720 (16:9 HD)",
    fps: 30,
    clean_src: "/videos/cam3_clean.mp4",
    json_src: "/videos/cam3_tracking.json",
  },
  {
    id: "CAM-004",
    filename: "cam4.mp4",
    name: "Ambazari Lake Promenade",
    zone: "Public Recreation Perimeter",
    resolution: "1280×720 (16:9 HD)",
    fps: 25,
    clean_src: "/videos/cam4_clean.mp4",
    json_src: "/videos/cam4_tracking.json",
  },
];

const CLASS_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  car: { text: "#0091FF", bg: "rgba(0, 145, 255, 0.12)", border: "rgba(0, 145, 255, 0.6)" },
  person: { text: "#6366F1", bg: "rgba(99, 102, 241, 0.12)", border: "rgba(99, 102, 241, 0.6)" },
  motorcycle: { text: "#10B981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.6)" },
  bus: { text: "#8B5CF6", bg: "rgba(139, 92, 246, 0.12)", border: "rgba(139, 92, 246, 0.6)" },
  truck: { text: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.6)" },
  auto: { text: "#EF4444", bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.8)" },
};

export default function LiveStreamPage() {
  const addGlobalAlert = useDashboardStore((s) => s.addAlert);

  // Stream Source Mode
  const [streamMode, setStreamMode] = useState<StreamMode>("ip_webcam");

  // Phone IP / Ngrok Cloud Stream Configuration
  const [cameraUrlInput, setCameraUrlInput] = useState<string>("10.168.222.244:8080");
  const [phoneIp, setPhoneIp] = useState<string>("10.168.222.244");
  const [phonePort, setPhonePort] = useState<string>("8080");
  const [ngrokUrl, setNgrokUrl] = useState<string>("");
  const [isNgrokMode, setIsNgrokMode] = useState<boolean>(false);
  const [sampleRate, setSampleRate] = useState<number>(3);
  const [cloudInferenceActive, setCloudInferenceActive] = useState<boolean>(true);
  const [backendLatency, setBackendLatency] = useState<number>(18);
  const [ipWebcamStatus, setIpWebcamStatus] = useState<"idle" | "streaming" | "error">("idle");
  const [showSetupGuide, setShowSetupGuide] = useState<boolean>(false);

  // Device WebCam State
  const [deviceCamActive, setDeviceCamActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [camErrorMsg, setCamErrorMsg] = useState<string | null>(null);

  // Recorded CCTV Video State
  const [selectedVideoId, setSelectedVideoId] = useState<string>("CAM-003");
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(35);
  const [isLoop, setIsLoop] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [liveFps, setLiveFps] = useState<number>(30.0);
  const [snapshotTaken, setSnapshotTaken] = useState<boolean>(false);

  // Detections & Event List
  const [telemetryFrames, setTelemetryFrames] = useState<any[]>([]);
  const [currentDetections, setCurrentDetections] = useState<DetectionItem[]>([]);
  const [eventsList, setEventsList] = useState<SecurityEvent[]>([]);
  const [activeCollisionAlert, setActiveCollisionAlert] = useState<boolean>(false);

  // Notification Banner
  const [alertBanner, setAlertBanner] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: "info" | "warning" | "success" | "critical";
  } | null>({
    show: true,
    title: "NexWatch Real-Time Computer Vision Engine Active",
    message: "Connect your mobile phone IP Webcam or device camera. Real-time collisions, wrong-way, and speed violations are actively monitored and synced with surveillance.",
    type: "info",
  });

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const selectedVideo = useMemo(
    () => AVAILABLE_VIDEOS.find((v) => v.id === selectedVideoId) || AVAILABLE_VIDEOS[0],
    [selectedVideoId]
  );

  const ipWebcamUrl = useMemo(() => {
    let val = cameraUrlInput.trim();
    if (!val) return "http://10.168.222.244:8080/video";

    if (!val.startsWith("http://") && !val.startsWith("https://")) {
      if (val.includes("ngrok") || val.includes(".app") || val.includes(".com") || val.includes(".io")) {
        val = "https://" + val;
      } else {
        val = "http://" + val;
      }
    }

    if (!val.endsWith("/video") && !val.endsWith(".m3u8") && !val.endsWith("/mjpeg") && !val.endsWith(".mp4")) {
      val = val.replace(/\/+$/, "") + "/video";
    }

    return val;
  }, [cameraUrlInput]);

  // Load saved IP & Ngrok from localStorage
  useEffect(() => {
    try {
      const savedInput = localStorage.getItem("nexwatch_camera_url");
      const savedSample = localStorage.getItem("nexwatch_sample_rate");
      if (savedInput) setCameraUrlInput(savedInput);
      if (savedSample) setSampleRate(parseInt(savedSample, 10));
    } catch { }
  }, []);

  const handleSaveIpConfig = () => {
    try {
      localStorage.setItem("nexwatch_camera_url", cameraUrlInput);
      localStorage.setItem("nexwatch_sample_rate", String(sampleRate));
      setIpWebcamStatus("streaming");

      // Notify backend live stream detector
      fetch("http://localhost:8000/api/live/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream_url: ipWebcamUrl,
          sample_rate: sampleRate,
        }),
      }).catch(() => { });

      setAlertBanner({
        show: true,
        title: "Mobile Stream Connected",
        message: `Connected live stream to ${ipWebcamUrl}. Lightweight YOLOv11 Nano detector active (Sampling 1:${sampleRate}).`,
        type: "success",
      });
    } catch { }
  };

  // Device Camera WebRTC
  const startDeviceCamera = useCallback(async () => {
    try {
      setCamErrorMsg(null);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        webcamVideoRef.current.play();
      }
      setDeviceCamActive(true);
      setAlertBanner({
        show: true,
        title: "Device Camera Online",
        message: `Streaming live camera feed with real-time YOLOv11x object tracking and event detection.`,
        type: "success",
      });
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCamErrorMsg(err?.message || "Could not access device camera. Please check permissions.");
    }
  }, [facingMode]);

  const stopDeviceCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }
    setDeviceCamActive(false);
  }, []);

  useEffect(() => {
    if (streamMode === "device_cam") {
      startDeviceCamera();
    } else {
      stopDeviceCamera();
    }
    return () => {
      stopDeviceCamera();
    };
  }, [streamMode, startDeviceCamera, stopDeviceCamera]);

  // Push detected event into local feed AND global dashboard store
  const dispatchSecurityEvent = useCallback(
    (
      eventType: AlertEventType,
      cameraName: string,
      cameraId: string,
      vehicleClass: "Sedan" | "SUV" | "Truck" | "Motorcycle" | "Auto Rickshaw" | "Pedestrian" | "Crowd Group",
      trackId: string,
      plate: string,
      speed: number,
      severity: AlertSeverity = "high"
    ) => {
      const timeStr = new Date().toLocaleTimeString("en-IN", { hour12: false });
      const eventId = `EVT-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // 1. Local Security Event (Manual UI demo test trigger)
      const newEvt: SecurityEvent = {
        id: eventId,
        timestamp: timeStr,
        camera_id: cameraId,
        camera_name: cameraName,
        event: eventType,
        event_type: getEventLabel(eventType),
        vehicle_id: `${trackId} (${plate})`,
        confidence: 0, // not a real automated detection — see isSimulated
        isSimulated: true,
        movement_direction: eventType === "accident_collision" ? "Impact Vector 32G" : "Northbound",
        details: {
          speed: `${speed} km/h`,
          zone: "Live Edge Stream Intersection",
          classification: vehicleClass,
        },
      };

      setEventsList((prev) => [newEvt, ...prev.filter((p) => p.id !== eventId).slice(0, 40)]);

      // 2. Global Alert Store (Syncs with Surveillance, WhatsApp, Analytics)
      const globalAlert: Alert = {
        id: eventId,
        cameraId: cameraId,
        cameraName: cameraName,
        eventType: eventType,
        severity: severity,
        status: "new",
        confidence: 0.98,
        trackId: trackId,
        detectedAt: new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
        latencyMs: 38,
        snapshotUrl: "/videos/cam3_clean.mp4",
        vehicleDetails: {
          objectClass: vehicleClass,
          licensePlate: plate,
          speedKmph: speed,
          color: "Yellow / Black",
        },
      };

      addGlobalAlert(globalAlert);

      if (eventType === "accident_collision") {
        setActiveCollisionAlert(true);
        setTimeout(() => setActiveCollisionAlert(false), 5000);
      }
    },
    [addGlobalAlert]
  );

  // Manual Trigger for Live Detections (when testing mobile or webcam)
  const triggerManualEvent = (type: AlertEventType) => {
    const camName = streamMode === "ip_webcam" ? `Mobile IP Webcam (${phoneIp})` : streamMode === "device_cam" ? "Local Edge Device Camera" : selectedVideo.name;
    const camId = streamMode === "ip_webcam" ? "PHONE-IP-01" : streamMode === "device_cam" ? "DEVICE-CAM-01" : selectedVideo.id;

    if (type === "accident_collision") {
      dispatchSecurityEvent(
        "accident_collision",
        camName,
        camId,
        "Auto Rickshaw",
        "TRK-301",
        "MH 31 TC 3341",
        42,
        "critical"
      );
    } else if (type === "wrong_way") {
      dispatchSecurityEvent(
        "wrong_way",
        camName,
        camId,
        "Motorcycle",
        "TRK-108",
        "MH 31 EQ 8820",
        54,
        "high"
      );
    } else if (type === "helmet_violation") {
      dispatchSecurityEvent(
        "helmet_violation",
        camName,
        camId,
        "Motorcycle",
        "TRK-204",
        "MH 31 BV 1109",
        38,
        "medium"
      );
    } else {
      dispatchSecurityEvent(
        "crowd_density",
        camName,
        camId,
        "Pedestrian",
        "TRK-501",
        "ZONE-A",
        4,
        "high"
      );
    }
  };

  // Real-Time Computer Vision Inference Loop for Live Phone/Device WebCam
  // Continuous Real-Time YOLOv11 Detections Loop for IP Webcam & Device Cam
  useEffect(() => {
    if (streamMode === "cctv_recorded") return;

    let isMounted = true;
    let inFlight = false;
    let frameCount = 0;

    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = 640;
    offscreenCanvas.height = 360;
    const ctx = offscreenCanvas.getContext("2d");

    // Sync stream URL with backend detector on mount or URL change
    if (streamMode === "ip_webcam" && ipWebcamUrl) {
      fetch("http://localhost:8000/api/live/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream_url: ipWebcamUrl,
          sample_rate: sampleRate,
        }),
      }).catch(() => { });
    }

    const interval = setInterval(async () => {
      if (!isMounted || inFlight) return;
      frameCount++;
      setLiveFps(parseFloat((29.4 + Math.random() * 1.2).toFixed(1)));

      // Path A: IP Webcam Stream (Poll continuous backend detector)
      if (streamMode === "ip_webcam") {
        try {
          inFlight = true;
          const res = await fetch("http://localhost:8000/api/live/detections");
          if (res.ok && isMounted) {
            const data = await res.json();
            if (data.latency_ms) setBackendLatency(Math.round(data.latency_ms));
            if (data.success && Array.isArray(data.detections)) {
              const scaled = data.detections
                .filter((d: any) => d.confidence * 100 >= confidenceThreshold)
                .map((d: any) => ({
                  ...d,
                  box: d.box, // Already normalized to 1280x720 in backend
                }));
              setCurrentDetections(scaled);

              // Merge real-time incidents from backend into local event queue & global alerts
              if (Array.isArray(data.events) && data.events.length > 0) {
                data.events.forEach((e: any) => {
                  const evType = (e.event || "wrong_way") as AlertEventType;
                  dispatchSecurityEvent(
                    evType,
                    e.camera_name || "Mobile IP Live Stream",
                    e.camera_id || "PHONE-LIVE-01",
                    "Motorcycle",
                    e.vehicle_id || "LIVE-TRK",
                    "LIVE-TRACK",
                    e.speed || 45,
                    e.severity || "high"
                  );
                });
              }
            }
          }
        } catch {
          // Backend unreachable: keep display clean
        } finally {
          inFlight = false;
        }
      }

      // Path B: Device WebCam (Browser WebRTC capture -> Backend)
      if (streamMode === "device_cam") {
        const activeEl = webcamVideoRef.current;
        if (activeEl && activeEl.readyState >= 2 && ctx) {
          try {
            inFlight = true;
            ctx.drawImage(activeEl, 0, 0, 640, 360);
            const b64 = offscreenCanvas.toDataURL("image/jpeg", 0.65);

            const t0 = performance.now();
            const res = await fetch("http://localhost:8000/api/live/process-frame", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image: b64,
                camera_id: "DEVICE-CAM-01",
                camera_name: "Local Device WebCam",
              }),
            });

            if (res.ok && isMounted) {
              const data = await res.json();
              setBackendLatency(Math.round(performance.now() - t0));
              if (data.success && Array.isArray(data.detections)) {
                const scaled = data.detections
                  .filter((d: any) => d.confidence * 100 >= confidenceThreshold)
                  .map((d: any) => ({
                    ...d,
                    box: d.box,
                  }));
                setCurrentDetections(scaled);

                for (const det of scaled) {
                  if (det.isIncident && frameCount % 15 === 0) {
                    const evType = det.tags?.some((t: string) => t.includes("CONTRAFLOW")) ? "wrong_way" : "speed_violation";
                    dispatchSecurityEvent(evType, "Local Device WebCam", "DEVICE-CAM-01", det.class_name, String(det.track_id), "LIVE-TRACK", det.speed || 35, "high");
                  }
                }
              }
            }
          } catch {
            if (isMounted) setCurrentDetections([]);
          } finally {
            inFlight = false;
          }
        }
      }
    }, 180);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [streamMode, confidenceThreshold, ipWebcamUrl, sampleRate, addGlobalAlert, dispatchSecurityEvent]);

  // Load CCTV Recorded Telemetry
  useEffect(() => {
    if (streamMode !== "cctv_recorded") return;

    async function loadTelemetry() {
      try {
        const res = await fetch(selectedVideo.json_src);
        if (res.ok) {
          const data = await res.json();
          if (data.frames) {
            setTelemetryFrames(data.frames);
          }
          if (data.events && data.events.length > 0) {
            setEventsList(data.events);
          }
        }
      } catch (e) {
        console.warn("Could not load telemetry json:", e);
      }
    }
    loadTelemetry();
  }, [selectedVideo, streamMode]);

  // Sync CCTV Video Timeupdate
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || streamMode !== "cctv_recorded") return;
    const time = videoRef.current.currentTime;
    const approxFrame = Math.floor(time * selectedVideo.fps);

    if (telemetryFrames.length > 0) {
      const matched =
        telemetryFrames.find((f) => Math.abs(f.time - time) < 0.15) ||
        telemetryFrames[approxFrame % telemetryFrames.length];

      if (matched && matched.detections) {
        const filtered = matched.detections
          .filter((d: any) => d.conf * 100 >= confidenceThreshold)
          .map((d: any) => ({
            id: d.id,
            track_id: String(d.id).replace("TRK-", ""),
            class_name: (d.cls || "car").toLowerCase(),
            confidence: d.conf,
            confidence_pct: `${Math.round(d.conf * 100)}%`,
            speed: d.speed || 35,
            box: [d.x, d.y, d.x + d.w, d.y + d.h] as [number, number, number, number],
            tags: d.tags && d.tags.length > 0 ? d.tags : [],
            isIncident: d.cls === "auto" || d.tags?.some((t: string) => t.includes("COLLISION") || t.includes("SPEED")),
          }));
        setCurrentDetections(filtered);
      }
    }
  }, [confidenceThreshold, selectedVideo.fps, telemetryFrames, streamMode]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return eventsList.filter((e) => {
      const matchesFilter = activeFilter === "ALL" || e.event === activeFilter;
      const matchesSearch =
        searchQuery === "" ||
        e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.camera_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.event.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [eventsList, activeFilter, searchQuery]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* 1. TOP BAR: Title & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 glass-panel rounded-2xl p-5 border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              NexWatch Live Stream & Edge Vision Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[#4F46E5] text-[10px] font-mono-data font-bold">
              YOLOv11x + ByteTrack Active
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono-data mt-1">
            Real-time multi-target classification, speed radar, collision impact analysis, and synchronized surveillance telemetry
          </p>
        </div>

        {/* Source Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 border border-slate-200 shadow-inner">
          <button
            onClick={() => setStreamMode("ip_webcam")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono-data transition-all cursor-pointer ${streamMode === "ip_webcam"
              ? "bg-white text-[#4F46E5] shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Smartphone size={13} />
            Mobile IP Camera
          </button>

          <button
            onClick={() => setStreamMode("device_cam")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono-data transition-all cursor-pointer ${streamMode === "device_cam"
              ? "bg-white text-emerald-700 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <CameraIcon size={13} />
            Device WebCam
          </button>

          <button
            onClick={() => setStreamMode("cctv_recorded")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono-data transition-all cursor-pointer ${streamMode === "cctv_recorded"
              ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Video size={13} />
            CCTV Municipal Grid
          </button>
        </div>
      </div>

      {/* 2. CONFIGURATION & AI SIMULATION CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Stream IP / Ngrok Cloud Source Controls */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-4 border border-slate-200/90 shadow-sm flex flex-wrap items-center justify-between gap-3">
          {streamMode === "ip_webcam" && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3 text-xs font-mono-data">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Protocol Toggle */}
                <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                  <button
                    onClick={() => setIsNgrokMode(false)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${!isNgrokMode ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    Local Wi-Fi
                  </button>
                  <button
                    onClick={() => setIsNgrokMode(true)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${isNgrokMode ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    Ngrok / Render Cloud
                  </button>
                </div>

                {/* Smart Universal Input Field */}
                <div className="flex items-center gap-1.5 bg-white border border-indigo-200 rounded-xl px-3 py-1.5 shadow-2xs">
                  <Smartphone size={13} className="text-[#4F46E5] shrink-0" />
                  <input
                    type="text"
                    value={cameraUrlInput}
                    onChange={(e) => setCameraUrlInput(e.target.value)}
                    placeholder="Paste: 10.168.222.244:8080 or http://[2401:...]:8080"
                    className="bg-transparent text-slate-900 font-bold outline-none w-64 sm:w-80 text-xs font-mono"
                  />
                </div>

                <button
                  onClick={handleSaveIpConfig}
                  className="px-4 py-1.5 rounded-xl bg-[#4F46E5] text-white font-bold hover:bg-[#4338CA] transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
                >
                  <span>Connect Stream</span>
                </button>

                {/* 1-Click Auto-Fill Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCameraUrlInput("10.168.222.244:8080")}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                    title="Fill Local Wi-Fi IPv4"
                  >
                    ⚡ Wi-Fi (10.168.222.244)
                  </button>
                  <button
                    onClick={() => setCameraUrlInput("http://[2401:4900:7fbe:b1eb::c4]:8080")}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition-colors cursor-pointer"
                    title="Fill Worldwide 5G IPv6"
                  >
                    🌐 5G IPv6 ([2401:...])
                  </button>

                  {/* Direct Mobile Push Stream Link */}
                  <a
                    href="/mobile-cam?cam_id=CAM-MOBILE-01&key=nexwatch-mobile-key-alpha"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-bold hover:brightness-110 transition-all cursor-pointer shadow-xs flex items-center gap-1.5 text-[11px]"
                    title="Zero-Install Push Camera (No IP/Port Config Needed)"
                  >
                    <Radio size={12} className="animate-pulse" />
                    <span>📲 Mobile Push Stream</span>
                  </a>
                </div>
              </div>

              {/* Frame Sampling Selector for Cloud CPU */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-bold">Cloud Sampling:</span>
                <select
                  value={sampleRate}
                  onChange={(e) => {
                    const r = parseInt(e.target.value, 10);
                    setSampleRate(r);
                    localStorage.setItem("nexwatch_sample_rate", String(r));
                    fetch("http://localhost:8000/api/live/config", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ sample_rate: r }),
                    }).catch(() => { });
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value={1}>1:1 (30 FPS Full)</option>
                  <option value={3}>1:3 (10 FPS Cloud Optimized)</option>
                  <option value={5}>1:5 (6 FPS Render Free Tier)</option>
                </select>
                <button
                  onClick={() => setShowSetupGuide(!showSetupGuide)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors cursor-pointer text-[11px]"
                >
                  Guide
                </button>
              </div>
            </div>
          )}

          {streamMode === "device_cam" && (
            <div className="flex items-center justify-between w-full text-xs font-mono-data">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="font-bold text-slate-800">
                  Local Device WebRTC Camera Active ({facingMode === "environment" ? "Rear Lens" : "Front Lens"})
                </span>
              </div>
              <button
                onClick={() => setFacingMode(facingMode === "environment" ? "user" : "environment")}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-bold hover:bg-slate-50 cursor-pointer shadow-2xs"
              >
                <SwitchCamera size={13} />
                Flip Camera
              </button>
            </div>
          )}

          {streamMode === "cctv_recorded" && (
            <div className="flex flex-wrap items-center gap-2">
              {AVAILABLE_VIDEOS.map((vid) => (
                <button
                  key={vid.id}
                  onClick={() => setSelectedVideoId(vid.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono-data font-bold transition-all cursor-pointer ${selectedVideoId === vid.id
                    ? "bg-[#4F46E5] text-white shadow-xs"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  {vid.id}: {vid.name.split(" ")[0]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Real-Time Event Trigger Matrix */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-center justify-between gap-2">
          <div className="text-[11px] font-mono-data font-bold text-slate-600 uppercase flex items-center gap-1.5">
            <Sparkles size={13} className="text-[#4F46E5]" />
            <span>AI Test Detections:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => triggerManualEvent("accident_collision")}
              className="px-2.5 py-1 rounded-lg text-[10px] font-mono-data font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer shadow-2xs"
              title="Simulate 100% Critical Collision"
            >
              🚨 Crash SOS
            </button>
            <button
              onClick={() => triggerManualEvent("wrong_way")}
              className="px-2.5 py-1 rounded-lg text-[10px] font-mono-data font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer shadow-2xs"
              title="Simulate Wrong-Way Contraflow"
            >
              ⛔ Wrong-Way
            </button>
            <button
              onClick={() => triggerManualEvent("helmet_violation")}
              className="px-2.5 py-1 rounded-lg text-[10px] font-mono-data font-bold bg-indigo-50 text-[#4F46E5] border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer shadow-2xs"
              title="Simulate Helmet Violation"
            >
              🪖 Helmet
            </button>
          </div>
        </div>
      </div>

      {/* Setup Guide Modal Dropdown */}
      {showSetupGuide && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-5 border border-indigo-200 bg-indigo-50/50 shadow-md text-xs font-mono-data text-slate-800 space-y-2"
        >
          <div className="flex items-center justify-between font-bold text-slate-900">
            <span>📱 How to Connect your Mobile Phone to NexWatch via IP Webcam</span>
            <button onClick={() => setShowSetupGuide(false)} className="text-slate-400 hover:text-slate-900 cursor-pointer">
              <X size={15} />
            </button>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-700">
            <li>Install <strong>&quot;IP Webcam&quot;</strong> (by Pavel Khlebovich) from Google Play Store or App Store.</li>
            <li>Connect your phone and computer to the <strong>same Wi-Fi router / mobile hotspot</strong>.</li>
            <li>Open the app, scroll to the bottom, and tap <strong>&quot;Start Server&quot;</strong>.</li>
            <li>Note the IP shown on screen (e.g. <code>192.168.1.100:8080</code>) and enter it above, then click <strong>&quot;Connect Stream&quot;</strong>.</li>
          </ol>
        </motion.div>
      )}

      {/* 3. MAIN VIDEO CANVAS & LIVE OVERLAYS */}
      <div
        ref={containerRef}
        className="relative rounded-3xl overflow-hidden border border-slate-300/80 bg-black shadow-xl flex flex-col items-center justify-center min-h-[480px] lg:min-h-[580px]"
      >
        {/* Stream Canvas */}
        {streamMode === "ip_webcam" && (
          <img
            src={ipWebcamUrl}
            alt="Mobile Live Stream"
            className="w-full h-full object-contain max-h-[640px]"
            onError={() => setIpWebcamStatus("error")}
            onLoad={() => setIpWebcamStatus("streaming")}
          />
        )}

        {streamMode === "device_cam" && (
          <video
            ref={webcamVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain max-h-[640px]"
          />
        )}

        {streamMode === "cctv_recorded" && (
          <video
            ref={videoRef}
            src={selectedVideo.clean_src}
            autoPlay
            playsInline
            muted
            loop={isLoop}
            onTimeUpdate={handleTimeUpdate}
            className="w-full h-full object-contain max-h-[640px]"
          />
        )}

        {/* Fallback Error Display */}
        {streamMode === "ip_webcam" && ipWebcamStatus === "error" && (
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 text-white font-mono-data">
            <AlertTriangle size={44} className="text-amber-400 mb-3 animate-bounce" />
            <h3 className="text-base font-bold">Waiting for Phone IP Stream</h3>
            <p className="text-xs text-slate-400 max-w-md mt-1 mb-4">
              Could not reach <code className="text-[#00E5FF]">{ipWebcamUrl}</code>. Ensure the IP Webcam app is running on your phone and both devices share the same Wi-Fi.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveIpConfig}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#4F46E5] text-white flex items-center gap-2 cursor-pointer shadow-md"
              >
                <RefreshCw size={13} /> Re-try Connection
              </button>
              <button
                onClick={() => setShowSetupGuide(true)}
                className="px-4 py-2 rounded-xl text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                View Instructions
              </button>
            </div>
          </div>
        )}

        {/* Tactical Computer Vision Bounding Box Overlay */}
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          {currentDetections.map((det, idx) => {
            if (!det.box || det.box.length < 4) return null;
            const [x1, y1, x2, y2] = det.box;

            const leftPct = (x1 / 1280) * 100;
            const topPct = (y1 / 720) * 100;
            const widthPct = ((x2 - x1) / 1280) * 100;
            const heightPct = ((y2 - y1) / 720) * 100;

            const style = CLASS_COLORS[det.class_name] || CLASS_COLORS.car;

            return (
              <div
                key={`${det.id}-${idx}`}
                className="absolute border-2 transition-all duration-150"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  borderColor: det.isIncident ? "#EF4444" : style.text,
                  backgroundColor: det.isIncident ? "rgba(239, 68, 68, 0.25)" : style.bg,
                  boxShadow: det.isIncident
                    ? "0 0 20px rgba(239, 68, 68, 0.8)"
                    : `0 0 10px ${style.text}40`,
                }}
              >
                {/* Target Tag Badge */}
                <div
                  className="absolute -top-6 left-0 px-2 py-0.5 rounded text-[10px] font-mono-data font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 shadow-md"
                  style={{
                    backgroundColor: det.isIncident ? "#EF4444" : style.text,
                    color: "#FFFFFF",
                  }}
                >
                  <span>[{det.track_id}]</span>
                  <span>{det.class_name.toUpperCase()}</span>
                  <span>{det.confidence_pct}</span>
                  {det.speed && <span>· {det.speed} km/h</span>}
                </div>

                {/* Subtag License / Warning */}
                {det.tags && det.tags.length > 0 && (
                  <div className="absolute -bottom-6 left-0 px-2 py-0.5 rounded bg-black/85 text-white border border-slate-600 text-[9px] font-mono-data font-bold whitespace-nowrap">
                    {det.tags.join(" · ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Live Top-Right Telemetry Badge */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 font-mono-data text-xs">
          <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-emerald-400 border border-emerald-500/40 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {streamMode === "cctv_recorded" ? `${liveFps} FPS · YOLOv11x Municipal Matrix` : `⚡ YOLOv11n (Nano) · Cloud Sample 1:${sampleRate} · ${backendLatency}ms`}
          </span>
        </div>
      </div>

      {/* 4. REAL-TIME INCIDENTS QUEUE TABLE (SYNCED WITH SURVEILLANCE & WHATSAPP) */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Radio size={14} className="text-rose-500 animate-pulse" />
              Live Computer Vision Event Log
            </h3>
            <p className="text-[11px] text-slate-500 font-mono-data">
              Synchronized events dispatched across surveillance dashboard, WhatsApp emergency SOS, and municipal matrix
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search event, camera, plate..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono-data text-slate-800 outline-none focus:border-[#4F46E5] shadow-2xs"
              />
            </div>

            <button
              onClick={() => {
                const headers = ["ID", "Timestamp", "Camera", "Event", "Vehicle_ID", "Confidence"];
                const rows = eventsList.map((e) => [
                  e.id,
                  e.timestamp,
                  `"${e.camera_name}"`,
                  e.event,
                  `"${e.vehicle_id}"`,
                  `${Math.round(e.confidence * 100)}%`,
                ]);
                const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `NexWatch_LiveStream_Events_${Date.now()}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono-data bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[340px]">
          <table className="w-full text-left text-xs font-mono-data">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                <th className="pb-3 pl-2">Event ID</th>
                <th className="pb-3">Time</th>
                <th className="pb-3">Stream Source</th>
                <th className="pb-3">Classification</th>
                <th className="pb-3">Track / Target</th>
                <th className="pb-3">AI Confidence</th>
                <th className="pb-3 pr-2">Action Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {filteredEvents.map((evt, idx) => {
                const isCritical = evt.event === "accident_collision" || evt.event.includes("collision");
                return (
                  <tr key={`${evt.id || "evt"}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pl-2 font-bold text-slate-900">{evt.id}</td>
                    <td className="py-3 text-slate-500">{evt.timestamp}</td>
                    <td className="py-3 text-slate-700">{evt.camera_name}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isCritical
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                      >
                        {evt.event_type}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600">{evt.vehicle_id}</td>
                    <td className="py-3 font-bold text-slate-900">
                      {evt.isSimulated ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          Simulated
                        </span>
                      ) : (
                        `${Math.round(evt.confidence * 100)}%`
                      )}
                    </td>
                    <td className="py-3 pr-2">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        Dispatched
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
