import test from "node:test";
import assert from "node:assert/strict";
import { layoutCallouts } from "../dist/label-layout.js";

test("all callouts survive a crowded hilt and stay separated inside the viewer", () => {
  for (const [width, height] of [
    [712, 270],
    [326, 202],
    [220, 230],
  ]) {
    for (const names of [
      ["Blade", "Habaki", "Tsuba", "Fuchi", "Tsuka", "Kashira", "Saya"],
      [
        "Incurved edge",
        "Blade back",
        "Point",
        "Blade-base ornaments",
        "Grip plaques",
        "Eared terminal",
      ],
    ]) {
      const items = names.map((name, id) => ({
        id,
        ax: width * 0.86,
        ay: height / 2,
        lane: id % 2,
        width: Math.min(136, Math.max(54, name.length * 5.3 + 18)),
        height: name.length > 18 ? 34 : 26,
      }));
      const result = layoutCallouts(items, width, height);
      assert.equal(result.length, names.length);
      assert.equal(new Set(result.map((i) => i.id)).size, names.length);
      for (const a of result) {
        assert.ok(a.x - a.width / 2 >= 0 && a.x + a.width / 2 <= width);
        assert.ok(a.y - a.height / 2 >= 0 && a.y + a.height / 2 <= height);
        for (const b of result)
          if (a.id !== b.id)
            assert.ok(
              Math.abs(a.x - b.x) >= (a.width + b.width) / 2 ||
                Math.abs(a.y - b.y) >= (a.height + b.height) / 2,
              "Callouts overlap",
            );
      }
    }
  }
});
