import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera } from "../dist/vendor/three.module.js";
import { OrbitControls } from "../dist/vendor/controls/OrbitControls.js";
import { createCameraTracker } from "../dist/camera-state.js";

test("wheel and trackpad pinch redraw even after OrbitControls consumed the change", () => {
  const originalDocument = globalThis.document;
  globalThis.document = new EventTarget();
  const element = new EventTarget();
  element.style = {};
  const camera = new PerspectiveCamera(31, 2, .01, 200);
  camera.position.set(0, 0, 10);
  const controls = new OrbitControls(camera, element);
  const changed = createCameraTracker();
  try {
    assert.equal(changed(camera), true);
    assert.equal(changed(camera), false);
    for (const [deltaY, ctrlKey] of [[-120, false], [240, false], [-6, true], [12, true]]) {
      const before = camera.position.length();
      const wheel = new Event("wheel", { cancelable: true });
      Object.assign(wheel, { deltaY, ctrlKey, deltaMode: 0, clientX: 100, clientY: 100 });
      element.dispatchEvent(wheel);
      assert.ok(deltaY < 0 ? camera.position.length() < before : camera.position.length() > before);
      assert.equal(controls.update(), false, "the input handler already consumed the change");
      assert.equal(changed(camera), true, "the render loop must still redraw the model");
      assert.equal(changed(camera), false, "an idle camera should not trigger continuous rendering");
    }
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    assert.equal(changed(camera), true, "resizing changes the rendered projection");
  } finally {
    controls.dispose();
    globalThis.document = originalDocument;
  }
});
