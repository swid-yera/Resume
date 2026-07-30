// Контекстное меню: определяет цель клика и отдаёт пункты примитиву меню.
//
// Сборка пунктов (itemsForTarget) намеренно чистая и не импортирует state.js:
// там .webp, понятные только Vite, и тесты бы не запустились. Всё, что умеет
// действовать, приходит снаружи через ctx.actions.
import { THEME_PRESETS, APPEARANCES } from "./constants.js";
import { openMenu } from "./ui/menu.js";

const SEP = { separator: true };

// --- Items ---

function themeSubmenu(ctx) {
  return THEME_PRESETS.map((preset) => ({
    label: preset.label,
    swatch: preset.swatch,
    checked: preset.id === ctx.activeTheme,
    onSelect: () => ctx.actions?.setTheme?.(preset.id),
  }));
}

function desktopItems(ctx) {
  return [
    {
      label: "New Window",
      submenu: [
        { label: "File Explorer", onSelect: () => ctx.actions?.openWindow?.("explorer") },
        { label: "Terminal", onSelect: () => ctx.actions?.openWindow?.("console") },
        { label: "Browser", onSelect: () => ctx.actions?.openWindow?.("browser") },
        { label: "Settings", onSelect: () => ctx.actions?.openWindow?.("settings") },
      ],
    },
    {
      label: "Sort Icons By",
      submenu: [
        { label: "Name", onSelect: () => ctx.actions?.sortIcons?.("name") },
        { label: "Kind", onSelect: () => ctx.actions?.sortIcons?.("kind") },
      ],
    },
    {
      label: "Appearance",
      submenu: APPEARANCES.map((mode) => ({
        label: mode.label,
        checked: mode.id === ctx.activeAppearance,
        onSelect: () => ctx.actions?.setAppearance?.(mode.id),
      })),
    },
    { label: "Change Theme", submenu: themeSubmenu(ctx) },
    SEP,
    { label: "Open Terminal", onSelect: () => ctx.actions?.openWindow?.("console") },
    { label: "Resume", onSelect: () => ctx.actions?.openWindow?.("text") },
  ];
}

function fileItems(target, ctx) {
  return [
    { label: "Open", onSelect: () => ctx.actions?.openWindow?.(target.type) },
    { label: "Get Info", onSelect: () => ctx.actions?.getInfo?.(target) },
  ];
}

function projectItems(target, ctx) {
  const p = target.project;
  return [
    p.path && {
      label: "Open Document",
      onSelect: () => ctx.actions?.openDoc?.(p.path),
    },
    p.path && {
      label: "Show in Explorer",
      onSelect: () => ctx.actions?.openPath?.(p.path.replace(/\\[^\\]+$/, "")),
    },
    (p.path && (p.url || p.repo)) && SEP,
    p.url && {
      label: "Open Site",
      onSelect: () => ctx.actions?.openExternal?.(p.url),
    },
    p.repo && {
      label: "Open Repository",
      onSelect: () => ctx.actions?.openExternal?.(p.repo),
    },
    p.url && {
      label: "Copy Link",
      onSelect: () => ctx.actions?.copyLink?.(p.url),
    },
    SEP,
    { label: "Get Info", onSelect: () => ctx.actions?.getInfo?.(target) },
  ].filter(Boolean);
}

function dockItems(target, ctx) {
  const isOpen = ctx.openTypes.includes(target.type);
  return [
    { label: "Open", onSelect: () => ctx.actions?.openWindow?.(target.type) },
    {
      label: "Close",
      disabled: !isOpen,
      onSelect: () => ctx.actions?.closeWindow?.(target.type),
    },
  ];
}

function windowItems(target, ctx) {
  return [
    { label: "Minimize", onSelect: () => ctx.actions?.minimizeWindow?.(target.type) },
    { label: "Zoom", onSelect: () => ctx.actions?.zoomWindow?.(target.type) },
    SEP,
    { label: "Close", onSelect: () => ctx.actions?.closeWindow?.(target.type) },
  ];
}

export function itemsForTarget(target, ctx) {
  switch (target.kind) {
    case "desktop":
      return desktopItems(ctx);
    case "file":
      return fileItems(target, ctx);
    case "project":
      return projectItems(target, ctx);
    case "dock":
      return dockItems(target, ctx);
    case "window":
      return windowItems(target, ctx);
    default:
      return [];
  }
}

// --- Target resolution ---

export function resolveTarget(el, getProject) {
  const tile = el.closest?.(".project-tile");
  if (tile) {
    return { kind: "project", project: getProject(Number(tile.dataset.index)) };
  }

  const dock = el.closest?.(".dock-item");
  if (dock) return { kind: "dock", type: dock.dataset.type };

  const file = el.closest?.(".file");
  if (file) return { kind: "file", type: file.dataset.type };

  const header = el.closest?.(".window-header");
  if (header) {
    return { kind: "window", type: header.closest(".window")?.dataset.type };
  }

  // Внутренности окна своего меню не имеют: пусть работает меню браузера,
  // иначе из терминала и заметок нельзя будет скопировать текст.
  if (el.closest?.(".window")) return { kind: "none" };

  if (el.closest?.("#desktop") || el === document.body) return { kind: "desktop" };

  return { kind: "none" };
}

// --- Wiring ---

export function setupContextMenu({ getCtx, getProject }) {
  document.addEventListener("contextmenu", (e) => {
    const target = resolveTarget(e.target, getProject);
    if (target.kind === "none") return;

    const items = itemsForTarget(target, getCtx());
    if (!items.length) return;

    e.preventDefault();
    openMenu({ x: e.clientX, y: e.clientY, items });
  });
}
