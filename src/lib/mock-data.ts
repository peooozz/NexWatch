import { Camera, Alert, DailyStat, AlertEventType, AlertStatus, AlertSeverity, AlertVehicleDetails } from "./types";

// ── Cameras in Nagpur Smart City Grid ──────────────────────────────────
export const cameras: Camera[] = [
  {
    id: "CAM-001",
    name: "Wardha Road Junction",
    zone: "South Arterial Corridor",
    location: { lat: 21.1256, lng: 79.0725 },
    status: "online",
    fps: 30,
    resolution: "3840×2160 (4K)",
    bitrate: "8.4 Mbps",
    bearing: 145,
    fovAngle: 78,
    lensType: "Varifocal 4.8-120mm PTZ",
  },
  {
    id: "CAM-002",
    name: "Sitabuldi Metro Interchange",
    zone: "Central Business District",
    location: { lat: 21.1458, lng: 79.0882 },
    status: "online",
    fps: 30,
    resolution: "1920×1080 (FHD)",
    bitrate: "6.2 Mbps",
    bearing: 42,
    fovAngle: 90,
    lensType: "Wide Fixed 2.8mm",
  },
  {
    id: "CAM-003",
    name: "Dharampeth Traffic Circle",
    zone: "West Commercial Sector",
    location: { lat: 21.1432, lng: 79.0652 },
    status: "online",
    fps: 30,
    resolution: "2560×1440 (2K)",
    bitrate: "7.1 Mbps",
    bearing: 260,
    fovAngle: 85,
    lensType: "Motorized 3.6-11mm",
  },
  {
    id: "CAM-004",
    name: "Ambazari Lake Promenade",
    zone: "Public Recreation Perimeter",
    location: { lat: 21.1349, lng: 79.0498 },
    status: "online",
    fps: 25,
    resolution: "1920×1080 (FHD)",
    bitrate: "5.5 Mbps",
    bearing: 210,
    fovAngle: 110,
    lensType: "Panoramic 180° Multi-sensor",
    sourceType: "cctv",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

let alertCounter = 120;

const EVENT_CONFIGS: {
  type: AlertEventType;
  severity: AlertSeverity;
  label: string;
  defaultClass: AlertVehicleDetails["objectClass"];
}[] = [
  // 1. Helmet Violation
  { type: "helmet_violation", severity: "medium", label: "Helmet Violation (No Headgear)", defaultClass: "Motorcycle" },
  // 2. Triple Riding
  { type: "triple_riding", severity: "high", label: "Triple Riding on Two-Wheeler (3 Pax)", defaultClass: "Motorcycle" },
  // 3. Wrong-Way Driving
  { type: "wrong_way", severity: "critical", label: "Wrong-Way Driving (Contraflow)", defaultClass: "Auto Rickshaw" },
  { type: "wrong_way", severity: "critical", label: "Wrong-Way Vehicle Entry", defaultClass: "Motorcycle" },
  // 4. Vehicle Stopped / Possible Accident
  { type: "vehicle_stopped", severity: "high", label: "Vehicle Stopped / Possible Accident (Hazard)", defaultClass: "Auto Rickshaw" },
  { type: "vehicle_stopped", severity: "high", label: "Vehicle Stopped in Active Lane (> 30s)", defaultClass: "Sedan" },
  // 5. Accident / Collision
  { type: "accident_collision", severity: "critical", label: "High-Impact Collision Detected (100% Accuracy)", defaultClass: "Auto Rickshaw" },
  { type: "accident_collision", severity: "critical", label: "Multi-Vehicle Crash Incident (100% Accuracy)", defaultClass: "Sedan" },
  // 6. Accident / Stopped Vehicle (Standalone)
  { type: "stopped_vehicle_accident", severity: "critical", label: "Accident / Stopped Vehicle (Lane Blockage)", defaultClass: "Truck" },
  { type: "stopped_vehicle_accident", severity: "critical", label: "Accident / Immobilized Auto-Rickshaw", defaultClass: "Auto Rickshaw" },

  // Supplementary Urban Events
  { type: "illegal_parking", severity: "high", label: "Illegal Parking / Red Zone Obstruction", defaultClass: "Auto Rickshaw" },
  { type: "speed_violation", severity: "high", label: "Speed Limit Exceeded (78 km/h)", defaultClass: "SUV" },
  { type: "crowd_density", severity: "critical", label: "Surge Crowd Density (> 85 pax/100m²)", defaultClass: "Crowd Group" },
];

export const EVENT_LABELS: Record<AlertEventType, string> = {
  helmet_violation: "⛑️ Helmet Violation",
  triple_riding: "🏍️ Triple Riding (3 Pax)",
  wrong_way: "⛔ Wrong-Way Driving",
  vehicle_stopped: "🛑 Vehicle Stopped / Hazard",
  accident_collision: "💥 Accident / Collision (100%)",
  stopped_vehicle_accident: "🚨 Accident / Stopped Vehicle",
  illegal_parking: "🛑 Illegal Parking / Red Zone",
  speed_violation: "⚡ Speed Limit Exceeded",
  crowd_density: "👥 Surge Crowd Density",
  loitering: "⏳ Loitering Detected",
  restricted_perimeter: "🚧 Perimeter Breach",
};

export function getEventLabel(type: AlertEventType): string {
  return EVENT_LABELS[type] || "Incident Detected";
}

const VEHICLE_MAKES = ["Tata Harrier", "Mahindra XUV700", "Hyundai Creta", "Maruti Brezza", "Toyota Innova", "Honda City", "Royal Enfield 350", "Bajaj Pulsar"];
const AUTO_MAKES = ["Bajaj RE Compact Auto", "Piaggio Ape City Plus", "Mahindra Treo Electric Auto", "Atul Shakti Auto", "Bajaj Maxima Z"];
const VEHICLE_COLORS = ["Pearl White", "Obsidian Black", "Metallic Silver", "Deep Crimson", "Navy Blue", "Charcoal Grey"];
const AUTO_COLORS = ["Yellow & Black (Classic)", "Green & Yellow (CNG Clean)", "Electric Cyan (EV Fleet)", "Yellow & Green"];

function generateVehicleMetadata(objectClass: AlertVehicleDetails["objectClass"]): AlertVehicleDetails {
  if (objectClass === "Pedestrian" || objectClass === "Crowd Group") {
    return {
      objectClass,
      durationInZoneSec: randomInt(45, 360),
    };
  }

  if (objectClass === "Auto Rickshaw") {
    const autoSeries = randomItem(["TA", "TB", "TC", "TD", "TE", "TR"]);
    const autoNum = randomInt(1000, 9999);
    return {
      objectClass: "Auto Rickshaw",
      make: randomItem(AUTO_MAKES),
      color: randomItem(AUTO_COLORS),
      licensePlate: `MH 31 ${autoSeries} ${autoNum}`,
      plateConfidence: 0.98,
      speedKmph: randomInt(24, 48),
      durationInZoneSec: randomInt(20, 300),
    };
  }

  const series = randomItem(["CB", "EK", "DW", "AX", "BN", "FR"]);
  const plateNum = randomInt(1000, 9999);
  const plate = `MH 31 ${series} ${plateNum}`;

  return {
    objectClass,
    make: randomItem(VEHICLE_MAKES),
    color: randomItem(VEHICLE_COLORS),
    licensePlate: plate,
    plateConfidence: parseFloat((0.88 + Math.random() * 0.11).toFixed(2)),
    speedKmph: objectClass === "Motorcycle" ? randomInt(48, 76) : randomInt(28, 85),
    durationInZoneSec: randomInt(35, 420),
  };
}

// Tactical SVG Snapshot Data URI
export function generateSnapshotUri(
  eventType: AlertEventType,
  camName: string,
  trackId: string,
  plate?: string
): string {
  const accent =
    eventType === "wrong_way" || eventType === "crowd_density"
      ? "%23FF3B30" // Critical Red
      : eventType === "speed_violation" || eventType === "illegal_parking"
      ? "%23FF9500" // Warning Amber
      : "%23007AFF"; // Info Blue

  const label = getEventLabel(eventType).toUpperCase();

  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'><defs><linearGradient id='scan' x1='0%25' y1='0%25' x2='0%25' y2='100%25'><stop offset='0%25' stop-color='rgba(0,0,0,0.8)'/><stop offset='50%25' stop-color='rgba(15,23,42,0.95)'/><stop offset='100%25' stop-color='rgba(0,0,0,0.85)'/></linearGradient><pattern id='tgrid' width='30' height='30' patternUnits='userSpaceOnUse'><path d='M 30 0 L 0 0 0 30' fill='none' stroke='rgba(255,255,255,0.04)' stroke-width='1'/></pattern></defs><rect width='640' height='360' fill='url(%23scan)'/><rect width='640' height='360' fill='url(%23tgrid)'/><path d='M20 50 L20 20 L50 20 M590 20 L620 20 L620 50 M20 310 L20 340 L50 340 M590 340 L620 340 L620 310' fill='none' stroke='${accent}' stroke-width='2' opacity='0.7'/><polygon points='80,110 240,90 270,270 60,290' fill='rgba(0,122,255,0.08)' stroke='%23007AFF' stroke-width='1.5' stroke-dasharray='6 4'/><text x='90' y='130' fill='%23007AFF' font-size='10' font-family='monospace' letter-spacing='1'>ZONE: GEOFENCE-A1</text><rect x='300' y='120' width='190' height='130' fill='rgba(255,59,48,0.1)' stroke='${accent}' stroke-width='2' rx='2'/><path d='M300 120 L315 120 M300 120 L300 135 M490 120 L475 120 M490 120 L490 135 M300 250 L315 250 M300 250 L300 235 M490 250 L475 250 M490 250 L490 235' fill='none' stroke='white' stroke-width='2'/><rect x='300' y='96' width='190' height='22' fill='${accent}' rx='2'/><text x='308' y='111' fill='white' font-size='10' font-family='monospace' font-weight='bold'>[${trackId}] ${label.slice(0, 18)}</text>${plate ? `<rect x='330' y='215' width='130' height='22' fill='white' rx='2'/><text x='395' y='230' fill='black' font-size='10' font-family='monospace' font-weight='bold' text-anchor='middle'>${plate}</text>` : ""}<circle cx='395' cy='185' r='6' fill='none' stroke='${accent}' stroke-width='1.5'/><line x1='380' y1='185' x2='410' y2='185' stroke='${accent}' stroke-width='1'/><line x1='395' y1='170' x2='395' y2='200' stroke='${accent}' stroke-width='1'/><rect x='20' y='320' width='600' height='24' fill='rgba(0,0,0,0.6)' rx='4'/><text x='30' y='336' fill='white' font-size='9' font-family='monospace' opacity='0.8'>CAM: ${camName.toUpperCase()} | AI NODE-04 [YOLOv11x-OPTICAL] | LAT: 21.1458 LNG: 79.0882</text></svg>`;
}

export function generateAlert(overrides?: Partial<Alert>): Alert {
  alertCounter++;
  const cam = randomItem(cameras);
  const cfg = randomItem(EVENT_CONFIGS);
  const now = new Date();
  const detectedOffset = randomInt(0, 90); // seconds ago
  const detectedAt = new Date(now.getTime() - detectedOffset * 1000);
  const latencyMs = Math.random() < 0.12
    ? randomInt(22000, 31000) // occasional network lag
    : randomInt(2100, 11000); // optimal pipeline speed
  const deliveredAt = new Date(detectedAt.getTime() + latencyMs);
  const trackId = `TRK-${randomInt(200, 999)}`;
  const vehicle = generateVehicleMetadata(cfg.defaultClass);

  return {
    id: `ALT-${alertCounter}`,
    cameraId: cam.id,
    cameraName: cam.name,
    eventType: cfg.type,
    severity: cfg.severity,
    confidence: parseFloat((0.78 + Math.random() * 0.21).toFixed(2)),
    trackId,
    detectedAt: detectedAt.toISOString(),
    deliveredAt: deliveredAt.toISOString(),
    latencyMs,
    status: "new",
    vehicleDetails: vehicle,
    snapshotUrl: generateSnapshotUri(cfg.type, cam.name, trackId, vehicle.licensePlate),
    ...overrides,
  };
}

// ── Initial Seed Alerts ────────────────────────────────────────────────
export function generateSeedAlerts(count = 28): Alert[] {
  const alerts: Alert[] = [];
  const now = Date.now();
  const statuses: AlertStatus[] = [
    "new", "new", "acknowledged", "resolved", "resolved",
    "acknowledged", "false_positive", "resolved", "new"
  ];

  for (let i = 0; i < count; i++) {
    const hoursAgo = Math.random() * 18;
    const detectedAt = new Date(now - hoursAgo * 3600000);
    const latencyMs = Math.random() < 0.1
      ? randomInt(24000, 31000)
      : randomInt(2200, 12000);
    const deliveredAt = new Date(detectedAt.getTime() + latencyMs);
    const status = randomItem(statuses);
    const cam = randomItem(cameras);
    const cfg = randomItem(EVENT_CONFIGS);
    const trackId = `TRK-${randomInt(100, 999)}`;
    const vehicle = generateVehicleMetadata(cfg.defaultClass);

    alertCounter++;
    alerts.push({
      id: `ALT-${alertCounter}`,
      cameraId: cam.id,
      cameraName: cam.name,
      eventType: cfg.type,
      severity: cfg.severity,
      confidence: parseFloat((0.76 + Math.random() * 0.22).toFixed(2)),
      trackId,
      detectedAt: detectedAt.toISOString(),
      deliveredAt: deliveredAt.toISOString(),
      latencyMs,
      status,
      vehicleDetails: vehicle,
      snapshotUrl: generateSnapshotUri(cfg.type, cam.name, trackId, vehicle.licensePlate),
      acknowledgedBy: status !== "new" ? randomItem(["Operator-Desk-1", "Chief-Dispatcher", "Automated-Triage"]) : undefined,
      resolvedAt: status === "resolved" ? new Date(deliveredAt.getTime() + randomInt(20000, 240000)).toISOString() : undefined,
      dispatchedUnit: status === "acknowledged" && Math.random() > 0.5 ? {
        unitName: "PCR Van #08 (Sitabuldi)",
        unitType: "PCR Patrol",
        dispatchedAt: new Date(deliveredAt.getTime() + 15000).toISOString(),
        etaMinutes: randomInt(2, 6),
        status: "en_route",
      } : undefined,
    });
  }

  return alerts.sort((a, b) =>
    new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );
}

// ── Daily Stats ──────────────────────────────────────────────────────
export function generateDailyStats(): DailyStat[] {
  const stats: DailyStat[] = [];
  const now = new Date();

  for (let d = 0; d < 7; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    for (const cam of cameras) {
      const hourly: { hour: number; count: number }[] = [];
      let total = 0;
      for (let h = 0; h < 24; h++) {
        const count = h >= 7 && h <= 21 ? randomInt(1, 9) : randomInt(0, 2);
        hourly.push({ hour: h, count });
        total += count;
      }

      stats.push({
        cameraId: cam.id,
        date: dateStr,
        totalAlerts: total,
        avgLatencyMs: randomInt(3500, 14000),
        falsePositiveRate: parseFloat((Math.random() * 0.14).toFixed(3)),
        resolvedRate: parseFloat((0.82 + Math.random() * 0.16).toFixed(3)),
        hourlyBreakdown: hourly,
      });
    }
  }

  return stats;
}
