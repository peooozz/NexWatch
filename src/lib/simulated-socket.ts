"use client";

import { useEffect, useRef } from "react";
import { useDashboardStore } from "./store";
import { generateAlert } from "./mock-data";
import { Alert } from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/alerts";

/**
 * Real-Time Alert Socket Hook — Connects to the FastAPI WebSocket server (/ws/alerts).
 * Pushes incoming real-time alerts into the Zustand store.
 * Automatically falls back to simulated edge generation if the backend is offline.
 */
export function useSimulatedSocket() {
  const addAlert = useDashboardStore((s) => s.addAlert);
  const wsRef = useRef<WebSocket | null>(null);
  const isFallbackRunning = useRef(false);
  const fallbackTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout | null = null;
    let shouldReconnect = true;

    function startFallbackLoop() {
      if (isFallbackRunning.current) return;
      isFallbackRunning.current = true;

      function scheduleNext() {
        const delay = 8000 + Math.random() * 7000;
        fallbackTimer.current = setTimeout(() => {
          if (isFallbackRunning.current) {
            addAlert(generateAlert());
            scheduleNext();
          }
        }, delay);
      }
      scheduleNext();
    }

    function stopFallbackLoop() {
      isFallbackRunning.current = false;
      if (fallbackTimer.current) {
        clearTimeout(fallbackTimer.current);
        fallbackTimer.current = null;
      }
    }

    function connectWebSocket() {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[CityEye WS] Connected to live FastAPI detection stream:", WS_URL);
          // Stop fallback loop since live stream is connected
          stopFallbackLoop();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && (data.id || data.event_type || data.eventType)) {
              // Normalize alert payload if backend sends snake_case
              const normalizedAlert: Alert = {
                id: data.id || `ALT-${Math.floor(100 + Math.random() * 900)}`,
                cameraId: data.camera_id || data.cameraId || "CAM-001",
                cameraName: data.camera_name || data.cameraName || "Wardha Road Junction",
                eventType: data.event_type || data.eventType || "illegal_parking",
                severity: data.severity || "high",
                confidence: data.confidence || 0.92,
                trackId: data.track_id || data.trackId || `TRK-${Math.floor(100 + Math.random() * 900)}`,
                detectedAt: data.detected_at || data.detectedAt || new Date().toISOString(),
                deliveredAt: new Date().toISOString(),
                latencyMs: data.latency_ms || data.latencyMs || Math.floor(12 + Math.random() * 10),
                status: (data.status as any) || "new",
                snapshotUrl: data.snapshot_url || data.snapshotUrl || "/snapshots/sample.jpg",
                vehicleDetails: data.vehicle_details || data.vehicleDetails || {
                  objectClass: data.object_class || "Sedan",
                  licensePlate: data.license_plate || "MH-31-EQ-4892",
                  plateConfidence: 0.94,
                  speedKmph: data.speed_kmph || 54,
                },
                notes: data.notes || undefined,
              };

              addAlert(normalizedAlert);
            }
          } catch (err) {
            console.error("[CityEye WS] Failed to parse alert message:", err);
          }
        };

        ws.onerror = () => {
          // Fallback to local simulated data generator
          startFallbackLoop();
        };

        ws.onclose = () => {
          startFallbackLoop();
          if (shouldReconnect) {
            reconnectTimer = setTimeout(connectWebSocket, 5000);
          }
        };
      } catch (e) {
        startFallbackLoop();
        if (shouldReconnect) {
          reconnectTimer = setTimeout(connectWebSocket, 5000);
        }
      }
    }

    connectWebSocket();

    return () => {
      shouldReconnect = false;
      stopFallbackLoop();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [addAlert]);
}
