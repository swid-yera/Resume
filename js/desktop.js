import { CONSTANTS } from "./constants.js";
import { openWindow } from "./open-window.js";

// --- Desktop icons ---

export function setupFileDragging() {
  document.querySelectorAll(".file").forEach((file) => {
    let isDragging = false;
    let hasMoved = false;
    let opening = false;
    let offsetX = 0,
      offsetY = 0;
    let startX = 0,
      startY = 0;

    file.addEventListener("pointerdown", (e) => {
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
        openWindow(file.dataset.type);
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
    });

    file.addEventListener("pointerup", endInteraction);
    // On touch (notably iOS Safari) a tap after setPointerCapture can end with
    // pointercancel instead of pointerup, so open here too. The `opening`
    // debounce dedupes if both fire.
    file.addEventListener("pointercancel", endInteraction);

    file.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openWindow(file.dataset.type);
      }
    });
  });
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
