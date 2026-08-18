// Виртуальная файловая система в виндовом виде: диски, пути через `\`,
// метаданные для колонок Проводника. Дерево целиком лежит в localStorage.
//
// Формы узлов:
//   dir   { type:"dir",  children: { name: node }, modified }
//   drive { type:"dir",  children, modified, drive:true, label:"Local Disk (C:)" }
//   file  { type:"file", content, mime, modified }
//   app   { type:"app",  target, modified }   // ярлык -> openWindow(target)
//
// Размер файла не хранится: он считается из содержимого, иначе врал бы после
// первой же записи.

export const STORAGE_KEY = "pc-fs-v2";

// Корень над дисками. Единственное место, где перечисляются сами диски.
export const THIS_PC = "This PC";
export const HOME = "C:\\Users\\antawkay";
export const DESKTOP = HOME + "\\Desktop";
export const PROJECTS_DIR = "C:\\Users\\antawkay\\Documents\\Projects";

const DEFAULT_CWD = HOME;
const DRIVE_RE = /^[A-Za-z]:$/;

// Папки, потом ярлыки, потом файлы; внутри ранга по алфавиту.
const TYPE_RANK = { dir: 0, app: 1, file: 2 };

const KIND_BY_EXT = {
  md: "Markdown File",
  markdown: "Markdown File",
  txt: "Text Document",
  json: "JSON File",
  ini: "Configuration File",
  css: "Cascading Style Sheet",
  js: "JavaScript File",
  html: "HTML Document",
  webp: "Image File",
  png: "Image File",
  jpg: "Image File",
  jpeg: "Image File",
};

// --- Пути ---

export function extensionOf(name) {
  const dot = String(name).lastIndexOf(".");
  return dot > 0 ? String(name).slice(dot + 1).toLowerCase() : "";
}

export function kindOf(name, node) {
  if (!node) return "";
  if (node.type === "dir") return node.drive ? "Local Disk" : "File folder";
  if (node.type === "app") return "Shortcut";
  return KIND_BY_EXT[extensionOf(name)] || "File";
}

export function fileSize(content) {
  return new TextEncoder().encode(String(content ?? "")).length;
}

function baseSegs(cwd) {
  const raw = String(cwd ?? "").trim().replace(/\//g, "\\");
  if (!raw || raw.toLowerCase() === THIS_PC.toLowerCase()) return [];
  return raw
    .split("\\")
    .filter(Boolean)
    .map((part, i) => (i === 0 && DRIVE_RE.test(part) ? part.toUpperCase() : part));
}

// "C:\Users\..", "..\Pictures", "\Windows", "This PC" -> список сегментов.
export function parsePath(input, cwd = DEFAULT_CWD) {
  const raw = String(input ?? "").trim().replace(/\//g, "\\");
  const base = baseSegs(cwd);
  if (!raw) return base;
  if (raw.toLowerCase() === THIS_PC.toLowerCase()) return [];

  const parts = raw.split("\\").filter(Boolean);
  let segs;

  if (parts.length && DRIVE_RE.test(parts[0])) {
    segs = [parts.shift().toUpperCase()];
  } else if (raw.startsWith("\\")) {
    segs = base.slice(0, 1); // от корня текущего диска
  } else {
    segs = base.slice();
  }

  for (const part of parts) {
    if (part === ".") continue;
    // Выше корня диска Windows не пускает: `cd ..` в `C:\` оставляет на месте.
    if (part === "..") {
      if (segs.length > 1) segs.pop();
      continue;
    }
    segs.push(part);
  }
  return segs;
}

export function formatPath(segs) {
  if (!segs.length) return THIS_PC;
  if (segs.length === 1) return segs[0] + "\\";
  return segs.join("\\");
}

export function normalizePath(path, cwd = DEFAULT_CWD) {
  return formatPath(parsePath(path, cwd));
}

export function joinPath(path, name) {
  return formatPath([...parsePath(path), name]);
}

// Вверх из `C:\` ведёт в This PC, как в Проводнике. Из This PC - никуда.
export function parentPath(path) {
  const segs = parsePath(path);
  if (!segs.length) return null;
  return formatPath(segs.slice(0, -1));
}

export function baseName(path) {
  const segs = parsePath(path);
  if (!segs.length) return THIS_PC;
  return segs[segs.length - 1];
}

// --- VFS ---

export class VFS {
  constructor({ seed, storage } = {}) {
    this.storage = storage || null;
    this.root = this.#loadTree(seed);
    this.cwd = DEFAULT_CWD;
  }

  #loadTree(seed) {
    if (this.storage) {
      const raw = this.storage.read();
      if (raw) {
        try {
          const tree = JSON.parse(raw);
          if (tree && tree.type === "dir" && tree.children) return tree;
        } catch {
          /* испорченное хранилище - падаем на сид */
        }
      }
    }
    return structuredClone(seed || defaultTree());
  }

  #persist() {
    if (!this.storage) return true;
    return this.storage.write(JSON.stringify(this.root)) !== false;
  }

  // Обход с приведением регистра: в Windows `cd documents` открывает Documents,
  // но в путях остаётся то имя, которым папка названа на диске.
  #walk(segs) {
    let node = this.root;
    const real = [];
    for (const seg of segs) {
      if (node.type !== "dir") return null;
      const name = childName(node, seg);
      if (name === null) return null;
      node = node.children[name];
      real.push(name);
    }
    return { node, segs: real };
  }

  #resolveSegs(segs) {
    return this.#walk(segs)?.node ?? null;
  }

  // [родительский узел, имя, сегменты]; бросает, если родителя нет.
  #parentOf(path) {
    const segs = parsePath(path, this.cwd);
    if (segs.length === 0) throw new Error("Invalid path: " + path);
    const found = this.#walk(segs.slice(0, -1));
    if (!found || found.node.type !== "dir") {
      throw new Error("The system cannot find the path specified: " + path);
    }
    const wanted = segs[segs.length - 1];
    // Существующий файл перезаписывается под своим именем, новый - под тем,
    // как его назвали.
    const name = childName(found.node, wanted) ?? wanted;
    return [found.node, name, [...found.segs, name]];
  }

  #entry(name, node, segs) {
    const entry = {
      name,
      path: formatPath(segs),
      type: node.type,
      kind: kindOf(name, node),
      modified: node.modified ?? null,
      // У картинки содержимого нет, вес задан в сиде.
      size: node.type === "file" ? (node.size ?? fileSize(node.content)) : null,
    };
    if (node.src) entry.src = node.src;
    if (node.type === "app") entry.target = node.target;
    if (node.label) entry.label = node.label;
    return entry;
  }

  resolve(path) {
    return this.#resolveSegs(parsePath(path, this.cwd));
  }

  exists(path) {
    return this.resolve(path) != null;
  }

  pwd() {
    return this.cwd;
  }

  drives() {
    return this.list(THIS_PC);
  }

  stat(path) {
    const found = this.#walk(parsePath(path, this.cwd));
    if (!found) return null;
    const { node, segs } = found;
    return this.#entry(segs.length ? segs[segs.length - 1] : THIS_PC, node, segs);
  }

  list(path = ".") {
    const found = this.#walk(parsePath(path, this.cwd));
    if (!found) {
      throw new Error("The system cannot find the path specified: " + path);
    }
    const { node, segs } = found;
    if (node.type !== "dir") throw new Error("Not a directory: " + path);
    return Object.entries(node.children)
      .map(([name, child]) => this.#entry(name, child, [...segs, name]))
      .sort(
        (a, b) =>
          TYPE_RANK[a.type] - TYPE_RANK[b.type] ||
          a.name.localeCompare(b.name, undefined, { numeric: true }),
      );
  }

  read(path) {
    const node = this.resolve(path);
    if (!node) throw new Error("The system cannot find the file specified: " + path);
    if (node.type !== "file") throw new Error("Not a file: " + path);
    return node.content;
  }

  // Готовый узел целиком: перетащенный файл уже разобран в drop-model.
  // Возвращает false, если сохранить не удалось - у localStorage кончилась квота.
  put(path, node) {
    const [parent, name] = this.#parentOf(path);
    const existing = parent.children[name];
    if (existing && existing.type !== "file") throw new Error("Not a file: " + path);
    parent.children[name] = { ...node, type: "file" };
    return this.#persist();
  }

  write(path, content, mime) {
    const [parent, name] = this.#parentOf(path);
    const existing = parent.children[name];
    if (existing && existing.type !== "file") throw new Error("Not a file: " + path);
    parent.children[name] = {
      type: "file",
      content: String(content),
      mime: mime || existing?.mime || mimeFor(name),
      modified: new Date().toISOString(),
    };
    this.#persist();
  }

  mkdir(path) {
    const [parent, name] = this.#parentOf(path);
    if (parent.children[name]) throw new Error("Already exists: " + path);
    parent.children[name] = {
      type: "dir",
      children: {},
      modified: new Date().toISOString(),
    };
    this.#persist();
  }

  remove(path) {
    const [parent, name, segs] = this.#parentOf(path);
    if (segs.length <= 1) throw new Error("Access denied: " + path);
    if (!parent.children[name]) {
      throw new Error("The system cannot find the file specified: " + path);
    }
    delete parent.children[name];
    this.#persist();
  }

  chdir(path) {
    const found = this.#walk(parsePath(path, this.cwd));
    if (!found) {
      throw new Error("The system cannot find the path specified: " + path);
    }
    if (found.node.type !== "dir") throw new Error("Not a directory: " + path);
    this.cwd = formatPath(found.segs);
  }

  // Полная замена содержимого папки. Нужна системному контенту (проекты
  // приезжают из бандла), который не должен застревать в старом localStorage.
  syncFolder(path, files) {
    const node = this.resolve(path);
    if (!node || node.type !== "dir") return;
    node.children = {};
    for (const file of files) {
      node.children[file.name] = {
        type: "file",
        content: String(file.content),
        mime: file.mime || mimeFor(file.name),
        modified: file.modified || new Date().toISOString(),
      };
    }
    this.#persist();
  }
}

// Точное имя ребёнка, иначе первое совпадающее без учёта регистра.
function childName(node, seg) {
  if (Object.hasOwn(node.children, seg)) return seg;
  const lower = seg.toLowerCase();
  for (const name of Object.keys(node.children)) {
    if (name.toLowerCase() === lower) return name;
  }
  return null;
}

function mimeFor(name) {
  const ext = extensionOf(name);
  if (ext === "md" || ext === "markdown") return "text/markdown";
  if (ext === "json") return "application/json";
  if (ext === "html") return "text/html";
  return "text/plain";
}

// --- Сид ---

// Даты фиксированные: иначе всё вечно «изменено только что».
const T = (iso) => new Date(iso).toISOString();

const dir = (children = {}, modified = "2026-05-18T10:02:00Z") => ({
  type: "dir",
  children,
  modified: T(modified),
});

const file = (content, modified = "2026-05-18T10:02:00Z") => ({
  type: "file",
  content,
  mime: "text/plain",
  modified: T(modified),
});

const doc = (content, modified = "2026-06-14T18:35:00Z") => ({
  type: "file",
  content,
  mime: "text/markdown",
  modified: T(modified),
});

const app = (target, modified = "2026-04-02T09:14:00Z") => ({
  type: "app",
  target,
  modified: T(modified),
});

// Картинка лежит в бандле, в ФС от неё только ссылка и вес: читать в текст
// нечего. new URL, а не import: fs.js гоняется в node --test, где webp не
// разобрать, а Vite этот вид ссылки всё равно подменяет на путь к ассету.
const image = (src, size, modified = "2026-06-09T14:22:00Z") => ({
  type: "file",
  src,
  mime: "image/webp",
  size,
  modified: T(modified),
});

const ABOUT_MD = `# About this machine

**antawkay OS** — портфолио, которое притворяется настольной системой.

| | |
|---|---|
| OS | antawkay OS 2.0 |
| Shell | jjsh |
| Frameworks | нет, ванильный JS |
| Storage | localStorage |
| Диск | C:\\ (виртуальный) |

Всё, что вы видите, нарисовано вручную: окна, док, меню, Проводник и этот
ридер. Сборка — Vite, хостинг — GitHub Pages.

> Проекты лежат в \`C:\\Users\\antawkay\\Documents\\Projects\` обычными
> markdown-файлами. Их можно открыть и здесь, и в терминале через \`type\`.
`;

const README_TXT = `Documents
=========

Projects\\   — проекты, по файлу .md на каждый
readme.txt  — этот файл

Подсказки:
  Проводник открывается из дока.
  В терминале работают dir, cd, type, tree.
  В адресной строке браузера понимается file:///C:/...
`;

export function defaultTree() {
  return dir({
    "C:": {
      ...dir(
        {
          "Program Files": dir({
            Browser: dir({ "Browser.lnk": app("browser") }),
            Terminal: dir({ "Terminal.lnk": app("console") }),
            Telegram: dir({ "Telegram.lnk": app("telegram") }),
            Notes: dir({ "Notes.lnk": app("notes") }),
            GitHub: dir({ "GitHub.lnk": app("github") }),
          }),
          Users: dir({
            antawkay: dir({
              Desktop: dir({
                "Projects.lnk": app("projects"),
                "Photos.lnk": app("photos"),
                "Recycle Bin.lnk": app("trash"),
                // Ярлык на резюме, а не документ: About.md рассказывал про
                // машину, и два разных «About» на одном столе только путали.
                "Resume.lnk": app("text"),
              }),
              Documents: dir({
                // Наполняется из бандла при загрузке (syncFolder).
                Projects: dir({}, "2026-06-14T18:35:00Z"),
                "readme.txt": file(README_TXT, "2026-05-30T12:21:00Z"),
              }),
              Downloads: dir({}),
              Music: dir({}),
              Pictures: dir({
                "Photos.lnk": app("photos"),
                "photo1.webp": image(
                  new URL("../photos/photo1.webp", import.meta.url).href,
                  54338,
                ),
                "photo3.webp": image(
                  new URL("../photos/photo3.webp", import.meta.url).href,
                  37270,
                  "2026-06-09T14:25:00Z",
                ),
              }),
              Videos: dir({}),
            }),
          }),
          Windows: dir(
            {
              System32: dir({
                drivers: dir({
                  etc: dir({
                    hosts: file(
                      "# Copyright (c) 1993-2026 antawkay OS\n127.0.0.1  localhost\n::1        localhost\n",
                      "2026-01-11T08:00:00Z",
                    ),
                  }),
                }),
              }),
              // Сведения о системе лежат в C:\Windows, а не на рабочем столе:
              // это про машину, а не про её владельца.
              "About.md": doc(ABOUT_MD, "2026-07-02T21:40:00Z"),
              "win.ini": file(
                "; for 16-bit app support\n[fonts]\n[extensions]\n[mci extensions]\n",
                "2026-01-11T08:00:00Z",
              ),
            },
            "2026-01-11T08:00:00Z",
          ),
        },
        "2026-01-11T08:00:00Z",
      ),
      drive: true,
      label: "Local Disk (C:)",
    },
  });
}

// --- Синглтон для браузера (ленивый, чтобы импорт не трогал localStorage) ---

const localStorageAdapter = {
  read() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  write(s) {
    try {
      localStorage.setItem(STORAGE_KEY, s);
      return true;
    } catch {
      // Хранилище недоступно или переполнено: остаёмся в памяти, но вызвавший
      // должен об этом узнать, иначе файл молча исчезнет после перезагрузки.
      return false;
    }
  },
};

let _fs = null;

export function getFs() {
  if (!_fs) _fs = new VFS({ seed: defaultTree(), storage: localStorageAdapter });
  return _fs;
}
