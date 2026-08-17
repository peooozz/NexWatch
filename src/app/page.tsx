"use client";

import Link from "next/link";
import {
  Shield,
  AlertTriangle,
  Zap,
  Activity,
  ArrowRight,
  Eye,
  Radio,
} from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#F8FAFC] text-[#0F172A] selection:bg-[#6366F1]/20 selection:text-[#4338CA] flex flex-col justify-between">
      {/* ══ Crisp Transparent Ambient Video Background (/videos/cam4_clean.mp4) ══ */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-60 scale-100 transition-opacity duration-700"
        >
          <source src="/videos/cam4_clean.mp4" type="video/mp4" />
        </video>
        {/* Sleek Frosted Glass Gradient Overlay - Clear & Transparent Aesthetic */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAFC]/80 via-[#F8FAFC]/50 to-[#F8FAFC]/85 backdrop-blur-[1.5px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_20%,rgba(99,102,241,0.09),rgba(255,255,255,0))]" />
      </div>

      {/* ══ Content Layer ══════════════════════════════════════════════════ */}
      <div className="relative z-10 flex flex-col min-h-screen justify-between">
        
        {/* ══ Floating Glassmorphic Top Navigation ══════════════════════════ */}
        <header className="sticky top-4 z-50 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <nav className="glass-navbar rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between transition-all duration-300 shadow-md">
            
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] flex items-center justify-center text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
                <Shield size={18} className="text-white" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold tracking-tight text-[#0F172A]">City</span>
                <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent">Eye</span>
              </div>
            </Link>

            {/* Center Pill Nav Menu */}
            <div className="hidden md:flex items-center gap-1 text-xs font-medium text-[#475569] bg-white/75 backdrop-blur-md p-1 rounded-full border border-white/90 shadow-xs">
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
                className="cta-purple-gradient text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-1.5 group cursor-pointer shadow-md"
              >
                <span>Live Console</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50/90 backdrop-blur-md border border-emerald-200/80 text-emerald-700 text-xs font-mono-data font-semibold shadow-xs">
                <Activity size={12} className="text-emerald-600 animate-pulse" />
                <span>Online</span>
              </div>
            </div>
          </nav>
        </header>

        {/* ══ Hero Section ══════════════════════════════════════════════════ */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-12 max-w-5xl mx-auto text-center">
          
          {/* Top Hackathon / System Tag */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/85 backdrop-blur-md border border-indigo-100 shadow-sm text-xs font-medium text-[#475569] mb-8"
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
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#0F172A] max-w-4xl leading-[1.12] sm:leading-[1.12] mb-6 drop-shadow-xs"
          >
            AI-Assisted CCTV{" "}
            <span className="inline-flex items-center align-middle mx-1 p-1 sm:p-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-rose-200 shadow-sm text-rose-500 hover:rotate-6 transition-transform">
              <Shield size={24} className="text-rose-500" />
            </span>{" "}
            Video Monitoring &{" "}
            <span className="inline-flex items-center align-middle mx-1 p-1 sm:p-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-amber-200 shadow-sm text-amber-500 hover:-rotate-6 transition-transform">
              <AlertTriangle size={24} className="text-amber-500" />
            </span>{" "}
            Violation Detection
          </motion.h1>

          {/* Subtitle Description */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg text-[#334155] max-w-3xl font-medium leading-relaxed mb-10 bg-white/40 backdrop-blur-xs py-2 px-4 rounded-2xl border border-white/60"
          >
            High-precision real-time computer vision for municipal CCTV networks. Automatically tracks{" "}
            <strong className="text-[#0F172A] font-bold">Without-Helmet Riders</strong>, detects{" "}
            <strong className="text-[#0F172A] font-bold">Wrong-Side Vehicles</strong> with directional optical flow, and triggers instant e-Challans under 2 seconds.
          </motion.p>

          {/* Primary & Secondary Dual CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto justify-center mb-14"
          >
            <Link
              href="/dashboard"
              className="cta-purple-gradient w-full sm:w-auto px-7 py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 group cursor-pointer shadow-xl shadow-indigo-500/25"
            >
              <span>Launch Live AI Feeds</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/dashboard/events"
              className="w-full sm:w-auto px-6 py-3.5 rounded-full font-semibold text-sm bg-white/90 hover:bg-white text-[#1E293B] border border-slate-200/80 shadow-md backdrop-blur-md hover:border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Shield size={16} className="text-rose-500" />
              <span>No-Helmet & Wrong-Side Triage</span>
            </Link>
          </motion.div>

          {/* ══ 3 Frosted Glass Feature Cards ══════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-left"
          >
            {/* Card 1 */}
            <div className="glass-card rounded-2xl p-5 border border-white/90 bg-white/85 backdrop-blur-xl shadow-md flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0 shadow-2xs">
                <Shield size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#0F172A]">No-Helmet AI</h3>
                <p className="text-xs text-[#475569] leading-relaxed font-medium">
                  YOLOv11 head-region detection on two-wheelers with multi-rider helmet parsing.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="glass-card rounded-2xl p-5 border border-white/90 bg-white/85 backdrop-blur-xl shadow-md flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 flex-shrink-0 shadow-2xs">
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#0F172A]">Wrong-Side Vector</h3>
                <p className="text-xs text-[#475569] leading-relaxed font-medium">
                  Optical flow trajectory & reverse-lane angle detection under 1.2 seconds.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="glass-card rounded-2xl p-5 border border-white/90 bg-white/85 backdrop-blur-xl shadow-md flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0 shadow-2xs">
                <Zap size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#0F172A]">Sub-40ms Latency</h3>
                <p className="text-xs text-[#475569] leading-relaxed font-medium">
                  TensorRT FP16 acceleration with automated Twilio WhatsApp SOS broadcast.
                </p>
              </div>
            </div>
          </motion.div>

        </main>

        {/* ══ Minimal Frosted Footer ════════════════════════════════════════ */}
        <footer className="w-full py-5 text-center text-xs text-[#475569] border-t border-white/60 bg-white/65 backdrop-blur-md">
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
