import { test } from "node:test";
import assert from "node:assert/strict";

import {
  slugForType,
  typeForSlug,
  typeFromHash,
  hashForType,
  setupRouter,
} from "./router.js";

// Заглушка окна с настоящим стеком истории: адрес меняется только через
// history, а переход назад шлёт оба события, как браузер, - сперва popstate,
// следом hashchange.
function fakeWindow(hash = "") {
  const win = {
    location: { hash, pathname: "/", search: "" },
    listeners: {},
    left: false, // ушли с сайта: назад с первой записи документа
    addEventListener(name, cb) {
      (this.listeners[name] ??= []).push(cb);
    },
    fire(name) {
      (this.listeners[name] ?? []).forEach((cb) => cb());
    },
  };

  const hashOf = (url) => (url.startsWith("#") ? url : "");
  const entries = [hash];
  let index = 0;

  win.history = {
    calls: [],
    get entries() {
      return [...entries];
    },
    get index() {
      return index;
    },
    pushState(_state, _title, url) {
      win.history.calls.push(["push", url]);
      entries.splice(index + 1);
      entries.push(hashOf(url));
      index = entries.length - 1;
      win.location.hash = entries[index];
    },
    replaceState(_state, _title, url) {
      win.history.calls.push(["replace", url]);
      entries[index] = hashOf(url);
      win.location.hash = entries[index];
    },
    back() {
      win.history.calls.push(["back"]);
      if (index === 0) {
        win.left = true;
        return;
      }
      index -= 1;
      win.location.hash = entries[index];
      win.fire("popstate");
      win.fire("hashchange");
    },
  };
  return win;
}

// Настоящий onActiveWindowChange зовёт колбэк сразу при подписке. На пустом
// столе активного окна нет, а если адрес уже открыл своё - оно и активно.
function fakeActiveChange(active = null) {
  const subs = [];
  const on = (cb) => {
    subs.push(cb);
    cb(active);
  };
  on.fire = (type) => subs.forEach((cb) => cb(type));
  return on;
}

// Кнопка «назад» браузера: тот же переход, что делает и сам роутер.
const pressBack = (win) => win.history.back();

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
  const onActive = fakeActiveChange("text");
  setupRouter({ openWindow: () => {}, onActiveWindowChange: onActive, win });

  onActive.fire(null);
  assert.equal(win.location.hash, "");
  assert.deepEqual(win.history.calls.at(-1), ["replace", "/"]);
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
  win.fire("hashchange");
  assert.deepEqual(opened, ["github"]);
});

// --- История: «назад» закрывает окно ---

// Стол со стопкой окон: верхнее активно, закрытие снимает его и делает активным
// то, что осталось, - как это делает window-manager.
function fakeDesktop(win) {
  const stack = [];
  const subs = [];
  const active = () => stack.at(-1) ?? null;
  const notify = () => subs.forEach((cb) => cb(active()));

  const desktop = {
    stack,
    open(type) {
      if (!stack.includes(type)) stack.push(type);
      notify();
    },
    closeTop() {
      stack.pop();
      notify();
    },
  };

  setupRouter({
    openWindow: (type) => desktop.open(type),
    closeTopWindow: () => desktop.closeTop(),
    onActiveWindowChange: (cb) => {
      subs.push(cb);
      cb(active());
    },
    win,
  });
  return desktop;
}

test("open windows take one step in history, switching between them stays on it", () => {
  const win = fakeWindow("");
  const desktop = fakeDesktop(win);

  desktop.open("explorer");
  desktop.open("console");

  assert.deepEqual(win.history.entries, ["", "#terminal"]);
  assert.equal(win.history.index, 1);
});

test("back closes the top window instead of leaving the site", () => {
  const win = fakeWindow("");
  const desktop = fakeDesktop(win);
  desktop.open("console");

  pressBack(win);

  assert.deepEqual(desktop.stack, []);
  assert.equal(win.location.hash, "");
  assert.equal(win.left, false);
});

test("one step back closes one window, though the browser sends two events", () => {
  const win = fakeWindow("");
  const desktop = fakeDesktop(win);
  desktop.open("explorer");
  desktop.open("console");

  pressBack(win);

  assert.deepEqual(desktop.stack, ["explorer"]);
});

test("back walks down the stack of windows and only then leaves the site", () => {
  const win = fakeWindow("");
  const desktop = fakeDesktop(win);
  desktop.open("explorer");
  desktop.open("console");

  pressBack(win);
  // Оставшемуся окну снова нужен свой шаг: иначе следующий «назад» уведёт с сайта
  assert.equal(win.location.hash, "#explorer");
  assert.deepEqual(win.history.entries, ["", "#explorer"]);

  pressBack(win);
  assert.deepEqual(desktop.stack, []);
  assert.equal(win.location.hash, "");

  pressBack(win);
  assert.equal(win.left, true);
});

test("closing the last window by hand takes its step out of history", () => {
  const win = fakeWindow("");
  const desktop = fakeDesktop(win);
  desktop.open("console");
  assert.equal(win.history.index, 1);

  desktop.closeTop();

  assert.equal(win.history.index, 0);
  assert.equal(win.location.hash, "");
  pressBack(win);
  assert.equal(win.left, true);
});

test("a window opened straight from a link does not add a step of its own", () => {
  const win = fakeWindow("#terminal");
  const desktop = fakeDesktop(win);

  assert.deepEqual(desktop.stack, ["console"]);
  assert.deepEqual(win.history.entries, ["#terminal"]);
  pressBack(win);
  assert.equal(win.left, true);
});

test("back over a link-opened window closes what was opened on top of it", () => {
  const win = fakeWindow("#terminal");
  const desktop = fakeDesktop(win);

  desktop.open("github");
  assert.deepEqual(win.history.entries, ["#terminal", "#github"]);

  pressBack(win);

  assert.deepEqual(desktop.stack, ["console"]);
  assert.equal(win.location.hash, "#terminal");
});
