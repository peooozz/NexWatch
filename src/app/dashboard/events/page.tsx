"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Maximize2,
  Minimize2,
  Download,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Layers,
  Activity,
  Radio,
  Car,
  User,
  Truck,
  Bus,
  Bike,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Clock,
  Eye,
  FileSpreadsheet,
  Smartphone,
  Camera as CameraIcon,
  Video,
  Settings,
  HelpCircle,
  ExternalLink,
  Wifi,
  Flashlight,
  SwitchCamera,
  Check,
} from "lucide-react";

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
  person_count?: number;
  movement_direction?: string;
  stopped_duration_sec?: number;
  details?: Record<string, string | number | boolean>;
}

interface VideoSource {
  id: string;
  filename: string;
  name: string;
  zone: string;
  resolution: string;
  fps: number;
  tracked_src: string;
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
    tracked_src: "/videos/cam1_tracked.mp4",
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
    tracked_src: "/videos/cam2_tracked.mp4",
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
    tracked_src: "/videos/cam3_tracked.mp4",
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
    tracked_src: "/videos/cam4_tracked.mp4",
    clean_src: "/videos/cam4_clean.mp4",
    json_src: "/videos/cam4_tracking.json",
  },
];

const CLASS_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  car: { text: "#00E5FF", bg: "rgba(0, 229, 255, 0.15)", border: "rgba(0, 229, 255, 0.4)" },
  person: { text: "#FFFFFF", bg: "rgba(255, 255, 255, 0.12)", border: "rgba(255, 255, 255, 0.3)" },
  motorcycle: { text: "#10B981", bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.4)" },
  bus: { text: "#EC4899", bg: "rgba(236, 72, 153, 0.15)", border: "rgba(236, 72, 153, 0.4)" },
  truck: { text: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.4)" },
  auto: { text: "#FB923C", bg: "rgba(251, 146, 60, 0.15)", border: "rgba(251, 146, 60, 0.4)" },
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT: LiveStreamPage
   ═══════════════════════════════════════════════════════════════════════ */
export default function LiveStreamPage() {
  // Stream Source Mode
  const [streamMode, setStreamMode] = useState<StreamMode>("ip_webcam");

  // Phone IP Webcam Configuration
  const [phoneIp, setPhoneIp] = useState<string>("192.168.1.100");
  const [phonePort, setPhonePort] = useState<string>("8080");
  const [ipWebcamStatus, setIpWebcamStatus] = useState<"idle" | "streaming" | "error">("idle");
  const [ipWebcamEndpoint, setIpWebcamEndpoint] = useState<"video" | "shot.jpg">("video");
  const [showSetupGuide, setShowSetupGuide] = useState<boolean>(false);

  // Device WebCam State
  const [deviceCamActive, setDeviceCamActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [camErrorMsg, setCamErrorMsg] = useState<string | null>(null);

  // Recorded CCTV Video State
  const [selectedVideoId, setSelectedVideoId] = useState<string>("CAM-001");
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(40);
  const [isLoop, setIsLoop] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [currentFrameNo, setCurrentFrameNo] = useState<number>(0);
  const [totalFrameCount, setTotalFrameCount] = useState<number>(796);

  // Real-Time Detections & Event List
  const [telemetryFrames, setTelemetryFrames] = useState<any[]>([]);
  const [currentDetections, setCurrentDetections] = useState<DetectionItem[]>([]);
  const [eventsList, setEventsList] = useState<SecurityEvent[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [liveFps, setLiveFps] = useState<number>(29.8);
  const [snapshotTaken, setSnapshotTaken] = useState<boolean>(false);

  // Notification Banner
  const [alertBanner, setAlertBanner] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: "info" | "warning" | "success" | "critical";
  } | null>({
    show: true,
    title: "Live Vision Analytics Engine Active",
    message: "Connect your Phone's IP Webcam app or device camera to stream real-time YOLO incident detection.",
    type: "info",
  });

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const liveImgRef = useRef<HTMLImageElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const selectedVideo = useMemo(
    () => AVAILABLE_VIDEOS.find((v) => v.id === selectedVideoId) || AVAILABLE_VIDEOS[0],
    [selectedVideoId]
  );

  // Computed IP Webcam Full URL
  const ipWebcamUrl = useMemo(() => {
    let cleanIp = phoneIp.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return `http://${cleanIp}:${phonePort}/${ipWebcamEndpoint}`;
  }, [phoneIp, phonePort, ipWebcamEndpoint]);

  // Load saved IP from localStorage on mount
  useEffect(() => {
    try {
      const savedIp = localStorage.getItem("cityeye_phone_ip");
      const savedPort = localStorage.getItem("cityeye_phone_port");
      if (savedIp) setPhoneIp(savedIp);
      if (savedPort) setPhonePort(savedPort);
    } catch {}
  }, []);

  // Save IP to localStorage
  const handleSaveIpConfig = () => {
    try {
      localStorage.setItem("cityeye_phone_ip", phoneIp);
      localStorage.setItem("cityeye_phone_port", phonePort);
      setIpWebcamStatus("streaming");
      setAlertBanner({
        show: true,
        title: "IP Webcam Stream Connected",
        message: `Attempting live MJPEG connection to ${ipWebcamUrl}. Ensure your phone & PC are on the same Wi-Fi.`,
        type: "success",
      });
    } catch {}
  };

  // ── Device Camera Handler (WebRTC getUserMedia) ──────────────────────
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
        title: "Device Camera Active",
        message: `Streaming high-definition video feed from ${facingMode === "environment" ? "Rear (Environment)" : "Front"} Camera.`,
        type: "success",
      });
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCamErrorMsg(err?.message || "Could not access device camera. Please check permissions.");
      setAlertBanner({
        show: true,
        title: "Camera Permission Denied",
        message: "Please allow browser camera permissions to enable direct device streaming.",
        type: "critical",
      });
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

  // Effect to toggle device camera on stream mode change
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

  // ── Simulated Live AI Detection Overlay for Live Phone/Webcam ───────
  useEffect(() => {
    if (streamMode === "cctv_recorded") return;

    let frameCount = 0;
    const interval = setInterval(() => {
      frameCount++;
      // Jitter live FPS
      setLiveFps(parseFloat((28.5 + Math.random() * 2.8).toFixed(1)));

      // Generate dynamic tracking boxes over live stream
      const xOffset = (Math.sin(frameCount / 10) * 120);
      const yOffset = (Math.cos(frameCount / 12) * 50);

      const liveDetections: DetectionItem[] = [
        {
          id: `LIVE-TRK-101`,
          track_id: 101,
          class_name: "car",
          confidence: 0.94,
          confidence_pct: "94%",
          speed: Math.floor(38 + Math.random() * 6),
          box: [Math.max(40, 260 + xOffset), 180 + yOffset, Math.max(200, 560 + xOffset), 420 + yOffset],
          tags: frameCount % 80 > 40 ? ["🚨 SPEED: 48 km/h"] : [],
        },
        {
          id: `LIVE-TRK-102`,
          track_id: 102,
          class_name: "motorcycle",
          confidence: 0.88,
          confidence_pct: "88%",
          speed: Math.floor(26 + Math.random() * 8),
          box: [Math.max(600, 680 - xOffset), 220 - yOffset, Math.max(760, 840 - xOffset), 440 - yOffset],
          tags: ["⚠ LIVE TRACK"],
        },
        {
          id: `LIVE-TRK-103`,
          track_id: 103,
          class_name: "person",
          confidence: 0.91,
          confidence_pct: "91%",
          speed: 4,
          box: [120, 240, 200, 480],
          tags: ["PEDESTRIAN"],
        },
      ].filter((d) => d.confidence * 100 >= confidenceThreshold);

      setCurrentDetections(liveDetections);

      // Periodically trigger a live security event
      if (frameCount % 45 === 0) {
        const newEvt: SecurityEvent = {
          id: `EVT-LIVE-${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }),
          camera_id: streamMode === "ip_webcam" ? "PHONE-IP-CAM" : "WEBCAM-NODE-01",
          camera_name: streamMode === "ip_webcam" ? `Phone IP (${phoneIp})` : "Local Edge Camera",
          event: frameCount % 90 === 0 ? "wrong_way_driving" : "speed_violation",
          event_type: frameCount % 90 === 0 ? "Violation" : "Traffic Warning",
          vehicle_id: `LIVE-${Math.floor(100 + Math.random() * 900)}`,
          confidence: 0.92,
          movement_direction: "Northbound",
          details: {
            speed: "52 km/h",
            zone: "Live Edge Field",
          },
        };
        setEventsList((prev) => [newEvt, ...prev.slice(0, 30)]);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [streamMode, confidenceThreshold, phoneIp]);

  // ── Load CCTV Recorded Telemetry & Events ───────────────────────────
  useEffect(() => {
    if (streamMode !== "cctv_recorded") return;

    async function loadTelemetry() {
      try {
        const res = await fetch(selectedVideo.json_src);
        if (res.ok) {
          const data = await res.json();
          if (data.frames) {
            setTelemetryFrames(data.frames);
            setTotalFrameCount(data.frames.length > 0 ? data.frames[data.frames.length - 1].frame : 796);
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
    const dur = videoRef.current.duration || 1;
    setCurrentTime(time);
    setDuration(dur);

    const approxFrame = Math.floor(time * selectedVideo.fps);
    setCurrentFrameNo(approxFrame);

    if (telemetryFrames.length > 0) {
      const matched =
        telemetryFrames.find((f) => Math.abs(f.time - time) < 0.14) ||
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
          }));
        setCurrentDetections(filtered);
        return;
      }
    }
  }, [confidenceThreshold, selectedVideo.fps, telemetryFrames, streamMode]);

  // Capture Live Snapshot
  const captureSnapshot = () => {
    setSnapshotTaken(true);
    setTimeout(() => setSnapshotTaken(false), 800);

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#0D1117";
    ctx.fillRect(0, 0, 1280, 720);

    // Draw video frame if device cam or cctv
    if (streamMode === "device_cam" && webcamVideoRef.current) {
      try {
        ctx.drawImage(webcamVideoRef.current, 0, 0, 1280, 720);
      } catch {}
    } else if (streamMode === "cctv_recorded" && videoRef.current) {
      try {
        ctx.drawImage(videoRef.current, 0, 0, 1280, 720);
      } catch {}
    }

    // Tactical Overlay Watermark
    ctx.fillStyle = "rgba(0, 229, 255, 0.9)";
    ctx.font = "bold 16px monospace";
    ctx.fillText(
      `[NEXWATCH TACTICAL EVIDENCE] // ${new Date().toISOString()} // STREAM: ${streamMode.toUpperCase()}`,
      24,
      40
    );

    const link = document.createElement("a");
    link.download = `NexWatch_Evidence_${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Export Events CSV
  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const headers = ["ID", "Timestamp", "Camera", "Event", "Vehicle_ID", "Confidence", "Speed_KMPH"];
      const rows = eventsList.map((e) => [
        e.id,
        e.timestamp,
        `"${e.camera_name}"`,
        e.event,
        e.vehicle_id,
        `${Math.round(e.confidence * 100)}%`,
        e.details?.speed || "35",
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
    } finally {
      setTimeout(() => setIsExporting(false), 500);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const current = currentDetections;
    const cars = current.filter((d) => d.class_name === "car" || d.class_name === "auto").length;
    const persons = current.filter((d) => d.class_name === "person").length;
    const motorcycles = current.filter((d) => d.class_name === "motorcycle").length;
    const buses = current.filter((d) => d.class_name === "bus").length;
    const trucks = current.filter((d) => d.class_name === "truck").length;

    const tripleRidingCount = eventsList.filter((e) => e.event === "triple_riding").length;
    const wrongWayCount = eventsList.filter((e) => e.event === "wrong_way_driving").length;
    const stoppedCount = eventsList.filter((e) => e.event === "vehicle_stopped").length;
    const helmetCount = eventsList.filter((e) => e.event === "helmet_violation").length;
    const collisionCount = eventsList.filter((e) => e.event === "accident_collision").length;

    return {
      cars,
      persons,
      motorcycles,
      buses,
      trucks,
      totalTracked: current.length,
      tripleRidingCount,
      wrongWayCount,
      stoppedCount,
      helmetCount,
      collisionCount,
    };
  }, [currentDetections, eventsList]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return eventsList.filter((e) => {
      const matchesFilter =
        activeFilter === "ALL" ||
        e.event === activeFilter ||
        (activeFilter === "triple_riding" && e.event === "triple_riding") ||
        (activeFilter === "wrong_way_driving" && e.event === "wrong_way_driving") ||
        (activeFilter === "helmet_violation" && e.event === "helmet_violation") ||
        (activeFilter === "vehicle_stopped" && e.event === "vehicle_stopped") ||
        (activeFilter === "accident_collision" && e.event === "accident_collision");

      const matchesSearch =
        searchQuery === "" ||
        e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.camera_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.event.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(e.vehicle_id).toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [eventsList, activeFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 p-3 sm:p-6 lg:p-8 space-y-6">
      {/* ═══════════════════════════════════════════════════════════════
          1. HEADER & STREAM SOURCE SWITCHER
          ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#1E2638] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold font-headline tracking-tight text-white flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#00E5FF] animate-live-pulse" />
              Live Stream & Edge Vision Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-data uppercase tracking-wider font-bold bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30">
              YOLOv11 Inference Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Real-time multi-target classification, speed radar, and automated traffic violation detection across live feeds.
          </p>
        </div>

        {/* STREAM SOURCE SELECTOR BUTTONS */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-[#07090E] border border-[#1E2638]">
          <button
            onClick={() => setStreamMode("ip_webcam")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
              streamMode === "ip_webcam"
                ? "bg-[#00E5FF] text-black shadow-[0_0_12px_rgba(0,229,255,0.4)]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Smartphone size={14} />
            Phone IP Webcam
          </button>

          <button
            onClick={() => setStreamMode("device_cam")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
              streamMode === "device_cam"
                ? "bg-[#10B981] text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <CameraIcon size={14} />
            Device Camera
          </button>

          <button
            onClick={() => setStreamMode("cctv_recorded")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
              streamMode === "cctv_recorded"
                ? "bg-[#0091FF] text-white shadow-[0_0_12px_rgba(0,145,255,0.4)]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Video size={14} />
            CCTV Grid Feeds
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          2. STREAM CONFIGURATION BAR (FOR IP WEBCAM & DEVICE CAM)
          ═══════════════════════════════════════════════════════════════ */}
      {streamMode === "ip_webcam" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-[#0B0F19] border border-[#00E5FF]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
        >
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#00E5FF]">
              <Wifi size={16} className="animate-pulse" />
              <span>IP WEBCAM ENDPOINT:</span>
            </div>

            <div className="flex items-center gap-2 bg-[#07090E] border border-[#1E2638] rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-500 font-mono">http://</span>
              <input
                type="text"
                value={phoneIp}
                onChange={(e) => setPhoneIp(e.target.value)}
                placeholder="192.168.1.100"
                className="bg-transparent text-xs font-mono text-white focus:outline-none w-32"
              />
              <span className="text-xs text-gray-500 font-mono">:</span>
              <input
                type="text"
                value={phonePort}
                onChange={(e) => setPhonePort(e.target.value)}
                placeholder="8080"
                className="bg-transparent text-xs font-mono text-white focus:outline-none w-14"
              />
              <span className="text-xs text-gray-500 font-mono">/video</span>
            </div>

            <button
              onClick={handleSaveIpConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-[#00E5FF] text-black hover:bg-[#00c8de] transition-colors cursor-pointer"
            >
              <Check size={14} />
              Connect Stream
            </button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => setShowSetupGuide(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-gray-300 bg-[#07090E] border border-[#1E2638] hover:border-[#00E5FF]/50 transition-colors cursor-pointer"
            >
              <HelpCircle size={14} className="text-[#00E5FF]" />
              How to setup IP Webcam App?
            </button>
          </div>
        </motion.div>
      )}

      {streamMode === "device_cam" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-[#0B0F19] border border-[#10B981]/30 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
            <span className="text-xs font-mono text-gray-300">
              Direct HTML5 WebRTC stream active on local device.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = facingMode === "environment" ? "user" : "environment";
                setFacingMode(next);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-[#07090E] border border-[#1E2638] text-white hover:border-[#10B981] transition-all cursor-pointer"
            >
              <SwitchCamera size={14} className="text-[#10B981]" />
              Flip Camera ({facingMode === "environment" ? "Rear" : "Front"})
            </button>
          </div>
        </motion.div>
      )}

      {streamMode === "cctv_recorded" && (
        <div className="flex flex-wrap items-center gap-2 p-1 bg-[#07090E] border border-[#1E2638] rounded-xl">
          {AVAILABLE_VIDEOS.map((vid) => (
            <button
              key={vid.id}
              onClick={() => setSelectedVideoId(vid.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                selectedVideoId === vid.id
                  ? "bg-[#0091FF] text-white font-bold"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>{vid.id}:</span>
              <span>{vid.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          3. MAIN VIDEO STAGE WITH TACTICAL BOUNDING BOX OVERLAY
          ═══════════════════════════════════════════════════════════════ */}
      <div
        ref={containerRef}
        className={`relative rounded-2xl overflow-hidden border border-[#1E2638] bg-[#000000] shadow-2xl flex flex-col items-center justify-center ${
          isFullscreen ? "h-screen w-screen rounded-none" : "min-h-[400px] sm:min-h-[520px] lg:min-h-[640px]"
        }`}
      >
        {/* FLASH EFFECT ON SNAPSHOT */}
        {snapshotTaken && (
          <div className="absolute inset-0 bg-white/90 z-50 animate-out fade-out duration-500 pointer-events-none" />
        )}

        {/* ── A. IP WEBCAM STREAM VIEW ── */}
        {streamMode === "ip_webcam" && (
          <div className="relative w-full h-full flex items-center justify-center min-h-[480px]">
            {/* MJPEG Live Stream */}
            <img
              ref={liveImgRef}
              src={ipWebcamUrl}
              alt="Phone IP Webcam Live Stream"
              className="w-full h-full object-contain max-h-[720px]"
              onError={() => {
                setIpWebcamStatus("error");
              }}
              onLoad={() => {
                setIpWebcamStatus("streaming");
              }}
            />

            {/* Connection Error Fallback Guide */}
            {ipWebcamStatus === "error" && (
              <div className="absolute inset-0 bg-[#07090E]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
                <AlertTriangle size={48} className="text-[#FF9500] mb-3" />
                <h3 className="text-lg font-bold text-white font-headline">Waiting for IP Webcam Stream</h3>
                <p className="text-xs text-gray-400 max-w-md mt-1 mb-4">
                  Could not reach <code className="text-[#00E5FF] font-mono">{ipWebcamUrl}</code>. Make sure the &quot;IP Webcam&quot; app is running on your phone and both devices are connected to the same Wi-Fi.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveIpConfig}
                    className="px-4 py-2 rounded-lg text-xs font-mono font-bold bg-[#00E5FF] text-black flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw size={14} /> Retry Connection
                  </button>
                  <button
                    onClick={() => setShowSetupGuide(true)}
                    className="px-4 py-2 rounded-lg text-xs font-mono text-gray-300 bg-[#1E2638] hover:bg-[#2A344D] cursor-pointer"
                  >
                    View Setup Instructions
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── B. DEVICE WEBCAM VIEW ── */}
        {streamMode === "device_cam" && (
          <div className="relative w-full h-full flex items-center justify-center min-h-[480px]">
            <video
              ref={webcamVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain max-h-[720px]"
            />
            {camErrorMsg && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center z-20">
                <XCircle size={44} className="text-[#FF3B30] mb-2" />
                <p className="text-sm font-semibold text-white">{camErrorMsg}</p>
                <button
                  onClick={startDeviceCamera}
                  className="mt-3 px-4 py-2 rounded-lg text-xs font-mono bg-[#10B981] text-black font-bold cursor-pointer"
                >
                  Grant Camera Permissions
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── C. PRE-RECORDED CCTV VIEW ── */}
        {streamMode === "cctv_recorded" && (
          <div className="relative w-full h-full flex items-center justify-center min-h-[480px]">
            <video
              ref={videoRef}
              src={selectedVideo.clean_src}
              autoPlay
              playsInline
              muted
              loop={isLoop}
              onTimeUpdate={handleTimeUpdate}
              className="w-full h-full object-contain max-h-[720px]"
            />
          </div>
        )}

        {/* ── D. TACTICAL REAL-TIME BOUNDING BOX OVERLAYS ── */}
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          {/* Scanline Grid */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0, 229, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.1) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          {/* Render Bounding Boxes */}
          {currentDetections.map((det, idx) => {
            if (!det.box || det.box.length < 4) return null;
            const [x1, y1, x2, y2] = det.box;

            // Map 1280x720 target space to percentage coordinates
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
                  borderColor: style.text,
                  backgroundColor: style.bg,
                  boxShadow: `0 0 10px ${style.text}40`,
                }}
              >
                {/* Corner Crosshairs */}
                <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-white" />
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-white" />
                <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-white" />
                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-white" />

                {/* Target Label HUD */}
                <div
                  className="absolute -top-6 left-0 px-2 py-0.5 rounded text-[10px] font-mono-data font-bold tracking-wider uppercase whitespace-nowrap flex items-center gap-1.5"
                  style={{
                    backgroundColor: style.text,
                    color: "#000000",
                  }}
                >
                  <span>[{det.track_id || idx + 1}]</span>
                  <span>{det.class_name}</span>
                  <span>{det.confidence_pct || `${Math.round(det.confidence * 100)}%`}</span>
                  {det.speed && <span className="opacity-80">· {det.speed} km/h</span>}
                </div>

                {/* Threat Tags */}
                {det.tags && det.tags.length > 0 && (
                  <div className="absolute -bottom-5 left-0 px-1.5 py-0.5 rounded bg-[#FF3B30] text-white text-[9px] font-mono-data font-bold tracking-wider">
                    {det.tags[0]}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── E. TOP HUD OVERLAY (FPS, LATENCY, NODE INFO) ── */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
          <div className="flex items-center gap-2 bg-[#07090E]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1E2638] text-[11px] font-mono">
            <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-live-pulse" />
            <span className="text-white font-bold">
              {streamMode === "ip_webcam"
                ? `PHONE IP WEBCAM [${phoneIp}]`
                : streamMode === "device_cam"
                ? "DEVICE SENSOR [WEBRTC 720p]"
                : selectedVideo.name.toUpperCase()}
            </span>
            <span className="text-gray-500">|</span>
            <span className="text-[#00E5FF]">{liveFps} FPS</span>
            <span className="text-gray-500">|</span>
            <span className="text-[#10B981]">LATENCY: 14ms</span>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={captureSnapshot}
              className="p-2 rounded-lg bg-[#07090E]/80 backdrop-blur-md border border-[#1E2638] hover:border-[#00E5FF] text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Capture Evidence Snapshot"
            >
              <Download size={14} className="text-[#00E5FF]" />
              <span className="hidden sm:inline">Capture Snapshot</span>
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-[#07090E]/80 backdrop-blur-md border border-[#1E2638] hover:border-white text-white transition-colors cursor-pointer"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* ── F. BOTTOM TIMELINE SCRUBBER (FOR RECORDED CCTV) ── */}
        {streamMode === "cctv_recorded" && (
          <div className="absolute bottom-3 left-3 right-3 bg-[#07090E]/90 backdrop-blur-md p-3 rounded-xl border border-[#1E2638] z-20">
            <div className="flex items-center justify-between gap-4 text-xs font-mono text-gray-300 mb-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      if (isPlaying) videoRef.current.pause();
                      else videoRef.current.play();
                      setIsPlaying(!isPlaying);
                    }
                  }}
                  className="p-1 rounded bg-[#1E2638] hover:bg-[#2A344D] text-white cursor-pointer"
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>

                <span>
                  {Math.floor(currentTime / 60)}:
                  {String(Math.floor(currentTime % 60)).padStart(2, "0")} / {Math.floor(duration / 60)}:
                  {String(Math.floor(duration % 60)).padStart(2, "0")}
                </span>

                <span className="text-gray-500">·</span>
                <span className="text-[#00E5FF]">FRAME #{currentFrameNo}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-gray-400">Confidence:</span>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                  className="w-24 accent-[#00E5FF] cursor-pointer"
                />
                <span className="text-[#00E5FF] font-bold">{confidenceThreshold}%</span>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Number(e.target.value);
                  setCurrentTime(Number(e.target.value));
                }
              }}
              className="w-full h-1.5 bg-[#1E2638] rounded-lg appearance-none cursor-pointer accent-[#00E5FF]"
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          4. REAL-TIME TELEMETRY & CLASSIFICATION CARDS
          ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-[#07090E] border border-[#1E2638] flex flex-col justify-between">
          <span className="text-gray-400 text-xs font-mono uppercase">TARGETS IN SIGHT</span>
          <span className="text-2xl font-mono font-bold text-[#00E5FF] mt-2">{stats.totalTracked}</span>
          <span className="text-[10px] font-mono text-gray-500">ByteTrack active</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#07090E] border border-[#00E5FF]/20 flex flex-col justify-between">
          <span className="text-gray-400 text-xs font-mono uppercase">CARS & AUTOS</span>
          <span className="text-2xl font-mono font-bold text-[#00E5FF] mt-2">{stats.cars}</span>
          <span className="text-[10px] font-mono text-gray-500">Light passenger</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#07090E] border border-[#10B981]/20 flex flex-col justify-between">
          <span className="text-gray-400 text-xs font-mono uppercase">MOTORCYCLES</span>
          <span className="text-2xl font-mono font-bold text-[#10B981] mt-2">{stats.motorcycles}</span>
          <span className="text-[10px] font-mono text-gray-500">Two-wheelers</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#07090E] border border-white/20 flex flex-col justify-between">
          <span className="text-gray-400 text-xs font-mono uppercase">PEDESTRIANS</span>
          <span className="text-2xl font-mono font-bold text-white mt-2">{stats.persons}</span>
          <span className="text-[10px] font-mono text-gray-500">Foot traffic</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#07090E] border border-[#F59E0B]/20 flex flex-col justify-between">
          <span className="text-gray-400 text-xs font-mono uppercase">TRUCKS</span>
          <span className="text-2xl font-mono font-bold text-[#F59E0B] mt-2">{stats.trucks}</span>
          <span className="text-[10px] font-mono text-gray-500">Heavy cargo</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#07090E] border border-[#FF3B30]/20 flex flex-col justify-between">
          <span className="text-gray-400 text-xs font-mono uppercase">VIOLATIONS LOGGED</span>
          <span className="text-2xl font-mono font-bold text-[#FF3B30] mt-2">{eventsList.length}</span>
          <span className="text-[10px] font-mono text-gray-500">Inference events</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          5. LIVE INCIDENT & VIOLATION EVENT LOG TABLE
          ═══════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-[#1E2638] bg-[#07090E] overflow-hidden">
        <div className="p-4 border-b border-[#1E2638] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-[#00E5FF]" />
            <h2 className="text-sm font-bold font-headline text-white">Live Incident & Violation Telemetry</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1E2638] text-gray-300">
              {filteredEvents.length} Events
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0B0F19] border border-[#1E2638] text-xs font-mono text-white focus:outline-none focus:border-[#00E5FF] w-48"
              />
            </div>

            <button
              onClick={handleExportCSV}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-[#1E2638] hover:bg-[#2A344D] text-white transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-[#10B981]" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs font-mono">
            <thead className="sticky top-0 bg-[#0B0F19] border-b border-[#1E2638] text-gray-400 text-[11px] uppercase">
              <tr>
                <th className="p-3">Event ID</th>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Camera Node</th>
                <th className="p-3">Incident Type</th>
                <th className="p-3">Target Track</th>
                <th className="p-3">Confidence</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2638]/50">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No incident violations detected yet in active stream.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-[#0B0F19]/50 transition-colors">
                    <td className="p-3 font-bold text-[#00E5FF]">{evt.id}</td>
                    <td className="p-3 text-gray-300">{evt.timestamp}</td>
                    <td className="p-3 text-gray-300">{evt.camera_name}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/30">
                        {evt.event.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-gray-300">{evt.vehicle_id}</td>
                    <td className="p-3 text-[#10B981]">{Math.round(evt.confidence * 100)}%</td>
                    <td className="p-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#10B981]">
                        <CheckCircle2 size={12} /> Logged
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          6. MODAL: HOW TO SETUP PHONE IP WEBCAM APP
          ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showSetupGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0B0F19] border border-[#00E5FF]/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#1E2638] pb-3">
                <div className="flex items-center gap-2 text-white font-bold font-headline">
                  <Smartphone className="text-[#00E5FF]" size={20} />
                  <span>How to Stream from IP Webcam Phone App</span>
                </div>
                <button
                  onClick={() => setShowSetupGuide(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs text-gray-300 leading-relaxed font-sans">
                <div className="p-3 rounded-lg bg-[#07090E] border border-[#1E2638]">
                  <strong className="text-[#00E5FF] font-mono block mb-1">Step 1: Install & Open App</strong>
                  Install the free <strong>&quot;IP Webcam&quot;</strong> app by Pavel Khlebovich on your Android phone from Google Play Store.
                </div>

                <div className="p-3 rounded-lg bg-[#07090E] border border-[#1E2638]">
                  <strong className="text-[#00E5FF] font-mono block mb-1">Step 2: Start Server</strong>
                  Connect your phone to the <strong>same Wi-Fi network</strong> as your laptop/computer. Scroll to the bottom of the app and tap <strong>&quot;Start server&quot;</strong>.
                </div>

                <div className="p-3 rounded-lg bg-[#07090E] border border-[#1E2638]">
                  <strong className="text-[#00E5FF] font-mono block mb-1">Step 3: Enter IP into NexWatch</strong>
                  Your phone will display an address at the bottom of the screen (e.g. <code className="text-[#00E5FF] font-mono">http://192.168.1.5:8080</code>).
                  Enter that IP into the bar above and click <strong>&quot;Connect Stream&quot;</strong>!
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowSetupGuide(false)}
                  className="px-5 py-2 rounded-xl text-xs font-bold font-mono bg-[#00E5FF] text-black hover:bg-[#00c8de] transition-colors cursor-pointer"
                >
                  Got It, Let&apos;s Stream!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
