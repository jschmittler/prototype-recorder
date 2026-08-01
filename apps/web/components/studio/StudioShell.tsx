"use client";

import Link from "next/link";

/**
 * Page container for the working routes. The application background, header and
 * footer come from AppShell — this only supplies the breadcrumb and measure.
 */
export function StudioShell({
  children,
  breadcrumb,
}: {
  children: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}) {
  return (
    <div>
      {breadcrumb && breadcrumb.length > 0 && (
        <div className="border-b border-ink-800 px-5 py-2.5 sm:px-6">
          <nav aria-label="Breadcrumb" className="mx-auto flex max-w-[1400px] items-center gap-2 text-xs text-ink-400">
            <Link href="/" className="transition-colors duration-fast hover:text-ink-200">
              Home
            </Link>
            {breadcrumb.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                <span className="text-ink-600" aria-hidden>
                  /
                </span>
                {item.href ? (
                  <Link href={item.href} className="transition-colors duration-fast hover:text-ink-200">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-ink-200">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
      )}
      <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-6">{children}</div>
    </div>
  );
}
