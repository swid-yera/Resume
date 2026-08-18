// Общий примитив меню: им пользуются и контекстное меню, и menu bar.
// Ничего не знает ни про проекты, ни про окна - только про данные пунктов.
//
// Модуль не импортирует state.js: там .webp, которые понимает только Vite,
// а геометрия и разметка должны тестироваться на node --test.
import { escapeHtml } from "../utils.js";

const MARGIN = 4;

// --- Geometry ---

export function placeMenu(point, size, viewport, opts = {}) {
  let left = point.x;
  let top = point.y;

  // Не влезает вправо - уходим влево. Для подменю отражаемся от левого края
  // родителя (flipFrom), иначе подменю накроет меню, из которого выехало.
  if (left + size.width > viewport.width) {
    left = (opts.flipFrom ?? point.x) - size.width;
  }
  // Не влезает вниз - открываемся вверх.
  if (top + size.height > viewport.height) top = point.y - size.height;

  // Меню больше экрана: переворот не спасает, прижимаем к краю.
  left = Math.max(MARGIN, Math.min(left, viewport.width - size.width));
  top = Math.max(MARGIN, Math.min(top, viewport.height - size.height));

  return { left: Math.max(0, left), top: Math.max(0, top) };
}

// --- Markup ---

export function menuItemHtml(item, index) {
  if (item.separator) return '<li class="menu__separator" role="separator"></li>';

  if (item.sectionLabel) {
    return `<li class="menu__section">${escapeHtml(item.sectionLabel)}</li>`;
  }

  const classes = ["menu__item"];
  if (item.disabled) classes.push("is-disabled");
  if (item.checked) classes.push("is-checked");

  const attrs = [
    `class="${classes.join(" ")}"`,
    `role="menuitem"`,
    `data-index="${index}"`,
    item.disabled ? 'aria-disabled="true"' : "",
    item.checked !== undefined ? `aria-checked="${!!item.checked}"` : "",
    item.submenu ? 'aria-haspopup="menu" aria-expanded="false"' : "",
    item.disabled ? "" : 'tabindex="-1"',
  ]
    .filter(Boolean)
    .join(" ");

  const check = `<span class="menu__check" aria-hidden="true">${item.checked ? "✓" : ""}</span>`;
  const swatch = item.swatch
    ? `<span class="menu__swatch" data-theme-swatch="${escapeHtml(item.swatch)}" aria-hidden="true"></span>`
    : "";
  const label = `<span class="menu__label">${escapeHtml(item.label ?? "")}</span>`;
  const trailing = item.submenu
    ? '<span class="menu__arrow" aria-hidden="true">›</span>'
    : item.shortcut
      ? `<span class="menu__shortcut">${escapeHtml(item.shortcut)}</span>`
      : "";

  return `<li ${attrs}>${check}${swatch}${label}${trailing}</li>`;
}

function menuHtml(items) {
  return `<ul class="menu__list" role="menu">${items.map(menuItemHtml).join("")}</ul>`;
}

// --- Behaviour ---

let openRoot = null;
let onCloseCb = null;

export function closeMenu() {
  if (!openRoot) return;
  openRoot.remove();
  openRoot = null;
  document.removeEventListener("pointerdown", onDocPointerDown, true);
  document.removeEventListener("keydown", onKeyDown, true);
  window.removeEventListener("blur", closeMenu);
  window.removeEventListener("resize", closeMenu);
  const cb = onCloseCb;
  onCloseCb = null;
  if (cb) cb();
}

function onDocPointerDown(e) {
  if (openRoot && !openRoot.contains(e.target)) closeMenu();
}

function rows(panel) {
  return [...panel.querySelectorAll('.menu__item:not(.is-disabled)')];
}

function onKeyDown(e) {
  if (!openRoot) return;
  if (e.key === "Escape") {
    e.preventDefault();
    // Гасим событие: иначе Esc заодно закроет и окно под меню (main.js).
    e.stopPropagation();
    closeMenu();
    return;
  }

  const panel = openRoot.querySelector(".menu:last-child") || openRoot;
  const items = rows(panel);
  if (!items.length) return;
  const current = items.indexOf(document.activeElement);

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const step = e.key === "ArrowDown" ? 1 : -1;
    const next = (current + step + items.length) % items.length;
    items[next].focus();
  } else if (e.key === "Enter" || e.key === " ") {
    if (current < 0) return;
    e.preventDefault();
    items[current].click();
  }
}

function buildPanel(items, point, depth, opts = {}) {
  const panel = document.createElement("div");
  panel.className = "menu";
  panel.dataset.depth = String(depth);
  panel.innerHTML = menuHtml(items);
  openRoot.appendChild(panel);

  const size = { width: panel.offsetWidth, height: panel.offsetHeight };
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const { left, top } = placeMenu(point, size, viewport, opts);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;

  function openSubmenu(row) {
    openRoot
      .querySelectorAll(`.menu[data-depth="${depth + 1}"]`)
      .forEach((p) => p.remove());
    const item = items[Number(row.dataset.index)];
    if (!item?.submenu?.length) return;
    const r = row.getBoundingClientRect();
    const parent = panel.getBoundingClientRect();
    row.setAttribute("aria-expanded", "true");
    buildPanel(item.submenu, { x: parent.right, y: r.top }, depth + 1, {
      flipFrom: parent.left,
    });
  }

  panel.addEventListener("click", (e) => {
    const row = e.target.closest(".menu__item");
    if (!row || row.classList.contains("is-disabled")) return;
    const item = items[Number(row.dataset.index)];
    if (!item) return;
    if (item.submenu) {
      openSubmenu(row);
      return;
    }
    closeMenu();
    item.onSelect?.();
  });

  // Подменю раскрывается по наведению, как в настоящей ОС, но на тач-экране
  // наводить нечем - там до него добирается тап через обработчик click.
  panel.addEventListener("pointerover", (e) => {
    const row = e.target.closest(".menu__item");
    if (!row) return;
    openSubmenu(row);
  });

  return panel;
}

export function openMenu({ x, y, items, onClose }) {
  closeMenu();
  if (!items?.length) return;

  openRoot = document.createElement("div");
  openRoot.className = "menu-layer";
  document.body.appendChild(openRoot);
  onCloseCb = onClose;

  buildPanel(items, { x, y }, 0);

  document.addEventListener("pointerdown", onDocPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("blur", closeMenu);
  window.addEventListener("resize", closeMenu);

  return closeMenu;
}

export function isMenuOpen() {
  return !!openRoot;
}
