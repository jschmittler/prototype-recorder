"use client";

import Link from "next/link";

export function StudioShell({
  children,
  breadcrumb,
}: {
  children: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-studio-950 text-studio-100">
      {breadcrumb && breadcrumb.length > 0 && (
        <div className="border-b border-studio-800/80 px-4 sm:px-6 py-2.5">
          <nav className="mx-auto max-w-[1400px] flex items-center gap-2 text-xs text-studio-400">
            <Link href="/" className="hover:text-studio-200 transition-colors">
              Home
            </Link>
            {breadcrumb.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                <span className="text-studio-600">/</span>
                {item.href ? (
                  <Link href={item.href} className="hover:text-studio-200 transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-studio-300">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
      )}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6">{children}</div>
    </div>
  );
}
