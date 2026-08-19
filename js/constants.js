export const CONSTANTS = {
  PADDING: 20,
  UPDATE_INTERVAL: 1000,
  DRAG_THRESHOLD: 5,
  DESKTOP_PADDING_TOP: 50,
  DESKTOP_PADDING_BOTTOM: 80,
  OPEN_DEBOUNCE_MS: 100,
  BRIGHTNESS_MAX: 70,
  WINDOW_DRAG_MARGIN: 80,
  WINDOW_CASCADE_STEP: 32,
  WINDOW_OPEN_SEAL_MS: 450,
  WINDOW_MIN_WIDTH: 320,
  WINDOW_MIN_HEIGHT: 220,
  FULLSCREEN_HINT_MS: 2500,
  SWIPE_THRESHOLD: 40,
};

// Палитры тем живут в colors_and_type.css под :root[data-theme]. Здесь только
// список и подписи: JS переключает атрибут и ни одного цвета не знает.
export const THEME_PRESETS = [
  { id: "neon", label: "Frost" },
  { id: "rose", label: "Rosé" },
  { id: "forest", label: "Forest" },
  { id: "amber", label: "Amber" },
  { id: "mono", label: "Mono" },
];

// Оформление и акцентная тема независимы: любой акцент работает и в тёмном,
// и в светлом. Светлую палитру подобрал Stitch (дизайн-система Daylight Desktop).
export const APPEARANCES = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
];

export const WINDOW_TITLES = {
  projects: "Projects",
  explorer: "File Explorer",
  markdown: "Markdown",
  photos: "Photos",
  text: "Resume",
  calls: "Recent Calls",
  github: "GitHub",
  telegram: "Telegram",
  instagram: "Instagram",
  notes: "Notes",
  trash: "Trash",
  settings: "Settings",
  console: "Terminal",
  browser: "Browser",
  player: "Now Playing",
};

export const GITHUB_PROFILES = [
  { username: "swid-yera", prefix: "gh-main" },
  { username: "Antawq", prefix: "gh-alt" },
];

// Дежурный плейлист рабочего стола. Пустая строка выключает фоновую музыку.
export const MUSIC_PLAYLIST = "PLFvZSmmKGRGk";

export const SETTINGS_KEY = "desktop-settings";
