// Accent + text color themes. Works on every page (login, signup, dashboard).
(() => {
  const ACCENT_KEY = "picklefinderAccent", TEXT_KEY = "picklefinderText", CUSTOM_KEY = "picklefinderCustomAccent";
  const root = document.documentElement;
  const hexToRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return [53, 226, 176]; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const lum = ([r, g, b]) => [r, g, b].map((v) => (v /= 255) <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
  const mix = (c, t, p) => c.map((v, i) => Math.round(v + (t[i] - v) * p));
  const css = (c) => `rgb(${c.join(",")})`;
  function customAccent(hex, light) {
    let c = hexToRgb(hex);
    if (light) while (lum(c) > .2 && c.some((v) => v > 20)) c = mix(c, [0, 0, 0], .12);
    else while (lum(c) < .3 && c.some((v) => v < 235)) c = mix(c, [255, 255, 255], .12);
    return { main: css(c), second: css(mix(c, light ? [0, 0, 0] : [0, 0, 0], .22)), rgb: c.join(", ") };
  }
  function apply() {
    const light = root.dataset.theme === "light";
    const accent = localStorage.getItem(ACCENT_KEY) || "mint";
    const text = localStorage.getItem(TEXT_KEY) || "default";
    ["--accent", "--accent-2", "--accent-rgb", "--accent-glow"].forEach((p) => root.style.removeProperty(p));
    if (accent === "custom") {
      const a = customAccent(localStorage.getItem(CUSTOM_KEY) || "#35e2b0", light);
      root.style.setProperty("--accent", a.main); root.style.setProperty("--accent-2", a.second);
      root.style.setProperty("--accent-rgb", a.rgb); root.style.setProperty("--accent-glow", `rgba(${a.rgb}, ${light ? .12 : .16})`);
    }
    root.dataset.accent = accent; root.dataset.text = text;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && accent !== "mint") meta.setAttribute("content", light ? "#f4f7f6" : "#0c1117");
    document.querySelectorAll("[data-accent-choice]").forEach((b) => b.classList.toggle("active", b.dataset.accentChoice === accent));
    document.querySelectorAll("[data-text-choice]").forEach((b) => b.classList.toggle("active", b.dataset.textChoice === text));
    const name = document.querySelector("#accentName"); if (name) name.textContent = accent === "custom" ? "Custom" : (document.querySelector(`[data-accent-choice="${accent}"]`)?.title || "Mint");
    const tname = document.querySelector("#textName"); if (tname) tname.textContent = document.querySelector(`[data-text-choice="${text}"] b`)?.textContent || "Default";
    const sw = document.querySelector("#accentCurrent"); if (sw) sw.style.background = getComputedStyle(root).getPropertyValue("--accent");
  }
  window.PFAppearance = {
    apply,
    setAccent(k) { localStorage.setItem(ACCENT_KEY, k); apply(); },
    setCustom(hex) { localStorage.setItem(CUSTOM_KEY, hex); localStorage.setItem(ACCENT_KEY, "custom"); apply(); },
    setText(k) { localStorage.setItem(TEXT_KEY, k); apply(); },
    reset() { [ACCENT_KEY, TEXT_KEY, CUSTOM_KEY].forEach((k) => localStorage.removeItem(k)); apply(); }
  };
  apply();
})();
