export type CameraStatus = "online" | "offline" | "degraded";

export type VisionMode = "cv" | "optical" | "thermal" | "night" | "wireframe";
export type LayoutMode = "grid" | "focus" | "map";

export type Camera = {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  zone: string;
  status: CameraStatus;
  fps: number;
  resolution: string;
  bitrate: string;
  fovAngle: number; // in degrees for map cone
  bearing: number; // direction facing in degrees
  streamUrl?: string;
  lensType: string;
};

export type AlertEventType =
  | "accident_collision"
  | "illegal_parking"
  | "loitering"
  | "wrong_way"
  | "crowd_density"
  | "speed_violation"
  | "restricted_perimeter";

export type AlertSeverity = "critical" | "high" | "medium" | "low";

export type AlertStatus =
  | "new"
  | "acknowledged"
  | "resolved"
  | "false_positive";

export type AlertVehicleDetails = {
  make?: string;
  model?: string;
  color?: string;
  licensePlate?: string;
  plateConfidence?: number;
  speedKmph?: number;
  durationInZoneSec?: number;
  objectClass: "Sedan" | "SUV" | "Truck" | "Motorcycle" | "Auto Rickshaw" | "Pedestrian" | "Crowd Group";
};

export type Alert = {
  id: string;
  cameraId: string;
  cameraName: string;
  eventType: AlertEventType;
  severity: AlertSeverity;
  confidence: number;
  trackId: string;
  detectedAt: string;
  deliveredAt: string;
  latencyMs: number;
  status: AlertStatus;
  snapshotUrl: string;
  vehicleDetails?: AlertVehicleDetails;
  notes?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  dispatchedUnit?: {
    unitName: string;
    unitType: "Traffic Police" | "PCR Patrol" | "Municipal Tow Truck";
    dispatchedAt: string;
    etaMinutes: number;
    status: "dispatched" | "en_route" | "on_scene";
  };
};

export type HourlyBreakdown = {
  hour: number;
  count: number;
};

export type DailyStat = {
  cameraId: string;
  date: string;
  totalAlerts: number;
  avgLatencyMs: number;
  falsePositiveRate: number;
  resolvedRate: number;
  hourlyBreakdown: HourlyBreakdown[];
};

export type UserRole = "Operator" | "Admin" | "Chief Dispatcher";

