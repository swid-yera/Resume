// Разбор брошенного в окно файла без DOM: чем он является, как его назвать при
// совпадении и что из него сохранить. Всё, что можно проверить на node --test.

import { extensionOf } from "./fs.js";
import { isImage } from "./apps/explorer-model.js";

// Дерево целиком сериализуется в localStorage, а квота там около 5 MB, причём
// в Chrome она считается по UTF-16. Больше четверти мегабайта на файл класть
// нельзя: одно телефонное фото в base64 забьёт хранилище целиком.
export const MAX_FILE_BYTES = 256 * 1024;

const TEXT_EXT = new Set([
  "md", "markdown", "txt", "json", "ini", "css", "js", "html", "xml",
  "csv", "yml", "yaml", "log", "sql", "sh", "java", "py",
]);

// svg попадает в картинки, а не в текст: иначе Проводник и Браузер разошлись бы
// с iconFor, где он уже считается изображением.
export function classify(name) {
  if (isImage(name)) return "image";
  return TEXT_EXT.has(extensionOf(name)) ? "text" : "binary";
}

export function tooBig(size) {
  return Number(size) > MAX_FILE_BYTES;
}

export function refusal(name, size) {
  if (!tooBig(size)) return null;
  const kb = Math.ceil(Number(size) / 1024);
  const limit = MAX_FILE_BYTES / 1024;
  return `${name} — ${kb} KB, это больше лимита в ${limit} KB`;
}

// Windows-стиль: photo.webp, photo (1).webp, photo (2).webp
export function uniqueName(existing, name) {
  const taken = new Set(existing.map((n) => String(n).toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;

  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let i = 1; ; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

// Текст лежит в content, всё остальное - data-URL в src: так картинку рисует
// уже готовый <img>, а бинарник отдаётся ссылкой на скачивание.
export function fileNode({ name, size, mime, text, dataUrl, modified }) {
  const node = {
    type: "file",
    mime: mime || "application/octet-stream",
    size,
    modified: modified || new Date().toISOString(),
  };
  if (classify(name) === "text") node.content = String(text ?? "");
  else node.src = dataUrl;
  return node;
}
