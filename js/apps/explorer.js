// Проводник: дерево слева, адресная строка крошками, таблица Details.
// Вся логика без DOM - в explorer-model.js.
import { getFs, THIS_PC, HOME, parentPath, baseName } from "../fs.js";
import { escapeHtml } from "../utils.js";
import { openEntry } from "../open-window.js";
import { setWindowTitle } from "../window-manager.js";
import {
  COLUMNS,
  QUICK_ACCESS,
  History,
  breadcrumbs,
  filterEntries,
  formatDate,
  formatSize,
  icon,
  iconFor,
  nextSort,
  sortEntries,
  statusText,
} from "./explorer-model.js";

// Состояние переживает закрытие окна: вернувшись, попадаешь туда же, откуда ушёл.
const state = {
  history: new History(HOME),
  sort: { key: "name", dir: 1 },
  view: "details",
  query: "",
  selected: null,
  expanded: new Set(["C:", "C:\\Users", "C:\\Users\\antawkay"]),
};

// Ссылка на draw открытого окна: сброшенный файл должен появиться в списке сам.
let redraw = null;

export const currentPath = () => state.history.current;

export function refreshExplorer() {
  redraw?.();
}

export function renderExplorer(windowContent, path) {
  if (path) state.history.push(path);

  windowContent.innerHTML = `
    <div class="explorer">
      <nav class="ex-nav" aria-label="Navigation pane"></nav>
      <div class="ex-main">
        <div class="ex-toolbar">
          <div class="ex-nav-buttons">
            <button type="button" class="ex-btn" data-nav="back" aria-label="Back">◀</button>
            <button type="button" class="ex-btn" data-nav="forward" aria-label="Forward">▶</button>
            <button type="button" class="ex-btn" data-nav="up" aria-label="Up">▲</button>
            <button type="button" class="ex-btn" data-nav="refresh" aria-label="Refresh">⟳</button>
          </div>
          <div class="ex-address">
            <div class="ex-crumbs"></div>
            <input class="ex-address-input" type="text" spellcheck="false"
                   autocomplete="off" aria-label="Address" hidden>
          </div>
          <input class="ex-search" type="search" spellcheck="false" placeholder="Search">
        </div>
        <div class="ex-view"></div>
        <div class="ex-status">
          <span class="ex-status-text"></span>
          <div class="ex-view-toggle" role="group" aria-label="View">
            <button type="button" class="ex-btn" data-view="details" aria-label="Details view">▤</button>
            <button type="button" class="ex-btn" data-view="icons" aria-label="Icons view">▦</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const fs = getFs();
  const root = windowContent.querySelector(".explorer");
  const nav = windowContent.querySelector(".ex-nav");
  const view = windowContent.querySelector(".ex-view");
  const crumbs = windowContent.querySelector(".ex-crumbs");
  const address = windowContent.querySelector(".ex-address-input");
  const search = windowContent.querySelector(".ex-search");
  const status = windowContent.querySelector(".ex-status-text");

  // То, что сейчас на экране: по нему работают выделение и статус-бар, иначе
  // они разошлись бы с фильтром поиска.
  let shown = [];

  const driveLabels = () =>
    Object.fromEntries(fs.drives().map((d) => [d.name, d.label || d.name]));

  const go = (target) => {
    if (!target) return;
    const node = fs.resolve(target);
    if (!node || node.type !== "dir") return;
    state.history.push(target);
    state.selected = null;
    state.query = "";
    search.value = "";
    draw();
  };

  // Папка открывается в этом же окне, остальное - как везде в системе.
  const open = (entry) => {
    if (entry.type === "dir") return go(entry.path);
    openEntry(entry);
  };

  // --- Отрисовка ---

  function draw() {
    const path = state.history.current;
    setWindowTitle("explorer", path === THIS_PC ? THIS_PC : baseName(path));

    let entries = [];
    try {
      entries = fs.list(path);
    } catch {
      entries = [];
    }
    shown = sortEntries(filterEntries(entries, state.query), state.sort.key, state.sort.dir);

    drawNav();
    drawCrumbs(path);
    drawView(shown);

    root.querySelector('[data-nav="back"]').disabled = !state.history.canBack;
    root.querySelector('[data-nav="forward"]').disabled = !state.history.canForward;
    root.querySelector('[data-nav="up"]').disabled = !parentPath(path);
    for (const btn of root.querySelectorAll("[data-view]")) {
      btn.classList.toggle("is-active", btn.dataset.view === state.view);
    }
    status.textContent = statusText(shown, state.selected);
  }

  function drawNav() {
    const path = state.history.current;
    const quick = QUICK_ACCESS.map(
      (item) => `
        <button type="button" class="ex-nav-item${item.path === path ? " is-current" : ""}"
                data-go="${escapeHtml(item.path)}">
          <span class="ex-nav-icon">${icon("i-folder")}</span>${escapeHtml(item.label)}
        </button>`,
    ).join("");

    nav.innerHTML = `
      <div class="ex-nav-group">
        <div class="ex-nav-label">Quick access</div>
        ${quick}
      </div>
      <div class="ex-nav-group">
        <div class="ex-nav-label">This PC</div>
        <button type="button" class="ex-nav-item${path === THIS_PC ? " is-current" : ""}"
                data-go="${THIS_PC}"><span class="ex-nav-icon">${icon("i-pc")}</span>This PC</button>
        ${fs.drives().map((d) => treeHtml(d, 1)).join("")}
      </div>`;
  }

  // Дерево рисуется только для раскрытых узлов: иначе на каждую перерисовку
  // пришлось бы обходить весь диск.
  function treeHtml(entry, depth) {
    if (entry.type !== "dir") return "";
    const open = state.expanded.has(entry.path);
    const current = entry.path === state.history.current;
    let children = [];
    if (open) {
      try {
        children = fs.list(entry.path).filter((e) => e.type === "dir");
      } catch {
        children = [];
      }
    }
    const hasChildren = open ? children.length > 0 : true;

    return `
      <div class="ex-tree-row" style="--depth:${depth}">
        <button type="button" class="ex-twisty${open ? " is-open" : ""}"
                data-expand="${escapeHtml(entry.path)}"
                aria-label="${open ? "Collapse" : "Expand"}">${hasChildren ? "›" : ""}</button>
        <button type="button" class="ex-nav-item${current ? " is-current" : ""}"
                data-go="${escapeHtml(entry.path)}">
          <span class="ex-nav-icon">${iconFor(entry)}</span>${escapeHtml(entry.label || entry.name)}
        </button>
      </div>
      ${open ? children.map((c) => treeHtml(c, depth + 1)).join("") : ""}`;
  }

  function drawCrumbs(path) {
    crumbs.innerHTML = breadcrumbs(path, driveLabels())
      .map(
        (c, i, all) =>
          `<button type="button" class="ex-crumb${i === all.length - 1 ? " is-last" : ""}"
                   data-go="${escapeHtml(c.path)}">${escapeHtml(c.label)}</button>`,
      )
      .join('<span class="ex-crumb-sep">›</span>');
    // Хвост пути важнее корня: если не влезло, показываем конец.
    crumbs.scrollLeft = crumbs.scrollWidth;
  }

  function drawView(entries) {
    if (!entries.length) {
      view.innerHTML = `<p class="ex-empty">${
        state.query ? "No items match your search." : "This folder is empty."
      }</p>`;
      return;
    }
    view.innerHTML = state.view === "icons" ? iconsHtml(entries) : detailsHtml(entries);
  }

  function detailsHtml(entries) {
    const head = COLUMNS.map(
      (c) => `
        <button type="button" class="ex-col ex-col--${c.key}" data-sort="${c.key}">
          ${c.label}${state.sort.key === c.key ? `<span class="ex-caret">${state.sort.dir === 1 ? "▲" : "▼"}</span>` : ""}
        </button>`,
    ).join("");

    const rows = entries
      .map(
        (e) => `
        <div class="ex-row${e.path === state.selected?.path ? " is-selected" : ""}"
             data-path="${escapeHtml(e.path)}" tabindex="0" role="button">
          <span class="ex-cell ex-col--name"><span class="ex-icon">${iconFor(e)}</span>${escapeHtml(e.name)}</span>
          <span class="ex-cell ex-col--modified">${escapeHtml(formatDate(e.modified))}</span>
          <span class="ex-cell ex-col--kind">${escapeHtml(e.kind)}</span>
          <span class="ex-cell ex-col--size">${escapeHtml(formatSize(e.size))}</span>
        </div>`,
      )
      .join("");

    return `<div class="ex-table"><div class="ex-head">${head}</div><div class="ex-rows">${rows}</div></div>`;
  }

  function iconsHtml(entries) {
    return `<div class="ex-tiles">${entries
      .map(
        (e) => `
        <div class="ex-tile${e.path === state.selected?.path ? " is-selected" : ""}"
             data-path="${escapeHtml(e.path)}" tabindex="0" role="button">
          <span class="ex-tile-icon">${iconFor(e)}</span>
          <span class="ex-tile-name">${escapeHtml(e.name)}</span>
        </div>`,
      )
      .join("")}</div>`;
  }

  // --- События ---

  const entryAt = (path) => shown.find((e) => e.path === path) ?? null;

  // Выделение меняем классом на месте: перерисовка списка заменила бы строку
  // между двумя кликами, и браузеру не на чем было бы поднять dblclick.
  const select = (row) => {
    state.selected = entryAt(row.dataset.path);
    for (const el of view.querySelectorAll("[data-path]")) {
      el.classList.toggle("is-selected", el === row);
    }
    status.textContent = statusText(shown, state.selected);
  };

  const goUp = () => {
    const up = parentPath(state.history.current);
    if (!up) return;
    state.history.push(up);
    state.selected = null;
    draw();
  };

  root.addEventListener("click", (e) => {
    const expand = e.target.closest("[data-expand]");
    if (expand) {
      const key = expand.dataset.expand;
      state.expanded.has(key) ? state.expanded.delete(key) : state.expanded.add(key);
      return draw();
    }

    const goTo = e.target.closest("[data-go]");
    if (goTo) return go(goTo.dataset.go);

    const nav = e.target.closest("[data-nav]")?.dataset.nav;
    if (nav) {
      if (nav === "up") return goUp();
      if (nav === "back") state.history.back();
      if (nav === "forward") state.history.forward();
      state.selected = null;
      return draw();
    }

    const sort = e.target.closest("[data-sort]")?.dataset.sort;
    if (sort) {
      state.sort = nextSort(state.sort, sort);
      return draw();
    }

    const viewMode = e.target.closest("[data-view]")?.dataset.view;
    if (viewMode) {
      state.view = viewMode;
      return draw();
    }

    const row = e.target.closest("[data-path]");
    if (row) return select(row);

    // Клик по пустому месту адресной строки открывает поле ввода пути.
    if (e.target.closest(".ex-address") && !e.target.closest(".ex-crumb")) {
      crumbs.hidden = true;
      address.hidden = false;
      address.value = state.history.current;
      address.focus();
      address.select();
    }
  });

  root.addEventListener("dblclick", (e) => {
    const row = e.target.closest("[data-path]");
    if (!row) return;
    const entry = entryAt(row.dataset.path);
    if (entry) open(entry);
  });

  const closeAddress = () => {
    address.hidden = true;
    crumbs.hidden = false;
  };

  address.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return closeAddress();
    if (e.key !== "Enter") return;
    const target = address.value.trim();
    const node = fs.resolve(target);
    if (node && node.type === "dir") {
      closeAddress();
      go(target);
    } else {
      address.classList.add("is-bad");
      setTimeout(() => address.classList.remove("is-bad"), 600);
    }
  });
  address.addEventListener("blur", closeAddress);

  search.addEventListener("input", () => {
    state.query = search.value;
    state.selected = null;
    draw();
  });

  view.addEventListener("keydown", (e) => {
    const row = e.target.closest("[data-path]");
    if (row && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      const entry = entryAt(row.dataset.path);
      if (entry) open(entry);
      return;
    }
    if (row && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const all = [...view.querySelectorAll("[data-path]")];
      const next = all[all.indexOf(row) + (e.key === "ArrowDown" ? 1 : -1)];
      if (!next) return;
      next.focus();
      select(next);
    }
  });

  windowContent.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !e.target.matches("input")) {
      e.preventDefault();
      goUp();
    }
    if (e.key === "F5") {
      e.preventDefault();
      draw();
    }
  });

  redraw = () => {
    if (root.isConnected) draw();
    else redraw = null;
  };

  draw();
}
