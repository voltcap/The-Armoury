import test from "node:test";
import assert from "node:assert/strict";
import { createDisassembly } from "../dist/disassembly.js";
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const fixture = [
  { name: "Blade", min: [-5, -.3, -.05], max: [3.2, .3, .05] },
  { name: "Guard", min: [3.05, -.9, -.5], max: [4.8, .9, .5] },
  { name: "Grip", min: [3.3, -.2, -.2], max: [4.5, .2, .2] },
  { name: "Pommel", min: [4.3, -.4, -.3], max: [5, .4, .3] },
  { name: "Scabbard", min: [-5, -.8, -.25], max: [3.3, .4, .25] },
  { name: "Suspension fittings", min: [-3, -.7, -.3], max: [3.2, .3, .5] },
];
test("parts clear axially before fanning out, and attached fittings never cross their scabbard", () => {
  const plan = createDisassembly(fixture, [.98, -.2, 0]);
  for (let step = 0; step <= 100; step++) {
    const amount = step / 100;
    assert.deepEqual(plan.position(5, amount), plan.position(4, amount));
    for (let k = 1; k < plan.core.length; k++) {
      const a = plan.core[k - 1], b = plan.core[k];
      const oldGap = plan.bounds[b][0] - plan.bounds[a][1];
      const gap = oldGap + dot(plan.position(b, amount), plan.axis) - dot(plan.position(a, amount), plan.axis);
      assert.ok(gap >= oldGap - 1e-9, "axial movement must increase clearance");
      if (amount >= .65) assert.ok(gap >= .45 - 1e-8, "display lanes need clear longitudinal intervals");
    }
  }
  for (let i = 0; i < fixture.length; i++) assert.ok(plan.position(i, 0).every((x) => Math.abs(x) < 1e-12));
});
test("yatagan grip scales escape outward while studs remain fixed to the hilt frame", () => {
  const parts = [fixture[0], { name: "Hilt frame", min: [3, -.3, -.07], max: [5, .3, .07] },
    { name: "Left grip scale", min: [3.1, -.3, -.2], max: [4.9, .3, -.07] },
    { name: "Right grip scale", min: [3.1, -.3, .07], max: [4.9, .3, .2] },
    { name: "Ornamental studs", min: [3.2, -.2, -.25], max: [4.8, .2, .25] }];
  const plan = createDisassembly(parts);
  for (let i = 0; i <= 100; i++) {
    const p = i / 100;
    assert.deepEqual(plan.position(4, p), plan.position(1, p));
    assert.ok(plan.position(2, p)[2] <= 0);
    assert.ok(plan.position(3, p)[2] >= 0);
  }
});
