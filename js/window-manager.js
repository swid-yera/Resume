import { CONSTANTS, WINDOW_TITLES } from "./constants.js";
import { openWindows } from "./state.js";

const windowTemplate = document.getElementById("window-template");

let topZ = 1000;
const activeChangeCbs = new Set();

// --- Focus & status ---

export function raiseWindow(win) {
  win.el.style.zIndex = ++topZ;
  notifyActiveChange();
}

function topWindow() {
  let top = null;
  for (const win of openWindows.values()) {
    // Свёрнутое окно не активно: иначе menu bar показывал бы приложение,
    // которого не видно на экране.
    if (win.el.classList.contains("is-minimized")) continue;
    if (!top || Number(win.el.style.zIndex) >= Number(top.el.style.zIndex)) {
      top = win;
    }
  }
  return top;
}

export function activeWindowType() {
  return topWindow()?.type ?? null;
}

// Подпись рисует menu-bar: он перестраивает панель целиком, и держать здесь
// ссылку на #active-app нельзя - она бы отвалилась при первой перерисовке.
// Подписчиков несколько: за активным окном следят и menu bar, и адресная строка.
export function onActiveWindowChange(cb) {
  activeChangeCbs.add(cb);
  cb(activeWindowType());
}

function notifyActiveChange() {
  const type = activeWindowType();
  for (const cb of activeChangeCbs) cb(type);
}

// Проводник и ридер меняют заголовок на имя папки или файла, как настоящие.
export function setWindowTitle(type, title) {
  const win = openWindows.get(type);
  if (!win || !title) return;
  win.el.querySelector(".window-title").textContent = title;
  win.el.setAttribute("aria-label", title);
}

function setDockIndicator(type, isRunning) {
  const item = document.querySelector(`.dock-item[data-type="${type}"]`);
  if (!item) return;
  const dot = item.querySelector(".dock-indicator");
  if (dot) dot.classList.toggle("is-running", !!isRunning);
}

// --- Dragging ---

function makeDraggable(win) {
  const header = win.el.querySelector(".window-header");
  let dragging = false;
  let startX = 0,
    startY = 0,
    initialX = 0,
    initialY = 0;

  header.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".window-control")) return;
    e.preventDefault();
    header.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    const rect = win.el.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    dragging = true;
  });

  header.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    e.preventDefault();
    const margin = CONSTANTS.WINDOW_DRAG_MARGIN;
    const minX = margin - win.el.offsetWidth;
    const maxX = window.innerWidth - margin;
    const maxY = window.innerHeight - margin;
    win.el.style.left =
      Math.max(minX, Math.min(initialX + e.clientX - startX, maxX)) + "px";
    win.el.style.top =
      Math.max(0, Math.min(initialY + e.clientY - startY, maxY)) + "px";
  });

  const endDrag = () => {
    dragging = false;
  };
  header.addEventListener("pointerup", endDrag);
  header.addEventListener("pointercancel", endDrag);
}

// --- Resizing ---

function makeResizable(win) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  let resizing = false;
  let dir = "";
  let startX = 0,
    startY = 0;
  let initialW = 0,
    initialH = 0,
    initialLeft = 0,
    initialTop = 0;

  win.el.querySelectorAll(".window-resize-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      dir = handle.dataset.dir;
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = win.el.getBoundingClientRect();
      initialW = rect.width;
      initialH = rect.height;
      initialLeft = rect.left;
      initialTop = rect.top;
      win.el.style.maxWidth = "none";
      win.el.style.maxHeight = "none";
    });

    handle.addEventListener("pointermove", (e) => {
      if (!resizing || !handle.hasPointerCapture(e.pointerId)) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const minW = CONSTANTS.WINDOW_MIN_WIDTH;
      const minH = CONSTANTS.WINDOW_MIN_HEIGHT;

      let w = initialW,
        h = initialH,
        left = initialLeft,
        top = initialTop;

      if (dir.includes("e")) {
        w = clamp(initialW + dx, minW, window.innerWidth - initialLeft);
      } else if (dir.includes("w")) {
        w = clamp(initialW - dx, minW, initialLeft + initialW);
        left = initialLeft + initialW - w;
      }
      if (dir.includes("s")) {
        h = clamp(initialH + dy, minH, window.innerHeight - initialTop);
      } else if (dir.includes("n")) {
        h = clamp(initialH - dy, minH, initialTop + initialH);
        top = initialTop + initialH - h;
      }

      win.el.style.width = w + "px";
      win.el.style.height = h + "px";
      win.el.style.left = left + "px";
      win.el.style.top = top + "px";
    });

    const endResize = () => {
      resizing = false;
      dir = "";
    };
    handle.addEventListener("pointerup", endResize);
    handle.addEventListener("pointercancel", endResize);
  });
}

// --- Minimize & zoom ---

export function minimizeWindow(win) {
  if (!win) return;
  win.el.classList.add("is-minimized");
  notifyActiveChange();
}

export function restoreWindow(win) {
  if (!win?.el.classList.contains("is-minimized")) return;
  win.el.classList.remove("is-minimized");
  notifyActiveChange();
}

export function zoomWindow(win) {
  if (!win) return;
  const el = win.el;

  if (el.classList.contains("is-maximized")) {
    el.classList.remove("is-maximized");
    // Возвращаем геометрию, которая была до разворота.
    Object.assign(el.style, win.prevGeometry ?? {});
    return;
  }

  win.prevGeometry = {
    left: el.style.left,
    top: el.style.top,
    width: el.style.width,
    height: el.style.height,
  };
  el.classList.add("is-maximized");
  el.style.left = "";
  el.style.top = "";
  el.style.width = "";
  el.style.height = "";
}

// --- Lifecycle ---

export function closeWindow(win) {
  if (win.el.classList.contains("is-closing")) return;
  win.el.classList.add("is-closing");
  const onEnd = (event) => {
    if (event.animationName !== "window-minimize") return;
    win.el.removeEventListener("animationend", onEnd);
    win.el.remove();
    openWindows.delete(win.type);
    setDockIndicator(win.type, false);
    notifyActiveChange();
  };
  win.el.addEventListener("animationend", onEnd);
}

export function createWindow(type) {
  const el = windowTemplate.content.firstElementChild.cloneNode(true);
  const contentEl = el.querySelector(".window-content");
  const win = { el, contentEl, type };
  const title = WINDOW_TITLES[type] || type;

  el.querySelector(".window-title").textContent = title;
  el.setAttribute("aria-label", title);
  // Нужен контекстному меню, чтобы по шапке найти окно.
  el.dataset.type = type;

  el.addEventListener("pointerdown", () => raiseWindow(win));
  el.querySelector(".window-control.close").addEventListener("click", (e) => {
    e.stopPropagation();
    closeWindow(win);
  });
  el.querySelector(".window-control.minimize").addEventListener("click", (e) => {
    e.stopPropagation();
    minimizeWindow(win);
  });
  el.querySelector(".window-control.maximize").addEventListener("click", (e) => {
    e.stopPropagation();
    zoomWindow(win);
  });
  makeDraggable(win);
  makeResizable(win);

  document.body.appendChild(el);

  const step = CONSTANTS.WINDOW_CASCADE_STEP;
  const slot = openWindows.size % 6;
  let left = 60 + slot * step;
  let top = 60 + slot * step;
  left = Math.min(left, Math.max(20, window.innerWidth - el.offsetWidth - 20));
  top = Math.min(top, Math.max(20, window.innerHeight - el.offsetHeight - 20));
  el.style.left = left + "px";
  el.style.top = top + "px";

  openWindows.set(type, win);
  setDockIndicator(type, true);
  raiseWindow(win);
  return win;
}

export function closeTopWindow() {
  const top = topWindow();
  if (top) closeWindow(top);
}
