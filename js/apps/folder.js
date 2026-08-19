import { folderContents, currentIndex } from "../state.js";
import { escapeHtml } from "../utils.js";
import { openWindow } from "../open-window.js";
import { CONSTANTS } from "../constants.js";

// --- Folder list ---

function renderFolder(windowContent, type) {
  const items = folderContents[type] || [];
  if (!items.length) {
    windowContent.innerHTML =
      '<p class="folder-empty">This folder is empty.</p>';
    return;
  }

  windowContent.innerHTML = `
            <div class="folder-content">
                ${items
                  .map(
                    (item, index) => `
                    <div class="folder-item" data-index="${index}" data-type="${escapeHtml(type)}"
                         tabindex="0" role="button" aria-label="Open ${escapeHtml(item.name)}">
                        <img src="${escapeHtml(item.src)}" alt="">
                        <span>${escapeHtml(item.name)}</span>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        `;

  const handleSelection = (e) => {
    const item = e.target.closest(".folder-item");
    if (!item) return;
    const index = parseInt(item.dataset.index, 10);
    if (isNaN(index)) return;
    openWindow(type, index);
  };

  const folderContent = windowContent.querySelector(".folder-content");
  folderContent.addEventListener("click", handleSelection);
  folderContent.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    handleSelection(e);
  });
}

export function renderFolderContent(windowContent, type, fileIndex) {
  const items = folderContents[type] || [];
  if (!items.length) {
    windowContent.innerHTML =
      '<p class="folder-empty">This folder is empty.</p>';
    return;
  }
  if (Number.isInteger(fileIndex) && items[fileIndex]) {
    renderGallery(windowContent, type, fileIndex);
  } else {
    renderFolder(windowContent, type);
  }
}

// --- Gallery ---

function renderGallery(windowContent, type, startIndex) {
  startIndex = startIndex || 0;
  const items = folderContents[type] || [];
  if (!items.length) return;

  currentIndex[type] = startIndex;

  windowContent.innerHTML = `
            <div class="gallery" role="region" aria-label="Image gallery">
                <button class="arrow left" aria-label="Previous image">&#10094;</button>
                <div class="gallery-container">
                    ${items
                      .map(
                        (item, idx) => `
                        <div class="gallery-item" data-index="${idx}"
                             role="img" aria-label="${escapeHtml(item.name)}">
                            <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.name)}">
                        </div>
                    `,
                      )
                      .join("")}
                </div>
                <button class="arrow right" aria-label="Next image">&#10095;</button>
            </div>
        `;

  const container = windowContent.querySelector(".gallery-container");
  const leftArrow = windowContent.querySelector(".arrow.left");
  const rightArrow = windowContent.querySelector(".arrow.right");

  const updateGallery = () => {
    container.style.transform = `translateX(-${currentIndex[type] * 100}%)`;
    leftArrow.setAttribute("aria-disabled", String(currentIndex[type] === 0));
    rightArrow.setAttribute(
      "aria-disabled",
      String(currentIndex[type] === items.length - 1),
    );
  };

  const step = (dir) => {
    currentIndex[type] =
      (currentIndex[type] + dir + items.length) % items.length;
    updateGallery();
  };

  leftArrow.addEventListener("click", () => step(-1));
  rightArrow.addEventListener("click", () => step(1));

  // Пальцем галерею листают свайпом, а не стрелками по краям экрана. Порог
  // отсекает дрожь, а сравнение с вертикалью - прокрутку, начатую по картинке.
  let touchX = 0;
  let touchY = 0;
  container.addEventListener(
    "touchstart",
    (e) => {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    },
    { passive: true },
  );

  container.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) < CONSTANTS.SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
    step(dx < 0 ? 1 : -1);
  });

  updateGallery();
}
