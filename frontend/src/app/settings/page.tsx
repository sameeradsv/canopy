"use client";

import { useEffect, useState } from "react";

type Theme    = "paper" | "slate" | "ink";
type FontMode = "editorial" | "grotesk" | "typewriter";
type Density  = "compact" | "regular" | "comfy";

function apply(attr: string, value: string, key: string) {
  document.documentElement.setAttribute(attr, value);
  localStorage.setItem(key, value);
}

export default function SettingsPage() {
  const [theme,    setTheme]    = useState<Theme>("paper");
  const [fontMode, setFontMode] = useState<FontMode>("editorial");
  const [density,  setDensity]  = useState<Density>("regular");

  useEffect(() => {
    setTheme((localStorage.getItem("canopy.theme")    ?? "paper")     as Theme);
    setFontMode((localStorage.getItem("canopy.fontMode") ?? "editorial") as FontMode);
    setDensity((localStorage.getItem("canopy.density") ?? "regular")  as Density);
  }, []);

  function onTheme(v: Theme) {
    setTheme(v);
    apply("data-theme", v, "canopy.theme");
  }
  function onFontMode(v: FontMode) {
    setFontMode(v);
    apply("data-fontmode", v, "canopy.fontMode");
  }
  function onDensity(v: Density) {
    setDensity(v);
    apply("data-density", v, "canopy.density");
  }

  return (
    <div style={{ maxWidth: 560, paddingTop: 8 }}>
      <div className="kicker" style={{ marginBottom: 24 }}>Appearance</div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12, fontWeight: 500, fontSize: 13 }}>Theme</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["paper", "slate", "ink"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => onTheme(t)}
              className={`btn ${theme === t ? "primary" : "ghost"}`}
              style={{ textTransform: "capitalize" }}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="faint small" style={{ marginTop: 8, marginBottom: 0 }}>
          {theme === "paper" && "Warm cream — easy on the eyes in daylight."}
          {theme === "slate" && "Cool neutral — balanced for mixed lighting."}
          {theme === "ink"   && "Dark background — comfortable at night."}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12, fontWeight: 500, fontSize: 13 }}>Font style</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["editorial", "grotesk", "typewriter"] as FontMode[]).map((f) => (
            <button
              key={f}
              onClick={() => onFontMode(f)}
              className={`btn ${fontMode === f ? "primary" : "ghost"}`}
              style={{ textTransform: "capitalize" }}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="faint small" style={{ marginTop: 8, marginBottom: 0 }}>
          {fontMode === "editorial"   && "Spectral serif — readable and considered."}
          {fontMode === "grotesk"     && "Manrope sans — clean and modern."}
          {fontMode === "typewriter"  && "JetBrains Mono — structured and technical."}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 12, fontWeight: 500, fontSize: 13 }}>Density</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["compact", "regular", "comfy"] as Density[]).map((d) => (
            <button
              key={d}
              onClick={() => onDensity(d)}
              className={`btn ${density === d ? "primary" : "ghost"}`}
              style={{ textTransform: "capitalize" }}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="faint small" style={{ marginTop: 8, marginBottom: 0 }}>
          {density === "compact" && "Tighter rows — more content visible at once."}
          {density === "regular" && "Balanced spacing — default."}
          {density === "comfy"   && "More breathing room — relaxed reading."}
        </p>
      </div>

      <div className="kicker" style={{ marginBottom: 24 }}>Keyboard shortcuts</div>
      <div className="card">
        {[
          ["⌘K", "Open search"],
          ["1", "Dashboard"],
          ["2", "Capture"],
          ["3", "Timeline"],
          ["4", "People"],
        ].map(([key, desc]) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "6px 0",
              borderBottom: "0.5px solid var(--line-soft)",
            }}
          >
            <span className="shot" style={{ minWidth: 36, textAlign: "center" }}>{key}</span>
            <span className="faint small">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
