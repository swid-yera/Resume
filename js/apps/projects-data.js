// Проекты приезжают из content/projects/*.md прямо в бандл.
//
// Манифеста нет: добавил файл - он появился и в папке Projects, и в Проводнике,
// и в терминале. `import.meta.glob` понимает только Vite, поэтому модуль
// отделён от логики - на node --test он бы не запустился.
import { parseFrontmatter } from "./markdown-doc.js";
import { getFs, PROJECTS_DIR, joinPath } from "../fs.js";

const MODULES = import.meta.glob("../../content/projects/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

let cached = null;

export function projectDocs() {
  if (cached) return cached;

  cached = Object.entries(MODULES)
    .map(([file, raw]) => {
      const name = file.split("/").pop();
      const { data, body } = parseFrontmatter(raw);
      return {
        name,
        path: joinPath(PROJECTS_DIR, name),
        content: raw,
        body,
        data,
        // Дата из фронтматтера, чтобы в Проводнике не было «изменено только что».
        modified: data.date ? new Date(data.date).toISOString() : undefined,
      };
    })
    // Свежие проекты сверху и в папке, и в плитках.
    .sort((a, b) => String(b.modified ?? "").localeCompare(String(a.modified ?? "")));

  return cached;
}

// Системный контент, а не пользовательские файлы: папка пересобирается на
// каждой загрузке, иначе посетитель со старым localStorage не увидит новый
// проект.
export function mountProjects() {
  const fs = getFs();
  fs.syncFolder(
    PROJECTS_DIR,
    projectDocs().map(({ name, content, modified }) => ({
      name,
      content,
      mime: "text/markdown",
      modified,
    })),
  );
}
