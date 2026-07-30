// Menu bar: набор меню зависит от активного окна.
//
// menusFor / appNameFor чистые и не импортируют state.js (там .webp, понятные
// только Vite) - иначе тесты на node --test не запустятся. Действия приходят
// снаружи через ctx.actions.
import { THEME_PRESETS, APPEARANCES, WINDOW_TITLES } from "./constants.js";
import { openMenu, closeMenu } from "./ui/menu.js";

const SEP = { separator: true };

// --- App name ---

export function appNameFor(activeType) {
  if (!activeType) return "Finder";
  return (WINDOW_TITLES[activeType] || activeType).replace(".txt", "");
}

// --- Shared menus ---

function themeSubmenu(ctx) {
  return THEME_PRESETS.map((preset) => ({
    label: preset.label,
    swatch: preset.swatch,
    checked: preset.id === ctx.activeTheme,
    onSelect: () => ctx.actions?.setTheme?.(preset.id),
  }));
}

function appearanceSubmenu(ctx) {
  return APPEARANCES.map((mode) => ({
    label: mode.label,
    checked: mode.id === ctx.activeAppearance,
    onSelect: () => ctx.actions?.setAppearance?.(mode.id),
  }));
}

function windowMenu(ctx) {
  const hasWindows = ctx.windows.length > 0;
  const items = [
    {
      label: "Minimize",
      disabled: !hasWindows,
      onSelect: () => ctx.actions?.minimizeTop?.(),
    },
    {
      label: "Zoom",
      disabled: !hasWindows,
      onSelect: () => ctx.actions?.zoomTop?.(),
    },
  ];

  if (hasWindows) {
    items.push(SEP, { sectionLabel: "OPEN WINDOWS" });
    for (const win of ctx.windows) {
      items.push({
        label: win.title,
        checked: win.isTop,
        onSelect: () => ctx.actions?.focusWindow?.(win.type),
      });
    }
  }

  return { label: "Window", items };
}

function helpMenu(ctx) {
  return {
    label: "Help",
    items: [
      { label: "Resume", onSelect: () => ctx.actions?.openWindow?.("text") },
      { label: "Open Terminal", onSelect: () => ctx.actions?.openWindow?.("console") },
    ],
  };
}

function editMenu() {
  // Правка живёт в самих полях ввода, поэтому пункты неактивны, а не врут.
  return {
    label: "Edit",
    items: [
      { label: "Cut", disabled: true },
      { label: "Copy", disabled: true },
      { label: "Paste", disabled: true },
    ],
  };
}

function fileMenu(ctx) {
  return {
    label: "File",
    items: [
      {
        label: "New Window",
        submenu: [
          { label: "File Explorer", onSelect: () => ctx.actions?.openWindow?.("explorer") },
          { label: "Terminal", onSelect: () => ctx.actions?.openWindow?.("console") },
          { label: "Browser", onSelect: () => ctx.actions?.openWindow?.("browser") },
          { label: "Settings", onSelect: () => ctx.actions?.openWindow?.("settings") },
        ],
      },
      SEP,
      {
        label: "Close Window",
        disabled: !ctx.windows.length,
        onSelect: () => ctx.actions?.closeTop?.(),
      },
    ],
  };
}

function viewMenu(ctx) {
  return {
    label: "View",
    items: [
      {
        label: "Sort Icons By",
        submenu: [
          { label: "Name", onSelect: () => ctx.actions?.sortIcons?.("name") },
          { label: "Kind", onSelect: () => ctx.actions?.sortIcons?.("kind") },
        ],
      },
      SEP,
      { label: "Appearance", submenu: appearanceSubmenu(ctx) },
      { label: "Change Theme", submenu: themeSubmenu(ctx) },
    ],
  };
}

function shellMenu(ctx) {
  return {
    label: "Shell",
    items: [
      { label: "Clear Buffer", onSelect: () => ctx.actions?.clearTerminal?.() },
      { label: "Command List", onSelect: () => ctx.actions?.terminalHelp?.() },
      SEP,
      { label: "Close Terminal", onSelect: () => ctx.actions?.closeWindow?.("console") },
    ],
  };
}

// --- Sets ---

export function menusFor(activeType, ctx) {
  if (activeType === "console") {
    return [shellMenu(ctx), editMenu(ctx), windowMenu(ctx), helpMenu(ctx)];
  }

  if (activeType === "projects") {
    return [fileMenu(ctx), viewMenu(ctx), windowMenu(ctx), helpMenu(ctx)];
  }

  if (!activeType) {
    return [
      fileMenu(ctx),
      editMenu(ctx),
      viewMenu(ctx),
      windowMenu(ctx),
      helpMenu(ctx),
    ];
  }

  return [fileMenu(ctx), editMenu(ctx), windowMenu(ctx), helpMenu(ctx)];
}

// --- Rendering ---

let barEl = null;
let getCtx = null;
let activeType = null;
let openLabel = null;

function renderBar() {
  if (!barEl) return;
  const menus = menusFor(activeType, getCtx());

  barEl.innerHTML =
    `<span class="menu-bar__spacer" aria-hidden="true"></span>` +
    `<span class="menu-bar__active" id="active-app">${appNameFor(activeType)}</span>` +
    menus
      .map(
        (m) =>
          `<button type="button" class="menu-bar__item${m.label === openLabel ? " is-open" : ""}" data-label="${m.label}">${m.label}</button>`,
      )
      .join("");
}

function openBarMenu(label) {
  const btn = barEl.querySelector(`[data-label="${label}"]`);
  if (!btn) return;
  const menu = menusFor(activeType, getCtx()).find((m) => m.label === label);
  if (!menu) return;

  const r = btn.getBoundingClientRect();
  openLabel = label;
  renderBar();
  openMenu({
    x: r.left,
    y: r.bottom + 2,
    items: menu.items,
    onClose: () => {
      openLabel = null;
      renderBar();
    },
  });
}

export function setActiveApp(type) {
  activeType = type ?? null;
  renderBar();
}

export function setupMenuBar({ getCtx: ctxFn }) {
  barEl = document.querySelector(".menu-bar__items");
  if (!barEl) return;
  getCtx = ctxFn;
  renderBar();

  barEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".menu-bar__item");
    if (!btn) return;
    const label = btn.dataset.label;
    if (label === openLabel) {
      closeMenu();
      return;
    }
    openBarMenu(label);
  });

  // При уже открытом меню наведение переключает на соседнее, как в macOS.
  barEl.addEventListener("pointerover", (e) => {
    if (!openLabel) return;
    const btn = e.target.closest(".menu-bar__item");
    if (!btn || btn.dataset.label === openLabel) return;
    openBarMenu(btn.dataset.label);
  });
}
