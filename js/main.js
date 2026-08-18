import {
  currentSettings,
  applyBrightness,
  applyTheme,
  applyAppearance,
  setTheme,
  setAppearance,
} from "./settings.js";
import { setupDateTime, teardownDateTime } from "./datetime.js";
import { setupFileDragging, setupDockItems, renderDesktopFiles } from "./desktop.js";
import { setupFileDrop } from "./drop.js";
import {
  closeTopWindow,
  closeWindow,
  minimizeWindow,
  zoomWindow,
  onActiveWindowChange,
  activeWindowType,
} from "./window-manager.js";
import { WINDOW_TITLES } from "./constants.js";
import { folderContents, openWindows } from "./state.js";
import { openWindow } from "./open-window.js";
import { setupContextMenu } from "./context-menu.js";
import { setupMenuBar, setActiveApp } from "./menu-bar.js";
import { iconOrder, assignSlots } from "./desktop-sort.js";
import { mountProjects } from "./apps/projects-data.js";
import { setupRouter } from "./router.js";

document.addEventListener(
  "error",
  (e) => {
    const t = e.target;
    if (t && t.tagName === "IMG" && t.getAttribute("src")) t.style.display = "none";
  },
  true,
);

function setupStartupOverlay() {
  const startupOverlay = document.getElementById("startup-overlay");
  if (!startupOverlay) return;

  startupOverlay.addEventListener(
    "animationend",
    () => {
      startupOverlay.remove();
    },
    { once: true },
  );
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeTopWindow();
});

window.addEventListener("beforeunload", () => {
  teardownDateTime();
});

// --- Menu actions ---

// Всё, что умеют делать меню, собрано здесь: и контекстное меню, и menu bar
// получают один и тот же набор действий, чтобы не разъезжались.
const actions = {
  openWindow,
  setTheme,
  setAppearance,
  openExternal: (url) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  },
  copyLink: (url) => {
    navigator.clipboard?.writeText(url).catch(() => {});
  },
  closeWindow: (type) => {
    const win = openWindows.get(type);
    if (win) closeWindow(win);
  },
  closeTop: closeTopWindow,
  minimizeWindow: (type) => minimizeWindow(openWindows.get(type)),
  zoomWindow: (type) => zoomWindow(openWindows.get(type)),
  minimizeTop: () => minimizeWindow(openWindows.get(activeWindowType())),
  zoomTop: () => zoomWindow(openWindows.get(activeWindowType())),
  focusWindow: (type) => openWindow(type),
  sortIcons: (mode) => sortDesktopIcons(mode),
  openPath: (path) => openWindow("explorer", path),
  openDoc: (path) => openWindow("markdown", path),
  getInfo: () => openWindow("text"),
  clearTerminal: () => openWindow("console"),
  terminalHelp: () => openWindow("console"),
};

function sortDesktopIcons(mode) {
  const desktop = document.getElementById("desktop");
  if (!desktop) return;

  const items = [...desktop.querySelectorAll(".file")].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      el,
      name: el.querySelector("span").textContent.trim(),
      isFolder: el.classList.contains("folder"),
      left: Math.round(r.left),
      top: Math.round(r.top),
    };
  });
  if (!items.length) return;

  // Раздаём уже занятые места заново: сами координаты приходят из CSS и
  // зависят от раскладки, поэтому не зашиваем их здесь.
  const slots = items.map(({ left, top }) => ({ left, top }));
  for (const item of assignSlots(iconOrder(items, mode), slots)) {
    item.el.style.left = `${item.left}px`;
    item.el.style.top = `${item.top}px`;
  }
}

function menuCtx() {
  const active = activeWindowType();
  return {
    activeTheme: currentSettings.theme,
    activeAppearance: currentSettings.appearance,
    openTypes: [...openWindows.keys()],
    windows: [...openWindows.values()].map((win) => ({
      type: win.type,
      title: WINDOW_TITLES[win.type] || win.type,
      isTop: win.type === active,
    })),
    actions,
  };
}

// --- Boot ---

function init() {
  setupStartupOverlay();
  // Проекты кладутся в C:\Users\antawkay\Documents\Projects до первого окна:
  // и Проводник, и терминал должны видеть их сразу.
  mountProjects();
  applyBrightness(currentSettings.brightness);
  applyAppearance(currentSettings.appearance);
  applyTheme(currentSettings.theme);
  setupDateTime();
  setupFileDragging();
  // Файлы, брошенные на стол в прошлый раз, лежат в localStorage и должны
  // вернуться иконками до того, как пользователь что-то откроет.
  renderDesktopFiles();
  setupDockItems();
  setupFileDrop();

  setupMenuBar({ getCtx: menuCtx });
  onActiveWindowChange(setActiveApp);

  setupContextMenu({
    getCtx: menuCtx,
    getProject: (index) => folderContents.projects[index],
  });

  // Последним: окно из адресной строки открывается поверх уже готового стола.
  setupRouter({ openWindow, onActiveWindowChange });
}

init();
