import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canStepBack,
  canStepForward,
  createTrack,
  isInside,
  observe,
  step,
} from "./browser-frame-track.js";

test("a fresh track sits on the entry page and steps nowhere", () => {
  const t = createTrack(4);
  assert.equal(isInside(t), false);
  assert.equal(canStepBack(t), false);
  assert.equal(canStepForward(t), false);
});

test("a new entry in the tab history means the frame went one page deeper", () => {
  const t = observe(createTrack(4), 5);
  assert.equal(isInside(t), true);
  assert.equal(canStepBack(t), true);
  assert.equal(canStepForward(t), false);
});

test("an unchanged history length leaves the track alone", () => {
  const t = observe(createTrack(4), 5);
  assert.equal(observe(t, 5), t);
});

test("stepping back opens the way forward again", () => {
  let t = observe(createTrack(4), 5);
  t = step(t, -1);
  assert.equal(isInside(t), false);
  assert.equal(canStepBack(t), false);
  assert.equal(canStepForward(t), true);
});

test("steps stop at the entry page and at the deepest page reached", () => {
  const t = observe(createTrack(4), 6);
  assert.equal(step(t, -9).depth, 0);
  assert.equal(step(t, 9).depth, 2);
});

test("going deeper after a step back raises the ceiling", () => {
  let t = observe(createTrack(4), 6);
  t = step(t, -1);
  t = observe(t, 7);
  assert.equal(t.depth, 3);
  assert.equal(canStepForward(t), false);
});

// Окно перерисовали - записи прошлого фрейма остаются в истории вкладки,
// и отсчёт должен начаться от неё, иначе «назад» шагнёт в чужую страницу.
test("a track made after a deep visit starts from zero again", () => {
  const t = createTrack(9);
  assert.equal(t.depth, 0);
  assert.equal(canStepBack(t), false);
});
