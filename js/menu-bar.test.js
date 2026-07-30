import { test } from "node:test";
import assert from "node:assert/strict";

import { menusFor, appNameFor } from "./menu-bar.js";

const ctx = (over = {}) => ({
  windows: [],
  activeTheme: "neon",
  actions: {},
  ...over,
});

const titles = (menus) => menus.map((m) => m.label);
const itemLabels = (menu) => menu.items.filter((i) => i.label).map((i) => i.label);
const find = (menus, label) => menus.find((m) => m.label === label);

// --- appNameFor ---

test("with nothing open the menu bar says Finder", () => {
  assert.equal(appNameFor(null), "Finder");
});

test("the active window names the menu bar, without the file extension", () => {
  assert.equal(appNameFor("console"), "Terminal");
  assert.equal(appNameFor("projects"), "Projects");
  assert.equal(appNameFor("text"), "Resume");
});

test("an unknown window type falls back to its own name", () => {
  assert.equal(appNameFor("banana"), "banana");
});

// --- menusFor ---

test("the desktop gets the full Finder set", () => {
  assert.deepEqual(titles(menusFor(null, ctx())), [
    "File",
    "Edit",
    "View",
    "Window",
    "Help",
  ]);
});

test("the terminal swaps File and View for Shell", () => {
  const menus = menusFor("console", ctx());
  assert.deepEqual(titles(menus), ["Shell", "Edit", "Window", "Help"]);
});

test("the terminal Shell menu can clear the buffer", () => {
  const shell = find(menusFor("console", ctx()), "Shell");
  assert.ok(itemLabels(shell).includes("Clear Buffer"));
});

test("the projects folder gets File and View but no Edit", () => {
  assert.deepEqual(titles(menusFor("projects", ctx())), [
    "File",
    "View",
    "Window",
    "Help",
  ]);
});

test("an unknown app still gets a usable base set", () => {
  assert.deepEqual(titles(menusFor("telegram", ctx())), [
    "File",
    "Edit",
    "Window",
    "Help",
  ]);
});

// --- Window menu ---

test("the Window menu lists open windows and ticks the front one", () => {
  const windows = [
    { type: "projects", title: "Projects", isTop: true },
    { type: "console", title: "Terminal", isTop: false },
  ];
  const menu = find(menusFor("projects", ctx({ windows })), "Window");
  const labels = itemLabels(menu);
  assert.ok(labels.includes("Projects"));
  assert.ok(labels.includes("Terminal"));

  const section = menu.items.find((i) => i.sectionLabel);
  assert.equal(section.sectionLabel, "OPEN WINDOWS");

  const front = menu.items.find((i) => i.label === "Projects");
  const back = menu.items.find((i) => i.label === "Terminal");
  assert.equal(front.checked, true);
  assert.equal(back.checked, false);
});

test("with no windows open the Window menu shows no window section", () => {
  const menu = find(menusFor(null, ctx()), "Window");
  assert.ok(!menu.items.some((i) => i.sectionLabel));
});

test("Minimize and Zoom are disabled when nothing is open", () => {
  const menu = find(menusFor(null, ctx()), "Window");
  const min = menu.items.find((i) => i.label === "Minimize");
  assert.equal(min.disabled, true);
});

test("Minimize is enabled once a window is open", () => {
  const windows = [{ type: "projects", title: "Projects", isTop: true }];
  const menu = find(menusFor("projects", ctx({ windows })), "Window");
  const min = menu.items.find((i) => i.label === "Minimize");
  assert.equal(min.disabled, false);
});

// --- Theme lives in View, same source as the context menu ---

test("the View menu carries the theme presets with the active one ticked", () => {
  const view = find(menusFor(null, ctx({ activeTheme: "amber" })), "View");
  const theme = view.items.find((i) => i.label === "Change Theme");
  assert.equal(theme.submenu.length, 5);
  assert.equal(theme.submenu.find((i) => i.label === "Amber").checked, true);
});

// --- Shape ---

test("no menu promises a shortcut it cannot honour", () => {
  // Горячие клавиши не реализованы, поэтому подписей быть не должно.
  for (const type of [null, "console", "projects", "telegram"]) {
    for (const menu of menusFor(type, ctx())) {
      for (const item of menu.items) {
        assert.equal(
          item.shortcut,
          undefined,
          `пункт "${item.label}" обещает ${item.shortcut}, но клавиши не работают`,
        );
      }
    }
  }
});

test("every enabled item either acts or opens a submenu", () => {
  for (const type of [null, "console", "projects", "telegram"]) {
    for (const menu of menusFor(type, ctx())) {
      for (const item of menu.items) {
        if (!item.label || item.disabled) continue;
        assert.ok(
          typeof item.onSelect === "function" || Array.isArray(item.submenu),
          `пункт "${item.label}" в меню "${menu.label}" ничего не делает`,
        );
      }
    }
  }
});
