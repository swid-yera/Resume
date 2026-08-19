import { CONSTANTS, WINDOW_TITLES } from "./constants.js";
import { openWindows } from "./state.js";
import { isMobile, onMobileChange } from "./mobile.js";

const windowTemplate = document.getElementById("window-template");

let topZ = 1000;
let desktopActive = true;
const activeChangeCbs = new Set();

// --- Focus & status ---

export function raiseWindow(win) {
  win.el.style.zIndex = ++topZ;
  desktopActive = false;
  notifyActiveChange();
}

// Стол активен, пока не тронули окно: F11 должен разворачивать его, а не пульт
// с музыкой, который приезжает сам. Клик по столу возвращает активность назад,
// как в macOS возвращает в Finder.
export function focusDesktop() {
  desktopActive = true;
}

document.addEventListener("pointerdown", (e) => {
  if (e.target.closest("#desktop")) focusDesktop();
});

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
    if (isMobile() || e.target.closest(".window-control")) return;
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
      if (isMobile()) return;
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

// Геометрию окна задают перетаскиванием, инлайновым стилем. Разворот её убирает,
// поэтому перед этим её надо запомнить, а при возврате поставить обратно.
function stashGeometry(win) {
  const { left, top, width, height } = win.el.style;
  win.prevGeometry = { left, top, width, height };
}

function dropGeometry(el) {
  el.style.left = "";
  el.style.top = "";
  el.style.width = "";
  el.style.height = "";
}

function restoreGeometry(win) {
  Object.assign(win.el.style, win.prevGeometry ?? {});
}

export function zoomWindow(win) {
  // На узком экране окно и так во весь стол, разворачивать нечего.
  if (!win || isMobile()) return;
  const el = win.el;

  if (el.classList.contains("is-maximized")) {
    el.classList.remove("is-maximized");
    restoreGeometry(win);
    return;
  }

  stashGeometry(win);
  el.classList.add("is-maximized");
  dropGeometry(el);
}

// Подсказка живёт внутри окна: в полном экране всё, что снаружи него, не рисуется.
// Нужна она потому, что панели с кнопками там нет, а F11 из чужого сайта до нас
// не доходит - клавиши достаются его документу. Esc гасит полный экран сам.
function showExitHint(el) {
  const hint = document.createElement("div");
  hint.className = "window-fullscreen-hint";
  hint.setAttribute("role", "status");
  hint.textContent = "Press Esc to exit fullscreen";
  el.append(hint);
  setTimeout(() => hint.remove(), CONSTANTS.FULLSCREEN_HINT_MS);
}

// F11 как в настоящем браузере: активное окно занимает весь экран целиком, без
// рабочего стола и своей шапки. Активен стол - на весь экран уходит он сам
// вместе с панелью и доком, то есть корень документа.
export function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }
  const top = desktopActive ? null : topWindow();
  if (top) fullscreenWindow(top);
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

function fullscreenWindow(win) {
  if (!win.el.requestFullscreen) return;

  stashGeometry(win);
  win.el.requestFullscreen().then(
    () => {
      dropGeometry(win.el);
      showExitHint(win.el);
    },
    () => restoreGeometry(win),
  );
  document.addEventListener(
    "fullscreenchange",
    () => {
      if (!document.fullscreenElement) restoreGeometry(win);
    },
    { once: true },
  );
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

function cascade(el) {
  const step = CONSTANTS.WINDOW_CASCADE_STEP;
  const slot = openWindows.size % 6;
  let left = 60 + slot * step;
  let top = 60 + slot * step;
  left = Math.min(left, Math.max(20, window.innerWidth - el.offsetWidth - 20));
  top = Math.min(top, Math.max(20, window.innerHeight - el.offsetHeight - 20));
  el.style.left = left + "px";
  el.style.top = top + "px";
}

// Поворот экрана меняет раскладку: геометрия, снятая с десктопа, на узком
// экране увела бы окно за край стола, а мобильная на десктопе слепила бы все
// окна в одну точку.
onMobileChange((mobile) => {
  for (const win of openWindows.values()) {
    if (mobile) win.el.classList.remove("is-maximized");
    dropGeometry(win.el);
    if (!mobile) cascade(win.el);
  }
});

// Окно глухо к нажатиям, пока не доехало. Держится на таймере, а не только на
// animationend: с prefers-reduced-motion анимации нет и событие не придёт.
function sealWhileOpening(el) {
  el.classList.add("is-opening");
  const unseal = () => el.classList.remove("is-opening");
  el.addEventListener(
    "animationend",
    (e) => {
      if (e.animationName === "window-open") unseal();
    },
    { once: true },
  );
  setTimeout(unseal, CONSTANTS.WINDOW_OPEN_SEAL_MS);
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
  sealWhileOpening(el);

  // Узкому экрану координаты не нужны: окно раскладывает CSS во весь стол, а
  // инлайновый стиль перебил бы его.
  if (!isMobile()) cascade(el);

  openWindows.set(type, win);
  setDockIndicator(type, true);
  raiseWindow(win);
  return win;
}

export function closeTopWindow() {
  const top = topWindow();
  if (top) closeWindow(top);
}
