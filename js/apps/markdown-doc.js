// Разбор markdown-документа без DOM и без рендера: фронтматтер, статистика,
// оглавление. Всё, что можно проверить на node --test, живёт здесь.

const FENCE_RE = /^```[\s\S]*?^```$/gm;

// --- Фронтматтер ---

// Полноценный YAML не нужен: в проектах есть только `ключ: значение`, списки в
// квадратных скобках и строки. Тащить парсер ради шести полей незачем.
function parseValue(raw) {
  const value = raw.trim();
  if (!value) return "";

  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => unquote(item.trim()))
      .filter(Boolean);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  // `year: 2026` - число, а вот id в Discord из восемнадцати цифр числом быть
  // не может: Number молча округлит его и ссылка на профиль сломается.
  if (/^-?\d+$/.test(value) && Number.isSafeInteger(Number(value))) {
    return Number(value);
  }
  return unquote(value);
}

function unquote(value) {
  const m = String(value).match(/^(['"])([\s\S]*)\1$/);
  return m ? m[2] : value;
}

// Строка со смыслом: пустые и комментарии в разборе не участвуют.
function meaningful(line) {
  return Boolean(line.trim()) && !line.trimStart().startsWith("#");
}

export function parseFrontmatter(raw) {
  const text = String(raw ?? "").replace(/^﻿/, "");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) return { data: {}, body: text };

  const data = {};
  const lines = match[1].split(/\r?\n/);
  // Открытый блочный список и его последняя запись, если она объект.
  let list = null;
  let entry = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!meaningful(line)) continue;
    const trimmed = line.trim();
    const indented = /^\s/.test(line);

    // Новый элемент блочного списка: `- Русский` или `- period: 2025`.
    if (list && indented && trimmed.startsWith("- ")) {
      const item = trimmed.slice(2).trim();
      const colon = item.indexOf(":");
      if (colon === -1) {
        list.push(unquote(item));
        entry = null;
      } else {
        entry = { [item.slice(0, colon).trim()]: parseValue(item.slice(colon + 1)) };
        list.push(entry);
      }
      continue;
    }

    // Остальные поля того же элемента идут с отступом под своим дефисом.
    if (entry && indented) {
      const colon = trimmed.indexOf(":");
      if (colon !== -1) {
        entry[trimmed.slice(0, colon).trim()] = parseValue(trimmed.slice(colon + 1));
        continue;
      }
    }

    list = null;
    entry = null;

    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1);

    // `key:` без значения открывает блочный список, только если следом правда
    // идёт дефис. Иначе это по-прежнему пустая строка, а не пустой массив:
    // `[]` истинно, и `data.image || fallback` перестал бы работать.
    if (!value.trim()) {
      const next = lines.slice(i + 1).find(meaningful);
      if (next && /^\s/.test(next) && next.trim().startsWith("- ")) {
        list = [];
        data[key] = list;
        continue;
      }
    }

    // Только первое двоеточие: `description: Каталог аниме: поиск` - одна строка.
    data[key] = parseValue(value);
  }

  return { data, body: text.slice(match[0].length) };
}

// --- Статистика ---

export function wordCount(markdown) {
  const text = String(markdown ?? "")
    // Блок кода читатель пропускает, а `инлайн` читает - он остаётся словом.
    .replace(FENCE_RE, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]+/g, " ");
  const words = text.split(/\s+/).filter(Boolean);
  return words.length;
}

// 200 слов в минуту - обычная оценка для чтения с экрана.
export function readingTime(words) {
  return Math.max(1, Math.round(words / 200));
}

// --- Оглавление ---

export function slugify(text) {
  return (
    String(text ?? "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

// Одинаковые заголовки не должны получить один и тот же id, иначе якорь
// оглавления всегда ведёт на первый из них.
export function uniqueSlug(text, used) {
  const base = slugify(text);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  used.add(`${base}-${n}`);
  return `${base}-${n}`;
}

// [{ level, text }] -> [{ level, text, id, depth }], где depth нормализован
// относительно самого крупного заголовка документа.
export function buildOutline(headings) {
  const used = new Set();
  const top = headings.length
    ? Math.min(...headings.map((h) => h.level))
    : 1;
  return headings.map((h) => ({
    level: h.level,
    text: h.text,
    id: h.id || uniqueSlug(h.text, used),
    depth: h.level - top,
  }));
}

// --- Заголовок окна ---

export function titleFor(path, data) {
  const name = String(path ?? "").split("\\").pop();
  return name || data?.name || "Untitled.md";
}
