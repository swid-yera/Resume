// Логика Проводника без DOM: колонки, сортировка, форматирование, крошки,
// история переходов. Всё, что можно проверить на node --test, живёт здесь.

import { THIS_PC, parsePath, formatPath, extensionOf } from "../fs.js";

export const COLUMNS = [
  { key: "name", label: "Name" },
  { key: "modified", label: "Date modified" },
  { key: "kind", label: "Type" },
  { key: "size", label: "Size", numeric: true },
];

export const QUICK_ACCESS = [
  { label: "Desktop", path: "C:\\Users\\antawkay\\Desktop" },
  { label: "Documents", path: "C:\\Users\\antawkay\\Documents" },
  { label: "Downloads", path: "C:\\Users\\antawkay\\Downloads" },
  { label: "Pictures", path: "C:\\Users\\antawkay\\Pictures" },
  { label: "Projects", path: "C:\\Users\\antawkay\\Documents\\Projects" },
];

const ICONS = {
  dir: "i-folder",
  drive: "i-drive",
  app: "i-shortcut",
  md: "i-file-text",
  txt: "i-file-blank",
  img: "i-image",
  file: "i-file",
};

const IMAGE_EXT = new Set(["webp", "png", "jpg", "jpeg", "gif", "svg"]);

export const isImage = (name) => IMAGE_EXT.has(extensionOf(name));

// Символы лежат в спрайте в index.html; размер задаёт font-size обёртки.
export const icon = (id) => `<svg class="fileicon" aria-hidden="true"><use href="#${id}"/></svg>`;

export function iconFor(entry) {
  if (entry.type === "dir") return icon(entry.label ? ICONS.drive : ICONS.dir);
  if (entry.type === "app") return icon(ICONS.app);
  const ext = extensionOf(entry.name);
  if (ext === "md" || ext === "markdown") return icon(ICONS.md);
  if (IMAGE_EXT.has(ext)) return icon(ICONS.img);
  if (ext === "txt") return icon(ICONS.txt);
  return icon(ICONS.file);
}

// --- Форматирование ---

function group(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Проводник не показывает байты: всё, что меньше килобайта, это «1 KB».
export function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return "";
  if (bytes === 0) return "0 KB";
  const kb = Math.ceil(bytes / 1024);
  if (kb < 1024) return group(kb) + " KB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return mb.toFixed(1) + " MB";
  return (mb / 1024).toFixed(1) + " GB";
}

const pad = (n) => String(n).padStart(2, "0");

// dd.mm.yyyy hh:mm - тот же формат, что в русской Windows.
export function formatDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return (
    `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// --- Сортировка ---

const RANK = { dir: 0, app: 1, file: 2 };

export function sortEntries(entries, key = "name", dir = 1) {
  const compare = (a, b) => {
    if (key === "size") return (a.size ?? -1) - (b.size ?? -1);
    if (key === "modified") {
      return String(a.modified ?? "").localeCompare(String(b.modified ?? ""));
    }
    if (key === "kind") {
      return a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  };

  // Папки и ярлыки всегда выше файлов, в какую бы сторону ни сортировали:
  // так же ведёт себя Проводник.
  return [...entries].sort(
    (a, b) => RANK[a.type] - RANK[b.type] || compare(a, b) * dir,
  );
}

// Повторный клик по колонке разворачивает её, новая колонка начинается по
// возрастанию - кроме даты, которую всегда хочется видеть свежей сверху.
export function nextSort(current, key) {
  if (current.key === key) return { key, dir: current.dir === 1 ? -1 : 1 };
  return { key, dir: key === "modified" ? -1 : 1 };
}

// --- Поиск ---

export function filterEntries(entries, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.name.toLowerCase().includes(q));
}

// --- Крошки ---

export function breadcrumbs(path, labels = {}) {
  const segs = parsePath(path);
  const crumbs = [{ label: THIS_PC, path: THIS_PC }];
  for (let i = 0; i < segs.length; i++) {
    const at = formatPath(segs.slice(0, i + 1));
    crumbs.push({ label: labels[segs[i]] || segs[i], path: at });
  }
  return crumbs;
}

// --- Статус-бар ---

export function statusText(entries, selected) {
  const count = `${entries.length} item${entries.length === 1 ? "" : "s"}`;
  if (!selected) return count;
  const size = formatSize(selected.size);
  return [count, "1 item selected", size].filter(Boolean).join(" · ");
}

// --- История ---

// У каждого окна своя, живёт пока окно открыто. Ведёт себя как в браузере:
// переход после «назад» отрезает хвост.
export class History {
  constructor(start) {
    this.stack = [start];
    this.index = 0;
  }

  get current() {
    return this.stack[this.index];
  }

  get canBack() {
    return this.index > 0;
  }

  get canForward() {
    return this.index < this.stack.length - 1;
  }

  push(path) {
    if (path === this.current) return this.current;
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(path);
    this.index = this.stack.length - 1;
    return this.current;
  }

  back() {
    if (this.canBack) this.index--;
    return this.current;
  }

  forward() {
    if (this.canForward) this.index++;
    return this.current;
  }
}
