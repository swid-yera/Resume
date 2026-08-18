import { test } from "node:test";
import assert from "node:assert/strict";

import { iconOrder, assignSlots, gridStep, freeSlots } from "./desktop-sort.js";

const icons = () => [
  { name: "Projects", isFolder: true },
  { name: "Photos", isFolder: true },
  { name: "About.txt", isFolder: false },
];

const names = (list) => list.map((i) => i.name);

// --- iconOrder ---

test("sorting by name is alphabetical", () => {
  assert.deepEqual(names(iconOrder(icons(), "name")), [
    "About.txt",
    "Photos",
    "Projects",
  ]);
});

test("sorting by kind puts folders first, then sorts by name", () => {
  assert.deepEqual(names(iconOrder(icons(), "kind")), [
    "Photos",
    "Projects",
    "About.txt",
  ]);
});

test("sorting does not mutate the input", () => {
  const input = icons();
  iconOrder(input, "name");
  assert.equal(input[0].name, "Projects");
});

test("an unknown mode falls back to sorting by name", () => {
  assert.deepEqual(names(iconOrder(icons(), "banana")), [
    "About.txt",
    "Photos",
    "Projects",
  ]);
});

// --- assignSlots ---
// Иконки прибиты к местам CSS-правилами по data-type, поэтому перестановка
// узлов в DOM их не двигает. Сортировка обязана раздать координаты.

test("sorted icons take over the existing slots, top-left first", () => {
  const slots = [
    { left: 360, top: 80 },
    { left: 80, top: 80 },
    { left: 220, top: 80 },
  ];
  const sorted = [{ name: "About.txt" }, { name: "Photos" }, { name: "Projects" }];
  assert.deepEqual(assignSlots(sorted, slots), [
    { name: "About.txt", left: 80, top: 80 },
    { name: "Photos", left: 220, top: 80 },
    { name: "Projects", left: 360, top: 80 },
  ]);
});

test("slots stacked vertically are filled top to bottom", () => {
  const slots = [
    { left: 20, top: 280 },
    { left: 20, top: 40 },
    { left: 20, top: 160 },
  ];
  const sorted = [{ name: "A" }, { name: "B" }, { name: "C" }];
  assert.deepEqual(assignSlots(sorted, slots), [
    { name: "A", left: 20, top: 40 },
    { name: "B", left: 20, top: 160 },
    { name: "C", left: 20, top: 280 },
  ]);
});

test("rows are ordered before columns", () => {
  const slots = [
    { left: 220, top: 80 },
    { left: 80, top: 200 },
    { left: 80, top: 80 },
  ];
  const sorted = [{ name: "A" }, { name: "B" }, { name: "C" }];
  const out = assignSlots(sorted, slots);
  assert.deepEqual(out[0], { name: "A", left: 80, top: 80 });
  assert.deepEqual(out[1], { name: "B", left: 220, top: 80 });
  assert.deepEqual(out[2], { name: "C", left: 80, top: 200 });
});

// Раскладка рабочего стола: десктоп ставит иконки в ряд, планшет в колонку.
const ROW = [
  { left: 80, top: 80 },
  { left: 220, top: 80 },
  { left: 360, top: 80 },
];
const COLUMN = [
  { left: 20, top: 40 },
  { left: 20, top: 160 },
  { left: 20, top: 280 },
];

test("gridStep reads the horizontal step off a row of icons", () => {
  const grid = gridStep(ROW, { stepX: 999, stepY: 120 });
  assert.equal(grid.originX, 80);
  assert.equal(grid.originY, 80);
  assert.equal(grid.stepX, 140);
});

test("a single column gives no horizontal step, so the fallback is used", () => {
  const grid = gridStep(COLUMN, { stepX: 140, stepY: 999 });
  assert.equal(grid.stepX, 140);
  assert.equal(grid.stepY, 120);
});

test("free slots skip the places that are already taken", () => {
  const grid = { originX: 80, originY: 80, stepX: 140, stepY: 120 };
  const [first] = freeSlots(ROW, grid, 4, 1);
  assert.deepEqual(first, { left: 80, top: 200 });
});

test("slots fill a column before moving to the next one", () => {
  const grid = { originX: 0, originY: 0, stepX: 100, stepY: 50 };
  assert.deepEqual(freeSlots([], grid, 2, 3), [
    { left: 0, top: 0 },
    { left: 0, top: 50 },
    { left: 100, top: 0 },
  ]);
});

test("asking for no slots returns nothing instead of looping", () => {
  const grid = { originX: 0, originY: 0, stepX: 100, stepY: 50 };
  assert.deepEqual(freeSlots([], grid, 2, 0), []);
});
