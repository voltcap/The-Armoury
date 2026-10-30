import test from "node:test";
import assert from "node:assert/strict";
import { createModelCache } from "../dist/model-cache.js";

test("concurrent viewers share a load and retain active assets during eviction", async () => {
  const loaded = [], disposed = [];
  const acquire = createModelCache(async (url) => {
    loaded.push(url);
    return { url };
  }, (root) => disposed.push(root.url), 2);
  const [study, left] = await Promise.all([acquire("sword"), acquire("sword")]);
  assert.equal(study.root, left.root);
  assert.deepEqual(loaded, ["sword"]);
  const right = await acquire("axe");
  study.release(); study.release();
  const another = await acquire("mace");
  assert.deepEqual(disposed, [], "the other viewer still owns the sword");
  left.release();
  assert.deepEqual(disposed, ["sword"]);
  right.release(); another.release();
  const again = await acquire("axe");
  assert.equal(loaded.filter((url) => url === "axe").length, 1);
  again.release();
});

test("a failed request can be retried without retaining a broken cache entry", async () => {
  let attempts = 0;
  const acquire = createModelCache(async () => {
    if (++attempts === 1) throw Error("unavailable");
    return { ready: true };
  }, () => {});
  const failures = await Promise.allSettled([acquire("sword"), acquire("sword")]);
  assert.ok(failures.every((result) => result.status === "rejected"));
  assert.equal(attempts, 1);
  const retry = await acquire("sword");
  assert.ok(retry.root.ready);
  assert.equal(attempts, 2);
  retry.release();
});
