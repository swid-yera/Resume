import { test } from "node:test";
import assert from "node:assert/strict";

import { skillGroups, fullSkillList, skillNote } from "./about-doc.js";

const data = {
  backend: ["Java & Spring", "MongoDB & SQL"],
  frontend: ["JavaScript & TypeScript", "Vue 3"],
  tools: ["Vite", "Cloudflare"],
  more: ["REST API", "HTML & CSS"],
};

test("groups keep their order and get readable labels", () => {
  const groups = skillGroups(data);
  assert.deepEqual(
    groups.map((g) => g.label),
    ["Бэкенд", "Фронтенд", "Инструменты"],
  );
  assert.deepEqual(groups[0].items, ["Java & Spring", "MongoDB & SQL"]);
});

test("an empty group is dropped rather than rendered as an empty row", () => {
  const groups = skillGroups({ backend: ["Java & Spring"], frontend: [] });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "Бэкенд");
});

test("related tech stays in one chip instead of being split apart", () => {
  const chips = skillGroups(data).flatMap((g) => g.items);
  assert.ok(chips.includes("Java & Spring"));
  assert.ok(chips.includes("JavaScript & TypeScript"));
  assert.ok(!chips.includes("Java"));
  assert.ok(!chips.includes("TypeScript"));
});

test("missing frontmatter yields no groups instead of throwing", () => {
  assert.deepEqual(skillGroups(undefined), []);
  assert.deepEqual(skillGroups({}), []);
});

// --- fullSkillList ---

test("the full list is the chips plus everything held back", () => {
  assert.deepEqual(fullSkillList(data), [
    "Java & Spring",
    "MongoDB & SQL",
    "JavaScript & TypeScript",
    "Vue 3",
    "Vite",
    "Cloudflare",
    "REST API",
    "HTML & CSS",
  ]);
});

test("something listed both as a chip and in more is not repeated", () => {
  const full = fullSkillList({ tools: ["Vite"], more: ["Vite", "Bootstrap"] });
  assert.deepEqual(full, ["Vite", "Bootstrap"]);
});

test("without a more list the full list is just the chips", () => {
  assert.deepEqual(fullSkillList({ tools: ["Vite"] }), ["Vite"]);
});

// --- skillNote ---

test("the note names everything, including what the chips do not show", () => {
  const note = skillNote(data);
  assert.match(note, /Java & Spring/);
  assert.match(note, /REST API/);
  assert.match(note, /HTML & CSS\.$/);
});

test("with nothing to list there is no note to show", () => {
  assert.equal(skillNote({}), "");
  assert.equal(skillNote(undefined), "");
});
