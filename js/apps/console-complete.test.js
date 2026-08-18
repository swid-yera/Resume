import { test } from "node:test";
import assert from "node:assert/strict";

import { VFS } from "../fs.js";
import {
  tokenAt,
  completionsFor,
  applyCompletion,
  predictFrom,
  nextWord,
} from "./console-complete.js";

function fsFixture() {
  return new VFS({
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
                        "notes.txt": { type: "file", content: "hi", modified: null },
                        "nested": { type: "dir", modified: null, children: {} },
                      },
                    },
                    Downloads: { type: "dir", modified: null, children: {} },
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
}

// --- tokenAt ---

test("caret inside a word selects that word", () => {
  const t = tokenAt("cat notes.txt", 2);
  assert.deepEqual([t.start, t.end, t.value, t.index], [0, 3, "cat", 0]);
});

test("caret at the end of a word still selects it, so Tab refines the word", () => {
  const t = tokenAt("cd Doc", 6);
  assert.deepEqual([t.start, t.end, t.value, t.index], [3, 6, "Doc", 1]);
});

test("caret after a trailing space starts a new, empty token", () => {
  const t = tokenAt("cd ", 3);
  assert.deepEqual([t.start, t.end, t.value, t.index], [3, 3, "", 1]);
});

// --- дополнение команд ---

test("the first word completes from the command list", () => {
  const fs = fsFixture();
  const { items } = completionsFor(fs, "c", 1);
  assert.deepEqual(items, ["cd", "cat", "clear"]);
});

test("an empty line offers every command", () => {
  const fs = fsFixture();
  const { items } = completionsFor(fs, "", 0);
  assert.ok(items.includes("help"));
  assert.ok(items.includes("ls"));
});

test("a command with no match completes to nothing rather than throwing", () => {
  const fs = fsFixture();
  assert.deepEqual(completionsFor(fs, "zzz", 3).items, []);
});

// --- дополнение путей ---

test("the second word completes from the current directory", () => {
  const fs = fsFixture();
  const { items } = completionsFor(fs, "cd D", 4);
  assert.deepEqual(items, ["Documents\\", "Downloads\\"]);
});

test("a directory gets a trailing slash so the next Tab goes deeper", () => {
  const fs = fsFixture();
  const { items } = completionsFor(fs, "cd Documents\\", 13);
  assert.deepEqual(items, ["Documents\\nested\\", "Documents\\notes.txt"]);
});

test("a file gets no trailing slash", () => {
  const fs = fsFixture();
  const { items } = completionsFor(fs, "cat Documents\\not", 17);
  assert.deepEqual(items, ["Documents\\notes.txt"]);
});

test("an absolute path completes against its own directory", () => {
  const fs = fsFixture();
  const { items } = completionsFor(fs, "cd C:\\Users\\ant", 15);
  assert.deepEqual(items, ["C:\\Users\\antawkay\\"]);
});

test("completion ignores case but keeps what was typed", () => {
  const fs = fsFixture();
  const { items } = completionsFor(fs, "cd doc", 6);
  assert.deepEqual(items, ["Documents\\"]);
});

test("a shortcut is offered without a slash - it is not a directory", () => {
  const fs = fsFixture();
  const { items } = completionsFor(fs, "cat Git", 7);
  assert.deepEqual(items, ["GitHub.lnk"]);
});

test("a path that does not exist completes to nothing instead of throwing", () => {
  const fs = fsFixture();
  assert.deepEqual(completionsFor(fs, "cd nowhere\\x", 12).items, []);
});

// --- подстановка ---

test("applying a completion replaces only the token and moves the caret after it", () => {
  const span = { start: 3, end: 6 };
  assert.deepEqual(applyCompletion("cd Doc", span, "Documents\\"), {
    line: "cd Documents\\",
    caret: 13,
  });
});

test("applying a completion in the middle keeps the tail of the line", () => {
  const span = { start: 3, end: 6 };
  assert.deepEqual(applyCompletion("cd Doc -x", span, "Documents\\"), {
    line: "cd Documents\\ -x",
    caret: 13,
  });
});

// --- предсказание из истории ---

test("prediction returns the tail of the newest matching command", () => {
  assert.equal(predictFrom(["cd Documents", "cat notes.txt"], "ca"), "t notes.txt");
});

test("the newest match wins over an older one", () => {
  assert.equal(predictFrom(["cd Downloads", "cd Documents"], "cd D"), "ocuments");
});

test("an exact match predicts nothing - there is no tail left", () => {
  assert.equal(predictFrom(["help"], "help"), "");
});

test("an empty line predicts nothing", () => {
  assert.equal(predictFrom(["help"], ""), "");
});

test("prediction is case sensitive, like the history it replays", () => {
  assert.equal(predictFrom(["Help"], "he"), "");
});

// --- приём одного слова ---

test("one word of a suggestion comes with its leading space", () => {
  assert.equal(nextWord(" notes.txt extra"), " notes.txt");
});

test("a suggestion without spaces is accepted whole", () => {
  assert.equal(nextWord("elp"), "elp");
});

test("an empty suggestion yields nothing to accept", () => {
  assert.equal(nextWord(""), "");
});
