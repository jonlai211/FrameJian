// Language toggle — single page, no routing. Persists the choice in
// localStorage so the visitor's preference sticks across reloads.

const STORAGE_KEY = "fj.lang";
const html = document.documentElement;
const toggle = document.getElementById("lang-toggle");

const setLang = (lang) => {
  const next = lang === "en" ? "en" : "zh";
  html.setAttribute("data-lang", next);
  html.setAttribute("lang", next === "en" ? "en" : "zh");
  try { localStorage.setItem(STORAGE_KEY, next); } catch {}
};

// Boot: prefer saved choice, otherwise honor the browser language.
const saved = (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })();
if (saved === "en" || saved === "zh") {
  setLang(saved);
} else {
  const isZh = /^zh/i.test(navigator.language || "");
  setLang(isZh ? "zh" : "en");
}

toggle.addEventListener("click", () => {
  const current = html.getAttribute("data-lang");
  setLang(current === "en" ? "zh" : "en");
});
