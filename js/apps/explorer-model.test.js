import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatSize,
  formatDate,
  sortEntries,
  nextSort,
  filterEntries,
  breadcrumbs,
  statusText,
  iconFor,
  History,
  COLUMNS,
} from "./explorer-model.js";

const entry = (name, type, over = {}) => ({
  name,
  type,
  kind: type === "dir" ? "File folder" : "Markdown File",
  size: type === "file" ? 100 : null,
  modified: "2026-05-18T10:02:00.000Z",
  path: "C:\\" + name,
  ...over,
});

// --- Размер ---

test("formatSize rounds up to whole kilobytes", () => {
  assert.equal(formatSize(0), "0 KB");
  assert.equal(formatSize(1), "1 KB");
  assert.equal(formatSize(1024), "1 KB");
  assert.equal(formatSize(1025), "2 KB");
  assert.equal(formatSize(4300), "5 KB");
});

test("formatSize groups thousands and switches unit", () => {
  assert.equal(formatSize(1024 * 1010), "1 010 KB");
  assert.equal(formatSize(1024 * 1024 * 3), "3.0 MB");
  assert.equal(formatSize(1024 * 1024 * 1024 * 2), "2.0 GB");
});

test("a folder has no size, not a zero", () => {
  assert.equal(formatSize(null), "");
  assert.equal(formatSize(undefined), "");
});

// --- Дата ---

test("formatDate writes dd.mm.yyyy hh:mm", () => {
  // Локальные компоненты, чтобы тест не зависел от часового пояса.
  const d = new Date(2026, 4, 18, 9, 5);
  assert.equal(formatDate(d), "18.05.2026 09:05");
  assert.equal(formatDate(d.toISOString()), "18.05.2026 09:05");
});

test("a missing or broken date renders as nothing", () => {
  assert.equal(formatDate(null), "");
  assert.equal(formatDate(""), "");
  assert.equal(formatDate("не дата"), "");
});

// --- Сортировка ---

test("folders and shortcuts stay above files in both directions", () => {
  const entries = [
    entry("zeta.md", "file"),
    entry("Alpha", "dir"),
    entry("Link.lnk", "app"),
  ];
  assert.deepEqual(
    sortEntries(entries, "name", 1).map((e) => e.name),
    ["Alpha", "Link.lnk", "zeta.md"],
  );
  assert.deepEqual(
    sortEntries(entries, "name", -1).map((e) => e.name),
    ["Alpha", "Link.lnk", "zeta.md"],
  );
});

test("sorting by name flips within the group", () => {
  const entries = [entry("b.md", "file"), entry("a.md", "file"), entry("c.md", "file")];
  assert.deepEqual(
    sortEntries(entries, "name", -1).map((e) => e.name),
    ["c.md", "b.md", "a.md"],
  );
});

test("sorting by size is numeric, not alphabetical", () => {
  const entries = [
    entry("small.md", "file", { size: 9 }),
    entry("big.md", "file", { size: 100 }),
    entry("mid.md", "file", { size: 40 }),
  ];
  assert.deepEqual(
    sortEntries(entries, "size", 1).map((e) => e.name),
    ["small.md", "mid.md", "big.md"],
  );
});

test("sorting by date puts the oldest first when ascending", () => {
  const entries = [
    entry("new.md", "file", { modified: "2026-07-01T00:00:00.000Z" }),
    entry("old.md", "file", { modified: "2026-01-01T00:00:00.000Z" }),
  ];
  assert.deepEqual(
    sortEntries(entries, "modified", 1).map((e) => e.name),
    ["old.md", "new.md"],
  );
});

test("sorting does not mutate the input", () => {
  const entries = [entry("b.md", "file"), entry("a.md", "file")];
  sortEntries(entries, "name", 1);
  assert.equal(entries[0].name, "b.md");
});

test("nextSort flips the same column and resets a new one", () => {
  assert.deepEqual(nextSort({ key: "name", dir: 1 }, "name"), { key: "name", dir: -1 });
  assert.deepEqual(nextSort({ key: "name", dir: -1 }, "name"), { key: "name", dir: 1 });
  assert.deepEqual(nextSort({ key: "name", dir: 1 }, "size"), { key: "size", dir: 1 });
  // Свежие файлы интереснее старых, поэтому дата начинается с убывания.
  assert.deepEqual(nextSort({ key: "name", dir: 1 }, "modified"), {
    key: "modified",
    dir: -1,
  });
});

test("every column has a label", () => {
  assert.deepEqual(
    COLUMNS.map((c) => c.key),
    ["name", "modified", "kind", "size"],
  );
  assert.ok(COLUMNS.every((c) => c.label));
});

// --- Поиск ---

test("search matches part of a name, ignoring case", () => {
  const entries = [entry("anitop.md", "file"), entry("portfolio-os.md", "file")];
  assert.deepEqual(
    filterEntries(entries, "TOP").map((e) => e.name),
    ["anitop.md"],
  );
  assert.equal(filterEntries(entries, "  ").length, 2);
  assert.equal(filterEntries(entries, "nothing").length, 0);
});

// --- Крошки ---

test("breadcrumbs start at This PC and use the drive label", () => {
  const crumbs = breadcrumbs("C:\\Users\\antawkay", { "C:": "Local Disk (C:)" });
  assert.deepEqual(crumbs, [
    { label: "This PC", path: "This PC" },
    { label: "Local Disk (C:)", path: "C:\\" },
    { label: "Users", path: "C:\\Users" },
    { label: "antawkay", path: "C:\\Users\\antawkay" },
  ]);
});

test("This PC itself is a single crumb", () => {
  assert.deepEqual(breadcrumbs("This PC"), [
    { label: "This PC", path: "This PC" },
  ]);
});

// --- Статус ---

test("statusText counts items and the selection", () => {
  const entries = [entry("a.md", "file"), entry("b.md", "file")];
  assert.equal(statusText(entries, null), "2 items");
  assert.equal(statusText([entry("a.md", "file")], null), "1 item");
  assert.equal(
    statusText(entries, entry("a.md", "file", { size: 4300 })),
    "2 items · 1 item selected · 5 KB",
  );
});

test("a selected folder reports no size", () => {
  const entries = [entry("Docs", "dir")];
  assert.equal(statusText(entries, entries[0]), "1 item · 1 item selected");
});

// --- Иконки ---

test("iconFor tells drives, folders, shortcuts and markdown apart", () => {
  assert.notEqual(iconFor(entry("C:", "dir", { label: "Local Disk (C:)" })), iconFor(entry("Docs", "dir")));
  assert.equal(iconFor(entry("a.md", "file")), iconFor(entry("b.markdown", "file")));
  assert.notEqual(iconFor(entry("a.md", "file")), iconFor(entry("a.txt", "file")));
  assert.notEqual(iconFor(entry("a.webp", "file")), iconFor(entry("a.txt", "file")));
});

// --- История ---

test("history walks back and forward", () => {
  const h = new History("C:\\");
  assert.equal(h.canBack, false);
  h.push("C:\\Users");
  h.push("C:\\Users\\antawkay");
  assert.equal(h.current, "C:\\Users\\antawkay");
  assert.equal(h.back(), "C:\\Users");
  assert.equal(h.canForward, true);
  assert.equal(h.forward(), "C:\\Users\\antawkay");
});

test("a new step after going back drops the tail", () => {
  const h = new History("C:\\");
  h.push("C:\\Users");
  h.push("C:\\Windows");
  h.back();
  h.push("C:\\Program Files");
  assert.equal(h.canForward, false);
  assert.deepEqual(h.stack, ["C:\\", "C:\\Users", "C:\\Program Files"]);
});

test("navigating to the same folder does not grow the history", () => {
  const h = new History("C:\\");
  h.push("C:\\");
  h.push("C:\\");
  assert.equal(h.stack.length, 1);
});

test("back at the start and forward at the end stay put", () => {
  const h = new History("C:\\");
  assert.equal(h.back(), "C:\\");
  assert.equal(h.forward(), "C:\\");
});
