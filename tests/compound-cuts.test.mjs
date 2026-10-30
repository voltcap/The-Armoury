import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../dist/vendor/three.module.js";
import { partitionGeometry, lower, upper } from "../dist/clean-cut.js";
import { modelConfig } from "../dist/data.js";
const members = (regions, point) => [...new Set(regions.filter((r) => r.planes.every((p) => point.reduce((s, v, i) => s + v * p[i], p[3]) >= -1e-8)).map((r) => r.part))];
test("curved quillon tips and blade roots stay with their intended pieces", () => {
  const moon = modelConfig.moonbrand.regions, arming = modelConfig.arming.regions;
  assert.deepEqual(members(moon, [2.85, 1.15, 0]), [1]);
  assert.deepEqual(members(moon, [2.85, -1.15, 0]), [1]);
  assert.deepEqual(members(moon, [3.03, 0, 0]), [0]);
  assert.deepEqual(members(moon, [3.21, 0, 0]), [2]);
  assert.deepEqual(members(arming, [3.55, .94, 0]), [1]);
  assert.deepEqual(members(arming, [3.55, -.94, 0]), [1]);
  assert.deepEqual(members(arming, [3.39, 0, .04]), [0]);
  assert.deepEqual(members(arming, [3.54, 0, 0]), [2]);
});
test("joining two regions of one part does not create internal cut caps", () => {
  const source = new T.BoxGeometry(2, 2, 2).toNonIndexed();
  const [part] = partitionGeometry(source, [{ part: 0, planes: [lower(0)] }, { part: 0, planes: [upper(0)] }]);
  assert.equal([...part.cuts.values()].reduce((sum, cut) => sum + cut.segments.length, 0), 0);
});
