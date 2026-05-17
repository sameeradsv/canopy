import type { Metadata } from "next";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canopy",
  description: "Local-first contextual memory",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="relative min-h-screen font-sans">
        <AmbientBackground />
        <Nav />
        <main className="relative mx-auto max-w-3xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
