import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { modelConfig, modelHistory, modelAnatomy, modelCatalog } from "../dist/data.js";
import { archive, craft, bibliography } from "../dist/research.js";
const root = new URL("../dist/", import.meta.url);
const read = async (path) =>
  JSON.parse(await fs.readFile(new URL(path, root), "utf8"));

test("content modules match the editable JSON sources", async () => {
  for (const [path, value] of [
    ["models/config.json", modelConfig],
    ["catalog.json", modelCatalog],
    ["history.json", modelHistory],
    ["anatomy.json", modelAnatomy],
    ["archive.json", archive],
    ["craft.json", craft],
    ["bibliography.json", bibliography],
  ])
    assert.deepEqual(await read(path), value, path + " needs npm run content");
});

function sources(refs) {
  assert.ok(refs?.length, "Missing source");
  for (const s of refs) assert.match(s.url, /^https:\/\//);
}
test("all specimens have sourced histories and features", () => {
  assert.equal(Object.keys(modelConfig).length, 13);
  assert.deepEqual(new Set(modelCatalog.map((w) => w.id)), new Set(Object.keys(modelConfig)));
  let featureCount = 0;
  for (const id of Object.keys(modelConfig)) {
    sources(modelHistory[id].sources);
    assert.ok(modelHistory[id].context);
    for (const part of modelHistory[id].parts) {
      assert.ok(part.function);
      sources(part.sources);
    }
    for (const f of modelAnatomy[id].features) {
      featureCount++;
      assert.ok(f.description);
      sources(f.sources);
      assert.equal(f.position.length, 3);
      assert.ok(f.position.every(Number.isFinite));
    }
  }
  assert.equal(featureCount, 77);
  for (const weapon of modelCatalog) {
    assert.deepEqual(weapon.parts, modelHistory[weapon.id].parts.map((p) => p.name));
    assert.ok(modelAnatomy[weapon.id].features.every((f) => weapon.parts.includes(f.parent)));
  }
});

test("craftsmanship links resolve to actual feature landmarks", () => {
  assert.equal(craft.length, 6);
  for (const entry of craft) {
    sources(entry.sources);
    assert.ok(
      modelAnatomy[entry.weapon].features.some((f) => f.name === entry.feature),
      entry.title,
    );
  }
  assert.ok(bibliography.length >= 8);
});

test("archive images exist and retain reusable licenses and attribution", async () => {
  assert.equal(archive.length, 8);
  assert.ok(archive.some((x) => x.id === "algerian-nimcha"));
  assert.ok(!archive.some((x) => x.id === "rustam"));
  await assert.rejects(fs.access(new URL("assets/archive/rustam.webp", root)));
  for (const entry of archive) {
    assert.ok(["CC0", "CC BY 4.0"].includes(entry.license), entry.title);
    assert.ok(
      entry.credit &&
        entry.creator &&
        entry.shelfmark &&
        entry.source &&
        entry.licenseUrl,
    );
    assert.ok(entry.weapons.every((id) => id in modelConfig));
    const bytes = await fs.readFile(new URL(entry.image, root));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  }
});

test("model derivatives are self-contained and match their credited checksums", async () => {
  const credits = await read("models/credits.json");
  assert.equal(credits.length, 13);
  const optimization = await read("models/optimization.json");
  assert.equal(optimization.models.length, credits.length);
  for (const cfg of Object.values(modelConfig)) {
    const bytes = await fs.readFile(new URL("models/" + cfg.file, root));
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    const metadata = JSON.parse(
      bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)),
    );
    const entry = credits.find((x) => x.file === cfg.file);
    assert.ok(entry);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.sha256,
    );
    assert.equal(entry.license, metadata.asset.extras.license);
    const optimized = optimization.models.find((x) => x.file === cfg.file);
    assert.equal(optimized.after.bytes, bytes.length);
    assert.equal(optimized.after.sha256, entry.sha256);
    assert.equal(optimized.before.sha256, entry.sourceSha256);
    assert.ok(optimized.after.bytes < optimized.before.bytes);
    assert.ok(metadata.extensionsRequired.includes("EXT_meshopt_compression"));
    assert.ok(entry.modifications);
    for (const x of [...(metadata.buffers || []), ...(metadata.images || [])])
      assert.ok(
        !x.uri || x.uri.startsWith("data:"),
        "External resource in " + cfg.file,
      );
    assert.ok(cfg.length > 0 && cfg.center.every(Number.isFinite));
  }
});
