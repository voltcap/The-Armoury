import { createCameraTracker } from "./camera-state.js?v=1.2.1";
import * as T from "./vendor/three.module.js";
import { OrbitControls } from "./vendor/controls/OrbitControls.js";
import { lightExhibit, exhibitMaterial } from "./exhibit-lighting.js?v=1.2.1";
import { acquireModel, disposeModel } from "./model-assets.js?v=1.2.1";
import { modelConfig } from "./data.js?v=1.2.1";

// Each model uses the study viewer's ten-unit span, not an inferred physical scale.
export function createComparison(catalog, history) {
  const views = [],
    panel = document.getElementById("comparePage");
  let syncing = false,
    visible = false,
    frame = 0;
  const linked = document.getElementById("linkViews");
  for (const side of ["Left", "Right"]) {
    const canvas = document.getElementById("compare" + side);
    const renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(31, 1, 0.01, 200);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.minDistance = 2;
    controls.maxDistance = 50;
    lightExhibit(renderer, scene, camera);
    const group = new T.Group();
    scene.add(group);
    const view = {
      side,
      canvas,
      renderer,
      scene,
      camera,
      controls,
      group,
      cameraChanged: createCameraTracker(),
      request: 0,
      dirty: true,
    };
    views.push(view);
    controls.addEventListener("change", () => {
      view.dirty = true;
      if (!linked.checked || syncing || !visible) return;
      syncing = true;
      for (const other of views)
        if (other !== view) {
          other.camera.position.copy(camera.position);
          other.controls.target.copy(controls.target);
          other.controls.update();
          other.dirty = true;
        }
      syncing = false;
    });
    const select = document.getElementById("compareSelect" + side);
    for (const w of catalog) select.add(new Option(w.short, w.id));
    select.value = side === "Left" ? "longsword" : "yatagan";
    select.onchange = () => load(view, select.value);
    new ResizeObserver(() => resize(view)).observe(canvas.parentElement);
  }
  function resize(v) {
    const r = v.canvas.parentElement.getBoundingClientRect();
    if (!r.width || !r.height) return;
    v.renderer.setSize(r.width, r.height, false);
    v.camera.aspect = r.width / r.height;
    v.camera.updateProjectionMatrix();
    v.dirty = true;
  }
  function reset() {
    syncing = true;
    for (const v of views) {
      resize(v);
      v.controls.target.set(0, 0, 0);
      const distance = Math.max(
        9,
        (5 /
          Math.max(0.25, v.camera.aspect) /
          Math.tan(T.MathUtils.degToRad(15.5))) *
          1.2,
      );
      v.camera.position.set(0.04 * distance, 0.13 * distance, distance);
      v.controls.update();
      v.dirty = true;
    }
    // Matching camera and projection make linked orbiting predictable.
    syncing = false;
  }
  async function load(v, id) {
    const token = ++v.request,
      state = document.getElementById("compareStatus" + v.side);
    state.hidden = false;
    state.dataset.loading = "true";
    state.textContent = "Loading model…";
    let lease;
    try {
      lease = await acquireModel("./models/" + modelConfig[id].file + "?v=1.1.0");
      const root = lease.root;
      if (token !== v.request) {
        lease.release();
        return;
      }
      v.group.children.slice().forEach((o) => {
        disposeModel(o, false);
        v.group.remove(o);
      });
      v.lease?.release();
      v.lease = lease;
      root.updateMatrixWorld(true);
      const cfg = modelConfig[id],
        sign = catalog.find((w) => w.id === id).sign;
      const c = new T.Vector3(...cfg.center),
        u = new T.Vector3(...cfg.u),
        a = new T.Vector3(...cfg.v),
        w = new T.Vector3(...cfg.w),
        mid = new T.Vector3(...cfg.mid),
        scale = 10 / cfg.length;
      let meshIndex = 0;
      root.traverse((mesh) => {
        if (!mesh.isMesh) return;
        const index = meshIndex++;
        if (cfg.includeMeshes && !cfg.includeMeshes.includes(index)) return;
        const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),
          p = g.attributes.position,
          n = g.attributes.normal;
        for (let i = 0; i < p.count; i++) {
          const x = new T.Vector3().fromBufferAttribute(p, i).sub(c);
          p.setXYZ(
            i,
            (x.dot(u) - mid.x) * scale * sign,
            (x.dot(a) - mid.y) * scale,
            (x.dot(w) - mid.z) * scale * sign,
          );
          if (n) {
            const x = new T.Vector3().fromBufferAttribute(n, i);
            n.setXYZ(i, x.dot(u) * sign, x.dot(a), x.dot(w) * sign);
          }
        }
        g.computeBoundingSphere();
        const material = exhibitMaterial(
          Array.isArray(mesh.material) ? mesh.material[0] : mesh.material,
        );
        v.group.add(new T.Mesh(g, material));
      });
      const info = document.getElementById("compareInfo" + v.side),
        h = history[id];
      info.replaceChildren();
      const title = document.createElement("h2");
      title.textContent = catalog.find((w) => w.id === id).short;
      const text = document.createElement("p");
      text.textContent = h.context;
      info.append(title, text);
      for (const source of (h.sources || []).slice(0, 2)) {
        const link = document.createElement("a");
        link.textContent = source.title;
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        info.append(link);
      }
      state.hidden = true;
      delete state.dataset.loading;
      v.canvas.dataset.model = id;
      v.dirty = true;
    } catch (e) {
      if (lease && v.lease !== lease) lease.release();
      if (token === v.request) {
        delete state.dataset.loading;
        state.textContent = "Unable to load. Select the weapon again to retry.";
      }
    }
  }
  function tick() {
    if (!visible) return;
    for (const v of views) {
      v.controls.update();
      const changed = v.cameraChanged(v.camera);
      if (changed || v.dirty) {
        v.renderer.render(v.scene, v.camera);
        v.canvas.dataset.cameraPosition = v.camera.position
          .toArray()
          .map((x) => x.toFixed(4))
          .join(",");
        v.canvas.dataset.cameraTarget = v.controls.target
          .toArray()
          .map((x) => x.toFixed(4))
          .join(",");
        v.dirty = false;
      }
    }
    frame = requestAnimationFrame(tick);
  }
  document.getElementById("compareReset").onclick = reset;
  linked.onchange = () => {
    if (linked.checked) reset();
  };
  return {
    show() {
      visible = true;
      reset();
      if (!panel.dataset.initialized) {
        panel.dataset.initialized = "true";
        views.forEach((v) =>
          load(v, document.getElementById("compareSelect" + v.side).value),
        );
      }
      cancelAnimationFrame(frame);
      tick();
    },
    hide() {
      visible = false;
      cancelAnimationFrame(frame);
    },
  };
}
