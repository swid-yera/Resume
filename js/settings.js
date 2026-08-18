import {
  CONSTANTS,
  THEME_PRESETS,
  APPEARANCES,
  SETTINGS_KEY,
} from "./constants.js";
import { escapeHtml, isLocalStorageAvailable } from "./utils.js";

// --- Persistence ---

const DEFAULTS = { brightness: 0, theme: "neon", appearance: "dark" };

export function loadSettings() {
  if (!isLocalStorageAvailable()) return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    // Настройки из старой версии не знают про appearance - дополняем дефолтом.
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...DEFAULTS };
}

export function saveSettings(settings) {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

// --- Apply ---

export function applyBrightness(value) {
  const overlay = document.getElementById("brightness-overlay");
  if (!overlay) return;
  overlay.style.opacity = value / 100;
}

// Тема и оформление живут в атрибутах на <html>: токены переопределяются
// целиком в colors_and_type.css, а JS не знает ни одного цвета.
export function applyTheme(themeId) {
  if (!THEME_PRESETS.some((t) => t.id === themeId)) return;
  document.documentElement.dataset.theme = themeId;
}

export function applyAppearance(id) {
  if (!APPEARANCES.some((a) => a.id === id)) return;
  document.documentElement.dataset.appearance = id;
}

export const currentSettings = loadSettings();

// Единственный вход для смены темы. Меню и окно настроек зовут его оба, иначе
// тема, выбранная в меню, оставила бы свотчи в настройках на прежней.
export function setTheme(themeId) {
  if (!THEME_PRESETS.some((t) => t.id === themeId)) return;
  currentSettings.theme = themeId;
  applyTheme(themeId);
  saveSettings(currentSettings);
  syncSwatches();
}

export function setAppearance(id) {
  if (!APPEARANCES.some((a) => a.id === id)) return;
  currentSettings.appearance = id;
  applyAppearance(id);
  saveSettings(currentSettings);
  syncAppearanceButtons();
}

function syncSwatches() {
  const swatches = document.querySelectorAll("#theme-swatches .settings-swatch");
  swatches.forEach((s) =>
    s.classList.toggle("is-active", s.dataset.id === currentSettings.theme),
  );
}

function syncAppearanceButtons() {
  const buttons = document.querySelectorAll("#appearance-switch .settings-seg");
  buttons.forEach((b) =>
    b.classList.toggle("is-active", b.dataset.id === currentSettings.appearance),
  );
}

// --- Settings window ---

export function renderSettings(windowContent) {
  windowContent.innerHTML = `
            <div class="settings-window">
                <div class="settings-section">
                    <span class="settings-label">Appearance</span>
                    <div class="settings-seg-group" id="appearance-switch">
                        ${APPEARANCES.map(
                          (a) => `
                            <button class="settings-seg${a.id === currentSettings.appearance ? " is-active" : ""}"
                                    data-id="${a.id}">${escapeHtml(a.label)}</button>
                        `,
                        ).join("")}
                    </div>
                </div>
                <div class="settings-section">
                    <label class="settings-label" for="brightness-slider">Brightness</label>
                    <input type="range" id="brightness-slider" class="settings-slider" min="0" max="${CONSTANTS.BRIGHTNESS_MAX}" value="${currentSettings.brightness}">
                </div>
                <div class="settings-section">
                    <span class="settings-label">Theme</span>
                    <div class="settings-swatches" id="theme-swatches">
                        ${THEME_PRESETS.map(
                          (t) => `
                            <button class="settings-swatch${t.id === currentSettings.theme ? " is-active" : ""}"
                                    data-id="${t.id}" data-theme-swatch="${t.id}"
                                    aria-label="${escapeHtml(t.label)}"></button>
                        `,
                        ).join("")}
                    </div>
                </div>
            </div>
        `;

  windowContent
    .querySelector("#brightness-slider")
    .addEventListener("input", function () {
      currentSettings.brightness = parseInt(this.value, 10);
      applyBrightness(currentSettings.brightness);
      saveSettings(currentSettings);
    });

  windowContent
    .querySelector("#theme-swatches")
    .addEventListener("click", (e) => {
      const swatch = e.target.closest(".settings-swatch");
      if (!swatch) return;
      setTheme(swatch.dataset.id);
    });

  windowContent
    .querySelector("#appearance-switch")
    .addEventListener("click", (e) => {
      const seg = e.target.closest(".settings-seg");
      if (!seg) return;
      setAppearance(seg.dataset.id);
    });
}
