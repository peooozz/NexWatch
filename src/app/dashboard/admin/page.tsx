"use client";

import { useDashboardStore } from "@/lib/store";
import { cameras } from "@/lib/mock-data";
import { useState } from "react";
import {
  Camera,
  Users,
  Cpu,
  Plus,
  Pencil,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Sliders,
  Radio,
  Server,
  Zap,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════
   Tab Button
   ═══════════════════════════════════════════════════════════════════════ */
function TabButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold font-mono-data transition-all cursor-pointer"
      style={{
        background: active ? "rgba(0, 145, 255, 0.2)" : "transparent",
        color: active ? "#00E5FF" : "var(--text-secondary)",
        border: active ? "1px solid rgba(0, 145, 255, 0.4)" : "1px solid transparent",
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Cameras Tab
   ═══════════════════════════════════════════════════════════════════════ */
function CamerasTab() {
  return (
    <div
      className="rounded-xl border overflow-hidden scanline-texture"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b bg-[#0B0F17]/80"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div>
          <h3 className="text-sm font-semibold text-white">Edge Camera Nodes & Zones</h3>
          <p className="text-[11px] text-gray-400">Manage stream profiles, geofence polygons, and FPS thresholds</p>
        </div>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono-data cursor-pointer bg-[#0091FF] text-white hover:bg-[#0077D4] transition-colors"
        >
          <Plus size={13} />
          Register Node
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr
              className="border-b bg-[#090C13] text-[10px] font-mono-data uppercase tracking-wider"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {["Node ID", "Name & Sector", "Coordinates", "Profile", "Bitrate", "Lens Spec", "Status", "Actions"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 font-semibold text-gray-400"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E2638]">
            {cameras.map((cam) => (
              <tr
                key={cam.id}
                className="hover:bg-[#141924]/60 transition-colors"
              >
                <td className="px-4 py-3 font-mono-data text-[#00E5FF] font-semibold">
                  {cam.id}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{cam.name}</div>
                  <div className="text-[10px] text-gray-400">{cam.zone}</div>
                </td>
                <td className="px-4 py-3 font-mono-data text-gray-400 text-[11px]">
                  {cam.location.lat.toFixed(4)}° N, {cam.location.lng.toFixed(4)}° E
                </td>
                <td className="px-4 py-3 font-mono-data text-white text-[11px]">
                  {cam.resolution} @ {cam.fps}fps
                </td>
                <td className="px-4 py-3 font-mono-data text-[#10B981] text-[11px]">
                  {cam.bitrate}
                </td>
                <td className="px-4 py-3 font-mono-data text-gray-300 text-[11px]">
                  {cam.lensType}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono-data">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        cam.status === "online" ? "bg-[#10B981] animate-live-pulse" : "bg-[#FF3B30]"
                      }`}
                    />
                    <span className="capitalize text-white">{cam.status}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono-data bg-[#141924] text-[#00E5FF] border border-[#1E2638] hover:bg-[#0091FF]/15 cursor-pointer transition-colors"
                  >
                    <Pencil size={11} />
                    Edit Geofence
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Users Tab
   ═══════════════════════════════════════════════════════════════════════ */
const mockUsers = [
  { id: "USR-001", name: "Rajesh Kumar", email: "rajesh@nagpur.gov.in", role: "Admin", clearance: "Level 4 (Full Root)" },
  { id: "USR-002", name: "Vikram Patel", email: "vikram@nagpur.gov.in", role: "Chief Dispatcher", clearance: "Level 3 (Tactical)" },
  { id: "USR-003", name: "Priya Sharma", email: "priya@nexwatch.ai", role: "Operator", clearance: "Level 2 (Triage)" },
  { id: "USR-004", name: "Anita Deshmukh", email: "anita@nexwatch.ai", role: "Operator", clearance: "Level 2 (Triage)" },
];

function UsersTab() {
  return (
    <div
      className="rounded-xl border overflow-hidden scanline-texture"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div
        className="px-4 py-3 border-b bg-[#0B0F17]/80"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <h3 className="text-sm font-semibold text-white">Personnel & Access Roles</h3>
        <p className="text-[11px] text-gray-400">Operator consoles, dispatch credentials, and security clearance levels</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr
              className="border-b bg-[#090C13] text-[10px] font-mono-data uppercase tracking-wider text-gray-400"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {["User ID", "Name", "Email Address", "Role", "Security Clearance"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E2638]">
            {mockUsers.map((user) => (
              <tr key={user.id} className="hover:bg-[#141924]/60 transition-colors">
                <td className="px-4 py-3 font-mono-data text-gray-400 text-[11px]">
                  {user.id}
                </td>
                <td className="px-4 py-3 font-medium text-white">
                  {user.name}
                </td>
                <td className="px-4 py-3 font-mono-data text-gray-400">
                  {user.email}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono-data font-semibold ${
                      user.role === "Admin"
                        ? "bg-[#0091FF]/20 text-[#00E5FF] border border-[#0091FF]/40"
                        : user.role === "Chief Dispatcher"
                        ? "bg-[#FF9500]/20 text-[#FF9500] border border-[#FF9500]/40"
                        : "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
                    }`}
                  >
                    {user.role === "Admin" ? (
                      <ShieldCheck size={11} />
                    ) : user.role === "Chief Dispatcher" ? (
                      <ShieldAlert size={11} />
                    ) : (
                      <Shield size={11} />
                    )}
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono-data text-gray-300 text-[11px]">
                  {user.clearance}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   System Health Tab
   ═══════════════════════════════════════════════════════════════════════ */
function RadialGauge({ value, label, sublabel }: { value: number; label: string; sublabel: string }) {
  const circumference = 2 * Math.PI * 45;
  const strokeDash = (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="130" height="130" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke="#1E2638"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke={
            value > 80
              ? "#FF3B30"
              : value > 60
              ? "#FF9500"
              : "#00E5FF"
          }
          strokeWidth="8"
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
        <text
          x="60"
          y="56"
          textAnchor="middle"
          fill="#F0F3F8"
          fontSize="19"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="bold"
        >
          {value}%
        </text>
        <text
          x="60"
          y="72"
          textAnchor="middle"
          fill="#64748B"
          fontSize="8"
          fontFamily="JetBrains Mono, monospace"
        >
          {label}
        </text>
      </svg>
      <span className="text-[10px] font-mono-data text-gray-400">{sublabel}</span>
    </div>
  );
}

function SystemHealthTab() {
  return (
    <div className="space-y-4">
      {/* Cluster Hardware & Acceleration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="rounded-xl border p-5 flex flex-col items-center justify-center scanline-texture"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <RadialGauge value={42} label="NVIDIA A100" sublabel="GPU Inference Load" />
        </div>

        <div
          className="rounded-xl border p-4 scanline-texture"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <h4
            className="text-xs font-semibold uppercase font-mono-data text-[#00E5FF] mb-3 flex items-center gap-1.5"
          >
            <Cpu size={14} />
            AI Pipeline Engine Spec
          </h4>
          <div className="space-y-2 text-xs font-mono-data">
            {[
              ["Detection Model", "YOLOv11x TensorRT 10.0"],
              ["Multi-Object Tracker", "ByteTrack v2.1"],
              ["OCR Engine", "LPRNet + CRNN (Plate)"],
              ["Batch Processing", "8 Streams / GPU Node"],
              ["Avg Frame Latency", "14.2 ms"],
              ["Precision", "FP16 Optimized"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-400">{k}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-xl border p-4 scanline-texture"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <h4
            className="text-xs font-semibold uppercase font-mono-data text-[#10B981] mb-3 flex items-center gap-1.5"
          >
            <Server size={14} />
            Edge Stream Health (Nagpur Grid)
          </h4>
          <div className="space-y-2 text-xs font-mono-data">
            {cameras.map((cam) => (
              <div key={cam.id} className="flex items-center justify-between">
                <span className="text-gray-300 truncate max-w-[140px]">{cam.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#00E5FF]">{cam.fps} FPS</span>
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E2638] flex justify-between text-xs font-mono-data">
            <span className="text-gray-400">Total Pipeline Uptime</span>
            <span className="text-[#10B981] font-bold">99.94%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Admin Page (role-gated)
   ═══════════════════════════════════════════════════════════════════════ */
export default function AdminPage() {
  const role = useDashboardStore((s) => s.role);
  const [activeTab, setActiveTab] = useState<"cameras" | "users" | "health">(
    "cameras"
  );

  if (role !== "Admin" && role !== "Chief Dispatcher") {
    return (
      <div
        className="flex flex-col items-center justify-center h-[60vh] gap-4"
      >
        <Shield size={48} className="text-[#FF3B30] animate-pulse" />
        <h2 className="text-lg font-semibold text-white">
          Admin / Chief Dispatcher Access Required
        </h2>
        <p className="text-xs text-center max-w-sm text-gray-400 font-mono-data">
          Switch your active clearance role to Admin or Chief Dispatcher using the top navigation switcher to access node configuration and security controls.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">
            Node Administration & Security Command
          </h1>
          <p className="text-xs text-gray-400 font-mono-data">
            CCTV hardware stream management, access roles, and AI acceleration clusters
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1.5 p-1 rounded-xl w-fit bg-[#0E121A] border border-[#1E2638]"
      >
        <TabButton
          active={activeTab === "cameras"}
          label="Edge Camera Nodes"
          icon={Camera}
          onClick={() => setActiveTab("cameras")}
        />
        <TabButton
          active={activeTab === "users"}
          label="Personnel & Roles"
          icon={Users}
          onClick={() => setActiveTab("users")}
        />
        <TabButton
          active={activeTab === "health"}
          label="AI Cluster Health"
          icon={Cpu}
          onClick={() => setActiveTab("health")}
        />
      </div>

      {/* Tab Content */}
      {activeTab === "cameras" && <CamerasTab />}
      {activeTab === "users" && <UsersTab />}
      {activeTab === "health" && <SystemHealthTab />}
    </div>
  );
}
