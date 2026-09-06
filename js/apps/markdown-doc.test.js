import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseFrontmatter,
  wordCount,
  readingTime,
  slugify,
  uniqueSlug,
  buildOutline,
  titleFor,
} from "./markdown-doc.js";

const DOC = `---
name: AniTop
url: https://anitop.me
stack: [Vue 3, Vite, TypeScript]
year: 2026
status: live
description: Каталог аниме: поиск по Jikan и Yummy API
---

# AniTop

Текст документа.
`;

// --- Фронтматтер ---

test("parseFrontmatter reads keys, lists and numbers", () => {
  const { data } = parseFrontmatter(DOC);
  assert.equal(data.name, "AniTop");
  assert.equal(data.url, "https://anitop.antawkay.com");
  assert.deepEqual(data.stack, ["Vue 3", "Vite", "TypeScript"]);
  assert.equal(data.year, 2026);
  assert.equal(data.status, "live");
});

test("a value keeps every colon after the first one", () => {
  const { data } = parseFrontmatter(DOC);
  assert.equal(data.description, "Каталог аниме: поиск по Jikan и Yummy API");
});

test("the body starts after the closing fence", () => {
  const { body } = parseFrontmatter(DOC);
  assert.ok(body.startsWith("\n# AniTop"), body.slice(0, 20));
  assert.ok(!body.includes("status: live"));
});

test("a document without frontmatter is all body", () => {
  const { data, body } = parseFrontmatter("# Just a title\n");
  assert.deepEqual(data, {});
  assert.equal(body, "# Just a title\n");
});

test("quotes and booleans are unwrapped", () => {
  const { data } = parseFrontmatter(`---\ntitle: "Quoted"\ndraft: true\n---\nbody`);
  assert.equal(data.title, "Quoted");
  assert.equal(data.draft, true);
});

test("an empty value does not become undefined", () => {
  const { data } = parseFrontmatter(`---\nimage:\n---\nbody`);
  assert.equal(data.image, "");
});

test("a number too long for a float stays a string", () => {
  const { data } = parseFrontmatter(`---\nyear: 2026\ndiscord: 1221496681091039312\n---\nbody`);
  assert.equal(data.year, 2026);
  assert.equal(data.discord, "1221496681091039312");
});

// --- Блочные списки ---

// Опыт и образование в резюме - это списки записей с несколькими полями, в
// одну строку они не ложатся. Синтаксис добавлен, старый разбор не менялся.
const RESUME = `---
name: Обо мне
experience:
  - period: 2025 — н.в.
    role: Java-разработчик
    org: ООО Ромашка
    summary: Сервисы на Spring, миграция на MongoDB
  - period: 2024 — 2025
    role: Стажёр
    org: Другая компания
education:
  - period: 2023 — 2027
    org: Университет
languages:
  - Русский
  - Английский
github: https://github.com/Antawq
---

# Обо мне
`;

test("a block list reads entries with several fields each", () => {
  const { data } = parseFrontmatter(RESUME);
  assert.equal(data.experience.length, 2);
  assert.deepEqual(data.experience[0], {
    period: "2025 — н.в.",
    role: "Java-разработчик",
    org: "ООО Ромашка",
    summary: "Сервисы на Spring, миграция на MongoDB",
  });
  assert.deepEqual(data.experience[1], {
    period: "2024 — 2025",
    role: "Стажёр",
    org: "Другая компания",
  });
});

test("a block list of plain strings stays a list of strings", () => {
  const { data } = parseFrontmatter(RESUME);
  assert.deepEqual(data.languages, ["Русский", "Английский"]);
});

test("a key after a block list is read as usual", () => {
  const { data } = parseFrontmatter(RESUME);
  assert.equal(data.github, "https://github.com/Antawq");
  assert.equal(data.education.length, 1);
  assert.equal(data.education[0].org, "Университет");
});

test("the body still starts after the closing fence", () => {
  const { body } = parseFrontmatter(RESUME);
  assert.ok(body.startsWith("\n# Обо мне"), body.slice(0, 20));
  assert.ok(!body.includes("period:"));
});

// --- Статистика ---

test("wordCount ignores code fences, inline code and markup", () => {
  const md = [
    "# Title",
    "",
    "one two three",
    "",
    "```js",
    "const ignored = 'not a word at all';",
    "```",
    "",
    "- four `five`",
  ].join("\n");
  assert.equal(wordCount(md), 6); // Title one two three four five
});

test("link text counts, the URL does not", () => {
  assert.equal(wordCount("[open site](https://example.com/a/b)"), 2);
});

test("readingTime never drops below a minute", () => {
  assert.equal(readingTime(0), 1);
  assert.equal(readingTime(10), 1);
  assert.equal(readingTime(400), 2);
});

// --- Оглавление ---

test("slugify handles cyrillic and punctuation", () => {
  assert.equal(slugify("Что умеет"), "что-умеет");
  assert.equal(slugify("Стек / данные"), "стек-данные");
  assert.equal(slugify("!!!"), "section");
});

test("repeated headings get distinct ids", () => {
  const used = new Set();
  assert.equal(uniqueSlug("Links", used), "links");
  assert.equal(uniqueSlug("Links", used), "links-2");
  assert.equal(uniqueSlug("Links", used), "links-3");
});

test("buildOutline normalizes depth against the top heading", () => {
  const outline = buildOutline([
    { level: 1, text: "AniTop" },
    { level: 2, text: "Что умеет" },
    { level: 3, text: "Поиск" },
  ]);
  assert.deepEqual(
    outline.map((h) => h.depth),
    [0, 1, 2],
  );
  assert.deepEqual(
    outline.map((h) => h.id),
    ["anitop", "что-умеет", "поиск"],
  );
});

test("a document that starts at h2 still starts at depth 0", () => {
  const outline = buildOutline([
    { level: 2, text: "First" },
    { level: 3, text: "Second" },
  ]);
  assert.deepEqual(
    outline.map((h) => h.depth),
    [0, 1],
  );
});

test("an existing id is kept", () => {
  const outline = buildOutline([{ level: 1, text: "Title", id: "custom" }]);
  assert.equal(outline[0].id, "custom");
});

// --- Заголовок ---

test("titleFor takes the file name from a windows path", () => {
  assert.equal(
    titleFor("C:\\Users\\antawkay\\Documents\\Projects\\anitop.md", {}),
    "anitop.md",
  );
  assert.equal(titleFor("", { name: "AniTop" }), "AniTop");
});
