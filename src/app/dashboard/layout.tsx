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
    ...(role === "Admin" || role === "Chief Dispatcher"
      ? [{ href: "/dashboard/admin", label: "Admin & Node Mgmt" }]
      : []),
  ];

  const visionModes: { mode: VisionMode; label: string; icon: React.ElementType }[] = [
    { mode: "optical", label: "Optical (RGB)", icon: Eye },
    { mode: "thermal", label: "FLIR Thermal", icon: Flame },
    { mode: "night", label: "Phosphor NVG", icon: Moon },
    { mode: "wireframe", label: "Edge AI CV", icon: Layers },
  ];

  const CurrentVisionIcon = visionModes.find((v) => v.mode === visionMode)?.icon || Eye;

  return (
    <header
      className="sticky top-0 z-40 border-b flex items-center justify-between px-3 md:px-6 h-16 transition-colors"
      style={{
        background: "rgba(14, 18, 26, 0.94)",
        borderColor: "var(--border-subtle)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* LEFT: Branding & Node Info */}
      <div className="flex items-center gap-3 lg:gap-4">
        <Link
          href="/"
          className="flex items-center gap-1 text-xs hover:text-white transition-colors group"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline">Exit</span>
        </Link>
        <div className="w-px h-5" style={{ background: "var(--border-subtle)" }} />

        <div className="flex items-center gap-2.5">
          <Logo size="sm" variant="dark" />
          <div className="hidden xl:flex flex-col">
            <span className="text-[10px] font-mono-data uppercase tracking-wider font-semibold text-[#00E5FF]">
              HQ-NAGPUR // GRID-01
            </span>
            <span className="text-[9px] font-mono-data text-gray-400">
              AI ENGINE: YOLOv11x + ByteTrack
            </span>
          </div>
        </div>
      </div>

      {/* CENTER: Main Navigation Tabs */}
      <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-xl bg-[#07090E]/60 border border-[#1E2638]">
        {navLinks.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all relative"
              style={{
                color: active ? "#ffffff" : "var(--text-secondary)",
                background: active ? "rgba(0, 145, 255, 0.2)" : "transparent",
                border: active ? "1px solid rgba(0, 145, 255, 0.4)" : "1px solid transparent",
              }}
            >
              {link.label}
              {link.href === "/dashboard" && criticalAlertsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-mono-data font-bold bg-[#FF3B30] text-white animate-live-pulse">
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
          <div className="hidden sm:flex items-center p-0.5 rounded-lg bg-[#07090E] border border-[#1E2638]">
            <button
              onClick={() => setLayoutMode("grid")}
              className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                layoutMode === "grid"
                  ? "bg-[#0091FF]/25 text-[#00E5FF] border border-[#0091FF]/40 shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
              title="2x2 Multi-Grid View"
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setLayoutMode("focus")}
              className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                layoutMode === "focus"
                  ? "bg-[#0091FF]/25 text-[#00E5FF] border border-[#0091FF]/40 shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
              title="Focus 1-Major + 3-Minor View"
            >
              <Maximize2 size={13} />
            </button>
            <button
              onClick={() => setLayoutMode("map")}
              className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                layoutMode === "map"
                  ? "bg-[#0091FF]/25 text-[#00E5FF] border border-[#0091FF]/40 shadow-sm"
                  : "text-gray-400 hover:text-white"
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono-data transition-all cursor-pointer border"
            style={{
              background: visionMode === "optical" ? "var(--bg-surface-raised)" : "rgba(0,229,255,0.12)",
              borderColor: visionMode === "optical" ? "var(--border-subtle)" : "rgba(0,229,255,0.4)",
              color: visionMode === "optical" ? "var(--text-secondary)" : "#00E5FF",
            }}
            title="Switch Vision Filter Shader"
          >
            <CurrentVisionIcon size={12} />
            <span className="hidden lg:inline capitalize">{visionMode}</span>
            <ChevronDown size={10} />
          </button>

          {showVisionMenu && (
            <div
              className="absolute right-0 mt-1 rounded-xl p-1.5 min-w-[170px] z-50 shadow-2xl border"
              style={{
                background: "var(--bg-surface-high)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <div className="px-2 py-1 text-[10px] uppercase font-mono-data text-gray-400 font-semibold border-b border-[#1E2638] mb-1">
                Sensor Spectrum
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
                    className="flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors"
                    style={{
                      background: active ? "rgba(0, 145, 255, 0.2)" : "transparent",
                      color: active ? "#00E5FF" : "var(--text-secondary)",
                    }}
                  >
                    <Icon size={13} />
                    <span>{v.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Audio Toggle */}
        <button
          onClick={toggleSoundAlerts}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            soundAlerts
              ? "bg-[#141924] border-[#1E2638] text-gray-300 hover:text-white"
              : "bg-[#FF3B30]/10 border-[#FF3B30]/30 text-[#FF3B30]"
          }`}
          title={soundAlerts ? "Sound Alerts Active" : "Sound Alerts Muted"}
        >
          {soundAlerts ? <Volume2 size={13} /> : <VolumeX size={13} />}
        </button>

        {/* System Telemetry Tag */}
        <div
          className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-mono-data"
          style={{
            background: "rgba(16, 185, 129, 0.08)",
            color: "var(--accent-green)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-live-pulse" />
          <span>{onlineCams}/4 CAMS</span>
          <span className="text-gray-500">|</span>
          <span>16ms GPU</span>
        </div>

        {/* Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border"
            style={{
              background: "var(--bg-surface-raised)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            {role === "Admin" ? (
              <ShieldCheck size={13} className="text-[#00E5FF]" />
            ) : role === "Chief Dispatcher" ? (
              <ShieldAlert size={13} className="text-[#FF9500]" />
            ) : (
              <Shield size={13} className="text-[#10B981]" />
            )}
            <span className="hidden sm:inline font-mono-data text-[11px]">{role}</span>
            <ChevronDown size={10} className="text-gray-400" />
          </button>

          {showRoleMenu && (
            <div
              className="absolute right-0 mt-1 rounded-xl p-1.5 min-w-[160px] z-50 shadow-2xl border"
              style={{
                background: "var(--bg-surface-high)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <div className="px-2 py-1 text-[10px] uppercase font-mono-data text-gray-400 font-semibold border-b border-[#1E2638] mb-1">
                Access Level
              </div>
              {(["Operator", "Admin", "Chief Dispatcher"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRole(r);
                    setShowRoleMenu(false);
                  }}
                  className="flex items-center justify-between w-full text-left px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                  style={{
                    background: r === role ? "rgba(0, 145, 255, 0.15)" : "transparent",
                    color: r === role ? "#00E5FF" : "var(--text-secondary)",
                  }}
                >
                  <span>{r}</span>
                  {r === role && <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Time HUD */}
        <span
          className="hidden 2xl:block text-xs font-mono-data px-2.5 py-1 rounded bg-[#07090E] border border-[#1E2638]"
          style={{ color: "#00E5FF" }}
        >
          {time} IST
        </span>
      </div>
    </header>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useSimulatedSocket();

  return (
    <div
      className="dashboard-theme min-h-screen grid-bg-subtle"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <DashboardNav />
      <main className="p-3 md:p-5 max-w-[1920px] mx-auto">{children}</main>
    </div>
  );
}
