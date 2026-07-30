import { test } from "node:test";
import assert from "node:assert/strict";

import { parseOmnibox, youtubeId } from "./browser-omnibox.js";

// --- youtubeId ---

test("youtubeId extracts the id from watch, youtu.be and embed urls", () => {
  assert.equal(
    youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
  assert.equal(youtubeId("youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(
    youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
  assert.equal(
    youtubeId("https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s"),
    "dQw4w9WgXcQ",
  );
  assert.equal(youtubeId("https://example.com"), null);
});

// --- parseOmnibox ---

test("file:// resolves to a windows path", () => {
  assert.deepEqual(parseOmnibox("file:///C:/Users/antawkay"), {
    kind: "file",
    path: "C:\\Users\\antawkay",
  });
  assert.deepEqual(parseOmnibox("file://C:\\Windows"), {
    kind: "file",
    path: "C:\\Windows",
  });
  // Пустой file:// это корень над дисками.
  assert.deepEqual(parseOmnibox("file:///"), { kind: "file", path: "This PC" });
  assert.deepEqual(parseOmnibox("file://"), { kind: "file", path: "This PC" });
});

test("a drive path typed without a scheme is still a path", () => {
  assert.deepEqual(parseOmnibox("C:\\Users"), { kind: "file", path: "C:\\Users" });
  assert.deepEqual(parseOmnibox("c:/users"), { kind: "file", path: "c:\\users" });
  assert.deepEqual(parseOmnibox("C:"), { kind: "file", path: "C:" });
  assert.deepEqual(parseOmnibox("this pc"), { kind: "file", path: "this pc" });
});

test("youtube urls become an embeddable nocookie player", () => {
  const r = parseOmnibox("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(r.kind, "youtube");
  assert.equal(r.videoId, "dQw4w9WgXcQ");
  assert.equal(
    r.embedUrl,
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
});

test("youtube without a scheme is still detected", () => {
  assert.equal(parseOmnibox("youtu.be/dQw4w9WgXcQ").kind, "youtube");
});

test("http(s) urls are treated as web as-is", () => {
  assert.deepEqual(parseOmnibox("https://example.com"), {
    kind: "web",
    url: "https://example.com",
  });
});

test("a bare domain gets an https:// prefix", () => {
  assert.deepEqual(parseOmnibox("example.com"), {
    kind: "web",
    url: "https://example.com",
  });
});

test("plain text becomes a VFS search", () => {
  assert.deepEqual(parseOmnibox("hello world"), {
    kind: "search",
    query: "hello world",
  });
  assert.deepEqual(parseOmnibox("notes"), {
    kind: "search",
    query: "notes",
  });
});

test("empty input is reported as empty", () => {
  assert.equal(parseOmnibox("").kind, "empty");
  assert.equal(parseOmnibox("   ").kind, "empty");
});
