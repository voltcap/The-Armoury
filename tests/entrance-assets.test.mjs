import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";

test("the entrance includes four equally sized transparent frames in numbered order", async () => {
  const root = new URL("../dist/", import.meta.url);
  const credits = JSON.parse(await fs.readFile(new URL("assets/home/credits.json", root), "utf8"));
  const html = await fs.readFile(new URL("index.html", root), "utf8");
  assert.equal(credits.frames.length, 4);
  assert.deepEqual(credits.frames.map((frame) => frame.file), ["frame-01.webp", "frame-02.webp", "frame-03.webp", "frame-04.webp"]);
  assert.equal((html.match(/class="knight-frame/g) || []).length, 4);
  let total = 0;
  for (const frame of credits.frames) {
    assert.ok(html.includes("assets/home/" + frame.file));
    const bytes = await fs.readFile(new URL("assets/home/" + frame.file, root));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    // VP8X records alpha and the actual shared canvas dimensions.
    assert.equal(bytes.toString("ascii", 12, 16), "VP8X");
    assert.ok(bytes[20] & 0x10);
    assert.equal(bytes.readUIntLE(24, 3) + 1, 816);
    assert.equal(bytes.readUIntLE(27, 3) + 1, 1100);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), frame.sha256);
    assert.equal(bytes.length, frame.bytes);
    assert.equal(frame.width, 816);
    assert.equal(frame.height, 1100);
    total += bytes.length;
  }
  assert.ok(total < 1.3e6, "Keep the four-frame entrance under 1.3 MB");
});
