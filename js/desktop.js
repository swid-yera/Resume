import { CONSTANTS } from "./constants.js";
import { openWindow, openEntry } from "./open-window.js";
import { getFs, DESKTOP } from "./fs.js";
import { iconFor } from "./apps/explorer-model.js";
import { escapeHtml } from "./utils.js";
import { gridStep, freeSlots } from "./desktop-sort.js";
import { isMobile } from "./mobile.js";

// --- Desktop icons ---

// Иконка ведёт либо в приложение (статическая разметка, её видит краулер),
// либо в файл из ФС - такие появляются, когда файл бросают на стол.
function activate(file) {
  const path = file.dataset.path;
  if (!path) return openWindow(file.dataset.type);
  openEntry({ type: "file", name: file.querySelector("span").textContent, path });
}

export function setupFileDragging() {
  document.querySelectorAll(".file").forEach((file) => {
    // Стол перерисовывается после каждого сброса, а слушатели вешаются один раз.
    if (file.dataset.wired) return;
    file.dataset.wired = "1";

    let isDragging = false;
    let hasMoved = false;
    let opening = false;
    let offsetX = 0,
      offsetY = 0;
    let startX = 0,
      startY = 0;

    file.addEventListener("pointerdown", (e) => {
      // На узком экране иконки не таскают: их раскладывает сетка стола, а
      // перехват указателя отнял бы у страницы прокрутку.
      if (isMobile()) return;
      e.preventDefault();
      file.setPointerCapture(e.pointerId);
      isDragging = false;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = file.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });

    file.addEventListener("pointermove", (e) => {
      if (!file.hasPointerCapture(e.pointerId)) return;

      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);

      if (
        !isDragging &&
        (dx > CONSTANTS.DRAG_THRESHOLD || dy > CONSTANTS.DRAG_THRESHOLD)
      ) {
        isDragging = true;
        file.classList.add("dragging");
      }
      if (!isDragging) return;

      hasMoved = true;
      const maxX = window.innerWidth - file.offsetWidth - CONSTANTS.PADDING;
      const maxY =
        window.innerHeight - file.offsetHeight - CONSTANTS.PADDING - CONSTANTS.DESKTOP_PADDING_BOTTOM;
      const minY = CONSTANTS.PADDING + CONSTANTS.DESKTOP_PADDING_TOP;

      file.style.left =
        Math.max(CONSTANTS.PADDING, Math.min(e.clientX - offsetX, maxX)) + "px";
      file.style.top =
        Math.max(minY, Math.min(e.clientY - offsetY, maxY)) + "px";
    });

    const endInteraction = () => {
      if (!hasMoved && !opening) {
        opening = true;
        activate(file);
        setTimeout(() => {
          opening = false;
        }, CONSTANTS.OPEN_DEBOUNCE_MS);
      }
      if (isDragging) file.classList.remove("dragging");
      isDragging = false;
      hasMoved = false;
    };

    // Иконки-ссылки ведут на статические страницы, чтобы их видел краулер.
    // Обычный клик открывает окно, но ctrl/cmd и средняя кнопка работают как
    // на любой ссылке - открывают страницу в новой вкладке.
    file.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      // На тач-экране открывает именно click: только он отличает касание от
      // прокрутки стола. Указатель этого не знает - палец, уехавший вниз,
      // заканчивает жест таким же pointerup, и иконка открывалась от свайпа.
      if (isMobile()) endInteraction();
    });

    file.addEventListener("pointerup", () => {
      if (!isMobile()) endInteraction();
    });
    // On touch (notably iOS Safari) a tap after setPointerCapture can end with
    // pointercancel instead of pointerup, so open here too. The `opening`
    // debounce dedupes if both fire.
    file.addEventListener("pointercancel", () => {
      if (!isMobile()) endInteraction();
    });

    file.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate(file);
      }
    });
  });
}

// Новые иконки координат не имеют и без этого легли бы стопкой в одну точку:
// статическим места раздаёт CSS, а этим - свободные слоты той же сетки.
function placeIcons(desktop, fresh) {
  const box = desktop.getBoundingClientRect();
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left - box.left), top: Math.round(r.top - box.top) };
  };

  const placed = [...desktop.querySelectorAll(".file")]
    .filter((el) => !fresh.includes(el))
    .map(rect);
  if (!placed.length) return;

  const sample = fresh[0].getBoundingClientRect();
  const grid = gridStep(placed, {
    stepX: Math.round(sample.width) + CONSTANTS.PADDING,
    stepY: Math.round(sample.height) + CONSTANTS.PADDING,
  });
  const rows = Math.max(1, Math.floor((box.height - grid.originY) / grid.stepY));

  const slots = freeSlots(placed, grid, rows, fresh.length);
  fresh.forEach((el, i) => {
    if (!slots[i]) return;
    el.style.left = `${slots[i].left}px`;
    el.style.top = `${slots[i].top}px`;
  });
}

// Ярлыки с рабочего стола ФС не рисуем: они дублируют статические иконки и док.
// Поэтому пока на стол ничего не бросали, эта функция ничего не добавляет.
export function renderDesktopFiles() {
  const desktop = document.getElementById("desktop");
  if (!desktop) return;

  let entries = [];
  try {
    entries = getFs().list(DESKTOP).filter((e) => e.type === "file");
  } catch {
    entries = [];
  }

  const seen = new Set();
  const fresh = [];
  for (const entry of entries) {
    seen.add(entry.path);
    if (desktop.querySelector(`.file[data-path="${CSS.escape(entry.path)}"]`)) continue;

    const el = document.createElement("div");
    el.className = "file";
    el.dataset.path = entry.path;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", `Open ${entry.name}`);
    el.innerHTML = `
            <div class="file-icon">${iconFor(entry)}</div>
            <span>${escapeHtml(entry.name)}</span>`;
    desktop.append(el);
    fresh.push(el);
  }

  if (fresh.length && !isMobile()) placeIcons(desktop, fresh);

  // Файл, удалённый из ФС мимо стола, не должен остаться висеть иконкой.
  for (const el of desktop.querySelectorAll(".file[data-path]")) {
    if (!seen.has(el.dataset.path)) el.remove();
  }

  setupFileDragging();
}

// --- Dock ---

export function setupDockItems() {
  document.querySelectorAll(".dock-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      openWindow(item.dataset.type);
    });
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openWindow(item.dataset.type);
      }
    });
  });
}
