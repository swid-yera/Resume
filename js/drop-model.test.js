import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_FILE_BYTES,
  classify,
  tooBig,
  refusal,
  uniqueName,
  fileNode,
} from "./drop-model.js";

test("classify tells text, images and everything else apart", () => {
  assert.equal(classify("notes.md"), "text");
  assert.equal(classify("data.json"), "text");
  assert.equal(classify("photo.webp"), "image");
  assert.equal(classify("PHOTO.JPG"), "image");
  assert.equal(classify("report.pdf"), "binary");
  assert.equal(classify("archive.zip"), "binary");
});

test("svg counts as an image, not as text", () => {
  assert.equal(classify("icon.svg"), "image");
});

test("a file without an extension is binary, not text", () => {
  assert.equal(classify("hosts"), "binary");
});

test("the size limit is applied on the byte count", () => {
  assert.equal(tooBig(MAX_FILE_BYTES), false);
  assert.equal(tooBig(MAX_FILE_BYTES + 1), true);
});

test("refusal stays silent for a file that fits", () => {
  assert.equal(refusal("small.txt", 10), null);
});

test("refusal names the file and both sizes", () => {
  const message = refusal("big.png", 512 * 1024);
  assert.match(message, /big\.png/);
  assert.match(message, /512 KB/);
  assert.match(message, /256 KB/);
});

test("a free name is left alone", () => {
  assert.equal(uniqueName(["a.txt"], "b.txt"), "b.txt");
});

test("a taken name gets a counter before the extension", () => {
  assert.equal(uniqueName(["photo.webp"], "photo.webp"), "photo (1).webp");
  assert.equal(
    uniqueName(["photo.webp", "photo (1).webp"], "photo.webp"),
    "photo (2).webp",
  );
});

test("collisions ignore case, the way Windows does", () => {
  assert.equal(uniqueName(["Photo.webp"], "photo.webp"), "photo (1).webp");
});

test("a name without an extension still gets a counter", () => {
  assert.equal(uniqueName(["README"], "README"), "README (1)");
});

test("a text file keeps its content and holds no src", () => {
  const node = fileNode({ name: "a.md", size: 3, mime: "text/markdown", text: "abc" });
  assert.equal(node.content, "abc");
  assert.equal(node.src, undefined);
  assert.equal(node.size, 3);
});

test("a binary file keeps the data url and holds no content", () => {
  const node = fileNode({
    name: "a.pdf",
    size: 9,
    mime: "application/pdf",
    dataUrl: "data:application/pdf;base64,AAA",
  });
  assert.equal(node.content, undefined);
  assert.equal(node.src, "data:application/pdf;base64,AAA");
});

test("a file of an unknown type still gets a mime", () => {
  assert.equal(fileNode({ name: "x.bin", size: 1 }).mime, "application/octet-stream");
});
