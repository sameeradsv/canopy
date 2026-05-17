import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canopy: {
          bg: "#0f1412",
          surface: "#1a221e",
          border: "#2a3530",
          muted: "#8a9a92",
          text: "#e8ede9",
          accent: "#6b9b7a",
          accentDim: "#4a6d54",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
