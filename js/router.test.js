import { test } from "node:test";
import assert from "node:assert/strict";

import {
  slugForType,
  typeForSlug,
  typeFromHash,
  hashForType,
  setupRouter,
} from "./router.js";

// Заглушка окна: location.hash меняется только через replaceState, как в браузере.
function fakeWindow(hash = "") {
  const win = {
    location: { hash, pathname: "/", search: "" },
    listeners: {},
    addEventListener(name, cb) {
      (this.listeners[name] ??= []).push(cb);
    },
  };
  win.history = {
    calls: [],
    replaceState(_state, _title, url) {
      win.history.calls.push(url);
      win.location.hash = url.startsWith("#") ? url : "";
    },
  };
  return win;
}

// Настоящий onActiveWindowChange зовёт колбэк сразу при подписке, и активного
// окна на этот момент ещё нет.
function fakeActiveChange() {
  const subs = [];
  const on = (cb) => {
    subs.push(cb);
    cb(null);
  };
  on.fire = (type) => subs.forEach((cb) => cb(type));
  return on;
}

// --- Слаги ---

test("a window type without an alias uses its own name", () => {
  assert.equal(slugForType("projects"), "projects");
  assert.equal(slugForType("github"), "github");
});

test("types whose name is an implementation detail get a readable alias", () => {
  assert.equal(slugForType("text"), "about");
  assert.equal(slugForType("console"), "terminal");
});

test("every alias maps back to its type", () => {
  assert.equal(typeForSlug("about"), "text");
  assert.equal(typeForSlug("terminal"), "console");
  assert.equal(typeForSlug("projects"), "projects");
});

test("an unknown slug maps to nothing", () => {
  assert.equal(typeForSlug("nope"), null);
  assert.equal(typeForSlug(""), null);
});

// --- Разбор hash ---

test("the leading hash is optional and case does not matter", () => {
  assert.equal(typeFromHash("#projects"), "projects");
  assert.equal(typeFromHash("projects"), "projects");
  assert.equal(typeFromHash("#Projects"), "projects");
});

test("an empty or junk hash opens nothing", () => {
  assert.equal(typeFromHash(""), null);
  assert.equal(typeFromHash("#"), null);
  assert.equal(typeFromHash("#whatever"), null);
  assert.equal(typeFromHash(undefined), null);
});

test("a hash that is not ours cannot be turned into a window", () => {
  assert.equal(typeFromHash("#section-2"), null);
});

// --- Сборка hash ---

test("a type becomes a hash, an unknown type becomes an empty string", () => {
  assert.equal(hashForType("text"), "#about");
  assert.equal(hashForType("projects"), "#projects");
  assert.equal(hashForType(null), "");
  assert.equal(hashForType("nope"), "");
});

test("the player has no address of its own and leaves an open one alone", () => {
  assert.equal(hashForType("player"), "");
  assert.equal(typeFromHash("#player"), null);

  const win = fakeWindow("");
  const onActive = fakeActiveChange();
  setupRouter({ openWindow: () => {}, onActiveWindowChange: onActive, win });

  onActive.fire("text");
  onActive.fire("player");
  assert.equal(win.location.hash, "#about");
});

test("round trip: type to hash and back", () => {
  for (const type of ["projects", "text", "console", "github", "settings"]) {
    assert.equal(typeFromHash(hashForType(type)), type);
  }
});

// --- setupRouter ---

test("a window named in the url is opened on load", () => {
  const opened = [];
  setupRouter({
    openWindow: (type) => opened.push(type),
    onActiveWindowChange: fakeActiveChange(),
    win: fakeWindow("#terminal"),
  });
  assert.deepEqual(opened, ["console"]);
});

test("subscribing to the active window does not wipe the url first", () => {
  const win = fakeWindow("#projects");
  const opened = [];
  setupRouter({
    openWindow: (type) => opened.push(type),
    onActiveWindowChange: fakeActiveChange(),
    win,
  });
  assert.deepEqual(opened, ["projects"]);
});

test("an opened window puts itself in the url", () => {
  const win = fakeWindow("");
  const onActive = fakeActiveChange();
  setupRouter({ openWindow: () => {}, onActiveWindowChange: onActive, win });

  onActive.fire("text");
  assert.equal(win.location.hash, "#about");
});

test("closing the last window clears the url", () => {
  const win = fakeWindow("#about");
  const onActive = fakeActiveChange();
  setupRouter({ openWindow: () => {}, onActiveWindowChange: onActive, win });

  onActive.fire(null);
  assert.equal(win.location.hash, "");
  assert.equal(win.history.calls.at(-1), "/");
});

test("a fragment that is not ours is left alone", () => {
  const win = fakeWindow("#some-anchor");
  const onActive = fakeActiveChange();
  setupRouter({ openWindow: () => {}, onActiveWindowChange: onActive, win });

  assert.equal(win.location.hash, "#some-anchor");
  assert.deepEqual(win.history.calls, []);
});

test("hashchange opens the window the url now points at", () => {
  const win = fakeWindow("");
  const opened = [];
  setupRouter({
    openWindow: (type) => opened.push(type),
    onActiveWindowChange: fakeActiveChange(),
    win,
  });

  win.location.hash = "#github";
  win.listeners.hashchange.forEach((cb) => cb());
  assert.deepEqual(opened, ["github"]);
});
