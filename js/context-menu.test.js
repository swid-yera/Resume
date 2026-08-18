import { test } from "node:test";
import assert from "node:assert/strict";

import { itemsForTarget } from "./context-menu.js";

// Цель описывается простым объектом, поэтому сборка пунктов тестируется
// без DOM. Резолв самого элемента живёт в слушателе и проверяется в браузере.

const labels = (items) => items.filter((i) => i.label).map((i) => i.label);

const ctx = {
  openTypes: [],
  project: null,
  activeTheme: "neon",
};

// --- Desktop ---

test("the desktop menu offers windows, sorting, theme and terminal", () => {
  const items = itemsForTarget({ kind: "desktop" }, ctx);
  const l = labels(items);
  assert.ok(l.includes("New Window"));
  assert.ok(l.includes("Sort Icons By"));
  assert.ok(l.includes("Change Theme"));
  assert.ok(l.includes("Open Terminal"));
  assert.ok(l.includes("Resume"));
});

test("the theme submenu lists every preset and ticks the active one", () => {
  const items = itemsForTarget({ kind: "desktop" }, { ...ctx, activeTheme: "forest" });
  const theme = items.find((i) => i.label === "Change Theme");
  assert.equal(theme.submenu.length, 5);
  const forest = theme.submenu.find((i) => i.label === "Forest");
  const frost = theme.submenu.find((i) => i.label === "Frost");
  assert.equal(forest.checked, true);
  assert.equal(frost.checked, false);
  assert.equal(forest.swatch, "forest", "свотч несёт id темы, цвет подставит css");
});

test("the desktop menu offers full screen where the browser has it", () => {
  const withApi = itemsForTarget({ kind: "desktop" }, { ...ctx, canFullscreen: true });
  assert.ok(labels(withApi).includes("Enter Full Screen"));
  assert.ok(!labels(itemsForTarget({ kind: "desktop" }, ctx)).includes("Enter Full Screen"));
});

test("from full screen the desktop menu leads back", () => {
  const items = itemsForTarget({ kind: "desktop" }, { ...ctx, canFullscreen: true, isFullscreen: true });
  assert.ok(labels(items).includes("Exit Full Screen"));
});

// --- File icon ---

test("a desktop icon can be opened and inspected", () => {
  const items = itemsForTarget({ kind: "file", type: "photos" }, ctx);
  assert.deepEqual(labels(items), ["Open", "Get Info"]);
});

// --- Project tile ---

test("a project tile offers site, repo, link and info", () => {
  const project = {
    name: "AniTop",
    url: "https://anitop.antawkay.com",
    repo: "https://github.com/Antawq/AniTop",
  };
  const items = itemsForTarget({ kind: "project", project }, ctx);
  assert.deepEqual(labels(items), [
    "Open Site",
    "Open Repository",
    "Copy Link",
    "Get Info",
  ]);
});

test("a project without a repo hides Open Repository", () => {
  const project = { name: "X", url: "https://x.dev", repo: null };
  const items = itemsForTarget({ kind: "project", project }, ctx);
  assert.ok(!labels(items).includes("Open Repository"));
});

test("a project without a url hides Open Site and Copy Link", () => {
  const project = { name: "X", url: null, repo: "https://github.com/a/b" };
  const l = labels(itemsForTarget({ kind: "project", project }, ctx));
  assert.ok(!l.includes("Open Site"));
  assert.ok(!l.includes("Copy Link"));
});

// --- Dock ---

test("a dock item for a closed app can be opened but not closed", () => {
  const items = itemsForTarget({ kind: "dock", type: "github" }, ctx);
  const close = items.find((i) => i.label === "Close");
  assert.equal(close.disabled, true);
});

test("a dock item for a running app can be closed", () => {
  const items = itemsForTarget(
    { kind: "dock", type: "github" },
    { ...ctx, openTypes: ["github"] },
  );
  const close = items.find((i) => i.label === "Close");
  assert.equal(close.disabled, false);
});

// --- Window header ---

test("a window header offers minimize, zoom and close", () => {
  const items = itemsForTarget({ kind: "window", type: "projects" }, ctx);
  assert.deepEqual(labels(items), ["Minimize", "Zoom", "Close"]);
});

// --- Unknown ---

test("an unknown target yields no menu at all", () => {
  assert.deepEqual(itemsForTarget({ kind: "nope" }, ctx), []);
});

// --- Shape ---

test("every actionable item can actually do something", () => {
  const kinds = [
    { kind: "desktop" },
    { kind: "file", type: "photos" },
    { kind: "window", type: "projects" },
  ];
  for (const target of kinds) {
    for (const item of itemsForTarget(target, ctx)) {
      if (!item.label || item.disabled) continue;
      assert.ok(
        typeof item.onSelect === "function" || Array.isArray(item.submenu),
        `пункт "${item.label}" ничего не делает`,
      );
    }
  }
});
