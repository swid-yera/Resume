import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canGoBack,
  canGoForward,
  createHistory,
  current,
  frameNavigated,
  go,
  push,
  replace,
} from "./browser-history.js";

test("a fresh history holds one address and goes nowhere", () => {
  const h = createHistory("about:home");
  assert.equal(current(h), "about:home");
  assert.equal(canGoBack(h), false);
  assert.equal(canGoForward(h), false);
});

test("pushing the address already shown changes nothing", () => {
  const h = push(createHistory("about:home"), "about:home");
  assert.deepEqual(h.stack, ["about:home"]);
  assert.equal(h.index, 0);
});

test("a new address cuts off everything ahead of it", () => {
  let h = push(push(createHistory("a"), "b"), "c");
  h = go(h, -1);
  h = push(h, "d");
  assert.deepEqual(h.stack, ["a", "b", "d"]);
  assert.equal(canGoForward(h), false);
});

test("go stops at both ends instead of running off the stack", () => {
  const h = push(createHistory("a"), "b");
  assert.equal(current(go(h, -5)), "a");
  assert.equal(current(go(h, 5)), "b");
});

test("replace swaps the current step without lengthening the chain", () => {
  const h = replace(push(createHistory("a"), "b"), "b/");
  assert.deepEqual(h.stack, ["a", "b/"]);
  assert.equal(h.index, 1);
});

// --- переходы внутри самой страницы ---

test("a redirect on the first load takes over the step, not a new one", () => {
  const h = frameNavigated(push(createHistory("about:home"), "http://site/a"), "http://site/a/", 1);
  assert.deepEqual(h.stack, ["about:home", "http://site/a/"]);
  assert.equal(canGoBack(h), true);
});

test("a page that navigates itself earns its own step, so back returns to it", () => {
  let h = push(createHistory("about:home"), "http://site/a");
  h = frameNavigated(h, "http://site/b", 2);
  assert.deepEqual(h.stack, ["about:home", "http://site/a", "http://site/b"]);
  assert.equal(current(go(h, -1)), "http://site/a");
});

test("a chain of self-navigations keeps every step in order", () => {
  let h = push(createHistory("about:home"), "http://site/a");
  h = frameNavigated(h, "http://site/b", 2);
  h = frameNavigated(h, "http://site/c", 3);
  assert.deepEqual(h.stack, ["about:home", "http://site/a", "http://site/b", "http://site/c"]);
});

test("reloading the same address does not pile up duplicate steps", () => {
  let h = push(createHistory("about:home"), "http://site/a");
  h = frameNavigated(h, "http://site/a", 2);
  h = frameNavigated(h, "http://site/a", 3);
  assert.deepEqual(h.stack, ["about:home", "http://site/a"]);
});

// Чужой источник адрес не отдаёт - дописывать в цепочку нечего.
test("an unreadable address leaves the chain untouched", () => {
  const h = push(createHistory("about:home"), "http://site/a");
  assert.equal(frameNavigated(h, null, 2), h);
  assert.equal(frameNavigated(h, "about:blank", 2), h);
});
