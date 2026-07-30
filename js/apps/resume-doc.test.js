import { test } from "node:test";
import assert from "node:assert/strict";

import { monogram, contacts, timeline, plural, splitSections } from "./resume-doc.js";

const WORDS = ["слово", "слова", "слов"];

// --- Монограмма ---

test("monogram takes the initials of the first two words", () => {
  assert.equal(monogram("Arman Kungozhanov"), "AK");
  assert.equal(monogram("Арман Кунгожанов"), "АК");
});

test("a single word gives two letters, not one", () => {
  assert.equal(monogram("antawkay"), "AN");
});

test("a third word is ignored", () => {
  assert.equal(monogram("Jean Claude Van Damme"), "JC");
});

test("an empty name never renders an empty circle", () => {
  assert.equal(monogram(""), "?");
  assert.equal(monogram(null), "?");
});

// --- Контакты ---

test("github keeps its url and shows the handle", () => {
  const [github] = contacts({ github: "https://github.com/Antawq" });
  assert.equal(github.id, "github");
  assert.equal(github.label, "GitHub");
  assert.equal(github.detail, "Antawq");
  assert.equal(github.href, "https://github.com/Antawq");
});

test("a telegram handle becomes a t.me link", () => {
  const [tg] = contacts({ telegram: "@antawkay" });
  assert.equal(tg.href, "https://t.me/antawkay");
  assert.equal(tg.detail, "@antawkay");
});

test("a telegram url is taken as it is", () => {
  const [tg] = contacts({ telegram: "https://t.me/antawkay" });
  assert.equal(tg.href, "https://t.me/antawkay");
  assert.equal(tg.detail, "@antawkay");
});

// Профиль в Discord открывается только по числовому id, ника в ссылке нет.
test("a numeric discord id becomes a profile link without showing the number", () => {
  const [dc] = contacts({ discord: "1221496681091039312" });
  assert.equal(dc.href, "https://discord.com/users/1221496681091039312");
  assert.equal(dc.detail, "профиль");
});

test("a discord nickname is shown but not linked", () => {
  const [dc] = contacts({ discord: "antawkay" });
  assert.equal(dc.href, null);
  assert.equal(dc.detail, "antawkay");
});

test("missing contacts produce no rows at all", () => {
  assert.deepEqual(contacts({}), []);
  assert.deepEqual(contacts({ telegram: "" }), []);
});

test("contacts keep the order github, telegram, discord", () => {
  const rows = contacts({
    discord: "1221496681091039312",
    telegram: "@antawkay",
    github: "https://github.com/Antawq",
  });
  assert.deepEqual(
    rows.map((r) => r.id),
    ["github", "telegram", "discord"],
  );
});

// --- Таймлайн ---

test("timeline normalizes entries and drops the empty ones", () => {
  const rows = timeline([
    { period: "2025 — н.в.", role: "Java-разработчик", org: "Ромашка", summary: "Spring" },
    { period: "", role: "", org: "", summary: "" },
    { org: "Университет" },
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    period: "2025 — н.в.",
    role: "Java-разработчик",
    org: "Ромашка",
    summary: "Spring",
  });
  assert.deepEqual(rows[1], { period: "", role: "", org: "Университет", summary: "" });
});

test("a missing list is an empty timeline, not a crash", () => {
  assert.deepEqual(timeline(undefined), []);
  assert.deepEqual(timeline("не список"), []);
});

// --- Числительные ---

test("plural picks the form by the last digit", () => {
  assert.equal(plural(1, WORDS), "слово");
  assert.equal(plural(2, WORDS), "слова");
  assert.equal(plural(4, WORDS), "слова");
  assert.equal(plural(5, WORDS), "слов");
  assert.equal(plural(0, WORDS), "слов");
});

test("the teens are the exception, whatever their last digit", () => {
  assert.equal(plural(11, WORDS), "слов");
  assert.equal(plural(12, WORDS), "слов");
  assert.equal(plural(114, WORDS), "слов");
});

test("hundreds do not change the rule", () => {
  assert.equal(plural(21, WORDS), "слово");
  assert.equal(plural(194, WORDS), "слова");
  assert.equal(plural(200, WORDS), "слов");
});

// --- Разбор тела ---

const BODY = `
# Обо мне

Первый абзац.

Второй абзац.

## Как я работаю

- Делю проект по слоям

## Что здесь посмотреть

Этот сайт - сам по себе пример.
`;

test("splitSections drops the h1 and keeps the lead as intro", () => {
  const { intro } = splitSections(BODY);
  assert.ok(intro.includes("Первый абзац."));
  assert.ok(intro.includes("Второй абзац."));
  assert.ok(!intro.includes("# Обо мне"));
  assert.ok(!intro.includes("Как я работаю"));
});

test("every h2 becomes its own section with a title and a body", () => {
  const { sections } = splitSections(BODY);
  assert.deepEqual(
    sections.map((s) => s.title),
    ["Как я работаю", "Что здесь посмотреть"],
  );
  assert.ok(sections[0].body.includes("Делю проект по слоям"));
  assert.ok(sections[1].body.includes("сам по себе пример"));
});

test("a body without headings is all intro", () => {
  const { intro, sections } = splitSections("Просто текст.\n");
  assert.equal(intro.trim(), "Просто текст.");
  assert.deepEqual(sections, []);
});

test("an empty body does not break", () => {
  assert.deepEqual(splitSections(""), { intro: "", sections: [] });
  assert.deepEqual(splitSections(null), { intro: "", sections: [] });
});
