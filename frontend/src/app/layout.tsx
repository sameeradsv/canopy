import type { Metadata, Viewport } from "next";
import { Spectral, Manrope, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/AuthContext";
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

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const APP_NAME = "Canopy";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "A quiet planner for people & intent",
  appleWebApp: { capable: true, statusBarStyle: "default", title: APP_NAME },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f5efe2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="paper"
      data-fontmode="editorial"
      data-density="regular"
      className={`${spectral.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeInit />
        <AuthProvider
          apiBase={process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? ""}
          tokenKey="canopy_auth_token"
        >
          <ShellLayout>{children}</ShellLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
