import { test } from "node:test";
import assert from "node:assert/strict";

import {
  VFS,
  parsePath,
  formatPath,
  normalizePath,
  parentPath,
  joinPath,
  baseName,
  kindOf,
  fileSize,
  defaultTree,
  THIS_PC,
} from "./fs.js";

// Адаптер хранилища вместо localStorage.
function memStorage(initial = null) {
  let data = initial;
  return {
    read: () => data,
    write: (s) => {
      data = s;
    },
    get raw() {
      return data;
    },
  };
}

// Маленький явный сид, чтобы тесты не зависели от дерева по умолчанию.
function seed() {
  return {
    type: "dir",
    children: {
      "C:": {
        type: "dir",
        drive: true,
        label: "Local Disk (C:)",
        modified: "2026-01-11T08:00:00.000Z",
        children: {
          Users: {
            type: "dir",
            modified: "2026-01-11T08:00:00.000Z",
            children: {
              antawkay: {
                type: "dir",
                modified: "2026-01-11T08:00:00.000Z",
                children: {
                  Documents: {
                    type: "dir",
                    modified: "2026-05-18T10:02:00.000Z",
                    children: {
                      "notes.txt": {
                        type: "file",
                        content: "hello",
                        mime: "text/plain",
                        modified: "2026-05-18T10:02:00.000Z",
                      },
                    },
                  },
                  Pictures: { type: "dir", children: {}, modified: null },
                },
              },
            },
          },
          "GitHub.lnk": { type: "app", target: "github", modified: null },
        },
      },
    },
  };
}

const DOCS = "C:\\Users\\antawkay\\Documents";

// --- Пути ---

test("parsePath understands drives, both slashes and relative paths", () => {
  assert.deepEqual(parsePath("C:\\Users", DOCS), ["C:", "Users"]);
  assert.deepEqual(parsePath("c:/users", DOCS), ["C:", "users"]);
  assert.deepEqual(parsePath("notes.txt", DOCS), [
    "C:",
    "Users",
    "antawkay",
    "Documents",
    "notes.txt",
  ]);
  assert.deepEqual(parsePath(".\\notes.txt", DOCS), [
    "C:",
    "Users",
    "antawkay",
    "Documents",
    "notes.txt",
  ]);
  assert.deepEqual(parsePath("..", DOCS), ["C:", "Users", "antawkay"]);
  assert.deepEqual(parsePath("..\\Pictures", DOCS), [
    "C:",
    "Users",
    "antawkay",
    "Pictures",
  ]);
  // Ведущий слэш - от корня текущего диска.
  assert.deepEqual(parsePath("\\Windows", DOCS), ["C:", "Windows"]);
  // Пустой путь оставляет на месте.
  assert.deepEqual(parsePath("", DOCS), ["C:", "Users", "antawkay", "Documents"]);
});

test("parsePath never climbs above the drive root", () => {
  assert.deepEqual(parsePath("..", "C:\\"), ["C:"]);
  assert.deepEqual(parsePath("..\\..\\..\\..", DOCS), ["C:"]);
});

test("This PC is the root above the drives", () => {
  assert.deepEqual(parsePath(THIS_PC, DOCS), []);
  assert.deepEqual(parsePath("this pc", DOCS), []);
  assert.equal(formatPath([]), THIS_PC);
});

test("formatPath keeps the trailing slash only on a drive root", () => {
  assert.equal(formatPath(["C:"]), "C:\\");
  assert.equal(formatPath(["C:", "Users"]), "C:\\Users");
  // Чистая строковая операция: регистр имён она не выправляет, это делает VFS.
  assert.equal(normalizePath("c:/users/../users/antawkay"), "C:\\users\\antawkay");
});

test("parentPath walks up and stops at This PC", () => {
  assert.equal(parentPath(DOCS), "C:\\Users\\antawkay");
  assert.equal(parentPath("C:\\Users"), "C:\\");
  assert.equal(parentPath("C:\\"), THIS_PC);
  assert.equal(parentPath(THIS_PC), null);
});

test("joinPath and baseName", () => {
  assert.equal(joinPath("C:\\Users", "antawkay"), "C:\\Users\\antawkay");
  assert.equal(joinPath("C:\\", "Windows"), "C:\\Windows");
  assert.equal(baseName(DOCS), "Documents");
  assert.equal(baseName("C:\\"), "C:");
  assert.equal(baseName(THIS_PC), THIS_PC);
});

// --- Метаданные ---

test("kindOf names things the way Explorer does", () => {
  assert.equal(kindOf("Projects", { type: "dir" }), "File folder");
  assert.equal(kindOf("C:", { type: "dir", drive: true }), "Local Disk");
  assert.equal(kindOf("Terminal.lnk", { type: "app" }), "Shortcut");
  assert.equal(kindOf("anitop.md", { type: "file" }), "Markdown File");
  assert.equal(kindOf("readme.txt", { type: "file" }), "Text Document");
  assert.equal(kindOf("noext", { type: "file" }), "File");
});

test("fileSize counts bytes, not characters", () => {
  assert.equal(fileSize("hello"), 5);
  assert.equal(fileSize("привет"), 12); // кириллица по два байта
  assert.equal(fileSize(""), 0);
});

// --- Обход ---

test("This PC lists the drives", () => {
  const fs = new VFS({ seed: seed() });
  const drives = fs.drives();
  assert.equal(drives.length, 1);
  assert.equal(drives[0].name, "C:");
  assert.equal(drives[0].label, "Local Disk (C:)");
  assert.equal(drives[0].kind, "Local Disk");
});

test("a new VFS starts in the home folder", () => {
  const fs = new VFS({ seed: defaultTree() });
  assert.equal(fs.pwd(), "C:\\Users\\antawkay");
  const names = fs.list(".").map((e) => e.name);
  for (const expected of ["Desktop", "Documents", "Downloads", "Pictures"]) {
    assert.ok(names.includes(expected), `home should contain ${expected}`);
  }
});

test("the default tree puts projects under Documents", () => {
  const fs = new VFS({ seed: defaultTree() });
  assert.equal(fs.resolve("C:\\Users\\antawkay\\Documents\\Projects").type, "dir");
  assert.equal(fs.resolve("C:\\Users\\antawkay\\Desktop\\Resume.lnk").type, "app");
  // Сведения о системе - в C:\Windows, а не на рабочем столе.
  assert.equal(fs.resolve("C:\\Windows\\About.md").type, "file");
  assert.equal(fs.resolve("C:\\Windows\\System32\\drivers\\etc\\hosts").type, "file");
});

test("list returns folders, then shortcuts, then files", () => {
  const fs = new VFS({ seed: seed() });
  fs.write("C:\\a.txt", "x");
  fs.mkdir("C:\\zfolder");
  const entries = fs.list("C:\\").map((e) => `${e.type}:${e.name}`);
  assert.deepEqual(entries, [
    "dir:Users",
    "dir:zfolder",
    "app:GitHub.lnk",
    "file:a.txt",
  ]);
});

test("list entries carry the columns Explorer shows", () => {
  const fs = new VFS({ seed: seed() });
  const [notes] = fs.list(DOCS);
  assert.equal(notes.name, "notes.txt");
  assert.equal(notes.path, DOCS + "\\notes.txt");
  assert.equal(notes.kind, "Text Document");
  assert.equal(notes.size, 5);
  assert.equal(notes.modified, "2026-05-18T10:02:00.000Z");
});

test("folders report no size", () => {
  const fs = new VFS({ seed: seed() });
  const [docs] = fs.list("C:\\Users\\antawkay");
  assert.equal(docs.name, "Documents");
  assert.equal(docs.size, null);
});

test("stat describes a single node, This PC included", () => {
  const fs = new VFS({ seed: seed() });
  assert.equal(fs.stat(DOCS).kind, "File folder");
  assert.equal(fs.stat(THIS_PC).name, THIS_PC);
  assert.equal(fs.stat("C:\\GitHub.lnk").target, "github");
  assert.equal(fs.stat("C:\\nope"), null);
});

test("list throws on a missing path or a file", () => {
  const fs = new VFS({ seed: seed() });
  assert.throws(() => fs.list("C:\\nope"));
  assert.throws(() => fs.list(DOCS + "\\notes.txt"));
});

// --- Чтение и запись ---

test("read returns content; write overwrites and stamps the date", () => {
  const fs = new VFS({ seed: seed() });
  assert.equal(fs.read(DOCS + "\\notes.txt"), "hello");
  fs.write(DOCS + "\\notes.txt", "world");
  assert.equal(fs.read(DOCS + "\\notes.txt"), "world");
  assert.notEqual(fs.stat(DOCS + "\\notes.txt").modified, "2026-05-18T10:02:00.000Z");
});

test("write picks the mime type from the extension", () => {
  const fs = new VFS({ seed: seed() });
  fs.write(DOCS + "\\note.md", "# hi");
  assert.equal(fs.resolve(DOCS + "\\note.md").mime, "text/markdown");
});

test("write throws when the parent folder is missing", () => {
  const fs = new VFS({ seed: seed() });
  assert.throws(() => fs.write("C:\\Missing\\x.txt", "y"));
});

test("read throws on a folder or a missing file", () => {
  const fs = new VFS({ seed: seed() });
  assert.throws(() => fs.read(DOCS));
  assert.throws(() => fs.read(DOCS + "\\ghost.txt"));
});

// --- mkdir и remove ---

test("mkdir creates a folder and refuses duplicates", () => {
  const fs = new VFS({ seed: seed() });
  fs.mkdir(DOCS + "\\Projects");
  assert.equal(fs.resolve(DOCS + "\\Projects").type, "dir");
  assert.deepEqual(fs.list(DOCS + "\\Projects"), []);
  assert.throws(() => fs.mkdir(DOCS + "\\Projects"));
  assert.throws(() => fs.mkdir("C:\\Missing\\Sub"));
});

test("remove deletes a node but protects the drive and This PC", () => {
  const fs = new VFS({ seed: seed() });
  fs.remove(DOCS + "\\notes.txt");
  assert.equal(fs.resolve(DOCS + "\\notes.txt"), null);
  assert.throws(() => fs.remove("C:\\"));
  assert.throws(() => fs.remove(THIS_PC));
  assert.throws(() => fs.remove("C:\\ghost"));
});

// --- cd ---

test("chdir moves around and resolves relative paths", () => {
  const fs = new VFS({ seed: seed() });
  fs.chdir(DOCS);
  assert.equal(fs.pwd(), DOCS);
  assert.equal(fs.read("notes.txt"), "hello");
  fs.chdir("..");
  assert.equal(fs.pwd(), "C:\\Users\\antawkay");
  fs.chdir("\\");
  assert.equal(fs.pwd(), "C:\\");
  fs.chdir(THIS_PC);
  assert.equal(fs.pwd(), THIS_PC);
});

test("lookups ignore case but paths keep the name on disk", () => {
  const fs = new VFS({ seed: seed() });
  fs.chdir("c:\\users\\ANTAWKAY\\documents");
  assert.equal(fs.pwd(), DOCS);
  assert.equal(fs.read("NOTES.TXT"), "hello");
  assert.equal(fs.stat("c:\\USERS").path, "C:\\Users");
});

test("chdir into a file or a missing folder throws", () => {
  const fs = new VFS({ seed: seed() });
  assert.throws(() => fs.chdir(DOCS + "\\notes.txt"));
  assert.throws(() => fs.chdir("C:\\nowhere"));
});

// --- syncFolder ---

test("syncFolder replaces the folder contents wholesale", () => {
  const fs = new VFS({ seed: seed() });
  fs.mkdir(DOCS + "\\Projects");
  fs.write(DOCS + "\\Projects\\stale.md", "old");

  fs.syncFolder(DOCS + "\\Projects", [
    { name: "anitop.md", content: "# AniTop", modified: "2026-06-14T18:35:00.000Z" },
  ]);

  const names = fs.list(DOCS + "\\Projects").map((e) => e.name);
  assert.deepEqual(names, ["anitop.md"]);
  assert.equal(fs.read(DOCS + "\\Projects\\anitop.md"), "# AniTop");
  assert.equal(
    fs.stat(DOCS + "\\Projects\\anitop.md").modified,
    "2026-06-14T18:35:00.000Z",
  );
});

// --- Персистентность ---

test("mutations persist through the storage adapter", () => {
  const storage = memStorage();
  const fs = new VFS({ seed: seed(), storage });
  fs.write(DOCS + "\\new.txt", "persisted");
  assert.ok(storage.raw, "storage should have been written");

  const restored = new VFS({ storage });
  assert.equal(restored.read(DOCS + "\\new.txt"), "persisted");
});

test("stored tree wins over the seed", () => {
  const storage = memStorage();
  new VFS({ seed: seed(), storage }).write("C:\\marker.txt", "1");

  const fs = new VFS({ seed: { type: "dir", children: {} }, storage });
  assert.equal(fs.read("C:\\marker.txt"), "1");
});
