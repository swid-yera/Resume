import { test } from "node:test";
import assert from "node:assert/strict";

import { VFS } from "../fs.js";
import { execute } from "./console-commands.js";

function fsFixture() {
  const fs = new VFS({
    seed: {
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
                        "anitop.md": {
                          type: "file",
                          content: "# AniTop",
                          mime: "text/markdown",
                          modified: "2026-06-14T18:35:00.000Z",
                        },
                      },
                    },
                    "GitHub.lnk": { type: "app", target: "github", modified: null },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  return fs;
}

const HOME = "C:\\Users\\antawkay";
const DOCS = HOME + "\\Documents";
const out = (fs, line) => execute(fs, line).lines.join("\n");

// --- Навигация ---

test("pwd prints the working directory", () => {
  assert.equal(out(fsFixture(), "pwd"), HOME);
});

test("cd without arguments prints the directory instead of leaving it", () => {
  const fs = fsFixture();
  assert.equal(out(fs, "cd"), HOME);
  assert.equal(fs.pwd(), HOME);
});

test("cd changes the directory and resolves relative paths", () => {
  const fs = fsFixture();
  execute(fs, "cd Documents");
  assert.equal(out(fs, "pwd"), DOCS);
  assert.equal(out(fs, "cat notes.txt"), "hello");
});

test("cd into a missing directory reports an error", () => {
  assert.match(out(fsFixture(), "cd nowhere"), /cannot find|not a directory/i);
});

// --- Списки ---

test("ls prints a Get-ChildItem table: Directory header, columns and entries", () => {
  const text = out(fsFixture(), "ls");
  assert.match(text, /Directory: C:\\Users\\antawkay/);
  assert.match(text, /Mode\s+LastWriteTime\s+Length Name/);
  assert.match(text, /----\s+-------------\s+------ ----/);
  assert.match(text, /d----.*Documents/);
  assert.match(text, /GitHub\.lnk/);
});

test("dir prints the volume header, the path and a summary", () => {
  const text = out(fsFixture(), "dir Documents");
  assert.match(text, /Volume in drive C/);
  assert.match(text, /Directory of C:\\Users\\antawkay\\Documents/);
  assert.match(text, /anitop\.md/);
  assert.match(text, /2 File\(s\)/);
  assert.match(text, /0 Dir\(s\)/);
});

test("dir shows <DIR> instead of a size for folders", () => {
  const text = out(fsFixture(), "dir");
  assert.match(text, /<DIR>\s+Documents/);
});

test("dir of an empty folder says File Not Found", () => {
  const fs = fsFixture();
  execute(fs, "mkdir Empty");
  assert.match(out(fs, "dir Empty"), /File Not Found/);
});

test("ls of a missing path errors instead of throwing", () => {
  const fs = fsFixture();
  assert.doesNotThrow(() => execute(fs, "ls nope"));
  assert.match(out(fs, "ls nope"), /cannot find/i);
});

// --- Файлы ---

test("cat prints a file and keeps its line breaks", () => {
  const fs = fsFixture();
  fs.write(HOME + "\\multi.txt", "one\ntwo");
  assert.equal(out(fs, "cat Documents\\notes.txt"), "hello");
  assert.deepEqual(execute(fs, "cat multi.txt").lines, ["one", "two"]);
});

test("cat accepts forward slashes in the path", () => {
  assert.equal(out(fsFixture(), "cat Documents/notes.txt"), "hello");
});

test("cat on a directory reports an error", () => {
  assert.match(out(fsFixture(), "cat Documents"), /not a file/i);
});

test("mkdir creates a directory", () => {
  const fs = fsFixture();
  execute(fs, "mkdir Projects");
  assert.equal(fs.resolve(HOME + "\\Projects").type, "dir");
});

// --- Прочее ---

test("date prints a line with a year", () => {
  assert.match(out(fsFixture(), "date"), /\d{4}/);
});

test("an unknown command answers like cmd does", () => {
  assert.match(out(fsFixture(), "frobnicate"), /is not recognized/i);
});

test("commands cut from the set are no longer recognized", () => {
  const fs = fsFixture();
  for (const cmd of ["neofetch", "echo hi", "tree", "start github", "cls", "touch f", "del x"]) {
    assert.match(out(fs, cmd), /is not recognized/i);
  }
});

test("help lists the available commands and nothing removed", () => {
  const text = out(fsFixture(), "help");
  for (const cmd of ["help", "ls", "dir", "cd", "pwd", "cat", "mkdir", "date"]) {
    assert.match(text, new RegExp("\\b" + cmd + "\\b"));
  }
  assert.doesNotMatch(text, /\b(neofetch|tree|start|echo|touch)\b/);
});

test("an empty line produces no output and no error", () => {
  const res = execute(fsFixture(), "   ");
  assert.deepEqual(res.lines, []);
  assert.equal(res.clear, undefined);
});

test("help also names the keys, otherwise completion is undiscoverable", () => {
  const text = out(fsFixture(), "help");
  for (const key of ["Tab", "Ctrl\\+Space", "Ctrl\\+F"]) {
    assert.match(text, new RegExp(key));
  }
});

test("clear asks the caller to wipe the screen and prints nothing itself", () => {
  const res = execute(fsFixture(), "clear");
  assert.equal(res.clear, true);
  assert.deepEqual(res.lines, []);
});

test("history numbers the commands of this session from one", () => {
  const res = execute(fsFixture(), "history", { history: ["pwd", "cd Documents"] });
  assert.deepEqual(res.lines, ["1 pwd", "2 cd Documents"]);
});

test("history without a session prints nothing", () => {
  assert.deepEqual(execute(fsFixture(), "history").lines, []);
});

// --- Цвет (параллельный канал rich, не трогает .lines) ---

// Есть ли в rich хоть один сегмент с цветом color (и, если задано, с текстом,
// содержащим textIncludes).
const hasSeg = (rich, color, textIncludes) =>
  (rich ?? []).some((segs) =>
    (segs ?? []).some(
      (s) => s.c === color && (textIncludes === undefined || s.t.includes(textIncludes)),
    ),
  );

test("rich stays aligned with lines and flattens back to the same text", () => {
  const res = execute(fsFixture(), "ls");
  assert.equal(res.rich.length, res.lines.length);
  res.rich.forEach((segs, i) => {
    if (segs) assert.equal(segs.map((s) => s.t).join(""), res.lines[i]);
  });
});

test("ls table headers are colored green", () => {
  assert.ok(hasSeg(execute(fsFixture(), "ls").rich, "th", "Mode"));
});

test("unknown command is styled as an error", () => {
  assert.ok(hasSeg(execute(fsFixture(), "frobnicate").rich, "err"));
});

test("fs errors are styled red", () => {
  assert.ok(hasSeg(execute(fsFixture(), "cd nowhere").rich, "err"));
});

test("dir colors directory rows", () => {
  assert.ok(hasSeg(execute(fsFixture(), "dir").rich, "dir", "Documents"));
});

test("ls colors directories and shortcuts distinctly", () => {
  const rich = execute(fsFixture(), "ls").rich;
  assert.ok(hasSeg(rich, "dir", "Documents"));
  assert.ok(hasSeg(rich, "app", "GitHub.lnk"));
});

test("help colors command names", () => {
  assert.ok(hasSeg(execute(fsFixture(), "help").rich, "cmd", "dir"));
});
