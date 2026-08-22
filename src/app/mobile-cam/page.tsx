"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Camera as CameraIcon,
  Video,
  Radio,
  RotateCcw,
  Sliders,
  Sparkles,
  Wifi,
  Shield,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Activity,
  Zap,
} from "lucide-react";

export default function MobileCamPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sendLoopTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Form & Config State
  const [camId, setCamId] = useState("CAM-MOBILE-01");
  const [authKey, setAuthKey] = useState("nexwatch-mobile-key-alpha");
  const [customHost, setCustomHost] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Stream & Status State
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("STANDBY — READY TO TRANSMIT");
  const [framesSent, setFramesSent] = useState(0);
  const [achievedFps, setAchievedFps] = useState(0);
  const [rttLatency, setRttLatency] = useState<number | null>(null);
  const [reconnects, setReconnects] = useState(0);
  const [resolution, setResolution] = useState("640x480");

  const isAwaitingAck = useRef(false);
  const lastAckTime = useRef(Date.now());
  const frameTimes = useRef<number[]>([]);
  const reconnectCountRef = useRef(0);
  const isStreamingRef = useRef(false);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Read URL Search Parameters on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlCamId = params.get("cam_id");
      const urlKey = params.get("key");
      const urlHost = params.get("host");

      if (urlCamId) setCamId(urlCamId);
      if (urlKey) setAuthKey(urlKey);
      if (urlHost) setCustomHost(urlHost);
    }
  }, []);

  const getWebSocketUrl = () => {
    const cid = encodeURIComponent(camId.trim() || "CAM-MOBILE-01");
    const k = encodeURIComponent(authKey.trim() || "nexwatch-mobile-key-alpha");

    let host = customHost.trim();
    if (!host) {
      if (typeof window !== "undefined") {
        if (window.location.host.includes("-frontend.onrender.com")) {
          host = `wss://${window.location.host.replace("-frontend.onrender.com", "-backend.onrender.com")}`;
        } else if (window.location.port === "3000") {
          const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          host = `${protocol}//${window.location.hostname}:8000`;
        } else {
          const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          host = `${protocol}//${window.location.host}`;
        }
      } else {
        host = "ws://127.0.0.1:8000";
      }
    } else if (!host.startsWith("ws://") && !host.startsWith("wss://")) {
      host = (window.location.protocol === "https:" ? "wss://" : "ws://") + host;
    }
    return `${host}/ws/stream?cam_id=${cid}&key=${k}`;
  };

  const startCamera = async () => {
    if (videoRef.current?.srcObject) {
      const s = videoRef.current.srcObject as MediaStream;
      s.getTracks().forEach((t) => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15, max: 20 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings ? track.getSettings() : {};
      if (settings.width && settings.height) {
        setResolution(`${settings.width}x${settings.height}`);
      }
      return true;
    } catch (err: any) {
      console.error("Camera access error:", err);
      setStatus("error");
      setStatusMsg("CAMERA PERMISSION DENIED OR UNAVAILABLE");
      alert(`Camera Access Error: ${err.message || err}\nPlease allow camera permissions in browser settings.`);
      return false;
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const s = videoRef.current.srcObject as MediaStream;
      s.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startFrameLoop = () => {
    stopFrameLoop();

    sendLoopTimerRef.current = setInterval(() => {
      const ws = wsRef.current;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (!video || video.paused || video.ended) return;
      if (!canvas) return;

      if (isAwaitingAck.current) {
        if (Date.now() - lastAckTime.current > 3000) {
          isAwaitingAck.current = false;
        } else {
          return;
        }
      }

      try {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        isAwaitingAck.current = true;
        lastAckTime.current = Date.now();

        canvas.toBlob(
          (blob) => {
            if (blob && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(blob);
              setFramesSent((prev) => prev + 1);

              const now = Date.now();
              frameTimes.current.push(now);
              if (frameTimes.current.length > 20) frameTimes.current.shift();
              if (frameTimes.current.length > 2) {
                const duration =
                  (frameTimes.current[frameTimes.current.length - 1] - frameTimes.current[0]) / 1000;
                if (duration > 0) {
                  setAchievedFps(Number(((frameTimes.current.length - 1) / duration).toFixed(1)));
                }
              }
            } else {
              isAwaitingAck.current = false;
            }
          },
          "image/jpeg",
          0.65
        );
      } catch (e) {
        console.error("Frame capture error:", e);
        isAwaitingAck.current = false;
      }
    }, 100); // 10 FPS
  };

  const stopFrameLoop = () => {
    if (sendLoopTimerRef.current) {
      clearInterval(sendLoopTimerRef.current);
      sendLoopTimerRef.current = null;
    }
    isAwaitingAck.current = false;
  };

  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = getWebSocketUrl();
    setStatus("connecting");
    setStatusMsg(
      `CONNECTING OUTBOUND (${reconnectCountRef.current > 0 ? "RETRY #" + reconnectCountRef.current : "PUSH"})...`
    );

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = "blob";

      ws.onopen = () => {
        reconnectCountRef.current = 0;
        isAwaitingAck.current = false;
        setStatus("live");
        setStatusMsg("🟢 LIVE STREAMING OUTBOUND TO CLOUD");
        startFrameLoop();
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.status === "ack") {
            isAwaitingAck.current = false;
            setRttLatency(Date.now() - lastAckTime.current);
            if (data.fps) {
              setAchievedFps(data.fps);
            }
          }
        } catch (e) {}
      };

      ws.onclose = (event) => {
        stopFrameLoop();

        if (!isStreamingRef.current) {
          setStatus("idle");
          setStatusMsg("STANDBY — READY TO TRANSMIT");
          return;
        }

        if (event.code === 4001) {
          setStatus("error");
          setStatusMsg("AUTHENTICATION FAILED (INVALID KEY / ID)");
          stopSession();
          alert("Authentication Failed: Invalid Camera ID or Secret Key.");
          return;
        }

        reconnectCountRef.current += 1;
        setReconnects(reconnectCountRef.current);
        const delay = Math.min(15000, Math.pow(2, reconnectCountRef.current) * 1000);
        setStatus("connecting");
        setStatusMsg(`CONNECTION DROPPED. RECONNECTING IN ${Math.round(delay / 1000)}s...`);

        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (isStreamingRef.current) connectWebSocket();
        }, delay);
      };
    } catch (e) {
      console.error("WS error:", e);
    }
  };

  const startSession = async () => {
    const ok = await startCamera();
    if (!ok) return;

    setIsStreaming(true);
    connectWebSocket();
  };

  const stopSession = () => {
    setIsStreaming(false);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    stopFrameLoop();
    stopCamera();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus("idle");
    setStatusMsg("STANDBY — READY TO TRANSMIT");
  };

  const switchCamera = async () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (isStreaming) {
      await startCamera();
    }
  };

  return (
    <div className="min-h-screen bg-[#06090E] text-slate-100 flex flex-col font-sans select-none">
      {/* Header */}
      <header className="p-3 bg-[#0D131F] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
          <div>
            <h1 className="text-sm font-bold tracking-wide">NexWatch Mobile Node</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">
              Push-Based Edge Video Ingestion
            </p>
          </div>
        </div>
        <div className="bg-black/60 border border-slate-700 px-2 py-1 rounded text-xs font-mono text-cyan-300 font-bold">
          {camId}
        </div>
      </header>

      {/* High-Visibility Status Banner */}
      <div
        className={`px-4 py-3 text-center text-xs sm:text-sm font-bold tracking-wide transition-all flex items-center justify-center gap-2 ${
          status === "live"
            ? "bg-emerald-950/90 text-emerald-300 border-b-2 border-emerald-500 shadow-lg shadow-emerald-950/50"
            : status === "connecting"
            ? "bg-amber-950/90 text-amber-300 border-b border-amber-600"
            : status === "error"
            ? "bg-rose-950/90 text-rose-300 border-b border-rose-600"
            : "bg-slate-900 text-slate-400 border-b border-slate-800"
        }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            status === "live"
              ? "bg-emerald-400 animate-ping"
              : status === "connecting"
              ? "bg-amber-400 animate-pulse"
              : status === "error"
              ? "bg-rose-400"
              : "bg-slate-500"
          }`}
        />
        <span>{statusMsg}</span>
      </div>

      {/* Viewfinder Area */}
      <div className="relative flex-1 min-h-[280px] max-h-[50vh] bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className="w-full h-full object-cover"
        />

        {!isStreaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-black/60 backdrop-blur-xs">
            <CameraIcon className="w-12 h-12 mb-3 text-cyan-400/80" />
            <p className="text-sm font-medium">
              Tap <strong className="text-cyan-300">START TRANSMITTING</strong> below to open camera and stream outbound
            </p>
          </div>
        )}

        <div className="absolute top-2 left-2 right-2 flex justify-between pointer-events-none">
          <div className="bg-black/75 backdrop-blur px-2 py-1 rounded text-[11px] font-mono text-cyan-400 border border-white/10">
            {achievedFps.toFixed(1)} FPS
          </div>
          <div className="bg-black/75 backdrop-blur px-2 py-1 rounded text-[11px] font-mono text-slate-300 border border-white/10">
            {resolution}
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="p-4 bg-[#0D131F] border-t border-slate-800 flex flex-col gap-3">
        {/* Telemetry Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-black/40 border border-slate-800 p-2 rounded text-center">
            <div className="text-base font-bold font-mono text-cyan-400">{framesSent}</div>
            <div className="text-[9px] text-slate-400 uppercase">Frames Sent</div>
          </div>
          <div className="bg-black/40 border border-slate-800 p-2 rounded text-center">
            <div className="text-base font-bold font-mono text-cyan-400">
              {rttLatency !== null ? `${rttLatency} ms` : "-- ms"}
            </div>
            <div className="text-[9px] text-slate-400 uppercase">RTT Latency</div>
          </div>
          <div className="bg-black/40 border border-slate-800 p-2 rounded text-center">
            <div className="text-base font-bold font-mono text-cyan-400">{reconnects}</div>
            <div className="text-[9px] text-slate-400 uppercase">Reconnects</div>
          </div>
        </div>

        {/* Primary Action Button */}
        {!isStreaming ? (
          <button
            onClick={startSession}
            className="w-full py-4 rounded-xl text-base font-bold bg-cyan-400 hover:bg-cyan-300 text-black shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Radio className="w-5 h-5" />
            START TRANSMITTING
          </button>
        ) : (
          <button
            onClick={stopSession}
            className="w-full py-4 rounded-xl text-base font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="w-3 h-3 bg-white rounded-xs" />
            STOP TRANSMITTING
          </button>
        )}

        {/* Secondary Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={switchCamera}
            className="py-2.5 px-3 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Switch Camera
          </button>
          <button
            onClick={() => window.location.reload()}
            className="py-2.5 px-3 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Reset State
          </button>
        </div>

        {/* Credentials & Configuration Accordion */}
        <div className="bg-black/20 border border-slate-800 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="w-full px-3 py-2.5 text-left text-xs font-semibold text-slate-400 hover:text-slate-200 flex justify-between items-center cursor-pointer"
          >
            <span>⚙️ Camera & Authentication Credentials</span>
            {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showConfig && (
            <div className="p-3 border-t border-slate-800 flex flex-col gap-2.5 bg-black/40 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Camera ID:</label>
                <input
                  type="text"
                  value={camId}
                  onChange={(e) => setCamId(e.target.value)}
                  disabled={isStreaming}
                  className="w-full bg-[#06090E] border border-slate-700 rounded p-2 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Secret Key:</label>
                <input
                  type="password"
                  value={authKey}
                  onChange={(e) => setAuthKey(e.target.value)}
                  disabled={isStreaming}
                  className="w-full bg-[#06090E] border border-slate-700 rounded p-2 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Custom WebSocket Host (Optional):
                </label>
                <input
                  type="text"
                  value={customHost}
                  onChange={(e) => setCustomHost(e.target.value)}
                  disabled={isStreaming}
                  placeholder="Auto (defaults to current domain)"
                  className="w-full bg-[#06090E] border border-slate-700 rounded p-2 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-hidden placeholder:text-slate-600"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden offscreen capture canvas */}
      <canvas ref={canvasRef} width={640} height={480} className="hidden" />
    </div>
  );
}
