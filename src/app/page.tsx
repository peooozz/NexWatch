"use client";

import Link from "next/link";
import {
  Shield,
  AlertTriangle,
  Zap,
  Activity,
  Radio,
  ArrowRight,
  Eye,
  Camera,
  Layers,
  ChevronRight,
  Play,
  CheckCircle2,
  Cpu,
  MapPin,
  Flame,
  Volume2,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function LandingPage() {
  const [activeCam, setActiveCam] = useState("CAM-004");
  const [isPlaying, setIsPlaying] = useState(true);

  const CAMERAS = [
    { id: "CAM-001", name: "Wardha Road 4-Way Junction", type: "Optical Flow / Reverse Lane", video: "/videos/cam1_clean.mp4" },
    { id: "CAM-002", name: "Sitabuldi Metro Interchange", type: "Triple Riding & Helmet AI", video: "/videos/cam2_clean.mp4" },
    { id: "CAM-003", name: "Dharampeth Traffic Circle", type: "100% Collision Vector", video: "/videos/cam3_clean.mp4" },
    { id: "CAM-004", name: "Ambazari Lake Promenade", type: "Pedestrian Overcrowding Surge", video: "/videos/cam4_clean.mp4" },
  ];

  const currentCam = CAMERAS.find((c) => c.id === activeCam) || CAMERAS[3];

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#F8FAFC] text-[#0F172A] selection:bg-[#6366F1]/20 selection:text-[#4338CA]">
      {/* ══ Background Transparent Video Feed (/videos/cam4_clean.mp4) ═════════ */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-25 filter blur-[0.5px] scale-105"
        >
          <source src="/videos/cam4_clean.mp4" type="video/mp4" />
        </video>
        {/* Soft Ambient Light Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAFC]/90 via-[#F8FAFC]/75 to-[#F8FAFC]/95 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.12),rgba(255,255,255,0))]" />
      </div>

      {/* ══ Content Layer ══════════════════════════════════════════════════ */}
      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* ══ Floating Glassmorphic Top Navigation ══════════════════════════ */}
        <header className="sticky top-4 z-50 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <nav className="glass-navbar rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between transition-all duration-300">
            
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Shield size={18} className="text-white" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold tracking-tight text-[#0F172A]">City</span>
                <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent">Eye</span>
              </div>
            </Link>

            {/* Center Pill Nav Menu */}
            <div className="hidden md:flex items-center gap-1 text-xs font-medium text-[#475569] bg-white/60 p-1 rounded-full border border-white/80 shadow-xs">
              <Link href="/dashboard" className="px-3.5 py-1.5 rounded-full text-[#0F172A] font-semibold bg-white shadow-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                Live Feeds
              </Link>
              <Link href="/dashboard/events" className="px-3.5 py-1.5 rounded-full hover:text-[#0F172A] hover:bg-white/80 transition-all">
                Incident Alerts
              </Link>
              <Link href="/dashboard/analytics" className="px-3.5 py-1.5 rounded-full hover:text-[#0F172A] hover:bg-white/80 transition-all">
                Analytics
              </Link>
              <Link href="/dashboard" className="px-3.5 py-1.5 rounded-full hover:text-[#0F172A] hover:bg-white/80 transition-all">
                Junctions
              </Link>
              <Link href="/dashboard/admin" className="px-3.5 py-1.5 rounded-full hover:text-[#0F172A] hover:bg-white/80 transition-all">
                System Health
              </Link>
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-2.5">
              <Link
                href="/dashboard"
                className="cta-purple-gradient text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-1.5 group cursor-pointer"
              >
                <span>Live Console</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-mono-data font-semibold">
                <Activity size={12} className="text-emerald-600 animate-pulse" />
                <span>Online</span>
              </div>
            </div>
          </nav>
        </header>

        {/* ══ Hero Section ══════════════════════════════════════════════════ */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-16 max-w-5xl mx-auto text-center">
          
          {/* Top Hackathon / System Tag */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-indigo-100 shadow-xs text-xs font-medium text-[#475569] mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-[#6366F1]" />
            <span className="font-bold text-[#6366F1] uppercase text-[10px] tracking-wider">Hackathon Prototype</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono-data text-[11px] text-[#334155]">Nagpur Municipal AI CCTV Network</span>
          </motion.div>

          {/* Main Title with Floating Badges */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#0F172A] max-w-4xl leading-[1.12] sm:leading-[1.12] mb-6"
          >
            AI-Assisted CCTV{" "}
            <span className="inline-flex items-center align-middle mx-1 p-1 sm:p-1.5 rounded-xl bg-white border border-rose-200 shadow-sm text-rose-500 hover:rotate-6 transition-transform">
              <Shield size={24} className="text-rose-500" />
            </span>{" "}
            Video Monitoring &{" "}
            <span className="inline-flex items-center align-middle mx-1 p-1 sm:p-1.5 rounded-xl bg-white border border-amber-200 shadow-sm text-amber-500 hover:-rotate-6 transition-transform">
              <AlertTriangle size={24} className="text-amber-500" />
            </span>{" "}
            Violation Detection
          </motion.h1>

          {/* Subtitle Description */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg text-[#475569] max-w-3xl font-normal leading-relaxed mb-10"
          >
            High-precision real-time computer vision for municipal CCTV networks. Automatically tracks{" "}
            <strong className="text-[#0F172A] font-semibold">Without-Helmet Riders</strong>, detects{" "}
            <strong className="text-[#0F172A] font-semibold">Wrong-Side Vehicles</strong> with directional optical flow, and triggers instant e-Challans under 2 seconds.
          </motion.p>

          {/* Primary & Secondary Dual CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto justify-center mb-16"
          >
            <Link
              href="/dashboard"
              className="cta-purple-gradient w-full sm:w-auto px-7 py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 group cursor-pointer shadow-lg"
            >
              <span>Launch Live AI Feeds</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/dashboard/events"
              className="w-full sm:w-auto px-6 py-3.5 rounded-full font-semibold text-sm bg-white/80 hover:bg-white text-[#1E293B] border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Shield size={16} className="text-rose-500" />
              <span>No-Helmet & Wrong-Side Triage</span>
            </Link>
          </motion.div>

          {/* ══ 3 Feature Cards (Matching Screenshot) ══════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-left"
          >
            {/* Card 1 */}
            <div className="glass-card rounded-2xl p-5 border border-white/80 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0">
                <Shield size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#0F172A]">No-Helmet AI</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  YOLOv11 head-region detection on two-wheelers with multi-rider helmet parsing.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="glass-card rounded-2xl p-5 border border-white/80 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#0F172A]">Wrong-Side Vector</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Optical flow trajectory & reverse-lane angle detection under 1.2 seconds.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="glass-card rounded-2xl p-5 border border-white/80 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
                <Zap size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#0F172A]">Sub-40ms Latency</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  TensorRT FP16 acceleration with automated Twilio WhatsApp SOS broadcast.
                </p>
              </div>
            </div>
          </motion.div>

          {/* ══ Live Interactive Video Preview Section ═════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="w-full mt-12 glass-panel rounded-3xl p-4 sm:p-6 border border-white/80 shadow-xl"
          >
            {/* Feed Selector Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-[#EF4444] animate-live-pulse" />
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Live Municipal Node Feeds (Nagpur Smart City)
                </span>
              </div>
              
              <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-mono-data">
                {CAMERAS.map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => setActiveCam(cam.id)}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                      activeCam === cam.id
                        ? "bg-[#6366F1] text-white font-bold shadow-xs"
                        : "bg-white/80 text-[#64748B] hover:text-[#0F172A] hover:bg-white border border-slate-200"
                    }`}
                  >
                    {cam.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Video Container */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-inner border border-slate-200 group">
              <video
                key={currentCam.video}
                src={currentCam.video}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Overlay HUD Tags */}
              <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white font-mono-data text-xs border border-white/20 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{currentCam.name}</span>
                <span className="text-slate-400">·</span>
                <span className="text-indigo-300 font-bold">{currentCam.type}</span>
              </div>

              <div className="absolute bottom-3 right-3">
                <Link
                  href="/dashboard"
                  className="cta-purple-gradient text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg"
                >
                  <Eye size={13} />
                  <span>Inspect in Command Center</span>
                </Link>
              </div>
            </div>
          </motion.div>

        </main>

        {/* ══ Footer ═══════════════════════════════════════════════════════ */}
        <footer className="w-full py-6 text-center text-xs text-[#64748B] border-t border-slate-200/60 bg-white/40 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono-data">
            <div>© 2026 CityEye · Nagpur Municipal Corporation (NMC) Traffic AI</div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-600 font-semibold">● 4 RTSP Edge Nodes Active</span>
              <span>·</span>
              <span>Twilio WhatsApp SOS Connected</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
