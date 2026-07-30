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
  WINDOW_MIN_WIDTH: 320,
  WINDOW_MIN_HEIGHT: 220,
};

export const THEME_PRESETS = [
  {
    id: "neon",
    label: "Frost",
    accent: "#e4f0f6",
    purple: "#ffffff",
    green: "#03DAC6",
    swatch: "#e4f0f6",
  },
  {
    id: "rose",
    label: "Rosé",
    accent: "#F4A0B5",
    purple: "#D4A0E0",
    green: "#F0C0A0",
    swatch: "#F4A0B5",
  },
  {
    id: "forest",
    label: "Forest",
    accent: "#4CAF50",
    purple: "#81C784",
    green: "#A5D6A7",
    swatch: "#4CAF50",
  },
  {
    id: "amber",
    label: "Amber",
    accent: "#FFB300",
    purple: "#FFD54F",
    green: "#FFCA28",
    swatch: "#FFB300",
  },
  {
    id: "mono",
    label: "Mono",
    accent: "#AAAAAA",
    purple: "#888888",
    green: "#CCCCCC",
    swatch: "#AAAAAA",
  },
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
};

export const GITHUB_PROFILES = [
  { username: "swid-yera", prefix: "gh-main" },
  { username: "Antawq", prefix: "gh-alt" },
];

export const SETTINGS_KEY = "desktop-settings";
