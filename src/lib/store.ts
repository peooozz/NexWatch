import { create } from "zustand";
import { Alert, UserRole, AlertStatus, AlertSeverity, LayoutMode, VisionMode } from "./types";
import { generateSeedAlerts, generateDailyStats, cameras } from "./mock-data";
import type { DailyStat } from "./types";

interface DashboardState {
  // Alerts
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  updateAlertStatus: (id: string, status: AlertStatus, by?: string) => void;
  acknowledgeAll: () => void;
  addNote: (id: string, note: string) => void;
  dispatchUnit: (
    alertId: string,
    unitName: string,
    unitType: "Traffic Police" | "PCR Patrol" | "Municipal Tow Truck"
  ) => void;

  // Role
  role: UserRole;
  setRole: (role: UserRole) => void;

  // Layout & Vision Modes
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  visionMode: VisionMode;
  setVisionMode: (mode: VisionMode) => void;
  focusedCameraId: string;
  setFocusedCameraId: (id: string) => void;

  // Audio / Sound FX
  soundAlerts: boolean;
  toggleSoundAlerts: () => void;

  // Search & Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  alertFilter: AlertStatus | "all";
  setAlertFilter: (f: AlertStatus | "all") => void;
  severityFilter: AlertSeverity | "all";
  setSeverityFilter: (s: AlertSeverity | "all") => void;
  cameraFilter: string | "all";
  setCameraFilter: (c: string | "all") => void;

  // Selected alert (for detail sheet / dispatch center)
  selectedAlertId: string | null;
  setSelectedAlertId: (id: string | null) => void;

  // Daily stats
  dailyStats: DailyStat[];
}

export const useDashboardStore = create<DashboardState>((set) => ({
  alerts: generateSeedAlerts(28),
  addAlert: (alert) =>
    set((s) => ({ alerts: [alert, ...s.alerts] })),
  updateAlertStatus: (id, status, by) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              acknowledgedBy: by ?? a.acknowledgedBy ?? "Operator Desk",
              resolvedAt: status === "resolved" ? new Date().toISOString() : a.resolvedAt,
            }
          : a
      ),
    })),
  acknowledgeAll: () =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.status === "new"
          ? { ...a, status: "acknowledged", acknowledgedBy: "Batch Ack (All)" }
          : a
      ),
    })),
  addNote: (id, note) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, notes: note } : a
      ),
    })),
  dispatchUnit: (alertId, unitName, unitType) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              status: a.status === "new" ? "acknowledged" : a.status,
              acknowledgedBy: a.acknowledgedBy || "Dispatcher",
              dispatchedUnit: {
                unitName,
                unitType,
                dispatchedAt: new Date().toISOString(),
                etaMinutes: 4,
                status: "en_route",
              },
            }
          : a
      ),
    })),

  role: "Operator",
  setRole: (role) => set({ role }),

  layoutMode: "grid",
  setLayoutMode: (layoutMode) => set({ layoutMode }),

  visionMode: "optical",
  setVisionMode: (visionMode) => set({ visionMode }),

  focusedCameraId: cameras[0]?.id || "CAM-001",
  setFocusedCameraId: (focusedCameraId) => set({ focusedCameraId }),

  soundAlerts: true,
  toggleSoundAlerts: () => set((s) => ({ soundAlerts: !s.soundAlerts })),

  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  alertFilter: "all",
  setAlertFilter: (alertFilter) => set({ alertFilter }),

  severityFilter: "all",
  setSeverityFilter: (severityFilter) => set({ severityFilter }),

  cameraFilter: "all",
  setCameraFilter: (cameraFilter) => set({ cameraFilter }),

  selectedAlertId: null,
  setSelectedAlertId: (selectedAlertId) => set({ selectedAlertId }),

  dailyStats: generateDailyStats(),
}));
