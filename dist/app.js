import { initSuite } from "./suite.js?v=1.0.1";
import * as T from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import { OrbitControls } from "./vendor/controls/OrbitControls.js";
import { RoomEnvironment } from "./vendor/environments/RoomEnvironment.js";
import { partitionGeometry, buildCutCaps, lower, upper } from "./clean-cut.js";
import { modelConfig, modelHistory, modelAnatomy } from "./data.js";

const roman = (n) =>
  ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n] ||
  String(n);
const $ = (id) => document.getElementById(id),
  pad = (n) => String(n).padStart(2, "0");
const collection = [
  {
    id: "longsword",
    title: "The longsword",
    short: "Longsword",
    place: "Medieval Europe",
    sub: "A study in steel, balance, and the craft of the hilt.",
    parts: ["Blade", "Crossguard", "Grip", "Pommel", "Peened cap"],
    method: "Source components · original textured geometry",
    sign: 1,
  },
  {
    id: "arming",
    title: "The arming sword",
    short: "Arming sword",
    place: "Italian tradition",
    sub: "A one-handed blade. A familiar, enduring silhouette.",
    parts: ["Blade", "Crossguard", "Grip", "Pommel"],
    method: "Clean planar cutaway · original textured scan",
    sign: -1,
  },
  {
    id: "gladius",
    title: "The gladius",
    short: "Roman gladius",
    place: "Ancient Rome",
    sub: "A compact blade and the fittings that complete it.",
    parts: ["Blade", "Guard", "Grip", "Pommel", "Scabbard", "Scabbard mounts"],
    method: "Source components + clean planar hilt cuts",
    sign: -1,
  },
  {
    id: "arabic",
    title: "The Arabic saber",
    short: "Arabic saber",
    place: "Arab sword traditions",
    sub: "A curved silhouette, ornamental mounts, and a compact hilt.",
    parts: [
      "Sheathed blade",
      "Guard",
      "Grip",
      "Upper suspension mount",
      "Lower suspension mount",
    ],
    method: "Connected source surfaces · grouped for study",
    sign: 1,
  },
  {
    id: "yatagan",
    title: "The yatagan",
    short: "Turkish yatagan",
    place: "Ottoman tradition",
    sub: "An inward-curving edge and a distinctive eared hilt.",
    parts: [
      "Blade",
      "Hilt frame",
      "Left grip scale",
      "Right grip scale",
      "Ornamental studs",
    ],
    method: "Supplied model · separate source surfaces",
    sign: 1,
  },
  {
    id: "katana",
    title: "The dragon katana",
    short: "Dragon katana",
    place: "Fantasy / Japanese influence",
    sub: "An imagined sword, explored through traditional terminology.",
    parts: ["Blade", "Habaki", "Tsuba", "Fuchi", "Tsuka", "Kashira", "Saya"],
    method: "Connected source pieces · fantasy sword mountings",
    sign: -1,
  },
  {
    id: "guards",
    title: "The Guards sword",
    short: "Irish Guards sword",
    place: "British military tradition",
    sub: "A ceremonial silhouette with a protective steel hilt.",
    parts: [
      "Blade",
      "Guard",
      "Grip",
      "Backstrap & pommel",
      "Scabbard",
      "Suspension rings",
    ],
    method: "Source components · grouped connected surfaces",
    sign: 1,
  },
  {
    id: "axe",
    title: "The T-axe",
    short: "Anglo-Saxon T-axe",
    place: "Early medieval England",
    sub: "The anatomy of a working tool, shaped for timber.",
    parts: ["Head", "Haft"],
    method: "Clean planar cutaway · original textured scan",
    sign: -1,
  },
  {
    id: "mace",
    title: "The steel mace",
    short: "Steel mace",
    place: "Medieval tradition",
    sub: "A compact head, a long shaft, and concentrated mass.",
    parts: ["Head", "Shaft", "Grip", "Butt cap", "Shaft collars"],
    method: "Source flanges + clean planar shaft cuts",
    sign: -1,
  },
];
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let config = modelConfig,
  history = modelHistory,
  anatomy = modelAnatomy,
  studyMode = "pieces",
  featureIndex = 0,
  activeFeatures = [],
  active = collection[0],
  selected = 0,
  isolated = false,
  parts = [],
  labels = [],
  requestId = 0,
  amount = 0,
  targetAmount = 0,
  touring = false,
  tourStart = 0,
  showLabels = true,
  wire = false,
  currentRaw = null,
  importedRoot = null,
  needsRender = true,
  autoFocus = true,
  cameraMove = null;
try {
  autoFocus = localStorage.getItem("armoury-closeups") !== "false";
} catch {}
$("focusToggle").checked = autoFocus;
let studyVisible = true;
let cameraIntent = "whole";
let renderer;
try {
  renderer = new T.WebGLRenderer({
    canvas: $("scene"),
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
} catch (e) {
  $("loading").textContent =
    "This exhibit needs WebGL. Try a browser with hardware acceleration enabled.";
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new T.Scene(),
  camera = new T.PerspectiveCamera(31, 1, 0.01, 200);
camera.position.set(1.5, 3, 18);
const controls = new OrbitControls(camera, $("scene"));
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 0.2;
controls.maxDistance = 50;
controls.autoRotateSpeed = 0.55;
controls.enablePan = true;
const pmrem = new T.PMREMGenerator(renderer),
  environment = new RoomEnvironment();
environment.add(new T.AmbientLight(0xffffff, 0.8));
scene.environment = pmrem.fromScene(environment, 0.02).texture;
scene.add(new T.AmbientLight(0xffffff, 0.65));
scene.add(new T.HemisphereLight(0xf5f1e9, 0xf5f1e9, 1.5));
for (const pos of [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]) {
  const light = new T.DirectionalLight(0xffffff, 0.8);
  light.position.set(...pos).multiplyScalar(10);
  scene.add(light);
}
scene.add(camera);
for (const [intensity, pos] of [
  [3.2, [-3, 4, 4]],
  [2.2, [4, -3, 4]],
]) {
  const light = new T.DirectionalLight(0xfff7eb, intensity),
    target = new T.Object3D();
  target.position.set(0, 0, -8);
  camera.add(target);
  light.target = target;
  light.position.set(...pos);
  camera.add(light);
}
const exhibit = new T.Group();
scene.add(exhibit);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
function resize() {
  needsRender = true;
  const r = $("viewport").getBoundingClientRect();
  if (!r.width || !r.height) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  if (parts.length) {
    if (isolated) {
      frameSelected();
      revealViewer();
    } else if (autoFocus && cameraIntent === "feature") frameFeature();
    else if (autoFocus && cameraIntent === "part") frameSelected();
    else resetCamera();
  }
}
new ResizeObserver(resize).observe($("viewport"));
resize();

function renderCollection() {
  $("weaponSelect").innerHTML = collection
    .map(
      (w) =>
        `<option value="${esc(w.id)}" ${w.id === active.id ? "selected" : ""}>${esc(w.short)}</option>`,
    )
    .join("");
  $("weaponSelect").onchange = (e) => loadWeapon(e.target.value);
  $("weapons").innerHTML = collection
    .map(
      (w) =>
        `<button class="weapon ${active.id === w.id ? "active" : ""}" data-weapon="${w.id}" ${active.id === w.id ? 'aria-current="true"' : ""}>${esc(w.short)}</button>`,
    )
    .join("");
  document
    .querySelectorAll("[data-weapon]")
    .forEach((b) => (b.onclick = () => loadWeapon(b.dataset.weapon)));
}
function setReady(ready) {
  for (const id of [
    "isolateBtn",
    "isolateMobile",
    "resetPosition",
    "explode",
    "assembleBtn",
    "explodeBtn",
    "tourBtn",
    "prevPart",
    "nextPart",
  ])
    $(id).disabled = !ready;
}
function releaseRoot(root) {
  if (!root) return;
  const textures = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      Object.values(m).forEach((v) => {
        if (v?.isTexture) textures.add(v);
      });
      m.dispose();
    }
  });
  textures.forEach((t) => t.dispose());
}
function removeModel() {
  for (const p of parts) {
    p.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
  }
  exhibit.clear();
  parts = [];
  labels = [];
  activeFeatures = [];
  $("featureLabel").hidden = true;
  $("labels").replaceChildren();
  $("leaders").replaceChildren();
}
function transformGeometry(mesh, cfg, sign) {
  const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const p = g.attributes.position,
    n = g.attributes.normal;
  const c = new T.Vector3(...cfg.center),
    u = new T.Vector3(...cfg.u),
    v = new T.Vector3(...cfg.v),
    w = new T.Vector3(...cfg.w),
    mid = new T.Vector3(...cfg.mid),
    scale = 10 / cfg.length;
  for (let i = 0; i < p.count; i++) {
    const a = new T.Vector3().fromBufferAttribute(p, i).sub(c);
    p.setXYZ(
      i,
      (a.dot(u) - mid.x) * scale * sign,
      (a.dot(v) - mid.y) * scale,
      (a.dot(w) - mid.z) * scale * sign,
    );
    if (n) {
      const a = new T.Vector3().fromBufferAttribute(n, i);
      n.setXYZ(i, a.dot(u) * sign, a.dot(v), a.dot(w) * sign);
    }
  }
  p.needsUpdate = true;
  if (n) n.needsUpdate = true;
  g.computeBoundingBox();
  return g;
}
function computeConfig(root) {
  root.updateMatrixWorld(true);
  let arr = [];
  root.traverse((o) => {
    if (o.isMesh) {
      const p = o.geometry.attributes.position;
      const step = Math.max(1, Math.floor(p.count / 15000));
      for (let i = 0; i < p.count; i += step)
        arr.push(
          new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld),
        );
    }
  });
  if (!arr.length) throw Error("No mesh surfaces found in this GLB.");
  let c = new T.Vector3();
  arr.forEach((p) => c.add(p));
  c.divideScalar(arr.length);
  let cov = Array(9).fill(0);
  arr.forEach((p) => {
    const a = p.clone().sub(c).toArray();
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) cov[j * 3 + k] += a[j] * a[k];
  });
  function power(seed, ortho) {
    let v = new T.Vector3(...seed);
    for (let i = 0; i < 45; i++) {
      let a = v.toArray();
      v.set(
        ...[0, 1, 2].map(
          (j) =>
            cov[j * 3] * a[0] + cov[j * 3 + 1] * a[1] + cov[j * 3 + 2] * a[2],
        ),
      );
      if (ortho) v.addScaledVector(ortho, -v.dot(ortho));
      v.normalize();
    }
    return v;
  }
  const u = power([1, 1, 1]),
    v = power([0.3, 0.8, 0.1], u),
    w = new T.Vector3().crossVectors(u, v);
  const bb = new T.Box3().setFromPoints(
    arr.map((p) => {
      const a = p.clone().sub(c);
      return new T.Vector3(a.dot(u), a.dot(v), a.dot(w));
    }),
  );
  return {
    center: c.toArray(),
    u: u.toArray(),
    v: v.toArray(),
    w: w.toArray(),
    mid: bb.getCenter(new T.Vector3()).toArray(),
    length: bb.max.x - bb.min.x,
  };
}
function connectivity(g) {
  const p = g.attributes.position,
    idx = g.index,
    par = Array.from({ length: p.count }, (_, i) => i),
    map = new Map();
  function root(i) {
    while (par[i] !== i) {
      par[i] = par[par[i]];
      i = par[i];
    }
    return i;
  }
  function join(a, b) {
    par[root(a)] = root(b);
  }
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)]
      .map((x) => Math.round(x * 10000))
      .join(",");
    if (map.has(key)) join(i, map.get(key));
    else map.set(key, i);
  }
  for (let i = 0; i < (idx?.count ?? p.count); i += 3) {
    join(idx ? idx.getX(i) : i, idx ? idx.getX(i + 1) : i + 1);
    join(idx ? idx.getX(i) : i, idx ? idx.getX(i + 2) : i + 2);
  }
  const boxes = new Map();
  for (let i = 0; i < p.count; i++) {
    let r = root(i);
    if (!boxes.has(r)) boxes.set(r, new T.Box3());
    boxes.get(r).expandByPoint(new T.Vector3().fromBufferAttribute(p, i));
  }
  return { root, boxes };
}
function regionsFor(id, mi, box) {
  const native = (part) => [{ part, planes: [] }],
    ranges = (cuts, indices) =>
      indices.map((part, i) => ({
        part,
        planes: [
          ...(i ? [upper(cuts[i - 1])] : []),
          ...(i < cuts.length ? [lower(cuts[i])] : []),
        ],
      }));
  const size = box.getSize(new T.Vector3()),
    c = box.getCenter(new T.Vector3());
  if (id === "longsword")
    return native(
      mi === 0 ? 0 : mi === 2 ? 2 : mi === 3 ? 3 : c.x > 4.7 ? 4 : 1,
    );
  if (id === "yatagan")
    return native(mi === 3 ? 0 : mi === 0 ? 1 : mi === 2 ? 4 : c.z > 0 ? 3 : 2);
  if (id === "arming") return ranges([3.18, 3.53, 4.55], [0, 1, 2, 3]);
  if (id === "gladius") {
    if (mi === 0) return native(size.x > 5 ? 4 : 5);
    if (size.x > 5) return native(0);
    if (box.min.x > 4.75) return native(3);
    return ranges([3.15, 4.4], [1, 2, 3]);
  }
  if (id === "arabic")
    return native(
      size.x > 5 ? 0 : size.y > 1 ? 1 : box.min.x > 3.5 ? 2 : c.x > 1.6 ? 3 : 4,
    );
  if (id === "guards") {
    if (mi === 1 || mi === 2) return native(5);
    if (mi === 0) return native(4);
    return native(
      size.x > 5 ? 0 : size.y > 0.8 ? 1 : box.max.y > -0.35 ? 2 : 3,
    );
  }
  if (id === "katana") {
    if (c.y > 0.4 * c.x + 0.5) return native(6);
    if (size.x > 4) return native(0);
    if (c.x < 2.18) return native(1);
    if (c.x < 2.49) return native(2);
    if (c.x < 2.72) return native(3);
    if (c.x > 4.44) return native(5);
    return native(4);
  }
  if (id === "axe") {
    const h = [-1, 0.4, 0, -2.1],
      nh = [1, -0.4, 0, 2.1];
    return [
      { part: 0, planes: [h] },
      { part: 0, planes: [nh, lower(1.2), [0, -1, 0, -0.42]] },
      { part: 1, planes: [nh, upper(1.2)] },
      { part: 1, planes: [nh, lower(1.2), [0, 1, 0, 0.42]] },
    ];
  }
  if (id === "mace") {
    if (size.x > 7) return ranges([-2.9, 1.5, 4.5], [0, 1, 2, 3]);
    return native(c.x < -2.9 ? 0 : c.x > 4.5 ? 3 : c.x > 1.5 ? 2 : 4);
  }
  const b = Math.min(4.1, 5 - Number($("hiltBoundary").value) / 10);
  return ranges([b, b + 0.3, 4.5], [0, 1, 2, 3]);
}
function createPart(index) {
  const group = new T.Group();
  group.name = active.parts[index];
  exhibit.add(group);
  return {
    group,
    index,
    name: active.parts[index],
    center: new T.Vector3(),
    box: new T.Box3(),
    offset: new T.Vector3(),
    count: 0,
    cuts: new Map(),
  };
}
function addSurfaces(root, cfg) {
  root.updateMatrixWorld(true);
  parts = active.parts.map((_, i) => createPart(i));
  let mi = 0;
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const g = transformGeometry(mesh, cfg, active.sign);
    let groups = [];
    if (
      [
        "longsword",
        "gladius",
        "arabic",
        "guards",
        "katana",
        "mace",
        "yatagan",
      ].includes(active.id)
    ) {
      const comp = connectivity(g),
        map = new Map(),
        ix = g.index,
        count = ix?.count ?? g.attributes.position.count;
      for (let j = 0; j < count; j += 3) {
        const a = ix ? ix.getX(j) : j,
          key = comp.root(a);
        if (!map.has(key)) map.set(key, []);
        for (let k = 0; k < 3; k++)
          map.get(key).push(ix ? ix.getX(j + k) : j + k);
      }
      groups = [...map].map(([key, indices]) => ({
        box: comp.boxes.get(key),
        indices,
      }));
    } else groups = [{ box: g.boundingBox, indices: null }];
    const original = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material;
    for (const group of groups) {
      let input = g;
      if (group.indices) {
        input = new T.BufferGeometry();
        for (const [k, a] of Object.entries(g.attributes))
          input.setAttribute(k, a);
        input.setIndex(group.indices);
      }
      for (const out of partitionGeometry(
        input,
        regionsFor(active.id, mi, group.box),
      )) {
        const k = out.part,
          mat = original.clone();
        mat.side = T.DoubleSide;
        mat.wireframe = wire;
        if (mat.color) {
          mat.color.r = Math.max(0.025, mat.color.r);
          mat.color.g = Math.max(0.023, mat.color.g);
          mat.color.b = Math.max(0.02, mat.color.b);
          if (active.id === "axe") mat.color.multiplyScalar(0.66);
        }
        if ("envMapIntensity" in mat) mat.envMapIntensity = 1.45;
        if ("roughness" in mat) mat.roughness = Math.max(0.35, mat.roughness);
        const obj = new T.Mesh(out.geometry, mat);
        obj.userData.part = k;
        parts[k].group.add(obj);
        parts[k].count += out.geometry.attributes.position.count / 3;
        for (const [key, cut] of out.cuts) {
          if (!parts[k].cuts.has(key))
            parts[k].cuts.set(key, { plane: cut.plane, segments: [] });
          parts[k].cuts.get(key).segments.push(...cut.segments);
        }
      }
      if (input !== g) input.dispose();
    }
    g.dispose();
    mi++;
  });
  for (const p of parts) {
    const cap = buildCutCaps(p.cuts);
    if (cap) {
      const material = new T.MeshStandardMaterial({
        color: 0x9a9386,
        metalness: 0.3,
        roughness: 0.67,
        side: T.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      const obj = new T.Mesh(cap, material);
      obj.userData.cutFace = true;
      obj.userData.part = p.index;
      p.group.add(obj);
    }
  }
  finishParts();
}
function finishParts() {
  parts = parts.filter((p) => p.count > 0);
  parts.forEach((p, i) => {
    p.index = i;
    p.group.traverse((o) => {
      if (o.isMesh) {
        o.userData.part = i;
        o.material.wireframe = wire;
      }
    });
    p.box.setFromObject(p.group, true);
    p.box.getCenter(p.center);
    p.offset.set(
      i * 0.65 - (parts.length - 1) * 0.28,
      i % 2 === 0 ? 0.8 : -0.85,
      ((i % 3) - 1) * 0.3,
    );
    if (i === 0) p.offset.x = -0.8;
    if (active.id === "katana")
      p.offset.set(
        i === 0 ? -1.3 : i === 6 ? -1.1 : (i - 1) * 0.65 - 0.6,
        i === 6 ? 1.1 : i % 2 === 0 ? 0.7 : -0.7,
        0,
      );
    if (active.id === "axe") {
      p.offset.set(i === 0 ? -1.1 : 0.3, i === 0 ? -1 : 0.55, 0);
    }
    if (active.id === "yatagan") {
      const offsets = [
        [-0.85, -0.65, 0],
        [0.1, 0.65, 0],
        [1, -0.85, -0.6],
        [1.4, 0.95, 0.6],
        [-0.15, 1.6, 0.2],
      ];
      p.offset.set(...offsets[i]);
    }
    const l = document.createElement("button");
    l.className = "part-label";
    l.textContent = p.name;
    l.onclick = () => selectPart(i);
    $("labels").append(l);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    $("leaders").append(line);
    labels.push(l);
  });
  $("loading").hidden = true;
  setReady(true);
  selected = 0;
  featureIndex = 0;
  prepareFeatures();
  renderParts();
  updateHistory();
  resetCamera();
  needsRender = true;
}
async function loadSourceModel(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return (await new GLTFLoader().loadAsync(url)).scene;
    } catch (error) {
      lastError = error;
      if (attempt < 2)
        await new Promise((resolve) =>
          setTimeout(resolve, 350 * (attempt + 1)),
        );
    }
  }
  throw lastError;
}
async function loadWeapon(id, customRoot = null) {
  const token = ++requestId;
  active = collection.find((w) => w.id === id);
  setReady(false);
  renderCollection();
  removeModel();
  if (currentRaw !== importedRoot) releaseRoot(currentRaw);
  currentRaw = null;
  selected = 0;
  studyMode = "pieces";
  featureIndex = 0;
  isolated = false;
  touring = false;
  cameraMove = null;
  targetAmount = 0;
  amount = 0;
  syncAmount();
  $("tourBtn").textContent = "Animate";
  $("title").textContent = active.short;
  $("customTuning").hidden = id !== "custom";
  $("loading").hidden = false;
  $("loading").innerHTML = '<span class="spinner"></span><p>Loading model…</p>';
  try {
    const root =
      customRoot ||
      (id === "custom"
        ? importedRoot
        : await loadSourceModel(
            new URL("./models/" + config[id].file, import.meta.url).href,
          ));
    if (token !== requestId) {
      releaseRoot(root);
      return;
    }
    currentRaw = root;
    addSurfaces(root, id === "custom" ? computeConfig(root) : config[id]);
    return true;
  } catch (error) {
    if (token !== requestId) return false;
    setReady(false);
    $("loading").innerHTML =
      '<p>Unable to load this model.</p><button id="retryModel">Retry</button>';
    $("retryModel").onclick = () =>
      loadWeapon(id, id === "custom" ? importedRoot : null);
    console.error(error);
    return false;
  }
}
function prepareFeatures() {
  const source = anatomy[active.id]?.features || [];
  const aliases = {
    "Grip & pommel": "Grip",
    Fittings: "Upper suspension mount",
    "Peened terminal": "Peened cap",
  };
  activeFeatures = source.map((f) => {
    let parent = parts.findIndex(
      (p) => p.name === (aliases[f.parent] || f.parent),
    );
    if (parent < 0)
      parent = parts.findIndex((p) =>
        p.name.toLowerCase().includes(f.parent.toLowerCase()),
      );
    if (parent < 0) parent = 0;
    const target = new T.Vector3(...f.position);
    let best = new T.Vector3(),
      distance = Infinity;
    parts[parent].group.traverse((o) => {
      if (!o.isMesh || o.userData.cutFace) return;
      const a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const point = new T.Vector3().fromBufferAttribute(a, i),
          d = point.distanceToSquared(target);
        if (d < distance) {
          distance = d;
          best.copy(point);
        }
      }
    });
    return { ...f, parentIndex: parent, anchor: best };
  });
  $("detailsMode").disabled = !activeFeatures.length;
  $("featureTotal").textContent = activeFeatures.length || "";
  $("pieceTotal").textContent = parts.length;
}
function renderParts() {
  const details = studyMode === "details",
    list = details ? activeFeatures : parts,
    at = details ? featureIndex : selected;
  $("piecesMode").classList.toggle("selected", !details);
  $("detailsMode").classList.toggle("selected", details);
  $("piecesMode").setAttribute("aria-pressed", String(!details));
  $("detailsMode").setAttribute("aria-pressed", String(details));
  $("parts").innerHTML = list
    .map(
      (p, i) =>
        `<button class="part-row ${i === at ? "active" : ""}" ${details ? "data-feature" : "data-part"}="${i}" aria-pressed="${i === at}">${esc(p.name)}</button>`,
    )
    .join("");
  $("parts")
    .querySelectorAll("[data-part]")
    .forEach((b) => (b.onclick = () => selectPart(+b.dataset.part)));
  $("parts")
    .querySelectorAll("[data-feature]")
    .forEach((b) => (b.onclick = () => selectFeature(+b.dataset.feature)));
  showInfo();
}
function partInfo(name) {
  const specific = anatomy[active.id]?.components?.[name];
  if (specific)
    return {
      term: specific.term,
      function: specific.description || specific.function,
      sources: specific.sources,
    };
  if (name === "Shaft collars")
    return {
      term: "Shaft fittings",
      function:
        "These smaller bands and collars articulate the shaft. In the source mesh they are separate connected surfaces; they are grouped together here for study.",
    };
  if (active.id === "arabic" && name === "Sheathed blade")
    return {
      term: "Sheathed blade exterior",
      function:
        "The curved blade is shown in its sheath. The ornate end protects the point; the suspension mounts allow the sheath to be carried. The supplied exterior does not expose a separate internal blade.",
    };
  const h = history[active.id],
    aliases = { Tsuba: "Guard", Tsuka: "Grip", "Backstrap & pommel": "Pommel" },
    target = (aliases[name] || name).toLowerCase();
  return (
    h?.parts.find(
      (p) =>
        p.name.toLowerCase() === target ||
        target.includes(p.name.toLowerCase()) ||
        p.name.toLowerCase().includes(target),
    ) || {
      term: name,
      function:
        "An estimated region of your model’s surface. Adjust the hilt boundary to align the planar cut with its geometry.",
    }
  );
}
function showInfo() {
  if (!parts.length) return;
  const detail = studyMode === "details",
    f = activeFeatures[featureIndex],
    p = parts[selected],
    info = detail ? { function: f.description } : partInfo(p.name),
    at = detail ? featureIndex : selected,
    total = detail ? activeFeatures.length : parts.length;
  $("partTitle").textContent = detail ? f.name : p.name;
  $("partDescription").textContent = info.function;
  $("partPosition").textContent = at + 1 + " / " + total;
  const refs =
    (detail && f.sources) ||
    info.sources ||
    anatomy[active.id]?.sources ||
    history[active.id]?.sources ||
    [];
  $("partSources").innerHTML = refs
    .slice(0, 2)
    .map(
      (s) =>
        `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title)}" aria-label="${esc(s.title)}">${esc(s.title.split(" · ")[0])}</a>`,
    )
    .join("");
  labels.forEach((l, i) => l.classList.toggle("active", i === selected));
  applyIsolation();
}
function selectPart(index, reframe = true) {
  if (!parts.length || !Number.isFinite(index)) return;
  studyMode = "pieces";
  selected = (index + parts.length) % parts.length;
  renderParts();
  if (reframe && (autoFocus || isolated)) {
    frameSelected();
    if (autoFocus) revealViewer();
  }
}
function selectFeature(index) {
  if (!activeFeatures.length || !Number.isFinite(index)) return;
  studyMode = "details";
  featureIndex = (index + activeFeatures.length) % activeFeatures.length;
  selected = activeFeatures[featureIndex].parentIndex;
  renderParts();
  if (autoFocus) {
    frameFeature();
    revealViewer();
  } else if (isolated) frameSelected();
}
function stepSelection(direction) {
  if (studyMode === "details") selectFeature(featureIndex + direction);
  else selectPart(selected + direction);
}
$("piecesMode").onclick = () => {
  studyMode = "pieces";
  renderParts();
};
$("detailsMode").onclick = () => selectFeature(featureIndex);
function applyIsolation() {
  needsRender = true;
  parts.forEach((p, i) => (p.group.visible = !isolated || i === selected));
  const text = isolated
    ? "Show whole weapon"
    : parts.length
      ? "Isolate " + parts[selected].name.toLowerCase()
      : "Isolate piece";
  document.querySelectorAll(".isolate-control").forEach((b) => {
    b.textContent = text;
    b.setAttribute("aria-pressed", String(isolated));
  });
}
function revealViewer() {
  if (document.documentElement.dataset.page === "study") return;
  if (innerWidth <= 660) {
    const bounds = $("viewport").getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > innerHeight)
      $("viewport").scrollIntoView({
        behavior: reduced ? "instant" : "smooth",
        block: "center",
      });
  }
}
function toggleIsolation() {
  if (!parts.length) return;
  isolated = !isolated;
  applyIsolation();
  if (isolated) {
    frameSelected();
    revealViewer();
  } else resetCamera();
}
function moveCamera(target, position) {
  cameraMove = {
    started: performance.now(),
    duration: reduced ? 0 : 850,
    fromTarget: controls.target.clone(),
    fromPosition: camera.position.clone(),
    toTarget: target.clone(),
    toPosition: position.clone(),
  };
  needsRender = true;
}
function fitBox(box, canonical = false, padding = 1.3) {
  const size = box.getSize(new T.Vector3()),
    center = box.getCenter(new T.Vector3()),
    distance = Math.max(
      0.85,
      ((Math.max(size.y, size.x / camera.aspect) * 0.5) /
        Math.tan(T.MathUtils.degToRad(camera.fov) / 2)) *
        padding +
        size.z * 0.6,
    );
  const direction = canonical
    ? new T.Vector3(0.035, 0.15, 1).normalize()
    : camera.position.clone().sub(controls.target).normalize();
  moveCamera(center, center.clone().addScaledVector(direction, distance));
}
function frameSelected() {
  cameraIntent = "part";
  const p = parts[selected];
  if (!p) return;
  fitBox(
    p.box.clone().translate(p.offset.clone().multiplyScalar(targetAmount)),
    false,
    1.55,
  );
}
function frameFeature() {
  cameraIntent = "feature";
  const f = activeFeatures[featureIndex];
  if (!f) return;
  const p = parts[f.parentIndex],
    size = p.box.getSize(new T.Vector3()),
    radius = Math.min(1.3, Math.max(0.3, size.length() * 0.14)),
    center = f.anchor.clone().addScaledVector(p.offset, targetAmount);
  fitBox(
    new T.Box3(
      center.clone().addScalar(-radius),
      center.clone().addScalar(radius),
    ),
    false,
    1.45,
  );
}
function resetCamera() {
  cameraIntent = "whole";
  if (!parts.length) return;
  const box = new T.Box3();
  for (const p of parts)
    if (p.group.visible)
      box.union(
        p.box.clone().translate(p.offset.clone().multiplyScalar(targetAmount)),
      );
  fitBox(box, true, 1.28);
}
function resetPosition() {
  controls.autoRotate = false;
  $("rotateBtn").classList.remove("active");
  $("rotateBtn").setAttribute("aria-pressed", "false");
  isolated = false;
  applyIsolation();
  resetCamera();
}
controls.addEventListener("start", () => (cameraMove = null));
function updateHistory() {
  const h = history[active.id];
  $("historyTitle").textContent = h?.period || active.short;
  $("historyContext").textContent =
    h?.context ||
    "No historical attribution is available for this imported model.";
  $("modelNote").textContent = h?.modelNote || "";
  $("sources").replaceChildren();
  [...(h?.sources || []), ...(anatomy[active.id]?.sources || [])]
    .filter((s, i, a) => a.findIndex((t) => t.url === s.url) === i)
    .forEach((s) => {
      const a = document.createElement("a");
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = s.title;
      $("sources").append(a);
    });
}
function setAmount(value) {
  touring = false;
  $("tourBtn").textContent = "Animate";
  targetAmount = T.MathUtils.clamp(Number(value), 0, 1);
  if (isolated) {
    isolated = false;
    applyIsolation();
  }
  needsRender = true;
  resetCamera();
}
function syncAmount() {
  $("explode").value = Math.round(targetAmount * 100);
  $("percent").textContent = Math.round(targetAmount * 100) + "%";
}
$("explode").addEventListener("input", (e) => {
  setAmount(e.currentTarget.value / 100);
  syncAmount();
});
$("explode").addEventListener("change", (e) => {
  setAmount(e.currentTarget.value / 100);
  syncAmount();
});
$("explodeBtn").onclick = () => {
  setAmount(1);
  syncAmount();
};
$("assembleBtn").onclick = () => {
  setAmount(0);
  syncAmount();
};
document
  .querySelectorAll(".isolate-control")
  .forEach((b) => (b.onclick = toggleIsolation));
$("prevPart").onclick = () => stepSelection(-1);
$("nextPart").onclick = () => stepSelection(1);
$("resetPosition").onclick = resetPosition;
$("tourBtn").onclick = () => {
  touring = !touring;
  tourStart = performance.now();
  $("tourBtn").textContent = touring ? "Pause" : "Animate";
  if (touring) {
    isolated = false;
    applyIsolation();
    targetAmount = 1;
    resetCamera();
  }
};
$("focusToggle").onchange = (e) => {
  autoFocus = e.currentTarget.checked;
  try {
    localStorage.setItem("armoury-closeups", String(autoFocus));
  } catch {}
  if (!autoFocus) {
    isolated = false;
    applyIsolation();
    setAmount(0);
    syncAmount();
  }
};
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("themeBtn").textContent = theme === "dark" ? "Light mode" : "Dark mode";
  $("themeBtn").setAttribute("aria-pressed", String(theme === "dark"));
  try {
    localStorage.setItem("armoury-theme", theme);
  } catch {}
  needsRender = true;
}
$("themeBtn").onclick = () =>
  applyTheme(
    document.documentElement.dataset.theme === "dark" ? "light" : "dark",
  );
applyTheme(document.documentElement.dataset.theme || "light");
for (const [id, key] of [
  ["labelsBtn", "labels"],
  ["wireBtn", "wire"],
  ["rotateBtn", "rotate"],
])
  $(id).onclick = () => {
    needsRender = true;
    if (key === "labels") showLabels = !showLabels;
    if (key === "wire") {
      wire = !wire;
      parts.forEach((p) =>
        p.group.traverse((o) => {
          if (o.isMesh) o.material.wireframe = wire;
        }),
      );
    }
    if (key === "rotate") controls.autoRotate = !controls.autoRotate;
    const state =
      key === "labels"
        ? showLabels
        : key === "wire"
          ? wire
          : controls.autoRotate;
    $(id).classList.toggle("active", state);
    $(id).setAttribute("aria-pressed", String(state));
  };
document.querySelectorAll("[data-tab]").forEach(
  (b) =>
    (b.onclick = () => {
      document
        .querySelectorAll("[data-tab]")
        .forEach((el) => el.classList.toggle("selected", el === b));
      $("anatomyPanel").hidden = b.dataset.tab !== "anatomy";
      $("historyPanel").hidden = b.dataset.tab !== "history";
    }),
);
$("importBtn").onclick = () => $("file").click();
$("file").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    if (f.size > 150 * 1024 * 1024)
      throw Error("Please choose a GLB smaller than 150 MB.");
    const buffer = await f.arrayBuffer();
    if (new DataView(buffer).getUint32(0, true) !== 0x46546c67)
      throw Error("Choose a valid binary glTF (.glb) file.");
    const view = new DataView(buffer);
    if (buffer.byteLength < 20 || view.getUint32(16, true) !== 0x4e4f534a)
      throw Error("The GLB must contain a valid scene.");
    const glb = JSON.parse(
      new TextDecoder().decode(
        new Uint8Array(buffer, 20, view.getUint32(12, true)),
      ),
    );
    if (
      [...(glb.buffers || []), ...(glb.images || [])].some(
        (x) => x.uri && !x.uri.startsWith("data:"),
      )
    )
      throw Error(
        "Import a self-contained GLB with embedded images and geometry.",
      );
    const root = (await new GLTFLoader().parseAsync(buffer, "")).scene;
    let custom = collection.find((w) => w.id === "custom");
    const entry = {
      id: "custom",
      title: f.name.replace(/\.glb$/i, "").replaceAll("_", " "),
      short: "Your model",
      place: "Imported GLB",
      sub: "Your model, divided into estimated surface regions.",
      parts: ["Blade region", "Guard region", "Grip region", "Pommel region"],
      method: "Estimated surface regions · adjust the hilt boundary",
      sign: 1,
    };
    if (custom) Object.assign(custom, entry);
    else collection.push(entry);
    if (importedRoot && importedRoot !== currentRaw) releaseRoot(importedRoot);
    importedRoot = root;
    await loadWeapon("custom", root);
  } catch (err) {
    alert(err.message);
  } finally {
    $("file").value = "";
  }
};
$("flipModel").onclick = () => {
  if (active.id !== "custom" || !currentRaw) return;
  active.sign *= -1;
  removeModel();
  addSurfaces(currentRaw, computeConfig(currentRaw));
};
$("hiltBoundary").onchange = () => {
  if (active.id !== "custom" || !currentRaw) return;
  removeModel();
  addSurfaces(currentRaw, computeConfig(currentRaw));
};
let down;
$("scene").addEventListener(
  "pointerdown",
  (e) => (down = { x: e.clientX, y: e.clientY }),
);
$("scene").addEventListener("pointerup", (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
  const r = $("scene").getBoundingClientRect(),
    mouse = new T.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    ),
    ray = new T.Raycaster();
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(
    parts.filter((p) => p.group.visible).map((p) => p.group),
    true,
  )[0];
  if (hit) selectPart(hit.object.userData.part);
});
document.addEventListener("keydown", (e) => {
  if (
    !studyVisible ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
    e.target.closest("dialog") ||
    !parts.length
  )
    return;
  if (e.code === "Space") {
    if (e.target.tagName === "BUTTON") return;
    e.preventDefault();
    setAmount(targetAmount > 0.5 ? 0 : 1);
    syncAmount();
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    stepSelection(1);
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    stepSelection(-1);
  }
  if (e.key.toLowerCase() === "i") toggleIsolation();
  if (e.key.toLowerCase() === "r") resetPosition();
  if (e.key === "Escape" && isolated) {
    isolated = false;
    applyIsolation();
    resetCamera();
  }
});
function animate(t) {
  requestAnimationFrame(animate);
  if (!studyVisible) return;
  const previousAmount = amount;
  if (touring) {
    const elapsed = (t - tourStart) / 1000;
    targetAmount = (1 - Math.cos((elapsed * Math.PI) / 5)) / 2;
    syncAmount();
  }
  amount = reduced
    ? targetAmount
    : Math.abs(amount - targetAmount) < 0.0001
      ? targetAmount
      : T.MathUtils.lerp(amount, targetAmount, 0.12);
  for (const p of parts) {
    p.group.position.copy(p.offset).multiplyScalar(amount);
    p.group.traverse((o) => {
      if (o.userData.cutFace) o.visible = isolated || amount > 0.01;
    });
  }
  if (cameraMove) {
    const progress =
        cameraMove.duration === 0
          ? 1
          : Math.min(1, (t - cameraMove.started) / cameraMove.duration),
      eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    camera.position.lerpVectors(
      cameraMove.fromPosition,
      cameraMove.toPosition,
      eased,
    );
    controls.target.lerpVectors(
      cameraMove.fromTarget,
      cameraMove.toTarget,
      eased,
    );
    if (progress === 1) cameraMove = null;
    needsRender = true;
  }
  const changed = controls.update(),
    moved = previousAmount !== amount;
  if (
    needsRender ||
    changed ||
    moved ||
    cameraMove ||
    touring ||
    controls.autoRotate
  ) {
    renderer.render(scene, camera);
    needsRender = false;
    $("scene").dataset.explosion = amount.toFixed(3);
    $("scene").dataset.visiblePieces = parts.filter(
      (p) => p.group.visible,
    ).length;
    $("scene").dataset.cameraDistance = camera.position
      .distanceTo(controls.target)
      .toFixed(3);
  }
  const r = $("viewport").getBoundingClientRect();
  const positioned = [];
  labels.forEach((l, i) => {
    const p = parts[i],
      line = $("leaders").children[i];
    if (
      !showLabels ||
      !p.group.visible ||
      studyMode === "details" ||
      (i !== selected && (amount < 0.12 || camera.aspect < 1.25))
    ) {
      l.style.display = "none";
      line.style.display = "none";
      return;
    }
    const anchor = p.center.clone().add(p.group.position).project(camera);
    if (
      anchor.z > 1 ||
      Math.abs(anchor.x) > 1.02 ||
      Math.abs(anchor.y) > 1.02
    ) {
      l.style.display = "none";
      line.style.display = "none";
      return;
    }
    const ax = (anchor.x * 0.5 + 0.5) * r.width,
      ay = (-anchor.y * 0.5 + 0.5) * r.height,
      lane = amount > 0.12 ? (p.offset.y >= 0 ? 0 : 1) : i % 2;
    const width = l.textContent.length * 5.1 + 27;
    positioned.push({
      l,
      line,
      i,
      ax,
      ay,
      width,
      x: Math.max(width / 2 + 12, Math.min(r.width - width / 2 - 12, ax)),
      y: Math.max(70, Math.min(r.height - 65, ay + (lane === 0 ? -40 : 40))),
      lane,
    });
  });
  for (const lane of [0, 1]) {
    const row = positioned
      .filter((p) => p.lane === lane)
      .sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++)
      row[i].x = Math.max(
        row[i].x,
        row[i - 1].x + (row[i - 1].width + row[i].width) / 2 + 9,
      );
    if (row.length) {
      const last = row.at(-1),
        over = last.x + last.width / 2 + 12 - r.width;
      if (over > 0) row.forEach((p) => (p.x -= over));
    }
  }
  positioned.forEach((p) => {
    p.l.style.display = "block";
    p.line.style.display = "block";
    p.l.style.left = p.x + "px";
    p.l.style.top = p.y + "px";
    const opacity = isolated || amount > 0.08 ? "1" : ".65";
    p.l.style.opacity = opacity;
    p.line.style.opacity = opacity;
    p.line.setAttribute("x1", p.ax);
    p.line.setAttribute("y1", p.ay);
    p.line.setAttribute("x2", p.x);
    p.line.setAttribute("y2", p.y + (p.lane === 0 ? 12 : -12));
  });
  const feature = activeFeatures[featureIndex],
    fl = $("featureLabel");
  if (studyMode === "details" && feature && showLabels) {
    const point = feature.anchor
      .clone()
      .add(parts[feature.parentIndex].group.position)
      .project(camera);
    fl.hidden = point.z > 1;
    fl.textContent = feature.name;
    fl.style.left =
      Math.max(60, Math.min(r.width - 60, (point.x * 0.5 + 0.5) * r.width)) +
      "px";
    fl.style.top =
      Math.max(
        65,
        Math.min(r.height - 60, (-point.y * 0.5 + 0.5) * r.height - 27),
      ) + "px";
  } else fl.hidden = true;
}

requestAnimationFrame(animate);
renderCollection();
await loadWeapon("longsword");
initSuite({
  catalog: collection,
  history,
  onStudyVisibility: (visible) => {
    studyVisible = visible;
    if (visible) {
      needsRender = true;
      resize();
    }
  },
  inspect: async (id, name) => {
    document.querySelector('[data-tab="anatomy"]').click();
    const ready = await loadWeapon(id);
    if (!ready || active.id !== id) return;
    if (name) {
      const index = activeFeatures.findIndex((f) => f.name === name);
      if (index >= 0) selectFeature(index);
    }
  },
});
