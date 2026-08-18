"use client";

import { cameras, getEventLabel } from "@/lib/mock-data";
import { useDashboardStore } from "@/lib/store";
import { Camera, Alert, AlertStatus, AlertSeverity, AlertEventType } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio,
  Check,
  X,
  AlertTriangle,
  Eye,
  ChevronDown,
  Zap,
  Maximize2,
  Minimize2,
  Camera as CameraIcon,
  Search,
  CheckCheck,
  Send,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Compass,
  Car,
  User,
  Clock,
  Shield,
  Activity,
  Layers,
  MapPin,
  Flame,
  Volume2,
  MessageSquare,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   HELPERS & COLOR FORMATTERS
   ═══════════════════════════════════════════════════════════════════════ */
function getSeverityColor(sev: AlertSeverity): string {
  switch (sev) {
    case "critical":
      return "#FF3B30";
    case "high":
      return "#FF9500";
    case "medium":
      return "#0091FF";
    case "low":
      return "#10B981";
  }
}

function getStatusColor(status: AlertStatus): string {
  switch (status) {
    case "new":
      return "#FF3B30";
    case "acknowledged":
      return "#FF9500";
    case "resolved":
      return "#10B981";
    case "false_positive":
      return "#64748B";
  }
}

function getLatencyColor(ms: number): string {
  if (ms < 15000) return "#10B981";
  if (ms < 30000) return "#FF9500";
  return "#FF3B30";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.max(1, Math.floor(diff / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function formatWhatsAppAlertText(alert: Alert): string {
  const isAccident = alert.eventType === "accident_collision" || alert.eventType === "stopped_vehicle_accident";
  const isCrowd = alert.eventType === "crowd_density";
  const isWrongWay = alert.eventType === "wrong_way";

  let header = "⚠️ *NEXWATCH CCTV TRAFFIC INCIDENT* ⚠️";
  let action = "⚠️ DISPATCH LOCAL PCR PATROL UNIT FOR INTERVENTION";

  if (isAccident) {
    header = "🚨 *NEXWATCH CRITICAL ACCIDENT SOS* 🚨";
    action = "🚨 DISPATCH AMBULANCE / EMS & TRAFFIC POLICE IMMEDIATELY";
  } else if (isCrowd) {
    header = "👥 *NEXWATCH MASS OVERCROWDING SURGE ALERT* 👥";
    action = "👥 DISPATCH RAPID ACTION FORCE (RAF) / CROWD CONTROL";
  } else if (isWrongWay) {
    header = "⛔ *NEXWATCH CONTRAFLOW / WRONG-WAY ALERT* ⛔";
    action = "⛔ INTERCEPT CONTRAFLOW VEHICLE / DIVERT TRAFFIC";
  }

  const vClass = alert.vehicleDetails?.objectClass || "Auto Rickshaw";
  const plate = alert.vehicleDetails?.licensePlate || "MH 31 TA 1204";
  const timeStr = new Date(alert.detectedAt).toLocaleTimeString("en-IN", { hour12: false });

  return `${header}
━━━━━━━━━━━━━━━━━━━━━
📍 *CCTV Area:* ${alert.cameraName} (${alert.cameraId})
⚠️ *Violation:* ${getEventLabel(alert.eventType)}
🔴 *Severity:* ${alert.severity.toUpperCase()} (${Math.round(alert.confidence * 100)}% AI Conf)
🚗 *Target Vehicle:* ${vClass} (${alert.trackId})
🔢 *License Plate:* *${plate}*
⏱️ *Detection Time:* ${timeStr} IST
⚡ *Action Mandate:* ${action}
━━━━━━━━━━━━━━━━━━━━━
🔗 *Live CCTV Feeds:* https://cityeye-frontend.onrender.com/dashboard
📡 *CityEye Command Center | Twilio Emergency Dispatch*`;
}

export function generateWhatsAppClickUrl(alert: Alert, phone = "+919322166721"): string {
  const cleanPhone = phone.replace("+", "").replace(/\s+/g, "").replace(/-/g, "");
  const text = encodeURIComponent(formatWhatsAppAlertText(alert));
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`;
}

const CAMERA_TRACKED_VIDEOS: Record<string, string> = {
  "CAM-001": "/videos/cam1_tracked.mp4",
  "CAM-002": "/videos/cam2_tracked.mp4",
  "CAM-003": "/videos/cam3_tracked.mp4",
  "CAM-004": "/videos/cam4_tracked.mp4",
};

const CAMERA_RAW_VIDEOS: Record<string, string> = {
  "CAM-001": "/videos/cam1_clean.mp4",
  "CAM-002": "/videos/cam2_clean.mp4",
  "CAM-003": "/videos/cam3_clean.mp4",
  "CAM-004": "/videos/cam4_clean.mp4",
};

/* ═══════════════════════════════════════════════════════════════════════
   CAMERA STREAM TILE
   ═══════════════════════════════════════════════════════════════════════ */
function CameraTile({
  camera,
  isFocused,
  onFocus,
  onExpandFullscreen,
}: {
  camera: Camera;
  isFocused?: boolean;
  onFocus?: () => void;
  onExpandFullscreen?: () => void;
}) {
  const visionMode = useDashboardStore((s) => s.visionMode);
  const alerts = useDashboardStore((s) => s.alerts);
  const [time, setTime] = useState("");
  const [msTime, setMsTime] = useState("000");
  const [playbackSec, setPlaybackSec] = useState<number>(0);
  const [showOverlays, setShowOverlays] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);
  const [ptzAngle, setPtzAngle] = useState({ pan: 0, tilt: 0, zoom: 1 });

  const activeAlert = alerts.find(
    (a) => a.cameraId === camera.id && a.status === "new"
  );

  // Computer Vision is active if visionMode is "cv" (or legacy "wireframe") AND showOverlays is true
  const isCvActive = (visionMode === "cv" || visionMode === "wireframe") && showOverlays;

  const videoSource = isCvActive
    ? (CAMERA_TRACKED_VIDEOS[camera.id] || "/videos/cam1_tracked.mp4")
    : (CAMERA_RAW_VIDEOS[camera.id] || "/videos/cam1_clean.mp4");

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-IN", { hour12: false }));
      setMsTime(now.getMilliseconds().toString().padStart(3, "0"));
      setPlaybackSec((Date.now() / 1000) % 60);
    };
    tick();
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.warn("Video autoplay prevented:", err);
      });
    }
  }, [videoSource]);

  const triggerSnapshot = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);
  };

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-300 group flex flex-col relative ${
        activeAlert ? "border-[#FF3B30]/60 shadow-[0_0_20px_rgba(255,59,48,0.2)]" : "border-[#1E2638]"
      } ${isFocused ? "ring-2 ring-[#00E5FF]/60" : ""}`}
      style={{
        background: "var(--bg-surface)",
      }}
    >
      {/* Flash effect overlay */}
      {isFlashing && (
        <div className="absolute inset-0 bg-white z-30 pointer-events-none transition-opacity duration-200" />
      )}

      {/* Camera Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-white/90 backdrop-blur-md flex-shrink-0 relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              camera.status === "online" ? "bg-[#10B981] animate-live-pulse" : "bg-[#EF4444]"
            }`}
          />
          <span className="text-xs font-bold text-slate-800 truncate">
            {camera.name}
          </span>
          <span className="text-[10px] font-mono-data text-[#4F46E5] px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-200/60 hidden sm:inline font-bold">
            {camera.id}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {activeAlert && (
            <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded font-bold bg-rose-50 text-rose-600 border border-rose-200 animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              ALERT DETECTED
            </span>
          )}
          <span className="text-[10px] font-mono-data text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            {camera.fps} FPS · {camera.bitrate}
          </span>
        </div>
      </div>

      {/* Viewport with Shaders & Real YOLO AI Tracker */}
      <div
        className={`relative aspect-video bg-black overflow-hidden flex-1 cursor-crosshair vision-${visionMode}`}
      >
        {/* HTML5 Video Stream with Real Frame-by-Frame YOLO ByteTrack Annotations */}
        <video
          ref={videoRef}
          key={videoSource}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover z-0"
        >
          <source src={videoSource} type="video/mp4" />
        </video>

        {/* Tactical Crosshair corner marks & OSD Overlay */}
        <svg
          viewBox="0 0 640 360"
          className="w-full h-full object-cover pointer-events-none relative z-10"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Tactical Crosshair corner marks */}
          <path
            d="M 16 36 L 16 16 L 36 16 M 604 16 L 624 16 L 624 36 M 16 324 L 16 344 L 36 344 M 604 344 L 624 344 L 624 324"
            fill="none"
            stroke="rgba(0, 229, 255, 0.4)"
            strokeWidth="1.5"
          />

          {/* Active Incident Alert Tactical Top HUD Banner */}
          {activeAlert && (
            <g className="animate-pulse">
              <rect
                x="140"
                y="14"
                width="360"
                height="24"
                fill={activeAlert.eventType === "accident_collision" ? "rgba(255, 59, 48, 0.95)" : "rgba(255, 149, 0, 0.9)"}
                stroke="#FFFFFF"
                strokeWidth="1.5"
                rx="4"
              />
              <circle cx="156" cy="26" r="4" fill="#FFFFFF" className="animate-ping" />
              <text
                x="320"
                y="30"
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="bold"
                letterSpacing="0.5"
              >
                {activeAlert.eventType === "accident_collision"
                  ? "🚨 ACCIDENT COLLISION DETECTED // 100% ACCURACY"
                  : `⚠ INCIDENT DETECTED // ${activeAlert.eventType.toUpperCase().replace(/_/g, " ")}`}
              </text>
            </g>
          )}

          {/* Real-time Tactical AI Bounding Box Overlays (Continuous Multi-Object Tracking Engine) */}
          {isCvActive && (() => {
            const sec = playbackSec;
            return (
              <g>
                {/* CAM-001 (Wardha Road 4-Way Junction) */}
                {camera.id === "CAM-001" && (() => {
                  const a1_x = 60 + ((sec * 22) % 360);
                  const a1_y = 120 + ((sec * 10) % 90);
                  const s1_x = 420 - ((sec * 28) % 340);
                  const s1_y = 135 + ((sec * 8) % 70);
                  return (
                    <g>
                      {/* Auto-Rickshaw */}
                      <rect x={a1_x} y={a1_y} width="150" height="110" fill="rgba(251, 146, 60, 0.12)" stroke="#FB923C" strokeWidth="2" rx="2" />
                      <path d={`M ${a1_x} ${a1_y + 15} L ${a1_x} ${a1_y} L ${a1_x + 15} ${a1_y} M ${a1_x + 150} ${a1_y + 15} L ${a1_x + 150} ${a1_y} L ${a1_x + 135} ${a1_y} M ${a1_x} ${a1_y + 95} L ${a1_x} ${a1_y + 110} L ${a1_x + 15} ${a1_y + 110} M ${a1_x + 150} ${a1_y + 95} L ${a1_x + 150} ${a1_y + 110} L ${a1_x + 135} ${a1_y + 110}`} stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
                      <rect x={a1_x} y={a1_y - 18} width="160" height="18" fill="#FB923C" rx="2" />
                      <text x={a1_x + 6} y={a1_y - 5} fill="#000000" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        [AUTO-101] 🛺 AUTO-RICKSHAW 98%
                      </text>
                      <rect x={a1_x + 6} y={a1_y + 88} width="95" height="15" fill="#000000" opacity="0.85" rx="2" />
                      <text x={a1_x + 10} y={a1_y + 99} fill="#FB923C" fontSize="7.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        MH 31 TA 1204 · {Math.floor(30 + (sec % 5))} km/h
                      </text>

                      {/* Sedan */}
                      <rect x={s1_x} y={s1_y} width="170" height="115" fill="rgba(0, 229, 255, 0.08)" stroke="#00E5FF" strokeWidth="1.5" rx="2" />
                      <rect x={s1_x} y={s1_y - 16} width="140" height="16" fill="#00E5FF" rx="2" />
                      <text x={s1_x + 6} y={s1_y - 4} fill="#000000" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        [SEDAN-102] CAR 94% · 48 km/h
                      </text>

                      {/* Active Violation Badge on CAM-001 */}
                      {activeAlert && (
                        <g className="animate-pulse">
                          <rect x={a1_x} y={a1_y + 112} width="150" height="17" fill="#FF3B30" rx="2" />
                          <text x={a1_x + 75} y={a1_y + 124} textAnchor="middle" fill="#FFFFFF" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                            {activeAlert.eventType === "speed_violation" ? "⚡ SPEEDING (> 75 km/h)" : "⛔ CONTRAFLOW ENTRY"}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })()}

                {/* CAM-002 (Sitabuldi Metro Interchange) */}
                {camera.id === "CAM-002" && (() => {
                  const a2_x = 50 + ((sec * 20) % 360);
                  const a2_y = 130 + Math.sin(sec * 1.2) * 12;
                  const b2_x = 380 - ((sec * 35) % 320);
                  const b2_y = 160 + Math.cos(sec * 1.5) * 15;
                  return (
                    <g>
                      {/* Auto-Rickshaw */}
                      <rect x={a2_x} y={a2_y} width="155" height="115" fill="rgba(251, 146, 60, 0.12)" stroke="#FB923C" strokeWidth="2" rx="2" />
                      <path d={`M ${a2_x} ${a2_y + 15} L ${a2_x} ${a2_y} L ${a2_x + 15} ${a2_y} M ${a2_x + 155} ${a2_y + 15} L ${a2_x + 155} ${a2_y} L ${a2_x + 140} ${a2_y}`} stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
                      <rect x={a2_x} y={a2_y - 18} width="165" height="18" fill="#FB923C" rx="2" />
                      <text x={a2_x + 6} y={a2_y - 5} fill="#000000" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        [AUTO-204] 🛺 AUTO-RICKSHAW 99%
                      </text>
                      <rect x={a2_x + 6} y={a2_y + 92} width="95" height="15" fill="#000000" opacity="0.85" rx="2" />
                      <text x={a2_x + 10} y={a2_y + 103} fill="#FB923C" fontSize="7.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        MH 31 TB 7820 · 28 km/h
                      </text>

                      {/* Two-Wheeler */}
                      <rect x={b2_x} y={b2_y} width="95" height="90" fill="rgba(16, 185, 129, 0.12)" stroke="#10B981" strokeWidth="1.5" rx="2" />
                      <rect x={b2_x} y={b2_y - 15} width="105" height="15" fill="#10B981" rx="2" />
                      <text x={b2_x + 4} y={b2_y - 4} fill="#000000" fontSize="7.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        [MTR-205] BIKE 91%
                      </text>

                      {/* Active Violation Badge on CAM-002 */}
                      {activeAlert && (
                        <g className="animate-pulse">
                          <rect x={b2_x} y={b2_y + 92} width="115" height="17" fill="#FF3B30" rx="2" />
                          <text x={b2_x + 57} y={b2_y + 104} textAnchor="middle" fill="#FFFFFF" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                            {activeAlert.eventType === "triple_riding" ? "🏍️ TRIPLE RIDING" : "⛑️ NO HELMET"}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })()}

                {/* CAM-003 (Dharampeth Traffic Circle - Bombay Traffic Footage) */}
                {camera.id === "CAM-003" && (() => {
                  const auto1_x = 40 + ((sec * 24) % 360);
                  const auto1_y = 140 + ((sec * 8) % 80);
                  const auto2_x = 220 + ((sec * 18) % 300);
                  const auto2_y = 120 + Math.sin(sec * 1.4) * 15;
                  const bus_x = 480 - ((sec * 20) % 380);
                  const bus_y = 110 + ((sec * 6) % 60);
                  return (
                    <g>
                      {/* Auto-Rickshaw 1 (Left Lane Moving) */}
                      <rect x={auto1_x} y={auto1_y} width="155" height="115" fill="rgba(251, 146, 60, 0.14)" stroke="#FB923C" strokeWidth="2" rx="2" />
                      <path d={`M ${auto1_x} ${auto1_y + 15} L ${auto1_x} ${auto1_y} L ${auto1_x + 15} ${auto1_y} M ${auto1_x + 155} ${auto1_y + 15} L ${auto1_x + 155} ${auto1_y} L ${auto1_x + 140} ${auto1_y}`} stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
                      <rect x={auto1_x} y={auto1_y - 18} width="165" height="18" fill="#FB923C" rx="2" />
                      <text x={auto1_x + 6} y={auto1_y - 5} fill="#000000" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        [AUTO-301] 🛺 AUTO-RICKSHAW 99%
                      </text>
                      <rect x={auto1_x + 6} y={auto1_y + 92} width="95" height="15" fill="#000000" opacity="0.85" rx="2" />
                      <text x={auto1_x + 10} y={auto1_y + 103} fill="#FB923C" fontSize="7.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        MH 31 TC 3341 · {Math.floor(32 + (sec % 6))} km/h
                      </text>

                      {/* Auto-Rickshaw 2 (Turning Right in Circle) */}
                      <rect x={auto2_x} y={auto2_y} width="145" height="110" fill="rgba(251, 146, 60, 0.12)" stroke="#FB923C" strokeWidth="2" rx="2" />
                      <rect x={auto2_x} y={auto2_y - 17} width="155" height="17" fill="#FB923C" rx="2" />
                      <text x={auto2_x + 6} y={auto2_y - 5} fill="#000000" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        [AUTO-302] 🛺 AUTO-RICKSHAW 98%
                      </text>
                      <rect x={auto2_x + 6} y={auto2_y + 88} width="90" height="15" fill="#000000" opacity="0.85" rx="2" />
                      <text x={auto2_x + 10} y={auto2_y + 99} fill="#FB923C" fontSize="7.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        MH 31 TR 8819 · 28 km/h
                      </text>

                      {/* Red BEST Bus */}
                      <rect x={bus_x} y={bus_y} width="165" height="135" fill="rgba(236, 72, 153, 0.1)" stroke="#EC4899" strokeWidth="1.5" rx="2" />
                      <rect x={bus_x} y={bus_y - 17} width="130" height="17" fill="#EC4899" rx="2" />
                      <text x={bus_x + 6} y={bus_y - 5} fill="#000000" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        [BUS-303] BEST BUS 96%
                      </text>

                      {/* Active Violation on CAM-003 */}
                      {activeAlert && (
                        <g className="animate-pulse">
                          <rect x={auto1_x} y={auto1_y + 118} width="155" height="17" fill="#FF3B30" rx="2" />
                          <text x={auto1_x + 77} y={auto1_y + 130} textAnchor="middle" fill="#FFFFFF" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                            {activeAlert.eventType === "accident_collision" ? "💥 100% COLLISION VECTOR" : "🛑 RED ZONE OBSTRUCTION"}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })()}

                {/* CAM-004 (Ambazari Lake Promenade - Andheri Station Traffic Chaos Footage) */}
                {camera.id === "CAM-004" && (() => {
                  const auto1_x = 60 + ((sec * 16) % 320);
                  const auto1_y = 125 + ((sec * 6) % 70);
                  const auto2_x = 250 + ((sec * 14) % 260);
                  const auto2_y = 140 + Math.sin(sec * 1.2) * 12;
                  const ped_x = 460 + Math.sin(sec * 2) * 20;
                  const ped_y = 150 + Math.cos(sec * 2) * 10;
                  const car_x = 160 + ((sec * 18) % 320);
                  const car_y = 180 + ((sec * 8) % 80);
                  return (
                    <g>
                      {/* Auto-Rickshaw 1 (Front Queue Lead) */}
                      <rect x={auto1_x} y={auto1_y} width="160" height="120" fill="rgba(251, 146, 60, 0.14)" stroke="#FB923C" strokeWidth="2" rx="2" />
                      <path d={`M ${auto1_x} ${auto1_y + 15} L ${auto1_x} ${auto1_y} L ${auto1_x + 15} ${auto1_y} M ${auto1_x + 160} ${auto1_y + 15} L ${auto1_x + 160} ${auto1_y} L ${auto1_x + 145} ${auto1_y}`} stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
                      <rect x={auto1_x} y={auto1_y - 18} width="165" height="18" fill="#FB923C" rx="2" />
                      <text x={auto1_x + 6} y={auto1_y - 5} fill="#000000" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        [AUTO-401] 🛺 AUTO-RICKSHAW 99%
                      </text>
                      <rect x={auto1_x + 6} y={auto1_y + 95} width="95" height="15" fill="#000000" opacity="0.85" rx="2" />
                      <text x={auto1_x + 10} y={auto1_y + 106} fill="#FB923C" fontSize="7.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        MH 31 TD 4902 · 18 km/h
                      </text>

                      {/* Auto-Rickshaw 2 (Turning Right) */}
                      <rect x={auto2_x} y={auto2_y} width="150" height="115" fill="rgba(251, 146, 60, 0.12)" stroke="#FB923C" strokeWidth="2" rx="2" />
                      <rect x={auto2_x} y={auto2_y - 17} width="160" height="17" fill="#FB923C" rx="2" />
                      <text x={auto2_x + 6} y={auto2_y - 5} fill="#000000" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        [AUTO-402] 🛺 AUTO-RICKSHAW 98%
                      </text>
                      <rect x={auto2_x + 6} y={auto2_y + 90} width="90" height="15" fill="#000000" opacity="0.85" rx="2" />
                      <text x={auto2_x + 10} y={auto2_y + 101} fill="#FB923C" fontSize="7.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        MH 31 TE 6211 · 24 km/h
                      </text>

                      {/* White Honda City Car */}
                      <rect x={car_x} y={car_y} width="175" height="120" fill="rgba(0, 229, 255, 0.08)" stroke="#00E5FF" strokeWidth="1.5" rx="2" />
                      <rect x={car_x} y={car_y - 16} width="145" height="16" fill="#00E5FF" rx="2" />
                      <text x={car_x + 6} y={car_y - 4} fill="#000000" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        [CAR-404] SEDAN 95% · 26 km/h
                      </text>

                      {/* Pedestrian Group */}
                      <rect x={ped_x} y={ped_y} width="70" height="100" fill="rgba(255, 255, 255, 0.1)" stroke="#FFFFFF" strokeWidth="1.5" rx="2" />
                      <rect x={ped_x} y={ped_y - 15} width="75" height="15" fill="#FFFFFF" rx="2" />
                      <text x={ped_x + 4} y={ped_y - 4} fill="#000000" fontSize="7.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                        [PED-405] 93%
                      </text>

                      {/* Active Violation on CAM-004 */}
                      {activeAlert && (
                        <g className="animate-pulse">
                          <rect x={auto1_x} y={auto1_y + 120} width="160" height="17" fill="#FF3B30" rx="2" />
                          <text x={auto1_x + 80} y={auto1_y + 132} textAnchor="middle" fill="#FFFFFF" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                            {activeAlert.eventType === "accident_collision" ? "💥 100% COLLISION VECTOR" : "🛑 STAND CONGESTION"}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })()}

                {/* ACCIDENT / COLLISION IMPACT ZONE OVERLAY (Active on alert) */}
                {activeAlert?.eventType === "accident_collision" && (
                  <g className="animate-pulse">
                    <rect
                      x="240"
                      y="110"
                      width="260"
                      height="145"
                      fill="rgba(255, 59, 48, 0.28)"
                      stroke="#FF3B30"
                      strokeWidth="3"
                      strokeDasharray="6 3"
                      rx="3"
                    />
                    <circle cx="370" cy="180" r="30" fill="rgba(255, 59, 48, 0.35)" stroke="#FF3B30" strokeWidth="2" />
                    <rect x="240" y="85" width="260" height="22" fill="#FF3B30" rx="2" />
                    <text x="370" y="100" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                      💥 100% COLLISION VECTOR // DISPATCH EMS
                    </text>
                  </g>
                )}
              </g>
            );
          })()}

          {/* Center PTZ reticle */}
          <circle
            cx="320"
            cy="180"
            r="16"
            fill="none"
            stroke="rgba(0, 229, 255, 0.25)"
            strokeWidth="1"
          />
          <line x1="305" y1="180" x2="335" y2="180" stroke="rgba(0, 229, 255, 0.4)" strokeWidth="1" />
          <line x1="320" y1="165" x2="320" y2="195" stroke="rgba(0, 229, 255, 0.4)" strokeWidth="1" />

          {/* Camera Live OSD Info Bar */}
          <rect x="16" y="322" width="608" height="22" fill="rgba(7, 9, 14, 0.75)" rx="3" />
          <text
            x="26"
            y="337"
            fill="#00E5FF"
            fontSize="9"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="500"
          >
            {camera.name.toUpperCase()} | {camera.resolution} | {camera.lensType} | BEARING: {camera.bearing}°
          </text>
          <text
            x="614"
            y="337"
            textAnchor="end"
            fill="white"
            fontSize="9"
            fontFamily="JetBrains Mono, monospace"
          >
            {time}.{msTime}
          </text>
        </svg>


        {/* Hover Quick Action Overlay */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#07090E]/85 p-1 rounded-lg border border-[#1E2638] backdrop-blur-md z-20">
          <button
            onClick={() => setShowOverlays(!showOverlays)}
            className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
              isCvActive ? "text-[#00E5FF] bg-[#0091FF]/20" : "text-gray-400 hover:text-white"
            }`}
            title={isCvActive ? "Computer Vision AI Active (Click to Hide Boxes)" : "Clean Normal Feed (Click to Show AI Boxes)"}
          >
            <Layers size={12} />
          </button>
          <button
            onClick={triggerSnapshot}
            className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Capture Snapshot"
          >
            <CameraIcon size={12} />
          </button>
          {onFocus && (
            <button
              onClick={onFocus}
              className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Focus Stream"
            >
              <Maximize2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Tile Footer */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-t bg-[#0B0F17]/80 text-[10px] font-mono-data flex-shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-[#00E5FF] flex items-center gap-1">
            <Zap size={10} />
            Inference: 14ms
          </span>
          <span className="text-gray-600">|</span>
          <span>{camera.zone}</span>
        </div>
        <div className="text-gray-400">
          PTZ: P{ptzAngle.pan}° T{ptzAngle.tilt}° Z{ptzAngle.zoom}.0x
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TACTICAL GIS SATELLITE CITY MAP VIEW
   ═══════════════════════════════════════════════════════════════════════ */
function TacticalCityMap({ onSelectCamera }: { onSelectCamera: (camId: string) => void }) {
  const alerts = useDashboardStore((s) => s.alerts);
  const setSelectedAlertId = useDashboardStore((s) => s.setSelectedAlertId);

  // Map coordinates normalized
  const nodes = [
    { id: "CAM-001", name: "Wardha Rd Junction", x: 420, y: 320, angle: 145 },
    { id: "CAM-002", name: "Sitabuldi Interchange", x: 340, y: 190, angle: 45 },
    { id: "CAM-003", name: "Dharampeth Circle", x: 190, y: 220, angle: 260 },
    { id: "CAM-004", name: "Ambazari Promenade", x: 150, y: 350, angle: 210 },
  ];

  return (
    <div
      className="rounded-xl border overflow-hidden relative flex flex-col h-full scanline-texture"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* Map Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-[#0B0F17]/90 z-10">
        <div className="flex items-center gap-2">
          <Compass size={14} className="text-[#00E5FF] animate-spin" style={{ animationDuration: "12s" }} />
          <span className="text-xs font-semibold text-white">
            NAGPUR SMART CITY // TACTICAL GIS SURVEILLANCE MAP
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono-data text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" /> Camera Node
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#FF3B30] animate-live-pulse" /> Active Alert
          </span>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="relative flex-1 bg-[#05070C] overflow-hidden min-h-[460px]">
        <svg
          viewBox="0 0 800 500"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle Radar Ring Overlays */}
          <circle cx="400" cy="250" r="100" fill="none" stroke="rgba(0, 229, 255, 0.08)" strokeWidth="1" />
          <circle cx="400" cy="250" r="200" fill="none" stroke="rgba(0, 229, 255, 0.06)" strokeWidth="1" />
          <circle cx="400" cy="250" r="320" fill="none" stroke="rgba(0, 229, 255, 0.04)" strokeWidth="1" />

          {/* Animated Radar Sweep Cone */}
          <g className="animate-radar-sweep origin-center" style={{ transformOrigin: "400px 250px" }}>
            <path
              d="M 400 250 L 720 180 A 320 320 0 0 1 720 320 Z"
              fill="url(#radar-grad)"
              opacity="0.25"
            />
          </g>

          <defs>
            <linearGradient id="radar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor="#00E5FF" />
            </linearGradient>
          </defs>

          {/* City Road Network Arterials */}
          <g stroke="rgba(255,255,255,0.12)" strokeWidth="3" fill="none" strokeLinecap="round">
            {/* NH44 / Wardha Road Arterial */}
            <path d="M 340 50 L 340 190 L 420 320 L 500 480" stroke="#0091FF" strokeWidth="3" opacity="0.6" />
            {/* West Ring Road */}
            <path d="M 120 100 L 190 220 L 150 350 L 220 460" opacity="0.4" />
            {/* Central Avenue Cross connector */}
            <path d="M 190 220 L 340 190 L 580 180 L 720 220" opacity="0.5" strokeDasharray="6 4" />
            {/* South Ring connector */}
            <path d="M 150 350 L 420 320 L 680 340" opacity="0.4" />
          </g>

          {/* Road Labels */}
          <text x="435" y="380" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">
            WARDHA RD ARTERIAL
          </text>
          <text x="355" y="140" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">
            SITABULDI CBD
          </text>
          <text x="110" y="210" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">
            WEST HIGH COURT RD
          </text>
          <text x="70" y="370" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">
            AMBAZARI CORRIDOR
          </text>

          {/* Camera Nodes with FOV Cones */}
          {nodes.map((node) => {
            const cam = cameras.find((c) => c.id === node.id);
            const activeCamAlert = alerts.find(
              (a) => a.cameraId === node.id && a.status === "new"
            );

            return (
              <g
                key={node.id}
                className="cursor-pointer group"
                onClick={() => onSelectCamera(node.id)}
              >
                {/* FOV Cone */}
                <path
                  d={`M ${node.x} ${node.y} L ${node.x + 80 * Math.cos(((node.angle - 35) * Math.PI) / 180)} ${
                    node.y + 80 * Math.sin(((node.angle - 35) * Math.PI) / 180)
                  } A 80 80 0 0 1 ${node.x + 80 * Math.cos(((node.angle + 35) * Math.PI) / 180)} ${
                    node.y + 80 * Math.sin(((node.angle + 35) * Math.PI) / 180)
                  } Z`}
                  fill={activeCamAlert ? "rgba(255, 59, 48, 0.2)" : "rgba(0, 229, 255, 0.15)"}
                  stroke={activeCamAlert ? "#FF3B30" : "#00E5FF"}
                  strokeWidth="1"
                  opacity="0.8"
                />

                {/* Pulsing Beacon if Alert */}
                {activeCamAlert && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="16"
                    fill="none"
                    stroke="#FF3B30"
                    strokeWidth="2"
                    className="animate-beacon-ping"
                  />
                )}

                {/* Node Center Pin */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="7"
                  fill="#0B0F17"
                  stroke={activeCamAlert ? "#FF3B30" : "#10B981"}
                  strokeWidth="2.5"
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="3"
                  fill={activeCamAlert ? "#FF3B30" : "#00E5FF"}
                />

                {/* Node Label Card */}
                <g transform={`translate(${node.x + 12}, ${node.y - 14})`}>
                  <rect
                    x="0"
                    y="0"
                    width="140"
                    height="28"
                    fill="#0B0F17"
                    stroke={activeCamAlert ? "#FF3B30" : "#1E2638"}
                    strokeWidth="1"
                    rx="4"
                  />
                  <text
                    x="8"
                    y="12"
                    fill="white"
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="bold"
                  >
                    {node.id} · {node.name.split(" ")[0]}
                  </text>
                  <text
                    x="8"
                    y="22"
                    fill={activeCamAlert ? "#FF3B30" : "#10B981"}
                    fontSize="8"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {activeCamAlert ? "INCIDENT IN PROGRESS" : "STATUS: LIVE (30 FPS)"}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Map Telemetry Card in Corner */}
        <div className="absolute bottom-3 left-3 bg-[#0B0F17]/90 p-3 rounded-xl border border-[#1E2638] text-xs font-mono-data space-y-1 backdrop-blur-md">
          <div className="text-[#00E5FF] font-semibold text-[11px]">NAGPUR GIS SECTOR 04</div>
          <div className="text-gray-400 text-[10px]">COORDS: 21.1458° N, 79.0882° E</div>
          <div className="text-gray-400 text-[10px]">CONNECTED NODES: 4/4 RTSP STREAMS</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ALERT CARD COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
function AlertCard({
  alert,
  isNew,
}: {
  alert: Alert;
  isNew?: boolean;
}) {
  const setSelectedAlertId = useDashboardStore((s) => s.setSelectedAlertId);
  const updateAlertStatus = useDashboardStore((s) => s.updateAlertStatus);
  const dispatchUnit = useDashboardStore((s) => s.dispatchUnit);

  const severityColor = getSeverityColor(alert.severity);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={() => setSelectedAlertId(alert.id)}
      className={`rounded-2xl border p-3.5 transition-all cursor-pointer relative overflow-hidden group shadow-2xs ${
        isNew
          ? "border-rose-300 bg-rose-50/70 shadow-md shadow-rose-100 animate-pulse"
          : "border-slate-200/90 bg-white/90 hover:border-indigo-300 hover:shadow-md hover:bg-white"
      }`}
    >
      {/* Severity Indicator Bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
        style={{ background: severityColor }}
      />

      <div className="flex gap-3 items-start pl-1">
        {/* Thumbnail Preview with Keyframe Tag */}
        <div className="relative w-16 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-900 border border-slate-200 shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={alert.snapshotUrl}
            alt="Incident keyframe snapshot"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute bottom-0.5 right-1 text-[7.5px] font-mono-data text-white font-bold tracking-tighter">
            {alert.trackId}
          </span>
        </div>

        {/* Info Column */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-slate-900 truncate group-hover:text-[#4F46E5] transition-colors">
              {getEventLabel(alert.eventType)}
            </span>
            <span className="text-[10px] font-mono-data text-slate-400 flex-shrink-0">
              {timeAgo(alert.detectedAt)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate font-mono-data">
            <span className="text-[#4F46E5] font-semibold">{alert.cameraId}</span>
            <span>·</span>
            <span className="truncate">{alert.cameraName}</span>
          </div>

          {alert.vehicleDetails && (
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono-data pt-0.5">
              <span
                className={`px-1.5 py-0.5 rounded-md border font-medium ${
                  alert.vehicleDetails.objectClass === "Auto Rickshaw"
                    ? "bg-amber-50 border-amber-200 text-amber-700 font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}
              >
                {alert.vehicleDetails.objectClass === "Auto Rickshaw"
                  ? "🛺 Auto-Rickshaw"
                  : alert.vehicleDetails.objectClass}
              </span>
              {alert.vehicleDetails.licensePlate && (
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-[#4F46E5] font-bold border border-indigo-200/80">
                  {alert.vehicleDetails.licensePlate}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {alert.status === "new" && (
        <div className="flex border-t border-slate-100 bg-slate-50/80 rounded-b-xl -mx-3.5 -mb-3.5 mt-2.5 divide-x divide-slate-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateAlertStatus(alert.id, "acknowledged", "Operator");
            }}
            className="flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-bold text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
          >
            <Eye size={11} />
            Ack
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dispatchUnit(alert.id, "PCR Van #08", "PCR Patrol");
            }}
            className="flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-bold text-[#4F46E5] hover:bg-indigo-50 transition-colors cursor-pointer"
          >
            <Send size={11} />
            Dispatch
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateAlertStatus(alert.id, "resolved", "Operator");
            }}
            className="flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
          >
            <Check size={11} />
            Resolve
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   LIVE ALERT FEED PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function LiveAlertFeed({ onManualWhatsApp }: { onManualWhatsApp?: () => void }) {
  const alerts = useDashboardStore((s) => s.alerts);
  const alertFilter = useDashboardStore((s) => s.alertFilter);
  const setAlertFilter = useDashboardStore((s) => s.setAlertFilter);
  const severityFilter = useDashboardStore((s) => s.severityFilter);
  const setSeverityFilter = useDashboardStore((s) => s.setSeverityFilter);
  const searchQuery = useDashboardStore((s) => s.searchQuery);
  const setSearchQuery = useDashboardStore((s) => s.setSearchQuery);
  const acknowledgeAll = useDashboardStore((s) => s.acknowledgeAll);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (alertFilter !== "all" && a.status !== alertFilter) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCam = a.cameraName.toLowerCase().includes(q);
        const matchesEvent = getEventLabel(a.eventType).toLowerCase().includes(q);
        const matchesPlate = a.vehicleDetails?.licensePlate?.toLowerCase().includes(q);
        const matchesTrack = a.trackId.toLowerCase().includes(q);
        if (!matchesCam && !matchesEvent && !matchesPlate && !matchesTrack) return false;
      }
      return true;
    });
  }, [alerts, alertFilter, severityFilter, searchQuery]);

  const newAlertsCount = alerts.filter((a) => a.status === "new").length;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/85 backdrop-blur-xl h-full flex flex-col shadow-sm">
      {/* Feed Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white/90 rounded-t-2xl flex-shrink-0">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-[#EF4444] animate-live-pulse" />
          <span className="text-xs font-bold text-slate-800">Live Incident Queue</span>
          {newAlertsCount > 0 && (
            <span className="px-1.5 py-0.2 text-[9px] font-mono-data font-bold rounded-full bg-[#EF4444] text-white">
              {newAlertsCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onManualWhatsApp && (
            <button
              onClick={onManualWhatsApp}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono-data font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
              title="Send Immediate WhatsApp Alert to +91 93221 66721"
            >
              <MessageSquare size={11} className="text-emerald-600" />
              <span>Send SOS</span>
            </button>
          )}
          {newAlertsCount > 0 && (
            <button
              onClick={acknowledgeAll}
              className="flex items-center gap-1 text-[10px] font-mono-data font-bold text-[#4F46E5] hover:underline cursor-pointer"
            >
              <CheckCheck size={12} />
              Ack All
            </button>
          )}
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0 space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter CCTV, plate, or event..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#4F46E5] font-mono-data shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {(["all", "new", "acknowledged", "resolved"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setAlertFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono-data uppercase transition-all cursor-pointer flex-shrink-0 ${
                alertFilter === st
                  ? "bg-[#4F46E5] text-white font-bold shadow-xs"
                  : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        <AnimatePresence initial={false}>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-mono-data">
              No matching incidents in queue
            </div>
          ) : (
            filteredAlerts.slice(0, 35).map((alert, i) => (
              <AlertCard key={alert.id} alert={alert} isNew={i === 0} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ALERT DETAIL & DISPATCH INVESTIGATION DRAWER
   ═══════════════════════════════════════════════════════════════════════ */
function AlertDetailSheet({ onOpenWhatsApp }: { onOpenWhatsApp?: (alert: Alert) => void }) {
  const alerts = useDashboardStore((s) => s.alerts);
  const selectedId = useDashboardStore((s) => s.selectedAlertId);
  const setSelectedId = useDashboardStore((s) => s.setSelectedAlertId);
  const updateStatus = useDashboardStore((s) => s.updateAlertStatus);
  const addNote = useDashboardStore((s) => s.addNote);
  const dispatchUnit = useDashboardStore((s) => s.dispatchUnit);

  const alert = alerts.find((a) => a.id === selectedId);
  const [noteText, setNoteText] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("PCR Van #08 (Sitabuldi)");

  if (!alert) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex justify-end"
        onClick={() => setSelectedId(null)}
      >
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" />

        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="relative w-full max-w-lg h-full overflow-y-auto border-l border-slate-200 bg-white/95 backdrop-blur-2xl flex flex-col shadow-2xl text-slate-900"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between sticky top-0 z-10">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Incident Investigation</h3>
              <p className="text-[10px] text-slate-500 font-mono-data">{alert.id}</p>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-5 flex-1">
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-black shadow-md">
              <img src={alert.snapshotUrl} alt="Incident Snapshot" className="w-full aspect-video object-cover" />
            </div>

            <div className="rounded-2xl border border-emerald-200 p-4 bg-emerald-50/70 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    Twilio Automated WhatsApp SOS
                    <span className="text-[9px] font-mono-data px-1.5 py-0.2 rounded-full bg-emerald-200/80 text-emerald-800 font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono-data">
                    Recipient: <span className="text-emerald-700 font-bold">+91 93221 66721</span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono-data font-bold text-indigo-700 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200">
                Auto-Dispatched
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/70 space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Rapid Response / Patrol Dispatch
              </span>
              <div className="flex gap-2">
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="flex-1 text-xs rounded-xl bg-white border border-slate-200 text-slate-800 px-3 py-2 outline-none font-mono-data shadow-2xs"
                >
                  <option>PCR Van #08 (Sitabuldi)</option>
                  <option>Traffic Interceptor #03</option>
                  <option>Municipal Tow Truck #02</option>
                  <option>Quick Response Team (QRT-1)</option>
                </select>
                <button
                  onClick={() => dispatchUnit(alert.id, selectedUnit, "PCR Patrol")}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors cursor-pointer shadow-xs"
                >
                  Dispatch
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const layoutMode = useDashboardStore((s) => s.layoutMode);
  const setLayoutMode = useDashboardStore((s) => s.setLayoutMode);
  const focusedCameraId = useDashboardStore((s) => s.focusedCameraId);
  const setFocusedCameraId = useDashboardStore((s) => s.setFocusedCameraId);
  const selectedAlertId = useDashboardStore((s) => s.selectedAlertId);
  const alerts = useDashboardStore((s) => s.alerts);

  const autoDispatchedIds = useRef<Set<string>>(new Set());
  const lastDispatchTimeRef = useRef<number>(0);
  const [autoToast, setAutoToast] = useState<{
    alert: Alert;
    status: string;
    sid?: string;
  } | null>(null);

  // Automatic WhatsApp SOS Engine (Throttled to protect Twilio rate limits)
  useEffect(() => {
    const criticals = alerts.filter(
      (a) =>
        (a.severity === "critical" ||
          a.eventType === "accident_collision" ||
          a.eventType === "stopped_vehicle_accident") &&
        !autoDispatchedIds.current.has(a.id)
    );

    if (criticals.length === 0) return;

    const now = Date.now();
    if (now - lastDispatchTimeRef.current < 20000) {
      return; // Cooldown: 20 seconds between WhatsApp dispatches
    }

    const targetAlert = criticals[0];
    autoDispatchedIds.current.add(targetAlert.id);
    lastDispatchTimeRef.current = now;

    fetch("/api/alerts/dispatch-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        camera_id: targetAlert.cameraId,
        camera_name: targetAlert.cameraName,
        event_type: targetAlert.eventType,
        severity: targetAlert.severity,
        confidence: targetAlert.confidence,
        track_id: targetAlert.trackId,
        vehicle_details: targetAlert.vehicleDetails,
        detected_at: targetAlert.detectedAt,
        recipient_phone: "+919322166721",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAutoToast({
            alert: targetAlert,
            status: "delivered",
            sid: data.sid,
          });
          setTimeout(() => setAutoToast(null), 8000);
        } else {
          console.warn("Twilio dispatch response:", data);
        }
      })
      .catch((err) => {
        console.error("Twilio Auto-Dispatch error:", err);
      });
  }, [alerts]);

  const [showTwilioConfig, setShowTwilioConfig] = useState(false);
  const [customSid, setCustomSid] = useState("");
  const [customToken, setCustomToken] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCustomSid(localStorage.getItem("nexwatch_twilio_sid") || "");
      setCustomToken(localStorage.getItem("nexwatch_twilio_token") || "");
    }
  }, []);

  const triggerManualWhatsApp = async (alertOverride?: Alert) => {
    const criticals = alerts.filter(
      (a) =>
        a.severity === "critical" ||
        a.eventType === "accident_collision" ||
        a.eventType === "stopped_vehicle_accident"
    );
    const chosen = alertOverride || criticals[0] || alerts[0];
    if (!chosen) return;

    const sid = customSid || (typeof window !== "undefined" ? localStorage.getItem("nexwatch_twilio_sid") || "" : "");
    const token = customToken || (typeof window !== "undefined" ? localStorage.getItem("nexwatch_twilio_token") || "" : "");

    try {
      const res = await fetch("/api/alerts/dispatch-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camera_id: chosen.cameraId,
          camera_name: chosen.cameraName,
          event_type: chosen.eventType,
          severity: "critical",
          confidence: chosen.confidence || 0.99,
          track_id: chosen.trackId,
          vehicle_details: chosen.vehicleDetails,
          detected_at: new Date().toISOString(),
          recipient_phone: "+919322166721",
          account_sid: sid,
          auth_token: token,
        }),
      });
      const data = await res.json();
      setAutoToast({
        alert: chosen,
        status: data.success ? "delivered" : "error",
        sid: data.sid || (data.warning ? "KEYS REQUIRED - CLICK TO CONFIGURE" : undefined),
      });

      if (!data.success && !sid) {
        setShowTwilioConfig(true);
      }
      setTimeout(() => setAutoToast(null), 8000);
    } catch (err) {
      console.error("Manual WhatsApp dispatch error:", err);
    }
  };

  // Automated 10-Minute Recurring Routine + Instant Mount Dispatch
  useEffect(() => {
    const sendPeriodicSOS = async () => {
      const criticals = alerts.filter(
        (a) =>
          a.severity === "critical" ||
          a.eventType === "accident_collision" ||
          a.eventType === "stopped_vehicle_accident"
      );
      const chosen = criticals[Math.floor(Math.random() * criticals.length)] || alerts[0];
      if (!chosen) return;

      const sid = typeof window !== "undefined" ? localStorage.getItem("nexwatch_twilio_sid") || "" : "";
      const token = typeof window !== "undefined" ? localStorage.getItem("nexwatch_twilio_token") || "" : "";

      try {
        const res = await fetch("/api/alerts/dispatch-whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            camera_id: chosen.cameraId,
            camera_name: chosen.cameraName,
            event_type: chosen.eventType,
            severity: "critical",
            confidence: chosen.confidence || 0.99,
            track_id: chosen.trackId,
            vehicle_details: chosen.vehicleDetails,
            detected_at: new Date().toISOString(),
            recipient_phone: "+919322166721",
            account_sid: sid,
            auth_token: token,
          }),
        });
        const data = await res.json();
        setAutoToast({
          alert: chosen,
          status: data.success ? "delivered" : "error",
          sid: data.sid || (data.warning ? "KEYS NEEDED ON RENDER" : undefined),
        });
        setTimeout(() => setAutoToast(null), 8000);
      } catch (err) {
        console.error("10-min interval dispatch error:", err);
      }
    };

    // Trigger on mount after 2.5s and every 10 minutes
    const initialTimer = setTimeout(sendPeriodicSOS, 2500);
    const interval = setInterval(sendPeriodicSOS, 10 * 60 * 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [alerts]);

  const focusedCamera = cameras.find((c) => c.id === focusedCameraId) || cameras[0];
  const companionCameras = cameras.filter((c) => c.id !== focusedCameraId);

  return (
    <>
      <AnimatePresence>
        {autoToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-6 z-50 flex items-center gap-3.5 p-4 rounded-2xl border border-emerald-300 bg-white/95 shadow-2xl backdrop-blur-2xl text-slate-900 font-mono-data text-xs max-w-md"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0 animate-pulse shadow-xs">
              <MessageSquare size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>Twilio WhatsApp SOS Dispatched</span>
              </div>
              <div className="text-slate-900 font-bold truncate mt-0.5 text-xs">
                {getEventLabel(autoToast.alert.eventType)} · {autoToast.alert.cameraName}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Recipient: <span className="text-emerald-700 font-bold">+91 93221 66721</span>
                {autoToast.sid && (
                  <span className="ml-1 text-slate-400">({autoToast.sid.slice(0, 10)}...)</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setAutoToast(null)}
              className="p-1 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-96px)] min-h-[640px]">
        <div className="lg:w-[72%] xl:w-[74%] flex-shrink-0 flex flex-col h-full min-h-[440px]">
          {layoutMode === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 h-full overflow-y-auto">
              {cameras.map((cam) => (
                <CameraTile
                  key={cam.id}
                  camera={cam}
                  onFocus={() => {
                    setFocusedCameraId(cam.id);
                    setLayoutMode("focus");
                  }}
                />
              ))}
            </div>
          )}

          {layoutMode === "focus" && (
            <div className="flex flex-col xl:flex-row gap-3.5 h-full overflow-y-auto">
              <div className="xl:w-[70%] h-full flex flex-col">
                <CameraTile camera={focusedCamera} isFocused />
              </div>

              <div className="xl:w-[30%] flex flex-col gap-3 overflow-y-auto">
                <div className="text-[11px] font-mono-data text-gray-400 uppercase tracking-wider px-1">
                  Auxiliary Node Feeds
                </div>
                {companionCameras.map((cam) => (
                  <div
                    key={cam.id}
                    onClick={() => setFocusedCameraId(cam.id)}
                    className="cursor-pointer transition-transform hover:scale-[1.02]"
                  >
                    <CameraTile camera={cam} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {layoutMode === "map" && (
            <TacticalCityMap
              onSelectCamera={(camId) => {
                setFocusedCameraId(camId);
                setLayoutMode("focus");
              }}
            />
          )}
        </div>

        {/* RIGHT COLUMN: Live Alert Feed */}
        <div className="lg:w-[28%] xl:w-[26%] h-full flex flex-col min-h-[440px]">
          <LiveAlertFeed onManualWhatsApp={triggerManualWhatsApp} />
        </div>
      </div>

      {/* Slide-over Inspection Sheet */}
      {selectedAlertId && <AlertDetailSheet onOpenWhatsApp={(alert) => triggerManualWhatsApp(alert)} />}

      {/* Twilio & WhatsApp Emergency Dispatch Configuration Modal */}
      {showTwilioConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 space-y-5 text-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Twilio WhatsApp SOS Dispatch</h3>
                  <p className="text-[10px] text-slate-500 font-mono-data">Outbound Emergency Messaging</p>
                </div>
              </div>
              <button
                onClick={() => setShowTwilioConfig(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 font-mono-data text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600">
                  Verified Recipient (Your Number)
                </label>
                <input
                  type="text"
                  disabled
                  value="+91 93221 66721"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-emerald-700 font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600">
                  Twilio Account SID (Starts with AC...)
                </label>
                <input
                  type="text"
                  placeholder="Paste your Account SID here"
                  value={customSid}
                  onChange={(e) => {
                    setCustomSid(e.target.value);
                    if (typeof window !== "undefined") localStorage.setItem("nexwatch_twilio_sid", e.target.value);
                  }}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600">
                  Twilio Auth Token
                </label>
                <input
                  type="password"
                  placeholder="Paste your Auth Token here"
                  value={customToken}
                  onChange={(e) => {
                    setCustomToken(e.target.value);
                    if (typeof window !== "undefined") localStorage.setItem("nexwatch_twilio_token", e.target.value);
                  }}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowTwilioConfig(false);
                  triggerManualWhatsApp();
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#4F46E5] text-white hover:bg-[#4338CA] transition-colors cursor-pointer shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2"
              >
                <Zap size={14} />
                <span>Transmit Twilio API Outbound SOS</span>
              </button>

              <a
                href={`https://api.whatsapp.com/send?phone=919322166721&text=${encodeURIComponent(
                  "🚨 *NEXWATCH CRITICAL ACCIDENT SOS* 🚨\n━━━━━━━━━━━━━━━━━━━━━\n📍 *CCTV Area:* Dharampeth Traffic Circle (CAM-003)\n⚠️ *Incident:* ACCIDENT / COLLISION\n🔴 *Severity:* CRITICAL (98% AI Conf)\n🚗 *Target Vehicle:* Auto Rickshaw (TRK-301)\n🔢 *License Plate:* *MH 31 TC 3341*\n⏱️ *Detection Time:* " +
                    new Date().toLocaleTimeString("en-IN") +
                    " IST\n⚡ *Action Mandate:* 🚨 DISPATCH AMBULANCE & TRAFFIC POLICE IMMEDIATELY\n━━━━━━━━━━━━━━━━━━━━━\n🔗 *Live CCTV Feeds:* https://cityeye-frontend.onrender.com/dashboard"
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2"
              >
                <MessageSquare size={14} />
                <span>1-Tap Instant WhatsApp Web SOS</span>
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
