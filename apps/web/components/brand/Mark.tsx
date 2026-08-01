/**
 * Frodotyping mark: a route that starts small, turns once, and ends at a gold
 * destination. The two horizontal strokes read as an "F" at small sizes; the
 * gold endpoint is the only warm colour and carries the product's single
 * meaning — work that has arrived somewhere.
 *
 * Legible from 16px (favicon) to presentation size.
 */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="8.25" className="fill-ink-850 stroke-ink-600" strokeWidth="1.5" />
      {/* The route: up the spine, out along two waypoint arms. */}
      <path
        d="M10.5 23V12.5A2.5 2.5 0 0 1 13 10h8"
        className="stroke-ink-200"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.5 16.5h6.5" className="stroke-ink-300" strokeWidth="2" strokeLinecap="round" />
      {/* Destination. */}
      <circle cx="21.5" cy="10" r="2.75" className="fill-gold-400" />
      <circle cx="21.5" cy="10" r="5.5" className="stroke-gold-400/25" strokeWidth="1.25" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight text-ink-50 ${className}`}>
      Frodo<span className="text-ink-300">typing</span>
    </span>
  );
}
