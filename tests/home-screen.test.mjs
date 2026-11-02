import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("home-screen launch stays inside the repository path and all app icons exist", async () => {
  const root = new URL("../dist/", import.meta.url);
  const manifest = JSON.parse(await fs.readFile(new URL("manifest.webmanifest", root), "utf8"));
  const hosted = new URL("https://example.org/The-Armoury/manifest.webmanifest");
  assert.equal(new URL(manifest.scope, hosted).pathname, "/The-Armoury/");
  assert.equal(new URL(manifest.start_url, hosted).href, "https://example.org/The-Armoury/#home");
  assert.equal(manifest.display, "standalone");
  for (const icon of [...manifest.icons, { src: "assets/app-icon-180.png", sizes: "180x180" }]) {
    const bytes = await fs.readFile(new URL(icon.src, root));
    const size = Number(icon.sizes.split("x")[0]);
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
});
