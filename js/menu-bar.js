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
    swatch: preset.id,
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
  ];

  if (!ctx.isCompact) {
    items.push({
      label: "Zoom",
      disabled: !hasWindows,
      onSelect: () => ctx.actions?.zoomTop?.(),
    });
  }

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
  const items = [];

  if (!ctx.isCompact) {
    items.push(
      {
        label: "Sort Icons By",
        submenu: [
          { label: "Name", onSelect: () => ctx.actions?.sortIcons?.("name") },
          { label: "Kind", onSelect: () => ctx.actions?.sortIcons?.("kind") },
        ],
      },
      SEP,
    );
  }

  items.push(
    { label: "Appearance", submenu: appearanceSubmenu(ctx) },
    { label: "Change Theme", submenu: themeSubmenu(ctx) },
  );

  return { label: "View", items };
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
  const edit = ctx.isCompact ? [] : [editMenu(ctx)];

  if (activeType === "console") {
    return [shellMenu(ctx), ...edit, windowMenu(ctx), helpMenu(ctx)];
  }

  if (activeType === "projects") {
    return [fileMenu(ctx), viewMenu(ctx), windowMenu(ctx), helpMenu(ctx)];
  }

  if (!activeType) {
    return [
      fileMenu(ctx),
      ...edit,
      viewMenu(ctx),
      windowMenu(ctx),
      helpMenu(ctx),
    ];
  }

  return [fileMenu(ctx), ...edit, windowMenu(ctx), helpMenu(ctx)];
}

// Узкий экран не держит пять меню в строку, поэтому бар схлопывается в одну
// кнопку с именем приложения, а их содержимое склеивается в один список.
export function compactMenuItems(activeType, ctx) {
  const items = [];
  for (const menu of menusFor(activeType, ctx)) {
    if (items.length) items.push(SEP);
    items.push({ sectionLabel: menu.label.toUpperCase() }, ...menu.items);
  }
  return items;
}

// --- Rendering ---

let barEl = null;
let getCtx = null;
let activeType = null;
let openLabel = null;

// Служебное имя единственной кнопки узкого бара: меню с таким заголовком нет,
// поэтому спутать его с настоящим нельзя.
const COMPACT_LABEL = "__app__";

function renderBar() {
  if (!barEl) return;
  const ctx = getCtx();

  // На узком экране имя приложения само и есть кнопка меню.
  if (ctx.isCompact) {
    barEl.innerHTML = `<button type="button" class="menu-bar__item menu-bar__app${openLabel ? " is-open" : ""}" data-label="${COMPACT_LABEL}" id="active-app" aria-haspopup="menu">${appNameFor(activeType)}</button>`;
    return;
  }

  const menus = menusFor(activeType, ctx);

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
  const ctx = getCtx();
  const items =
    label === COMPACT_LABEL
      ? compactMenuItems(activeType, ctx)
      : menusFor(activeType, ctx).find((m) => m.label === label)?.items;
  if (!items?.length) return;

  const r = btn.getBoundingClientRect();
  openLabel = label;
  renderBar();
  openMenu({
    x: r.left,
    y: r.bottom + 2,
    items,
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

// Набор меню зависит от ширины экрана, поэтому поворот телефона пересобирает бар.
export function refreshMenuBar() {
  closeMenu();
  openLabel = null;
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
