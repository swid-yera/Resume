import { test } from "node:test";
import assert from "node:assert/strict";

import { inlineImages, withUpdatedAt, pickReadme } from "./github-data.js";

// --- inlineImages ---

test("every remote image in the readme becomes a data uri", async () => {
  const md = "![logo](https://a.test/logo.svg) и ![badge](https://b.test/b.png)";
  const out = await inlineImages(md, async (url) => `data:image/png;base64,${url.length}`);

  assert.equal(out, "![logo](data:image/png;base64,23) и ![badge](data:image/png;base64,20)");
});

test("an image that cannot be loaded stays as it was", async () => {
  const md = "![logo](https://a.test/logo.svg)";
  const out = await inlineImages(md, async () => null);

  assert.equal(out, md);
});

test("a readme that failed to load is passed through, not turned into a string", async () => {
  assert.equal(await inlineImages(null, async () => "data:,"), null);
});

test("a loader that throws does not take the whole readme down", async () => {
  const md = "![logo](https://a.test/logo.svg)";
  const out = await inlineImages(md, async () => {
    throw new Error("network");
  });

  assert.equal(out, md);
});

// --- withUpdatedAt ---

const profiles = { Antawq: { user: { login: "Antawq" }, readme: "# hi" } };

test("unchanged profiles keep the previous timestamp", () => {
  const previous = { updated_at: "2026-01-01T00:00:00.000Z", ...profiles };
  const next = withUpdatedAt(profiles, previous);

  assert.equal(next.updated_at, "2026-01-01T00:00:00.000Z");
});

test("changed profiles get a fresh timestamp", () => {
  const previous = { updated_at: "2026-01-01T00:00:00.000Z", ...profiles };
  const next = withUpdatedAt(
    { Antawq: { user: { login: "Antawq" }, readme: "# hello" } },
    previous,
  );

  assert.notEqual(next.updated_at, "2026-01-01T00:00:00.000Z");
});

test("the first run stamps a timestamp of its own", () => {
  assert.match(withUpdatedAt(profiles, null).updated_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("the timestamp comes first so the file stays readable", () => {
  assert.equal(Object.keys(withUpdatedAt(profiles, null))[0], "updated_at");
});

// --- pickReadme ---

test("the readme is taken from master when there is no main", async () => {
  const seen = [];
  const readme = await pickReadme("Antawq", async (branch) => {
    seen.push(branch);
    return branch === "master" ? "# from master" : null;
  });

  assert.equal(readme, "# from master");
  assert.deepEqual(seen, ["main", "master"]);
});

test("master is not asked for once main answered", async () => {
  const seen = [];
  const readme = await pickReadme("Antawq", async (branch) => {
    seen.push(branch);
    return "# from main";
  });

  assert.equal(readme, "# from main");
  assert.deepEqual(seen, ["main"]);
});

test("a profile without a readme anywhere resolves to null", async () => {
  assert.equal(await pickReadme("Antawq", async () => null), null);
});
