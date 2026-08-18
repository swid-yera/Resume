import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildSeoPages } from "./build-seo.js";

const ABOUT = `---
name: Обо мне
description: Фуллстак с уклоном в бэкенд.
date: 2026-07-01T10:00:00Z
backend: [Java & Spring]
---

# Обо мне
`;

function project({ name, date }) {
  return `---
name: ${name}
description: ${name} - проект.
${date ? `date: ${date}` : ""}
---

# ${name}
`;
}

// Каждый прогон получает свой корень: сборка пишет файлы, а не строит строки.
async function fixture(projects) {
  const root = await mkdtemp(path.join(tmpdir(), "seo-"));
  await mkdir(path.join(root, "content", "projects"), { recursive: true });
  await writeFile(path.join(root, "content", "about.md"), ABOUT, "utf8");
  for (const [file, body] of Object.entries(projects)) {
    await writeFile(path.join(root, "content", "projects", file), body, "utf8");
  }
  return root;
}

async function build(root, outName = "dist") {
  const outDir = path.join(root, outName);
  await buildSeoPages({ root, outDir });
  return readFile(path.join(outDir, "sitemap.xml"), "utf8");
}

test("a project without a date claims no lastmod instead of today", async (t) => {
  const root = await fixture({
    "dated.md": project({ name: "Dated", date: "2026-06-14T18:35:00Z" }),
    "undated.md": project({ name: "Undated" }),
  });
  t.after(() => rm(root, { recursive: true, force: true }));

  const xml = await build(root);
  const undated = xml.match(/<url>(?:(?!<\/url>)[\s\S])*undated[\s\S]*?<\/url>/)[0];

  assert.doesNotMatch(undated, /<lastmod>/);
  assert.match(xml, /<loc>[^<]*\/projects\/dated\/<\/loc>\s*<lastmod>2026-06-14<\/lastmod>/);
});

test("dated projects come first, undated keep a stable order", async (t) => {
  const root = await fixture({
    "beta.md": project({ name: "Beta" }),
    "alpha.md": project({ name: "Alpha" }),
    "dated.md": project({ name: "Dated", date: "2026-06-14T18:35:00Z" }),
  });
  t.after(() => rm(root, { recursive: true, force: true }));

  const xml = await build(root);
  const order = [...xml.matchAll(/\/projects\/([a-z]+)\/</g)].map((m) => m[1]);

  assert.deepEqual(order, ["dated", "alpha", "beta"]);
});

test("the same content builds the same sitemap twice", async (t) => {
  const root = await fixture({
    "undated.md": project({ name: "Undated" }),
  });
  t.after(() => rm(root, { recursive: true, force: true }));

  const first = await build(root, "dist-a");
  const second = await build(root, "dist-b");

  assert.equal(first, second);
});
