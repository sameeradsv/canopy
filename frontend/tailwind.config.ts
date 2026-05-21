import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canopy: {
          bg:        "var(--bg)",
          surface:   "var(--panel)",
          border:    "var(--line)",
          muted:     "var(--fg-mute)",
          text:      "var(--fg)",
          accent:    "var(--accent)",
          accentDim: "var(--accent-soft)",
        },
      },
      fontFamily: {
        sans:  ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono:  ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
