"use client";

/**
 * Overall job progress. Turns gold at 100% — the one place besides a completed
 * stage badge where the destination colour is earned.
 */
export function ProgressRing({ progress, size = 160 }: { progress: number; size?: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const done = pct >= 100;

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${pct}% complete`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-ink-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={
            "transition-[stroke-dashoffset,stroke] duration-700 ease-settle " +
            (done ? "stroke-gold-400" : "stroke-signal-500")
          }
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span
          className={
            "text-4xl font-semibold tabular-nums tracking-tight " +
            (done ? "text-gold-300" : "text-ink-50")
          }
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}
