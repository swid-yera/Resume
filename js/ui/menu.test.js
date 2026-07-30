import { test } from "node:test";
import assert from "node:assert/strict";

import { placeMenu, menuItemHtml } from "./menu.js";

const VIEWPORT = { width: 1000, height: 800 };
const SIZE = { width: 200, height: 300 };

// --- placeMenu ---

test("a menu with room around it opens at the cursor", () => {
  assert.deepEqual(placeMenu({ x: 100, y: 100 }, SIZE, VIEWPORT), {
    left: 100,
    top: 100,
  });
});

test("a menu near the right edge flips to the left of the cursor", () => {
  // 950 + 200 = 1150 > 1000, so it opens leftwards: 950 - 200 = 750
  assert.deepEqual(placeMenu({ x: 950, y: 100 }, SIZE, VIEWPORT), {
    left: 750,
    top: 100,
  });
});

test("a menu near the bottom edge flips above the cursor", () => {
  // 700 + 300 = 1000 > 800, so it opens upwards: 700 - 300 = 400
  assert.deepEqual(placeMenu({ x: 100, y: 700 }, SIZE, VIEWPORT), {
    left: 100,
    top: 400,
  });
});

test("a corner flips on both axes at once", () => {
  assert.deepEqual(placeMenu({ x: 950, y: 700 }, SIZE, VIEWPORT), {
    left: 750,
    top: 400,
  });
});

test("a menu too big to flip is clamped into view, never off-screen", () => {
  // Выше экрана: перевернуть некуда, но верх не должен уехать за границу.
  const huge = { width: 400, height: 900 };
  const pos = placeMenu({ x: 300, y: 500 }, huge, VIEWPORT);
  assert.ok(pos.top >= 0, `top ушёл за экран: ${pos.top}`);
  assert.ok(pos.top < 100, `верх меню слишком низко: ${pos.top}`);
  assert.ok(pos.left >= 0);
});

test("a cursor hard against the left edge never yields a negative offset", () => {
  const pos = placeMenu({ x: 2, y: 2 }, SIZE, VIEWPORT);
  assert.ok(pos.left >= 0);
  assert.ok(pos.top >= 0);
});

test("a submenu with no room on the right opens clear of its parent", () => {
  // Родитель занимает 820..980, подменю просится от его правого края.
  // 980 + 200 = 1180 > 1000, поэтому уходим влево ОТ ЛЕВОГО КРАЯ РОДИТЕЛЯ
  // (820 - 200 = 620), иначе подменю ляжет поверх него.
  const pos = placeMenu({ x: 980, y: 100 }, SIZE, VIEWPORT, { flipFrom: 820 });
  assert.deepEqual(pos, { left: 620, top: 100 });
});

test("a submenu that fits on the right ignores the flip anchor", () => {
  const pos = placeMenu({ x: 300, y: 100 }, SIZE, VIEWPORT, { flipFrom: 100 });
  assert.equal(pos.left, 300);
});

// --- menuItemHtml ---

test("a plain item renders its label", () => {
  assert.match(menuItemHtml({ label: "Open Site" }, 0), /Open Site/);
});

test("a separator renders as a rule and carries no label", () => {
  const html = menuItemHtml({ separator: true }, 0);
  assert.match(html, /menu__separator/);
  assert.doesNotMatch(html, /menu__label/);
});

test("a submenu item gets an arrow and is marked as expandable", () => {
  const html = menuItemHtml({ label: "Change Theme", submenu: [] }, 0);
  assert.match(html, /menu__arrow/);
  assert.match(html, /aria-haspopup="menu"/);
});

test("a checked item is marked for screen readers, not just visually", () => {
  const html = menuItemHtml({ label: "Neon", checked: true }, 0);
  assert.match(html, /aria-checked="true"/);
});

test("a disabled item is marked disabled", () => {
  const html = menuItemHtml({ label: "Close", disabled: true }, 0);
  assert.match(html, /aria-disabled="true"/);
});

test("a section label is not an actionable row", () => {
  const html = menuItemHtml({ sectionLabel: "OPEN WINDOWS" }, 0);
  assert.match(html, /OPEN WINDOWS/);
  assert.doesNotMatch(html, /role="menuitem"/);
});

test("a hostile label cannot inject markup", () => {
  const html = menuItemHtml({ label: '<img src=x onerror="alert(1)">' }, 0);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});
