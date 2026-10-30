import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";

test("the entrance includes all six transparent, optimized illustration frames", async () => {
  const root = new URL("../dist/", import.meta.url);
  const credits = JSON.parse(await fs.readFile(new URL("assets/home/credits.json", root), "utf8"));
  const html = await fs.readFile(new URL("index.html", root), "utf8");
  assert.equal(credits.frames.length, 6);
  let total = 0;
  for (const frame of credits.frames) {
    assert.ok(html.includes("assets/home/" + frame.file));
    const bytes = await fs.readFile(new URL("assets/home/" + frame.file, root));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    // VP8X's alpha flag confirms that paper removal survived WebP conversion.
    assert.equal(bytes.toString("ascii", 12, 16), "VP8X");
    assert.ok(bytes[20] & 0x10);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), frame.sha256);
    assert.equal(bytes.length, frame.bytes);
    assert.equal(frame.height, 1100);
    total += bytes.length;
  }
  assert.ok(total < 2.1e6, "Keep the six-frame entrance under 2.1 MB");
});
