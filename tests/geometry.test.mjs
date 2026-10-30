import assert from "node:assert/strict";
import * as T from "../dist/vendor/three.module.js";
import {
  partitionGeometry,
  buildCutCaps,
  lower,
  upper,
} from "../dist/clean-cut.js";
const cube = new T.BoxGeometry(2, 2, 2),
  outputs = partitionGeometry(cube, [
    { part: 0, planes: [lower(0.23)] },
    { part: 1, planes: [upper(0.23)] },
  ]);
function area(g) {
  const p = g.attributes.position,
    ix = g.index;
  let sum = 0;
  for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
    const a = new T.Vector3().fromBufferAttribute(p, ix ? ix.getX(i) : i),
      b = new T.Vector3().fromBufferAttribute(p, ix ? ix.getX(i + 1) : i + 1),
      c = new T.Vector3().fromBufferAttribute(p, ix ? ix.getX(i + 2) : i + 2);
    sum += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return sum;
}
assert.equal(outputs.length, 2);
assert.ok(
  Math.abs(outputs.reduce((a, o) => a + area(o.geometry), 0) - area(cube)) <
    1e-5,
  "All original surface area is preserved",
);
for (const o of outputs) {
  const p = o.geometry.attributes.position;
  let boundary = 0;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    assert.ok(o.part === 0 ? x <= 0.230001 : x >= 0.229999);
    if (Math.abs(x - 0.23) < 1e-6) boundary++;
  }
  assert.ok(boundary > 0);
  const cap = buildCutCaps(o.cuts);
  assert.ok(cap, "The closed cut is capped");
  assert.ok(
    Math.abs(area(cap) - 4) < 1e-5,
    "Cap area matches the exact square cross-section",
  );
  for (let i = 0; i < cap.attributes.position.count; i++)
    assert.ok(Math.abs(cap.attributes.position.getX(i) - 0.23) < 1e-6);
}
const triangle = new T.BufferGeometry();
triangle.setAttribute(
  "position",
  new T.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, 1, 0], 3),
);
triangle.setAttribute(
  "uv",
  new T.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2),
);
const clipped = partitionGeometry(triangle, [
  { part: 0, planes: [lower(0)] },
  { part: 1, planes: [upper(0)] },
]);
assert.ok(
  Math.abs(clipped.reduce((a, o) => a + area(o.geometry), 0) - 1) < 1e-6,
);
for (const o of clipped) {
  const p = o.geometry.attributes.position,
    uv = o.geometry.attributes.uv;
  for (let i = 0; i < p.count; i++)
    if (Math.abs(p.getX(i)) < 1e-6)
      assert.ok(
        Math.abs(uv.getX(i) - 0.5) < 1e-6,
        "UV interpolation remains continuous",
      );
}
const diagonal = partitionGeometry(cube, [
  { part: 0, planes: [[1, -0.4, 0, 0.2]] },
  { part: 1, planes: [[-1, 0.4, 0, -0.2]] },
]);
assert.ok(
  Math.abs(diagonal.reduce((a, o) => a + area(o.geometry), 0) - 24) < 1e-5,
);
console.log(
  "Planarity, area preservation, UV continuity, diagonal cuts and closed caps passed.",
);
