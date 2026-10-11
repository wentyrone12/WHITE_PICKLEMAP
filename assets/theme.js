/* PickleFinder theme engine (classic script, loaded in <head> on every page so there is no flash).
   Handles: Light / Dark / System, accent color presets + custom color, text color styles, glow background. */
(() => {
  const KEYS = {
    theme: "picklefinderTheme",
    accent: "picklefinderAccent",
    text: "picklefinderTextStyle",
    glow: "picklefinderGlow"
  };

  // Accent presets. "emerald" = the original PickleFinder look (no overrides applied).
  const ACCENTS = [
    { id: "emerald", name: "Emerald", hex: "#35e2b0" },
    { id: "ocean",   name: "Ocean",   hex: "#3d8cff" },
    { id: "violet",  name: "Violet",  hex: "#a06bff" },
    { id: "pink",    name: "Bubblegum", hex: "#ff5fa8" },
    { id: "sunset",  name: "Sunset",  hex: "#ff7a3d" },
    { id: "gold",    name: "Gold",    hex: "#ffc02e" },
    { id: "lime",    name: "Pickle Lime", hex: "#9be11d" },
    { id: "aqua",    name: "Aqua",    hex: "#19d3e6" },
    { id: "crimson", name: "Crimson", hex: "#ff4d63" }
  ];

  const TEXT_STYLES = [
    { id: "classic",  name: "Classic",   hint: "Original text colors" },
    { id: "tinted",   name: "Tinted",    hint: "Text picks up your accent" },
    { id: "vivid",    name: "Vivid",     hint: "Colorful gradient headings" },
    { id: "contrast", name: "High contrast", hint: "Sharper, easier to read" }
  ];

  const VARS = ["--accent", "--accent-2", "--accent-glow", "--accent-rgb", "--accent-ink", "--text", "--soft", "--muted"];
  const root = document.documentElement;
  const read = (k, fallback = null) => { try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };
  const remove = (k) => { try { localStorage.removeItem(k); } catch { /* storage blocked */ } };

  // The auth pages only have a dark layout, so they always render dark (accent + text style still apply).
  const isAppPage = /dashboard\.html$/i.test(location.pathname);

  /* ---------- color helpers ---------- */
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  function hexToRgb(hex) {
    const h = String(hex).replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
  }
  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: Math.round(255 * f(0)), g: Math.round(255 * f(8)), b: Math.round(255 * f(4)) };
  }
  const rgbToHex = ({ r, g, b }) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  const hsl = (h, s, l) => rgbToHex(hslToRgb(h, s, l));
  function luminance({ r, g, b }) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  /* ---------- state ---------- */
  function getState() {
    const accent = read(KEYS.accent, "emerald");
    const text = read(KEYS.text, "classic");
    return {
      theme: read(KEYS.theme, "system"),
      accent,
      text: TEXT_STYLES.some((t) => t.id === text) ? text : "classic",
      glow: read(KEYS.glow, "on") !== "off"
    };
  }

  function resolvedMode(theme) {
    if (!isAppPage) return "dark";
    if (theme === "light" || theme === "dark") return theme;
    return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark";
  }

  function accentHex(accentValue) {
    const preset = ACCENTS.find((a) => a.id === accentValue);
    if (preset) return preset.hex;
    return /^#[0-9a-f]{6}$/i.test(accentValue) ? accentValue : ACCENTS[0].hex;
  }

  function apply() {
    const st = getState();
    const mode = resolvedMode(st.theme);
    root.dataset.theme = mode;
    root.dataset.textstyle = st.text;
    root.dataset.glow = st.glow ? "on" : "off";
    root.dataset.accent = ACCENTS.some((a) => a.id === st.accent) ? st.accent : "custom";

    // Clear previous overrides, then set what is needed.
    VARS.forEach((v) => root.style.removeProperty(v));

    const isDefaultLook = st.accent === "emerald" && st.text === "classic";
    let accentBase = null;
    if (!isDefaultLook) accentBase = hexToRgb(accentHex(st.accent));
    const { h, s } = rgbToHsl(hexToRgb(accentHex(st.accent)));
    const dark = mode === "dark";

    if (st.accent !== "emerald") {
      const sat = clamp(s, 62, 100);
      const main = dark ? hsl(h, sat, clamp(rgbToHsl(accentBase).l, 56, 66)) : hsl(h, clamp(sat, 60, 92), clamp(rgbToHsl(accentBase).l - 8, 30, 40));
      const second = dark ? hsl(h, sat, 48) : hsl(h, clamp(sat, 60, 92), 29);
      const rgb = hexToRgb(main);
      root.style.setProperty("--accent", main);
      root.style.setProperty("--accent-2", second);
      root.style.setProperty("--accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      root.style.setProperty("--accent-glow", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${dark ? 0.18 : 0.14})`);
      root.style.setProperty("--accent-ink", luminance(rgb) > 0.38 ? "#07130f" : "#ffffff");
    }

    // Text color styles
    const hue = Math.round(h);
    if (st.text === "tinted" || st.text === "vivid") {
      root.style.setProperty("--text", dark ? hsl(hue, 45, 94) : hsl(hue, 40, 11));
      root.style.setProperty("--soft", dark ? hsl(hue, 30, 80) : hsl(hue, 28, 24));
      root.style.setProperty("--muted", dark ? hsl(hue, 20, 64) : hsl(hue, 16, 37));
    } else if (st.text === "contrast") {
      root.style.setProperty("--text", dark ? "#ffffff" : "#050a08");
      root.style.setProperty("--soft", dark ? "#e6eeec" : "#1c2623");
      root.style.setProperty("--muted", dark ? "#b9c5c2" : "#3b4743");
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0c1117" : "#f4f7f6");
    root.style.colorScheme = dark ? "dark" : "light";
    window.dispatchEvent(new CustomEvent("picklefinder:theme", { detail: { ...st, mode } }));
  }

  /* ---------- public API ---------- */
  window.PickleTheme = {
    ACCENTS, TEXT_STYLES,
    get state() { return getState(); },
    setTheme(theme) {
      const valid = ["light", "dark", "system"].includes(theme) ? theme : "system";
      if (valid === "system") remove(KEYS.theme); else write(KEYS.theme, valid);
      apply();
    },
    setAccent(value) {
      if (value === "emerald") remove(KEYS.accent); else write(KEYS.accent, value);
      apply();
    },
    setTextStyle(id) {
      if (id === "classic") remove(KEYS.text); else write(KEYS.text, id);
      apply();
    },
    setGlow(on) {
      if (on) remove(KEYS.glow); else write(KEYS.glow, "off");
      apply();
    },
    reset() {
      Object.values(KEYS).forEach(remove);
      apply();
    },
    accentColor() { return getComputedStyle(root).getPropertyValue("--accent").trim() || "#35e2b0"; },
    apply
  };

  apply();
  window.matchMedia?.("(prefers-color-scheme: light)")?.addEventListener?.("change", () => {
    if (!read(KEYS.theme)) apply();
  });
})();
