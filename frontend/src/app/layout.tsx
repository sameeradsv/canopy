import type { Metadata, Viewport } from "next";
import { Spectral, JetBrains_Mono } from "next/font/google";
import { CanopyAuthProvider } from "@/components/CanopyAuthProvider";
import { ShellLayout } from "@/components/ShellLayout";
import { ThemeInit } from "@/components/ThemeInit";
import "./globals.css";

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});


const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "optional",
});

const APP_NAME = "Canopy";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "A quiet planner for people & intent",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png",  sizes: "192x192", type: "image/png" },
    ],
    apple: [
      // iOS uses the largest matching size; 180×180 covers all current devices
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icons/favicon-32x32.png",
  },
};

export const viewport: Viewport = {
  // Matches --bg of the paper theme so the browser chrome blends in
  themeColor: "#f5efe2",
  width: "device-width",
  initialScale: 1,
  // "cover" lets the app extend behind the notch / home indicator on iOS
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="paper"
      data-fontmode="editorial"
      data-density="regular"
      className={`${spectral.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeInit />
        <CanopyAuthProvider>
          <ShellLayout>{children}</ShellLayout>
        </CanopyAuthProvider>
      </body>
    </html>
  );
}
