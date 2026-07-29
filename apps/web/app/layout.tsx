import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prototype Walkthrough",
  description: "Turn a prototype into a polished walkthrough video.",
};

const GITHUB = "https://github.com/jschmittler/figma-walkthrough";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-black/5 bg-white/70 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-grid place-items-center w-7 h-7 rounded-lg bg-brand-600 text-white text-sm">▶</span>
              Prototype Walkthrough
            </Link>
            <nav className="flex items-center gap-6 text-sm text-gray-600">
              <Link href="/create" className="hover:text-gray-900">Create</Link>
              <a href={GITHUB} target="_blank" rel="noreferrer" className="hover:text-gray-900">GitHub</a>
              <Link
                href="/create"
                className="rounded-lg bg-brand-600 px-3.5 py-2 text-white hover:bg-brand-700 transition-colors"
              >
                Create walkthrough
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-black/5 mt-16">
          <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-gray-500 flex flex-wrap gap-x-8 gap-y-2 justify-between">
            <span>© {new Date().getFullYear()} Prototype Walkthrough · MIT</span>
            <div className="flex gap-6">
              <a href={GITHUB} target="_blank" rel="noreferrer" className="hover:text-gray-800">Repository</a>
              <a href={`${GITHUB}/blob/main/PLAYBOOK.md`} target="_blank" rel="noreferrer" className="hover:text-gray-800">Playbook</a>
              <a href={`${GITHUB}/issues`} target="_blank" rel="noreferrer" className="hover:text-gray-800">Support</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
