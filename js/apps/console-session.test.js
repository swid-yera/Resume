import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createSession,
  openSession,
  closeSession,
  tabLabel,
  screenText,
} from "./console-session.js";

const HOME = "C:\\Users\\antawkay";

// --- открытие ---

test("a fresh session starts empty at the given directory", () => {
  const s = createSession(1, HOME);
  assert.equal(s.id, 1);
  assert.equal(s.cwd, HOME);
  assert.deepEqual(s.screen, []);
  assert.deepEqual(s.history, []);
});

test("opening a session appends it and makes it active", () => {
  const a = createSession(1, HOME);
  const { sessions, activeId } = openSession([a], HOME);
  assert.equal(sessions.length, 2);
  assert.equal(activeId, sessions[1].id);
});

test("ids keep growing so a reopened tab never reuses a closed id", () => {
  let state = { sessions: [createSession(1, HOME)], activeId: 1 };
  state = openSession(state.sessions, HOME);
  const second = state.activeId;
  state = closeSession(state.sessions, second);
  state = openSession(state.sessions, HOME);
  assert.notEqual(state.activeId, second);
});

// --- закрытие ---

test("closing the active tab activates its right neighbour", () => {
  const s = [createSession(1, HOME), createSession(2, HOME), createSession(3, HOME)];
  const next = closeSession(s, 2);
  assert.deepEqual(next.sessions.map((x) => x.id), [1, 3]);
  assert.equal(next.activeId, 3);
});

test("closing the last tab falls back to the left neighbour", () => {
  const s = [createSession(1, HOME), createSession(2, HOME)];
  const next = closeSession(s, 2);
  assert.deepEqual(next.sessions.map((x) => x.id), [1]);
  assert.equal(next.activeId, 1);
});

test("closing the only tab leaves nothing - the caller closes the window", () => {
  const next = closeSession([createSession(1, HOME)], 1);
  assert.deepEqual(next.sessions, []);
  assert.equal(next.activeId, null);
});

test("closing an unknown id changes nothing", () => {
  const s = [createSession(1, HOME)];
  const next = closeSession(s, 99);
  assert.deepEqual(next.sessions.map((x) => x.id), [1]);
});

// --- подпись вкладки ---

test("the tab is labelled with the folder it sits in", () => {
  assert.equal(tabLabel(createSession(1, HOME + "\\Documents")), "Documents");
});

test("at the drive root the label is the drive, not an empty string", () => {
  assert.equal(tabLabel(createSession(1, "C:\\")), "C:");
});

test("outside any drive the label falls back to the shell name", () => {
  assert.equal(tabLabel(createSession(1, "This PC")), "pwsh");
});

// --- копирование вывода ---

const seg = (t) => ({ t });

test("a text block becomes one line per row", () => {
  const screen = [{ table: false, rows: [[seg("first")], [seg("second")]] }];
  assert.equal(screenText(screen), "first\nsecond");
});

test("segments of one row are joined without extra spaces", () => {
  const screen = [{ table: false, rows: [[seg("PS C:\\>"), seg(" "), seg("pwd")]] }];
  assert.equal(screenText(screen), "PS C:\\> pwd");
});

test("table cells are joined by a single space", () => {
  const screen = [
    { table: true, rows: [[{ segs: [seg("d----")] }, { segs: [seg("Projects")] }]] },
  ];
  assert.equal(screenText(screen), "d---- Projects");
});

test("an empty screen copies as an empty string, not as undefined", () => {
  assert.equal(screenText([]), "");
});
