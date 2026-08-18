// Дополнение по Tab и подсказка из истории - как в PSReadLine, но без DOM.
//
// Два независимых механизма, которые в pwsh легко перепутать:
//   дополнение (Tab)   - перебирает варианты из команд и файловой системы;
//   предсказание (->)  - показывает серым хвост команды, уже набранной раньше.
// Tab предсказание игнорирует, а не принимает: так задокументировано поведение
// PSReadLine, и мышечная память с настоящего pwsh переносится сюда без сюрпризов.

import { COMMAND_NAMES } from "./console-commands.js";

function tokens(line) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, value: m[0] });
  }
  return out;
}

// Токен под кареткой. Каретка в пробелах или в конце строки означает начало
// нового, пустого токена - иначе Tab после `cd ` не предложил бы ничего.
export function tokenAt(line, caret) {
  const pos = Math.max(0, Math.min(caret ?? line.length, line.length));
  const list = tokens(line);
  for (let i = 0; i < list.length; i++) {
    if (pos >= list[i].start && pos <= list[i].end) return { ...list[i], index: i };
  }
  return { start: pos, end: pos, value: "", index: list.filter((t) => t.end <= pos).length };
}

// Делит путь на «куда смотреть» и «что искать»: `C:\Users\ant` -> папка
// `C:\Users`, префикс `ant`. Head хранит набранное начало, чтобы вернуть его
// в строку целиком и не потерять регистр, который ввёл пользователь.
function splitPathToken(value) {
  const i = Math.max(value.lastIndexOf("\\"), value.lastIndexOf("/"));
  if (i < 0) return { dir: ".", prefix: value, head: "" };
  return { dir: value.slice(0, i) || "\\", prefix: value.slice(i + 1), head: value.slice(0, i + 1) };
}

// Варианты для токена под кареткой: первое слово дополняется командами,
// остальные - содержимым папки. Папка получает хвостовой слэш, чтобы следующий
// Tab уходил вглубь без ручного ввода разделителя.
export function completionsFor(fs, line, caret) {
  const t = tokenAt(line, caret);
  const span = { start: t.start, end: t.end };

  if (t.index === 0) {
    const q = t.value.toLowerCase();
    return { ...span, items: COMMAND_NAMES.filter((n) => n.startsWith(q)) };
  }

  const { dir, prefix, head } = splitPathToken(t.value);
  let entries;
  try {
    entries = fs.list(dir);
  } catch {
    return { ...span, items: [] };
  }
  const q = prefix.toLowerCase();
  const items = entries
    .filter((e) => e.name.toLowerCase().startsWith(q))
    .map((e) => head + e.name + (e.type === "dir" ? "\\" : ""));
  return { ...span, items };
}

export function applyCompletion(line, span, item) {
  return {
    line: line.slice(0, span.start) + item + line.slice(span.end),
    caret: span.start + item.length,
  };
}

// Хвост самой свежей команды истории, начинающейся с уже набранного. Пустая
// строка не предсказывается: иначе подсказка висела бы над пустым приглашением.
export function predictFrom(history, line) {
  if (!line) return "";
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.length > line.length && h.startsWith(line)) return h.slice(line.length);
  }
  return "";
}

// Ctrl+F принимает одно слово подсказки вместе с ведущими пробелами, чтобы
// после приёма каретка стояла там же, где стояла бы при ручном наборе.
export function nextWord(suffix) {
  const m = String(suffix).match(/^\s*\S+/);
  return m ? m[0] : "";
}
