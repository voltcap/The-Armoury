// Compare the actual camera, not OrbitControls' most recent return value.
// Input handlers can consume a camera change before the animation loop runs.
export function createCameraTracker() {
  let previous = null;
  return (camera) => {
    camera.updateMatrixWorld(true);
    const state = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements];
    const changed = !previous || state.some((value, index) => Math.abs(value - previous[index]) > 1e-10);
    if (changed) previous = state;
    return changed;
  };
}
