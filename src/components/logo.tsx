"use client";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
  showText?: boolean;
}

export function Logo({ size = "md", showText = true }: LogoProps) {
  const iconSize = size === "sm" ? 32 : size === "lg" ? 44 : 36;
  const textSize = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";

  return (
    <div className="flex items-center gap-2.5 group cursor-pointer select-none">
      {/* Aesthetic AI Vision Iris Emblem */}
      <div
        className="relative flex items-center justify-center rounded-xl bg-gradient-to-tr from-[#4F46E5] via-[#6366F1] to-[#9333EA] p-[1.5px] shadow-md shadow-indigo-500/20 group-hover:scale-105 group-hover:shadow-indigo-500/35 transition-all duration-300"
        style={{ width: iconSize, height: iconSize }}
      >
        <div className="w-full h-full rounded-[10px] bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center relative overflow-hidden">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.4),transparent_70%)]" />

          {/* Aesthetic Modern Iris / Aperture Optical Geometry SVG */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-[60%] h-[60%] text-white relative z-10 drop-shadow-xs"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Outer Lens Ring */}
            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" />
            {/* Inner Focal Iris Aperture Blades */}
            <path
              d="M12 3a9 9 0 0 1 7.79 4.5L13.5 12"
              stroke="white"
              strokeWidth="1.6"
              strokeOpacity="0.9"
            />
            <path
              d="M21 12a9 9 0 0 1-4.5 7.79L12 13.5"
              stroke="white"
              strokeWidth="1.6"
              strokeOpacity="0.9"
            />
            <path
              d="M12 21a9 9 0 0 1-7.79-4.5L10.5 12"
              stroke="white"
              strokeWidth="1.6"
              strokeOpacity="0.9"
            />
            <path
              d="M3 12a9 9 0 0 1 4.5-7.79L12 10.5"
              stroke="white"
              strokeWidth="1.6"
              strokeOpacity="0.9"
            />
            {/* Center Glowing Optical Pupil */}
            <circle cx="12" cy="12" r="2.8" fill="#FFFFFF" />
            <circle cx="12" cy="12" r="1.2" fill="#4F46E5" />
          </svg>
        </div>
      </div>

      {/* Aesthetic Clean Typography */}
      {showText && (
        <div className="flex items-baseline tracking-tight">
          <span className={`${textSize} font-extrabold text-[#0F172A]`}>Nex</span>
          <span
            className={`${textSize} font-black bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] bg-clip-text text-transparent ml-0.5`}
          >
            Watch
          </span>
        </div>
      )}
    </div>
  );
}
