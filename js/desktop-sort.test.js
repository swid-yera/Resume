import { test } from "node:test";
import assert from "node:assert/strict";

import { iconOrder, assignSlots } from "./desktop-sort.js";

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
