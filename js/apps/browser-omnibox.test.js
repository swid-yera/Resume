import { test } from "node:test";
import assert from "node:assert/strict";

import {
  embedHint,
  playerErrorText,
  externalUrl,
  hostOf,
  parseOmnibox,
  refusesEmbedding,
  youtubeId,
} from "./browser-omnibox.js";

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

test("youtubeId also covers shorts and live - те же ролики, другой путь", () => {
  assert.equal(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("youtube.com/live/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

test("the bare host is not a video and must not be taken for one", () => {
  assert.equal(youtubeId("youtube.com"), null);
  assert.equal(youtubeId("https://www.youtube.com/results?search_query=lofi"), null);
});

// --- ютуб: время и плейлисты ---

test("a shorts link plays in the embedded player", () => {
  const intent = parseOmnibox("youtube.com/shorts/dQw4w9WgXcQ");
  assert.equal(intent.kind, "youtube");
  assert.equal(intent.embedUrl, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1");
});

test("a timestamp survives into the player instead of being dropped", () => {
  assert.equal(
    parseOmnibox("https://youtu.be/dQw4w9WgXcQ?t=42").embedUrl,
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1&start=42",
  );
  assert.equal(
    parseOmnibox("youtube.com/watch?v=dQw4w9WgXcQ&t=90s").embedUrl,
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1&start=90",
  );
});

test("a playlist plays as a playlist, not as a blocked page", () => {
  const intent = parseOmnibox("youtube.com/playlist?list=PLabc123");
  assert.equal(intent.kind, "youtube");
  assert.equal(
    intent.embedUrl,
    "https://www.youtube-nocookie.com/embed/videoseries?enablejsapi=1&list=PLabc123",
  );
  assert.equal(intent.playlistId, "PLabc123");
});

test("a video opened from inside a playlist keeps both", () => {
  const intent = parseOmnibox("youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc123");
  assert.equal(
    intent.embedUrl,
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1&list=PLabc123",
  );
});

test("the new-tab link points at the real youtube page, not at the player", () => {
  assert.equal(
    externalUrl(parseOmnibox("youtube.com/shorts/dQw4w9WgXcQ")),
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  assert.equal(
    externalUrl(parseOmnibox("youtube.com/playlist?list=PLabc123")),
    "https://www.youtube.com/playlist?list=PLabc123",
  );
});

test("the youtube home page stays blocked - there is nothing embeddable there", () => {
  const intent = parseOmnibox("youtube.com");
  assert.equal(intent.kind, "web");
  assert.equal(refusesEmbedding(intent.url), true);
});

test("the blocked youtube page explains which links do work", () => {
  assert.match(embedHint("https://youtube.com"), /Shorts|playlist/);
  assert.match(embedHint("https://www.youtube.com/results?search_query=lofi"), /playlist/);
});

test("the blocked github page points at the app that renders the profile here", () => {
  assert.match(embedHint("https://github.com/Antawq"), /GitHub app/);
});

test("other blocked hosts get no made-up advice", () => {
  assert.equal(embedHint("https://example.com"), null);
  assert.equal(embedHint("https://x.com"), null);
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
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1",
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

test("about:home is the start page, whatever the case", () => {
  assert.deepEqual(parseOmnibox("about:home"), { kind: "home" });
  assert.deepEqual(parseOmnibox("  About:Home "), { kind: "home" });
});

test("an unknown about: address is not mistaken for a search", () => {
  assert.deepEqual(parseOmnibox("about:blank"), { kind: "home" });
});

// --- externalUrl ---

test("only the addresses a real browser could open have an external url", () => {
  assert.equal(externalUrl(parseOmnibox("https://example.com")), "https://example.com");
  assert.equal(externalUrl(parseOmnibox("example.com")), "https://example.com");
  assert.equal(externalUrl(parseOmnibox("about:home")), null);
  assert.equal(externalUrl(parseOmnibox("C:\\Users")), null);
  assert.equal(externalUrl(parseOmnibox("hello world")), null);
  assert.equal(externalUrl(parseOmnibox("")), null);
});

// --- hostOf / refusesEmbedding ---

test("hostOf drops the scheme, the path and the www prefix", () => {
  assert.equal(hostOf("https://www.github.com/Antawq/Resume"), "github.com");
  assert.equal(hostOf("https://sub.example.com"), "sub.example.com");
  // Мусор в адресной строке не должен ронять отрисовку.
  assert.equal(hostOf("not a url"), "not a url");
});

test("known hosts are reported as refusing to be embedded", () => {
  assert.equal(refusesEmbedding("https://github.com/Antawq"), true);
  assert.equal(refusesEmbedding("https://www.google.com/search?q=a"), true);
  assert.equal(refusesEmbedding("https://gist.github.com/x"), true);
});

test("an unknown host is given the benefit of the doubt", () => {
  assert.equal(refusesEmbedding("https://example.com"), false);
  assert.equal(refusesEmbedding("https://antawkay.com"), false);
});

// Совпадать должен домен целиком, иначе под запрет попадёт чужой сайт.
test("a host that merely ends with a blocked name is not blocked", () => {
  assert.equal(refusesEmbedding("https://notgithub.com"), false);
  assert.equal(refusesEmbedding("https://github.com.evil.net"), false);
});

// Наружу отдаём страницу ролика, а не встраиваемый плеер.
test("a youtube address opens as a watch page, not as an embed", () => {
  assert.equal(
    externalUrl(parseOmnibox("https://www.youtube.com/watch?v=dQw4w9WgXcQ")),
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
});

// Плейлист под замком и ролик под замком приходят одним и тем же кодом: развести
// их можно только по адресу, из которого фрейм собрали.
test("a refused playlist is explained as a playlist, not as a video", () => {
  assert.match(playerErrorText(150, true), /public playlists only/);
  assert.match(playerErrorText(150, false), /outside YouTube/);
  assert.match(playerErrorText(100, false), /removed, or made private/);
  assert.match(playerErrorText(2, true), /does not name anything/);
});

test("an unknown player error still says something", () => {
  assert.match(playerErrorText(999), /refused to play/);
  assert.match(playerErrorText(undefined), /refused to play/);
});
