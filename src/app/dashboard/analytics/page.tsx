"use client";

import { useDashboardStore } from "@/lib/store";
import { cameras, getEventLabel } from "@/lib/mock-data";
import { useMemo, useState } from "react";
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
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════
   KPI Card
   ═══════════════════════════════════════════════════════════════════════ */
function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  sublabel,
  mono,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  sublabel?: string;
  mono?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-4 scanline-texture relative overflow-hidden"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono-data uppercase tracking-wider text-gray-400">
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center border"
          style={{ background: `${color}15`, borderColor: `${color}30` }}
        >
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <p
        className={`text-2xl font-bold ${mono ? "font-mono-data" : ""}`}
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
      {sublabel && (
        <p className="text-[10px] font-mono-data text-gray-500 mt-1">{sublabel}</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Analytics Page
   ═══════════════════════════════════════════════════════════════════════ */
export default function AnalyticsPage() {
  const dailyStats = useDashboardStore((s) => s.dailyStats);
  const alerts = useDashboardStore((s) => s.alerts);
  const [selectedCamera, setSelectedCamera] = useState("all");

  // Today's stats
  const todayStr = new Date().toISOString().split("T")[0];
  const todayStats = dailyStats.filter((s) => s.date === todayStr);

  const totalAlertsToday = useMemo(() => {
    if (selectedCamera === "all")
      return todayStats.reduce((sum, s) => sum + s.totalAlerts, 0);
    return (
      todayStats.find((s) => s.cameraId === selectedCamera)?.totalAlerts || 0
    );
  }, [todayStats, selectedCamera]);

  const avgLatency = useMemo(() => {
    const relevant =
      selectedCamera === "all"
        ? todayStats
        : todayStats.filter((s) => s.cameraId === selectedCamera);
    if (!relevant.length) return 0;
    return (
      relevant.reduce((sum, s) => sum + s.avgLatencyMs, 0) / relevant.length
    );
  }, [todayStats, selectedCamera]);

  const falsePositiveRate = useMemo(() => {
    const relevant =
      selectedCamera === "all"
        ? todayStats
        : todayStats.filter((s) => s.cameraId === selectedCamera);
    if (!relevant.length) return 0;
    return (
      relevant.reduce((sum, s) => sum + s.falsePositiveRate, 0) /
      relevant.length
    );
  }, [todayStats, selectedCamera]);

  // Peak hour
  const peakHour = useMemo(() => {
    const hourTotals = Array(24).fill(0);
    const relevant =
      selectedCamera === "all"
        ? todayStats
        : todayStats.filter((s) => s.cameraId === selectedCamera);
    relevant.forEach((s) =>
      s.hourlyBreakdown.forEach((h) => (hourTotals[h.hour] += h.count))
    );
    const maxIdx = hourTotals.indexOf(Math.max(...hourTotals));
    return `${maxIdx.toString().padStart(2, "0")}:00 hrs`;
  }, [todayStats, selectedCamera]);

  // Hourly chart data
  const hourlyData = useMemo(() => {
    const data = [];
    const relevant =
      selectedCamera === "all"
        ? todayStats
        : todayStats.filter((s) => s.cameraId === selectedCamera);
    for (let h = 0; h < 24; h++) {
      let count = 0;
      relevant.forEach((s) => {
        const hEntry = s.hourlyBreakdown.find((b) => b.hour === h);
        if (hEntry) count += hEntry.count;
      });
      data.push({ hour: `${h.toString().padStart(2, "0")}:00`, alerts: count });
    }
    return data;
  }, [todayStats, selectedCamera]);

  // 7-day trend data
  const trendData = useMemo(() => {
    const dates = [...new Set(dailyStats.map((s) => s.date))].sort();
    return dates.map((date) => {
      const entry: Record<string, string | number> = { date: date.slice(5) };
      cameras.forEach((cam) => {
        const stat = dailyStats.find(
          (s) => s.date === date && s.cameraId === cam.id
        );
        entry[cam.name] = stat?.totalAlerts || 0;
      });
      return entry;
    });
  }, [dailyStats]);

  // Camera table data
  const tableData = useMemo(() => {
    return cameras.map((cam) => {
      const camStats = dailyStats.filter((s) => s.cameraId === cam.id);
      const totalAlerts = camStats.reduce((s, d) => s + d.totalAlerts, 0);
      const avgLat =
        camStats.length > 0
          ? camStats.reduce((s, d) => s + d.avgLatencyMs, 0) / camStats.length
          : 0;
      const resolvedRate =
        camStats.length > 0
          ? camStats.reduce((s, d) => s + d.resolvedRate, 0) / camStats.length
          : 0;
      const fpRate =
        camStats.length > 0
          ? camStats.reduce((s, d) => s + d.falsePositiveRate, 0) /
            camStats.length
          : 0;
      return {
        camera: cam.name,
        id: cam.id,
        zone: cam.zone,
        totalAlerts,
        avgLatency: avgLat,
        resolvedRate,
        fpRate,
      };
    });
  }, [dailyStats]);

  const lineColors = ["#00E5FF", "#FF9500", "#10B981", "#A855F7"];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Top Bar: Selector + Export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">
            Surveillance Intelligence & Analytics
          </h1>
          <p className="text-xs text-gray-400 font-mono-data">
            Detection metrics, false positive rates, and 7-day municipal trend breakdown
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="rounded-lg px-3 py-2 text-xs font-mono-data bg-[#141924] border border-[#1E2638] text-white outline-none cursor-pointer"
          >
            <option value="all">All Camera Sectors</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>

          <button
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono-data font-semibold bg-[#0091FF]/15 text-[#00E5FF] border border-[#0091FF]/30 hover:bg-[#0091FF]/25 transition-colors cursor-pointer"
          >
            <Download size={13} />
            Export Intel PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Incidents (Today)"
          value={totalAlertsToday.toString()}
          icon={AlertTriangle}
          color="#FF3B30"
          sublabel="Real-time edge detections"
        />
        <KpiCard
          label="Avg Pipeline Latency"
          value={`${(avgLatency / 1000).toFixed(2)}s`}
          icon={Clock}
          color="#00E5FF"
          mono
          sublabel="Camera to operator triage"
        />
        <KpiCard
          label="False Positive Rate"
          value={`${(falsePositiveRate * 100).toFixed(1)}%`}
          icon={TrendingDown}
          color="#FF9500"
          sublabel="AI accuracy benchmark"
        />
        <KpiCard
          label="Peak Activity Window"
          value={peakHour}
          icon={Activity}
          color="#10B981"
          mono
          sublabel="Traffic density peak"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hourly bar chart */}
        <div
          className="rounded-xl border p-4 scanline-texture"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase font-mono-data text-white">
              Hourly Incident Distribution (Today)
            </h3>
            <span className="text-[10px] font-mono-data text-gray-500">24-HOUR BINS</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hourlyData}>
              <CartesianGrid stroke="#1E2638" strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                tick={{ fill: "#64748B", fontSize: 10, fontFamily: "monospace" }}
                interval={3}
              />
              <YAxis tick={{ fill: "#64748B", fontSize: 10, fontFamily: "monospace" }} />
              <Tooltip
                contentStyle={{
                  background: "#0E121A",
                  border: "1px solid #1E2638",
                  borderRadius: 8,
                  color: "#F0F3F8",
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
              />
              <Bar
                dataKey="alerts"
                fill="#0091FF"
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 7-day line chart */}
        <div
          className="rounded-xl border p-4 scanline-texture"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase font-mono-data text-white">
              7-Day Sector Trend Analysis
            </h3>
            <span className="text-[10px] font-mono-data text-gray-500">PER-NODE FREQUENCY</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid stroke="#1E2638" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748B", fontSize: 10, fontFamily: "monospace" }}
              />
              <YAxis tick={{ fill: "#64748B", fontSize: 10, fontFamily: "monospace" }} />
              <Tooltip
                contentStyle={{
                  background: "#0E121A",
                  border: "1px solid #1E2638",
                  borderRadius: 8,
                  color: "#F0F3F8",
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, fontFamily: "monospace", color: "#94A3B8" }}
              />
              {cameras.map((cam, i) => (
                <Line
                  key={cam.id}
                  type="monotone"
                  dataKey={cam.name}
                  stroke={lineColors[i]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sector Performance Data Table */}
      <div
        className="rounded-xl border overflow-hidden scanline-texture"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr
                className="border-b bg-[#090C13] text-[10px] font-mono-data uppercase tracking-wider text-gray-400"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                {[
                  "Sector / Camera Node",
                  "7-Day Total Incidents",
                  "Avg Pipeline Latency",
                  "Resolution Efficiency",
                  "False Positive Rate",
                ].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2638]">
              {tableData.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-[#141924]/60 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{row.camera}</div>
                    <div className="text-[10px] text-gray-400 font-mono-data">
                      {row.id} · {row.zone}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono-data text-white font-semibold">
                    {row.totalAlerts}
                  </td>
                  <td className="px-4 py-3 font-mono-data">
                    <span
                      style={{
                        color:
                          row.avgLatency < 15000
                            ? "#10B981"
                            : row.avgLatency < 30000
                            ? "#FF9500"
                            : "#FF3B30",
                      }}
                    >
                      {(row.avgLatency / 1000).toFixed(2)}s
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono-data text-[#10B981] font-semibold">
                    {(row.resolvedRate * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 font-mono-data text-[#FF9500]">
                    {(row.fpRate * 100).toFixed(1)}%
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
