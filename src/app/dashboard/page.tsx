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
      <div
        className="flex items-center justify-between px-3 py-2 border-b bg-[#0B0F17]/90 flex-shrink-0 relative z-10"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              camera.status === "online" ? "bg-[#10B981] animate-live-pulse" : "bg-[#FF3B30]"
            }`}
          />
          <span className="text-xs font-semibold text-white truncate">
            {camera.name}
          </span>
          <span className="text-[10px] font-mono-data text-[#00E5FF] px-1.5 py-0.5 rounded bg-[#0091FF]/15 border border-[#0091FF]/30 hidden sm:inline">
            {camera.id}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {activeAlert && (
            <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded font-bold bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40 animate-live-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-ping" />
              ALERT DETECTED
            </span>
          )}
          <span className="text-[10px] font-mono-data text-gray-400 bg-[#141924] px-2 py-0.5 rounded border border-[#1E2638]">
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
function AlertCard({ alert, isNew }: { alert: Alert; isNew?: boolean }) {
  const updateAlertStatus = useDashboardStore((s) => s.updateAlertStatus);
  const setSelectedAlertId = useDashboardStore((s) => s.setSelectedAlertId);
  const dispatchUnit = useDashboardStore((s) => s.dispatchUnit);

  const severityColor = getSeverityColor(alert.severity);
  const statusColor = getStatusColor(alert.status);
  const latencyColor = getLatencyColor(alert.latencyMs);

  return (
    <motion.div
      layout
      initial={isNew ? { opacity: 0, y: -20, scale: 0.96 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 hover:border-[#0091FF]/60 hover:shadow-lg ${
        isNew && alert.severity === "critical" ? "animate-glow-ring" : ""
      }`}
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
        borderLeft: `4px solid ${severityColor}`,
      }}
      onClick={() => setSelectedAlertId(alert.id)}
    >
      <div className="p-3 flex gap-3">
        {/* Snapshot Thumbnail with Severity Ribbon */}
        <div className="w-20 h-20 rounded-lg flex-shrink-0 overflow-hidden relative border border-[#1E2638] bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={alert.snapshotUrl}
            alt="Alert Snapshot"
            className="w-full h-full object-cover"
          />
          <div
            className="absolute top-0 right-0 px-1 py-0.5 text-[8px] font-mono-data font-bold uppercase rounded-bl text-white"
            style={{ background: severityColor }}
          >
            {alert.severity}
          </div>
        </div>

        {/* Card Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-1">
            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-white truncate">
                {getEventLabel(alert.eventType)}
              </h4>
              <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                <MapPin size={9} className="text-gray-500" />
                {alert.cameraName}
              </p>
            </div>
            <span
              className="text-[9px] font-mono-data text-gray-400 flex-shrink-0"
              title={new Date(alert.detectedAt).toLocaleString()}
            >
              {timeAgo(alert.detectedAt)}
            </span>
          </div>

          {/* Vehicle / Object Meta Chip */}
          {alert.vehicleDetails && (
            <div className="flex items-center gap-1.5 mb-1.5 text-[9px] font-mono-data text-gray-300">
              <span
                className={`px-1.5 py-0.5 rounded border font-semibold ${
                  alert.vehicleDetails.objectClass === "Auto Rickshaw"
                    ? "bg-[#FB923C]/20 border-[#FB923C]/60 text-[#FB923C]"
                    : "bg-[#141924] border-[#1E2638] text-white"
                }`}
              >
                {alert.vehicleDetails.objectClass === "Auto Rickshaw"
                  ? "🛺 Auto-Rickshaw"
                  : alert.vehicleDetails.objectClass}
              </span>
              {alert.vehicleDetails.licensePlate && (
                <span className="px-1.5 py-0.5 rounded bg-white/10 text-[#00E5FF] font-bold border border-white/20">
                  {alert.vehicleDetails.licensePlate}
                </span>
              )}
            </div>
          )}

          {/* Meta Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded bg-[#0091FF]/15 text-[#00E5FF] border border-[#0091FF]/30">
              {Math.round(alert.confidence * 100)}% Conf
            </span>

            <span
              className="text-[9px] font-mono-data flex items-center gap-0.5 px-1.5 py-0.5 rounded"
              style={{
                background: `${latencyColor}18`,
                color: latencyColor,
                border: `1px solid ${latencyColor}30`,
              }}
            >
              <Zap size={8} />
              {(alert.latencyMs / 1000).toFixed(1)}s
            </span>

            <span
              className="text-[9px] font-mono-data uppercase px-1.5 py-0.5 rounded font-medium"
              style={{
                background: `${statusColor}18`,
                color: statusColor,
                border: `1px solid ${statusColor}30`,
              }}
            >
              {alert.status}
            </span>

            {alert.dispatchedUnit && (
              <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded bg-[#FF9500]/20 text-[#FF9500] border border-[#FF9500]/40 flex items-center gap-1">
                <Send size={8} />
                {alert.dispatchedUnit.status === "en_route" ? "UNIT EN ROUTE" : "DISPATCHED"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Quick Bar */}
      {alert.status === "new" && (
        <div
          className="flex border-t divide-x divide-[#1E2638] bg-[#0B0F17]/60"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateAlertStatus(alert.id, "acknowledged", "Operator");
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-[#FF9500] hover:bg-[#FF9500]/10 transition-colors cursor-pointer"
          >
            <Eye size={11} />
            Ack
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dispatchUnit(alert.id, "PCR Van #08", "PCR Patrol");
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-[#00E5FF] hover:bg-[#00E5FF]/10 transition-colors cursor-pointer"
          >
            <Send size={11} />
            Dispatch
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateAlertStatus(alert.id, "resolved", "Operator");
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-[#10B981] hover:bg-[#10B981]/10 transition-colors cursor-pointer"
          >
            <Check size={11} />
            Resolve
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateAlertStatus(alert.id, "false_positive");
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-gray-400 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={11} />
            False +
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   LIVE ALERT FEED PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function LiveAlertFeed() {
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
    <div
      className="rounded-xl border h-full flex flex-col scanline-texture"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 border-b bg-[#0B0F17]/90 flex-shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-[#FF3B30] animate-live-pulse" />
          <span className="text-xs font-semibold text-white">Live Incident Queue</span>
          {newAlertsCount > 0 && (
            <span className="text-[10px] font-mono-data font-bold px-1.5 py-0.2 rounded-full bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40">
              {newAlertsCount} new
            </span>
          )}
        </div>

        {newAlertsCount > 0 && (
          <button
            onClick={acknowledgeAll}
            className="flex items-center gap-1 text-[10px] font-mono-data px-2 py-1 rounded bg-[#0091FF]/15 text-[#00E5FF] hover:bg-[#0091FF]/25 border border-[#0091FF]/30 transition-all cursor-pointer"
            title="Acknowledge all pending alerts"
          >
            <CheckCheck size={11} />
            Ack All
          </button>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="p-2.5 space-y-2 border-b border-[#1E2638] bg-[#090C13]">
        {/* Search Input */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-2.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by vehicle, plate, camera..."
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-[#141924] border border-[#1E2638] text-white placeholder-gray-500 outline-none focus:border-[#0091FF]"
          />
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {(["all", "new", "acknowledged", "resolved"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setAlertFilter(st)}
              className={`px-2 py-1 rounded-md text-[10px] font-mono-data capitalize transition-all cursor-pointer flex-shrink-0 ${
                alertFilter === st
                  ? "bg-[#0091FF] text-white font-semibold"
                  : "bg-[#141924] text-gray-400 hover:text-white border border-[#1E2638]"
              }`}
            >
              {st}
            </button>
          ))}

          <div className="w-px h-4 bg-[#1E2638] mx-0.5 flex-shrink-0" />

          {(["all", "critical", "high"] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2 py-1 rounded-md text-[10px] font-mono-data uppercase transition-all cursor-pointer flex-shrink-0 ${
                severityFilter === sev
                  ? "bg-[#FF3B30] text-white font-semibold"
                  : "bg-[#141924] text-gray-400 hover:text-white border border-[#1E2638]"
              }`}
            >
              {sev === "all" ? "All Sev" : sev}
            </button>
          ))}
        </div>

        {/* Quick Event Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[9px] font-mono-data scrollbar-none">
          {[
            { label: "All Events", query: "" },
            { label: "⛑️ Helmet Violation", query: "Helmet" },
            { label: "🏍️ Triple Riding", query: "Triple" },
            { label: "⛔ Wrong-Way", query: "Wrong" },
            { label: "🛑 Stopped / Possible Crash", query: "Stopped" },
            { label: "💥 Collision (100%)", query: "Collision" },
            { label: "🚨 Accident / Stopped Vehicle", query: "Accident" },
            { label: "🛺 Auto-Rickshaw", query: "Auto" },
          ].map((cat) => (
            <button
              key={cat.label}
              onClick={() => setSearchQuery(cat.query)}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer flex-shrink-0 ${
                searchQuery === cat.query
                  ? "bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 font-bold"
                  : "bg-[#07090E] text-gray-400 hover:text-white border border-[#1E2638]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        <AnimatePresence initial={false}>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs font-mono-data">
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
function AlertDetailSheet() {
  const alerts = useDashboardStore((s) => s.alerts);
  const selectedId = useDashboardStore((s) => s.selectedAlertId);
  const setSelectedId = useDashboardStore((s) => s.setSelectedAlertId);
  const updateStatus = useDashboardStore((s) => s.updateAlertStatus);
  const addNote = useDashboardStore((s) => s.addNote);
  const dispatchUnit = useDashboardStore((s) => s.dispatchUnit);

  const alert = alerts.find((a) => a.id === selectedId);
  const [noteText, setNoteText] = useState("");
  const [isPlayingScrubber, setIsPlayingScrubber] = useState(false);
  const [scrubberPos, setScrubberPos] = useState(65); // percentage
  const [playbackSpeed, setPlaybackSpeed] = useState<"0.5x" | "1.0x" | "2.0x">("1.0x");
  const [selectedUnit, setSelectedUnit] = useState("PCR Van #08 (Sitabuldi)");

  if (!alert) return null;

  const severityColor = getSeverityColor(alert.severity);

  const timelineSteps = [
    { label: "Edge Detection (YOLOv11x)", time: alert.detectedAt, done: true },
    { label: "Delivered to Command Bus", time: alert.deliveredAt, done: true },
    {
      label: `Operator Ack ${alert.acknowledgedBy ? `(${alert.acknowledgedBy})` : ""}`,
      time: alert.status !== "new" ? alert.deliveredAt : null,
      done: alert.status !== "new",
    },
    {
      label: alert.dispatchedUnit ? `Unit Dispatched (${alert.dispatchedUnit.unitName})` : "Patrol Dispatch",
      time: alert.dispatchedUnit ? alert.dispatchedUnit.dispatchedAt : null,
      done: Boolean(alert.dispatchedUnit),
    },
    {
      label: "Resolved / Citation Issued",
      time: alert.resolvedAt || null,
      done: alert.status === "resolved",
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex justify-end"
        onClick={() => setSelectedId(null)}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="relative w-full max-w-lg h-full overflow-y-auto border-l flex flex-col"
          style={{
            background: "var(--bg-base)",
            borderColor: "var(--border-subtle)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-[#1E2638] bg-[#0E121A] flex items-center justify-between sticky top-0 z-10">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 text-[9px] font-mono-data font-bold uppercase rounded text-white"
                  style={{ background: severityColor }}
                >
                  {alert.severity}
                </span>
                <span className="text-xs font-mono-data text-gray-400">{alert.id}</span>
              </div>
              <h3 className="text-sm font-semibold text-white mt-1">
                {getEventLabel(alert.eventType)}
              </h3>
            </div>

            <button
              onClick={() => setSelectedId(null)}
              className="p-1.5 rounded-lg bg-[#141924] text-gray-400 hover:text-white border border-[#1E2638] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="p-5 space-y-5 flex-1">
            {/* Interactive Video Evidence Scrubber */}
            <div className="rounded-xl border border-[#1E2638] overflow-hidden bg-[#05070B]">
              <div className="relative aspect-video">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={alert.snapshotUrl}
                  alt="Incident Snapshot"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/80 text-[9px] font-mono-data text-[#00E5FF] border border-[#0091FF]/40">
                  REC: {new Date(alert.detectedAt).toLocaleTimeString()} · KEYFRAME
                </div>
              </div>

              {/* Scrubber Controls */}
              <div className="p-3 bg-[#0B0F17] border-t border-[#1E2638] space-y-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlayingScrubber(!isPlayingScrubber)}
                    className="p-1.5 rounded-lg bg-[#0091FF] text-white cursor-pointer hover:bg-[#0077D4]"
                  >
                    {isPlayingScrubber ? <Pause size={12} /> : <Play size={12} />}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={scrubberPos}
                    onChange={(e) => setScrubberPos(Number(e.target.value))}
                    className="flex-1 accent-[#00E5FF] cursor-pointer h-1.5 bg-[#1E2638] rounded-lg"
                  />

                  <div className="flex items-center gap-1">
                    {(["0.5x", "1.0x", "2.0x"] as const).map((sp) => (
                      <button
                        key={sp}
                        onClick={() => setPlaybackSpeed(sp)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono-data cursor-pointer ${
                          playbackSpeed === sp
                            ? "bg-[#0091FF]/30 text-[#00E5FF] border border-[#0091FF]/50"
                            : "text-gray-500 hover:text-white"
                        }`}
                      >
                        {sp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Object Telemetry & OCR Plate Data */}
            {alert.vehicleDetails && (
              <div className="rounded-xl border border-[#1E2638] p-4 bg-[#0E121A] space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span className="flex items-center gap-1.5">
                    <Car size={14} className="text-[#00E5FF]" />
                    AI Vehicle Classification & OCR
                  </span>
                  <span className="text-[10px] font-mono-data text-[#10B981]">
                    {Math.round(alert.confidence * 100)}% Match
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono-data">
                  <div className="p-2 rounded-lg bg-[#141924] border border-[#1E2638]">
                    <span className="text-[10px] text-gray-400 block">Class & Make</span>
                    <span className="text-white font-medium">
                      {alert.vehicleDetails.make || alert.vehicleDetails.objectClass}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-[#141924] border border-[#1E2638]">
                    <span className="text-[10px] text-gray-400 block">Color Signature</span>
                    <span className="text-white font-medium">
                      {alert.vehicleDetails.color || "N/A"}
                    </span>
                  </div>

                  {alert.vehicleDetails.licensePlate && (
                    <div className="col-span-2 p-2.5 rounded-lg bg-[#0091FF]/10 border border-[#0091FF]/30 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-[#00E5FF] block">OCR License Plate</span>
                        <span className="text-white font-bold text-sm">
                          {alert.vehicleDetails.licensePlate}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#10B981] font-semibold">
                        {Math.round((alert.vehicleDetails.plateConfidence || 0.92) * 100)}% Match
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Incident Details Metadata Table */}
            <div className="rounded-xl border border-[#1E2638] overflow-hidden bg-[#0E121A]">
              {[
                ["Camera Node", alert.cameraName],
                ["Node ID", alert.cameraId],
                ["Track ID", alert.trackId],
                ["Latency", `${(alert.latencyMs / 1000).toFixed(2)}s`],
                ["Detected At", new Date(alert.detectedAt).toLocaleString("en-IN")],
                ["Delivered At", new Date(alert.deliveredAt).toLocaleString("en-IN")],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between px-3.5 py-2 border-b last:border-b-0 border-[#1E2638] text-xs font-mono-data"
                >
                  <span className="text-gray-400">{k}</span>
                  <span className="text-white">{v}</span>
                </div>
              ))}
            </div>

            {/* Emergency Dispatch Unit Action */}
            <div className="rounded-xl border border-[#FF9500]/30 p-4 bg-[#FF9500]/5 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-[#FF9500]">
                <span className="flex items-center gap-1.5">
                  <Send size={13} />
                  Rapid Response / Patrol Dispatch
                </span>
                {alert.dispatchedUnit && (
                  <span className="text-[10px] font-mono-data text-[#10B981]">
                    ETA: ~{alert.dispatchedUnit.etaMinutes} MIN
                  </span>
                )}
              </div>

              {alert.dispatchedUnit ? (
                <div className="p-3 rounded-lg bg-[#141924] border border-[#1E2638] text-xs font-mono-data space-y-1">
                  <div className="text-white font-medium">{alert.dispatchedUnit.unitName}</div>
                  <div className="text-gray-400 text-[10px]">
                    Status: <span className="text-[#00E5FF] uppercase">{alert.dispatchedUnit.status}</span> · Dispatched: {new Date(alert.dispatchedUnit.dispatchedAt).toLocaleTimeString()}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    className="flex-1 text-xs rounded-lg bg-[#141924] border border-[#1E2638] text-white px-2.5 py-1.5 outline-none font-mono-data"
                  >
                    <option>PCR Van #08 (Sitabuldi)</option>
                    <option>Traffic Interceptor #03</option>
                    <option>Municipal Tow Truck #02</option>
                    <option>Quick Response Team (QRT-1)</option>
                  </select>
                  <button
                    onClick={() => dispatchUnit(alert.id, selectedUnit, "PCR Patrol")}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#FF9500] text-black hover:bg-[#E08500] transition-colors cursor-pointer"
                  >
                    Dispatch
                  </button>
                </div>
              )}
            </div>

            {/* Status Timeline */}
            <div className="rounded-xl border border-[#1E2638] p-4 bg-[#0E121A] space-y-3">
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Incident Triage Lifecycle
              </h4>
              <div className="space-y-3 font-mono-data text-xs">
                {timelineSteps.map((s, idx) => (
                  <div key={s.label} className="flex gap-3 items-start">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] flex-shrink-0 mt-0.5 ${
                        s.done ? "bg-[#0091FF] text-white font-bold" : "bg-[#1E2638] text-gray-500"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <p className={`font-medium ${s.done ? "text-white" : "text-gray-500"}`}>
                        {s.label}
                      </p>
                      {s.time && (
                        <p className="text-[10px] text-gray-400">
                          {new Date(s.time).toLocaleString("en-IN")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Operator Notes */}
            <div className="rounded-xl border border-[#1E2638] p-4 bg-[#0E121A] space-y-2">
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Operator Incident Log
              </h4>
              <textarea
                value={noteText || alert.notes || ""}
                onChange={(e) => setNoteText(e.target.value)}
                onBlur={() => {
                  if (noteText) addNote(alert.id, noteText);
                }}
                rows={3}
                placeholder="Log operator observations or e-challan citation numbers..."
                className="w-full rounded-lg bg-[#141924] border border-[#1E2638] p-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-[#0091FF] resize-none font-mono-data"
              />
            </div>
          </div>

          {/* Drawer Actions Footer */}
          <div className="p-4 border-t border-[#1E2638] bg-[#0E121A] flex gap-2 sticky bottom-0 z-10">
            {alert.status === "new" && (
              <button
                onClick={() => updateStatus(alert.id, "acknowledged", "Operator")}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold bg-[#FF9500] text-black hover:bg-[#E08500] cursor-pointer"
              >
                Acknowledge Incident
              </button>
            )}
            {alert.status !== "resolved" && (
              <button
                onClick={() => updateStatus(alert.id, "resolved", "Operator")}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold bg-[#10B981] text-white hover:bg-[#0E9F6E] cursor-pointer"
              >
                Resolve & Close
              </button>
            )}
            {alert.status === "new" && (
              <button
                onClick={() => updateStatus(alert.id, "false_positive")}
                className="px-3 py-2.5 rounded-lg text-xs font-medium bg-[#141924] text-gray-400 hover:text-white border border-[#1E2638] cursor-pointer"
              >
                False +
              </button>
            )}
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

  const focusedCamera = cameras.find((c) => c.id === focusedCameraId) || cameras[0];
  const companionCameras = cameras.filter((c) => c.id !== focusedCameraId);

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-96px)] min-h-[640px]">
        {/* LEFT COLUMN: Surveillance Video Matrix / Map */}
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
              {/* Primary Focus Camera */}
              <div className="xl:w-[70%] h-full flex flex-col">
                <CameraTile camera={focusedCamera} isFocused />
              </div>

              {/* Sidebar Companion Feeds */}
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
          <LiveAlertFeed />
        </div>
      </div>

      {/* Slide-over Inspection Sheet */}
      {selectedAlertId && <AlertDetailSheet />}
    </>
  );
}
