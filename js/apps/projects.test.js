import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeProject, statusMeta, projectTileHtml } from "./projects.js";

// --- normalizeProject ---

test("image becomes a src under the projects folder", () => {
  const p = normalizeProject({ image: "anitop.webp", name: "AniTop" });
  assert.equal(p.src, "projects/anitop.webp");
  assert.equal(p.name, "AniTop");
});

test("a full record keeps every field", () => {
  const p = normalizeProject({
    image: "anitop.webp",
    name: "AniTop",
    url: "https://anitop.me",
    repo: "https://github.com/Antawq/AniTop",
    description: "Каталог аниме",
    stack: ["Vue 3", "Vite"],
    year: 2026,
    status: "live",
  });
  assert.equal(p.url, "https://anitop.antawkay.com");
  assert.equal(p.repo, "https://github.com/Antawq/AniTop");
  assert.equal(p.description, "Каталог аниме");
  assert.deepEqual(p.stack, ["Vue 3", "Vite"]);
  assert.equal(p.year, 2026);
  assert.equal(p.status, "live");
});

test("missing optional fields do not break the record", () => {
  const p = normalizeProject({ image: "x.webp", name: "X" });
  assert.equal(p.url, null);
  assert.equal(p.repo, null);
  assert.equal(p.description, "");
  assert.deepEqual(p.stack, []);
  assert.equal(p.year, null);
  assert.equal(p.status, null);
});

test("a non-array stack is ignored rather than rendered as junk", () => {
  assert.deepEqual(normalizeProject({ stack: "Vue 3" }).stack, []);
  assert.deepEqual(normalizeProject({ stack: null }).stack, []);
});

test("an empty record stays harmless", () => {
  const p = normalizeProject({});
  assert.equal(p.name, "");
  assert.equal(p.src, "");
});

// --- statusMeta ---

test("live status is labelled and marked live", () => {
  assert.deepEqual(statusMeta("live"), { label: "Live", isLive: true });
});

test("known non-live statuses get their own labels", () => {
  assert.deepEqual(statusMeta("wip"), { label: "WIP", isLive: false });
  assert.deepEqual(statusMeta("archived"), {
    label: "Archived",
    isLive: false,
  });
});

test("an absent or unknown status renders nothing", () => {
  assert.equal(statusMeta(null), null);
  assert.equal(statusMeta("banana"), null);
});

// --- projectTileHtml ---

const full = () =>
  normalizeProject({
    image: "anitop.webp",
    name: "AniTop",
    url: "https://anitop.antawkay.com",
    repo: "https://github.com/Antawq/AniTop",
    description: "Каталог аниме",
    stack: ["Vue 3", "Vite"],
    year: 2026,
    status: "live",
  });

test("a full tile shows name, description, year and status", () => {
  const html = projectTileHtml(full(), 0);
  assert.match(html, /AniTop/);
  assert.match(html, /Каталог аниме/);
  assert.match(html, /2026/);
  assert.match(html, /Live/);
});

test("every stack entry becomes its own chip", () => {
  const html = projectTileHtml(full(), 0);
  const chips = html.match(/class="project-tile__chip"/g) || [];
  assert.equal(chips.length, 2);
});

test("no description means no description element, not an empty gap", () => {
  const p = normalizeProject({ name: "X", image: "x.webp" });
  assert.doesNotMatch(projectTileHtml(p, 0), /project-tile__desc/);
});

test("no repo means no Code button", () => {
  const p = normalizeProject({ name: "X", url: "https://x.dev" });
  const html = projectTileHtml(p, 0);
  assert.doesNotMatch(html, /data-action="repo"/);
  assert.match(html, /data-action="site"/);
});

test("no url means no Open Site button", () => {
  const p = normalizeProject({ name: "X", repo: "https://github.com/a/b" });
  const html = projectTileHtml(p, 0);
  assert.doesNotMatch(html, /data-action="site"/);
  assert.match(html, /data-action="repo"/);
});

test("an unknown status renders no status dot", () => {
  const p = normalizeProject({ name: "X", status: "banana" });
  assert.doesNotMatch(projectTileHtml(p, 0), /project-tile__status/);
});

test("the tile carries its index so clicks can find the project", () => {
  assert.match(projectTileHtml(full(), 3), /data-index="3"/);
});

test("a hostile name cannot inject markup", () => {
  const p = normalizeProject({ name: '<img src=x onerror="alert(1)">' });
  const html = projectTileHtml(p, 0);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});
