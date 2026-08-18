"use client";

import { useDashboardStore } from "@/lib/store";
import { cameras, getEventLabel } from "@/lib/mock-data";
import { useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  Clock,
  TrendingDown,
  Activity,
  Download,
  ShieldCheck,
  Zap,
  Radio,
  Eye,
  CheckCircle2,
  Camera as CameraIcon,
  Layers,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";

/* ═══════════════════════════════════════════════════════════════════════
   KPI Card Component
   ═══════════════════════════════════════════════════════════════════════ */
function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  sublabel,
  badge,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sublabel?: string;
  badge?: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-200/90 bg-white/90 backdrop-blur-xl shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-mono-data font-bold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center border shadow-2xs"
          style={{ background: `${color}15`, borderColor: `${color}35` }}
        >
          <Icon size={17} style={{ color }} />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono-data">
          {value}
        </p>
        {badge && (
          <span className="text-[10px] font-mono-data font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {badge}
          </span>
        )}
      </div>
      {sublabel && (
        <p className="text-[11px] font-mono-data text-slate-500 mt-2 font-medium">
          {sublabel}
        </p>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const alerts = useDashboardStore((s) => s.alerts);
  const [selectedCamera, setSelectedCamera] = useState("all");
  const [livePulseTick, setLivePulseTick] = useState(0);

  // Real-time live pulse ticker syncing every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setLivePulseTick((prev) => prev + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Filter alerts by camera
  const liveFilteredAlerts = useMemo(() => {
    if (selectedCamera === "all") return alerts;
    return alerts.filter((a) => a.cameraId === selectedCamera);
  }, [alerts, selectedCamera]);

  const totalIncidents = liveFilteredAlerts.length;
  const criticalCount = liveFilteredAlerts.filter(
    (a) => a.severity === "critical" || a.eventType === "accident_collision"
  ).length;
  const resolvedCount = liveFilteredAlerts.filter(
    (a) => a.status === "resolved" || a.status === "acknowledged"
  ).length;
  const resolutionRate = totalIncidents > 0 ? Math.round((resolvedCount / totalIncidents) * 100) : 100;

  // 1. EXACT 24-HOUR BINS HOURLY INCIDENT DISTRIBUTION (Matching Screenshot)
  const hourly24BinsData = useMemo(() => {
    const currentHour = new Date().getHours();
    const data = [];

    const hourMultipliers = [
      4, 5, 2, 3, 6, 3, 7, 13, 20, 18, 24, 21, 16, 14, 17, 22, 16, 21, 11, 15, 2, 4, 17, 3
    ];

    for (let h = 0; h < 24; h++) {
      const isCurrent = h === currentHour;
      const base = hourMultipliers[h % hourMultipliers.length];
      const liveAdd = isCurrent ? (livePulseTick % 5) + 2 : 0;
      const count = base + liveAdd;

      data.push({
        hour: `${h.toString().padStart(2, "0")}:00`,
        alerts: count,
        isCurrent,
      });
    }
    return data;
  }, [livePulseTick]);

  // 2. EXACT 7-DAY PER-NODE FREQUENCY SECTOR TREND (Matching Screenshot)
  const sectorTrendData = useMemo(() => {
    const dates = ["08-12", "08-13", "08-14", "08-15", "08-16", "08-17", "08-18"];
    const offset = livePulseTick % 3;

    return dates.map((date, idx) => {
      return {
        date,
        "Wardha Road Junction": 80 + Math.sin(idx * 1.1) * 8 + (idx === 6 ? offset * 2 : 0),
        "Sitabuldi Metro Interchange": 105 - idx * 6 + (idx === 6 ? offset * 3 : 0),
        "Dharampeth Traffic Circle": 57 + idx * 5 + Math.cos(idx * 0.9) * 6,
        "Ambazari Lake Promenade": 78 + Math.sin(idx * 1.5) * 22 + (idx === 6 ? offset : 0),
      };
    });
  }, [livePulseTick]);

  // Event category share
  const eventDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    liveFilteredAlerts.forEach((a) => {
      const label = getEventLabel(a.eventType);
      counts[label] = (counts[label] || 0) + 1;
    });

    const colors = ["#4F46E5", "#EF4444", "#F59E0B", "#10B981", "#8B5CF6", "#06B6D4"];
    return Object.entries(counts).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length],
    }));
  }, [liveFilteredAlerts]);

  // Camera distribution matrix
  const cameraDistribution = useMemo(() => {
    return cameras.map((cam) => {
      const camAlerts = alerts.filter((a) => a.cameraId === cam.id);
      const criticals = camAlerts.filter((a) => a.severity === "critical").length;
      return {
        name: cam.name.split(" ")[0],
        fullName: cam.name,
        id: cam.id,
        incidents: camAlerts.length,
        critical: criticals,
        fps: cam.fps,
        status: cam.status,
      };
    });
  }, [alerts]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Top Bar: Selector + Live Telemetry */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              NexWatch Intelligence & Live Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono-data font-bold animate-pulse flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              LIVE SURVEILLANCE SYNC
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono-data mt-1">
            Real-time traffic computer vision violations, automated Twilio SOS telemetry, and edge analytics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="rounded-xl px-3.5 py-2 text-xs font-mono-data bg-white border border-slate-200 text-slate-800 outline-none cursor-pointer shadow-2xs font-semibold"
          >
            <option value="all">All 4 Municipal Sectors</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#4F46E5] text-white hover:bg-[#4338CA] transition-colors cursor-pointer shadow-sm shadow-indigo-500/20"
          >
            <Download size={13} />
            Export Intel PDF
          </button>
        </div>
      </div>

      {/* 4 Synchronized KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Live Edge Incidents"
          value={totalIncidents}
          icon={AlertTriangle}
          color="#EF4444"
          sublabel="Syncing with active CCTV streams"
          badge="LIVE"
        />
        <KpiCard
          label="Critical / High Urgency"
          value={criticalCount}
          icon={Zap}
          color="#F59E0B"
          sublabel="Accidents & Contraflow Violations"
        />
        <KpiCard
          label="Triage & Resolution Rate"
          value={`${resolutionRate}%`}
          icon={ShieldCheck}
          color="#10B981"
          sublabel={`${resolvedCount} / ${totalIncidents} Resolved or Dispatched`}
          badge="OPTIMAL"
        />
        <KpiCard
          label="Connected RTSP Nodes"
          value="4 / 4"
          icon={Activity}
          color="#4F46E5"
          sublabel="30.0 FPS · TensorRT Acceleration"
          badge="100% ONLINE"
        />
      </div>

      {/* Charts Grid: HOURLY INCIDENT DISTRIBUTION & 7-DAY SECTOR TREND (Matching User Image) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. HOURLY INCIDENT DISTRIBUTION (TODAY) 24-HOUR BINS */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-mono-data font-bold uppercase tracking-wider text-slate-500">
                HOURLY INCIDENT DISTRIBUTION (TODAY)
              </span>
            </div>
            <span className="text-[10px] font-mono-data px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200">
              24-HOUR BINS
            </span>
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly24BinsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} opacity={0.6} />
                <XAxis dataKey="hour" stroke="#64748B" fontSize={9} tickLine={false} interval={3} fontStyle="bold" />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    color: "#FFFFFF",
                    borderColor: "#334155",
                    borderRadius: "10px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                    fontSize: "12px",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                  cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
                  formatter={(val: any) => [`alerts : ${val}`, ""]}
                />
                <Bar dataKey="alerts" fill="#0091FF" radius={[4, 4, 0, 0]}>
                  {hourly24BinsData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isCurrent ? "#00E5FF" : "#0091FF"}
                      opacity={entry.isCurrent ? 1 : 0.9}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. 7-DAY SECTOR TREND ANALYSIS PER-NODE FREQUENCY */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-mono-data font-bold uppercase tracking-wider text-slate-500">
                7-DAY SECTOR TREND ANALYSIS
              </span>
            </div>
            <span className="text-[10px] font-mono-data px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200">
              PER-NODE FREQUENCY
            </span>
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sectorTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" opacity={0.6} />
                <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} domain={[0, 130]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#CBD5E1",
                    borderRadius: "12px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                />
                <Line
                  type="natural"
                  dataKey="Ambazari Lake Promenade"
                  stroke="#A855F7"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: "#A855F7" }}
                />
                <Line
                  type="natural"
                  dataKey="Dharampeth Traffic Circle"
                  stroke="#10B981"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: "#10B981" }}
                />
                <Line
                  type="natural"
                  dataKey="Sitabuldi Metro Interchange"
                  stroke="#F59E0B"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: "#F59E0B" }}
                />
                <Line
                  type="natural"
                  dataKey="Wardha Road Junction"
                  stroke="#00E5FF"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: "#00E5FF" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] font-mono-data">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#A855F7]" />
              <span className="text-[#A855F7] font-semibold">Ambazari Lake Promenade</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
              <span className="text-[#10B981] font-semibold">Dharampeth Traffic Circle</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              <span className="text-[#F59E0B] font-semibold">Sitabuldi Metro Interchange</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF]" />
              <span className="text-[#00E5FF] font-semibold">Wardha Road Junction</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Sector Camera Breakdown Table */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Municipal CCTV Nodes Telemetry Matrix
            </h3>
            <p className="text-[11px] text-slate-500 font-mono-data">
              Live camera-wise violation load, fps performance, and automated dispatch status
            </p>
          </div>
          <span className="text-xs font-mono-data font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            ● All 4 Edge Streams Online
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-data">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                <th className="pb-3 pl-2">Camera Node</th>
                <th className="pb-3">Sector Location</th>
                <th className="pb-3">Live Incidents</th>
                <th className="pb-3">Critical SOS</th>
                <th className="pb-3">FPS</th>
                <th className="pb-3 pr-2">Twilio Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {cameraDistribution.map((cam) => (
                <tr key={cam.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 pl-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-slate-900">{cam.id}</span>
                  </td>
                  <td className="py-3 text-slate-700">{cam.fullName}</td>
                  <td className="py-3 font-bold text-[#4F46E5]">{cam.incidents}</td>
                  <td className="py-3 font-bold text-rose-600">{cam.critical}</td>
                  <td className="py-3 text-slate-600">{cam.fps} FPS</td>
                  <td className="py-3 pr-2">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      Connected
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
