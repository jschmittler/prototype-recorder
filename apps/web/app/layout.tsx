import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frodotyping — small prototypes, long journeys",
  description:
    "Turn a prototype link into a narrated walkthrough your stakeholders will actually watch.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
