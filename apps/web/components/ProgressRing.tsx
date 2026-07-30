"use client";

export function ProgressRing({
  progress,
  size = 160,
  variant = "light",
}: {
  progress: number;
  size?: number;
  variant?: "light" | "studio";
}) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const isStudio = variant === "studio";

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={isStudio ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={isStudio ? "#6366f1" : "url(#progressGradient)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
        {!isStudio && (
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>
          </defs>
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span
          className={
            "text-4xl font-semibold tabular-nums tracking-tight " +
            (isStudio ? "text-white" : "text-gray-900")
          }
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}
