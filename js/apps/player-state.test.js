import { test } from "node:test";
import assert from "node:assert/strict";

import { pickActive } from "./player-bridge.js";
import {
  emptyState,
  formatTime,
  hasVideo,
  isLoading,
  isPlaying,
  readPlayer,
  sameState,
  thumbnailUrl,
  watchUrl,
} from "./player-state.js";

const fakePlayer = (over = {}) => ({
  getVideoData: () => ({
    video_id: "dQw4w9WgXcQ",
    title: "Never Gonna",
    author: "Rick",
    ...(over.data ?? {}),
  }),
  getCurrentTime: () => over.currentTime ?? 26,
  getDuration: () => over.duration ?? 1638,
  getVolume: () => over.volume ?? 60,
  isMuted: () => over.muted ?? false,
  getPlayerState: () => over.playerState ?? 1,
});

test("a fresh state holds no video and answers nothing", () => {
  const s = emptyState();
  assert.equal(hasVideo(s), false);
  assert.equal(isPlaying(s), false);
});

test("a snapshot carries what the player reports", () => {
  const s = readPlayer(fakePlayer());
  assert.equal(s.videoId, "dQw4w9WgXcQ");
  assert.equal(s.title, "Never Gonna");
  assert.equal(s.author, "Rick");
  assert.equal(s.currentTime, 26);
  assert.equal(s.duration, 1638);
  assert.equal(s.volume, 60);
  assert.equal(s.muted, false);
  assert.equal(hasVideo(s), true);
  assert.equal(thumbnailUrl(s.videoId), "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
});

test("switching tracks reads as loading, buffering a known track does not", () => {
  const between = readPlayer(fakePlayer({ data: { video_id: "" }, playerState: -1 }));
  assert.equal(isLoading(between, true), true);
  assert.equal(isLoading(readPlayer(fakePlayer({ playerState: 3 })), true), false);
  assert.equal(isLoading(readPlayer(fakePlayer()), true), false);
  assert.equal(isLoading(between, false), false);
});

test("a snapshot points back at the video page, an empty one points nowhere", () => {
  assert.equal(watchUrl(readPlayer(fakePlayer())), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(watchUrl(emptyState()), null);
});

test("a player that is not ready yet reads as an empty snapshot", () => {
  assert.deepEqual(readPlayer(null), emptyState());
  assert.deepEqual(readPlayer({}), emptyState());
});

test("methods that answer with nothing usable fall back instead of poisoning the snapshot", () => {
  const half = { getCurrentTime: () => NaN, getVolume: () => undefined };
  const s = readPlayer(half);
  assert.equal(s.currentTime, 0);
  assert.equal(s.volume, 100);
});

test("buffering still counts as playing, paused and ended do not", () => {
  const at = (playerState) => readPlayer(fakePlayer({ playerState }));
  assert.equal(isPlaying(at(1)), true);
  assert.equal(isPlaying(at(3)), true);
  assert.equal(isPlaying(at(2)), false);
  assert.equal(isPlaying(at(0)), false);
});

test("two reads of a still player are the same state, one second apart is not", () => {
  assert.equal(sameState(readPlayer(fakePlayer()), readPlayer(fakePlayer())), true);
  assert.equal(
    sameState(readPlayer(fakePlayer()), readPlayer(fakePlayer({ currentTime: 27 }))),
    false,
  );
});

test("a video opened by hand outranks the background playlist", () => {
  assert.equal(pickActive(["music", "browser"]), "browser");
  assert.equal(pickActive(["music"]), "music");
  assert.equal(pickActive([]), null);
});

test("times read as a player shows them, and nonsense reads as zero", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(26), "0:26");
  assert.equal(formatTime(1638), "27:18");
  assert.equal(formatTime(3723), "1:02:03");
  assert.equal(formatTime(-5), "0:00");
  assert.equal(formatTime(NaN), "0:00");
});
