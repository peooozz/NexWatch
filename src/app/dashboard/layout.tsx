"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { useDashboardStore } from "@/lib/store";
import { useSimulatedSocket } from "@/lib/simulated-socket";
import { cameras } from "@/lib/mock-data";
import { VisionMode, LayoutMode, UserRole } from "@/lib/types";
import {
  ChevronLeft,
  ChevronDown,
  User,
  LayoutGrid,
  Maximize2,
  Map,
  Eye,
  Flame,
  Moon,
  Cpu,
  Volume2,
  VolumeX,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Layers,
} from "lucide-react";
import { useState, useEffect } from "react";

function DashboardNav() {
  const pathname = usePathname();
  const role = useDashboardStore((s) => s.role);
  const setRole = useDashboardStore((s) => s.setRole);
  const layoutMode = useDashboardStore((s) => s.layoutMode);
  const setLayoutMode = useDashboardStore((s) => s.setLayoutMode);
  const visionMode = useDashboardStore((s) => s.visionMode);
  const setVisionMode = useDashboardStore((s) => s.setVisionMode);
  const soundAlerts = useDashboardStore((s) => s.soundAlerts);
  const toggleSoundAlerts = useDashboardStore((s) => s.toggleSoundAlerts);
  const alerts = useDashboardStore((s) => s.alerts);

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showVisionMenu, setShowVisionMenu] = useState(false);
  const [time, setTime] = useState("");

  const onlineCams = cameras.filter((c) => c.status === "online").length;
  const criticalAlertsCount = alerts.filter(
    (a) => a.status === "new" && (a.severity === "critical" || a.severity === "high")
  ).length;

  useEffect(() => {
    function tick() {
      setTime(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const navLinks = [
    { href: "/dashboard", label: "Live Surveillance" },
    { href: "/dashboard/analytics", label: "Analytics & Intel" },
    { href: "/dashboard/events", label: "Live Stream" },
    ...(role === "Admin" || role === "Chief Dispatcher"
      ? [{ href: "/dashboard/admin", label: "Admin & Nodes" }]
      : []),
  ];

  const visionModes: {
    mode: VisionMode;
    label: string;
    description: string;
    icon: React.ElementType;
  }[] = [
    {
      mode: "cv",
      label: "Computer Vision",
      description: "YOLO AI Detection & Bounding Boxes",
      icon: Layers,
    },
    {
      mode: "optical",
      label: "Optical (Clean Feed)",
      description: "Normal Camera Feed (No Overlays)",
      icon: Eye,
    },
    {
      mode: "thermal",
      label: "FLIR Thermal",
      description: "Infrared Thermal Spectrum",
      icon: Flame,
    },
    {
      mode: "night",
      label: "Phosphor NVG",
      description: "Night Vision Mode",
      icon: Moon,
    },
  ];

  const currentVision = visionModes.find((v) => v.mode === visionMode) || visionModes[0];
  const CurrentVisionIcon = currentVision.icon;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl flex items-center justify-between px-3 md:px-6 h-16 transition-colors shadow-xs">
      {/* LEFT: Branding & Node Info */}
      <div className="flex items-center gap-3 lg:gap-4">
        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors group"
        >
          <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline font-medium">Exit</span>
        </Link>
        <div className="w-px h-5 bg-slate-200" />

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] flex items-center justify-center text-white shadow-xs">
            <Shield size={16} />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold tracking-tight text-[#0F172A]">City</span>
            <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent">Eye</span>
          </div>

          <div className="hidden xl:flex flex-col ml-2 pl-3 border-l border-slate-200">
            <span className="text-[10px] font-mono-data uppercase tracking-wider font-bold text-[#6366F1]">
              HQ-NAGPUR // GRID-01
            </span>
            <span className="text-[9px] font-mono-data text-slate-500">
              YOLOv11x + ByteTrack + Twilio
            </span>
          </div>
        </div>
      </div>

      {/* CENTER: Main Navigation Tabs */}
      <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-slate-100/80 border border-slate-200/80 shadow-inner">
        {navLinks.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all relative flex items-center ${
                active
                  ? "bg-white text-[#4F46E5] shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              {link.label}
              {link.href === "/dashboard" && criticalAlertsCount > 0 && (
                <span
                  suppressHydrationWarning
                  className="ml-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-mono-data font-bold bg-[#EF4444] text-white animate-pulse"
                >
                  {criticalAlertsCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* RIGHT: Telemetry, Layout Modes, Vision Shaders & Role Switch */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Layout Switcher (only visible on dashboard view) */}
        {pathname === "/dashboard" && (
          <div className="hidden sm:flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
            <button
              onClick={() => setLayoutMode("grid")}
              className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                layoutMode === "grid"
                  ? "bg-white text-[#4F46E5] shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="2x2 Multi-Grid View"
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setLayoutMode("focus")}
              className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                layoutMode === "focus"
                  ? "bg-white text-[#4F46E5] shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Focus 1-Major + 3-Minor View"
            >
              <Maximize2 size={13} />
            </button>
            <button
              onClick={() => setLayoutMode("map")}
              className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                layoutMode === "map"
                  ? "bg-white text-[#4F46E5] shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Tactical GIS Satellite Map"
            >
              <Map size={13} />
            </button>
          </div>
        )}

        {/* Vision Mode Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowVisionMenu(!showVisionMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono-data transition-all cursor-pointer border bg-white border-slate-200 text-slate-800 shadow-xs hover:border-slate-300"
            title="Switch Vision Filter & Computer Vision AI"
          >
            <CurrentVisionIcon size={13} className={visionMode === "cv" ? "text-[#4F46E5]" : "text-slate-500"} />
            <span className="hidden sm:inline font-medium">{currentVision.label}</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>

          {showVisionMenu && (
            <div className="absolute right-0 mt-1.5 rounded-2xl p-1.5 min-w-[240px] z-50 shadow-xl border border-slate-200 bg-white/95 backdrop-blur-xl">
              <div className="px-2.5 py-1 text-[10px] uppercase font-mono-data text-slate-400 font-bold border-b border-slate-100 mb-1 flex items-center justify-between">
                <span>Sensor Spectrum & AI</span>
                <span className="text-[9px] text-[#4F46E5]">YOLOv11</span>
              </div>
              {visionModes.map((v) => {
                const Icon = v.icon;
                const active = v.mode === visionMode;
                return (
                  <button
                    key={v.mode}
                    onClick={() => {
                      setVisionMode(v.mode);
                      setShowVisionMenu(false);
                    }}
                    className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-all cursor-pointer ${
                      active
                        ? "bg-indigo-50 text-[#4F46E5] border border-indigo-200/60"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={15} className={`mt-0.5 ${active ? "text-[#4F46E5]" : "text-slate-400"}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold leading-tight">{v.label}</div>
                      <div className="text-[10px] text-slate-500 font-mono-data truncate mt-0.5">
                        {v.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Audio Mute/Unmute Toggle */}
        <button
          onClick={toggleSoundAlerts}
          className={`p-2 rounded-full border transition-all cursor-pointer shadow-xs ${
            soundAlerts
              ? "bg-white border-slate-200 text-[#4F46E5]"
              : "bg-slate-100 border-slate-200 text-slate-400"
          }`}
          title={soundAlerts ? "Sound Alerts Active (Siren On)" : "Sound Alerts Muted"}
        >
          {soundAlerts ? <Volume2 size={13} /> : <VolumeX size={13} />}
        </button>

        {/* Live Clock Telemetry */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-mono-data text-slate-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span suppressHydrationWarning>{time || "LIVE"}</span>
          <span className="text-[9px] text-slate-400">IST</span>
        </div>

        {/* Role Switcher Pill */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer border bg-white border-slate-200 text-slate-800 shadow-xs hover:border-slate-300"
          >
            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[#4F46E5]">
              <User size={12} />
            </div>
            <span className="hidden md:inline font-medium">{role}</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-1.5 rounded-2xl p-1.5 min-w-[200px] z-50 shadow-xl border border-slate-200 bg-white/95 backdrop-blur-xl">
              <div className="px-2.5 py-1 text-[10px] uppercase font-mono-data text-slate-400 font-bold border-b border-slate-100 mb-1">
                Operator Clearance
              </div>
              {(["Chief Dispatcher", "Operator", "Field Unit", "Admin"] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRole(r);
                    setShowRoleMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                    role === r
                      ? "bg-indigo-50 text-[#4F46E5] font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{r}</span>
                  {role === r && <ShieldCheck size={13} className="text-[#4F46E5]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Initialize simulated WebSocket telemetry bus for realistic traffic feeds
  useSimulatedSocket();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col selection:bg-[#6366F1]/20 selection:text-[#4338CA]">
      <DashboardNav />
      <main className="flex-1 p-3 md:p-4 overflow-hidden relative ambient-light-bg">
        {children}
      </main>
    </div>
  );
}
