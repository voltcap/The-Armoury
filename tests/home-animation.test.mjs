import test from "node:test";
import assert from "node:assert/strict";
import { initHome } from "../dist/home.js";

test("Enter plays the four numbered frames faster, even with reduced motion, and leaving Home cancels playback", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const saved = { document: globalThis.document, matchMedia: globalThis.matchMedia };
  const classes = () => {
    const values = new Set();
    return { add: (...items) => items.forEach((x) => values.add(x)), remove: (...items) => items.forEach((x) => values.delete(x)), toggle: (x, on) => on ? values.add(x) : values.delete(x) };
  };
  const frames = Array.from({ length: 4 }, (_, i) => ({ src: "", dataset: { src: `frame-${i + 1}` }, classList: classes(), decode: async () => {} }));
  const page = { dataset: {}, classList: classes(), querySelectorAll: () => frames };
  const button = {};
  globalThis.document = { getElementById: (id) => id === "homePage" ? page : button };
  globalThis.matchMedia = () => ({ matches: true });
  let entered = 0;
  try {
    const home = initHome(() => entered++);
    home.show();
    await button.onclick();
    assert.equal(entered, 0, "Enter must not skip directly into Study");
    assert.equal(button.disabled, true);
    const poses = [page.dataset.pose];
    for (const duration of [400, 420, 450]) {
      t.mock.timers.tick(duration);
      poses.push(page.dataset.pose);
      assert.equal(entered, 0);
    }
    assert.deepEqual(poses, ["1", "2", "3", "4"]);
    t.mock.timers.tick(629);
    assert.equal(entered, 0, "hold the final frame before entering");
    t.mock.timers.tick(1);
    assert.equal(entered, 1);
    home.show(); await button.onclick();
    home.hide(); t.mock.timers.tick(10000);
    assert.equal(entered, 1, "cancelled playback must not reopen Study later");
  } finally {
    globalThis.document = saved.document;
    globalThis.matchMedia = saved.matchMedia;
  }
});
