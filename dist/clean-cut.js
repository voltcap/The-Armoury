import * as T from "./vendor/three.module.js";

// Intersect the surfaces with planes. Triangle centroids must never determine
// a cut: that keeps whole crossing triangles and produces a sawtooth edge.
const EPS = 1e-7;
const value = (v, p) =>
  v.position[0] * p[0] + v.position[1] * p[1] + v.position[2] * p[2] + p[3];
function mix(a, b, t) {
  const v = {};
  for (const key of Object.keys(a))
    v[key] = a[key].map((n, i) => n + (b[key][i] - n) * t);
  return v;
}
function clip(poly, plane) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = value(a, plane),
      db = value(b, plane),
      ia = da >= -EPS,
      ib = db >= -EPS;
    if (ia) out.push(a);
    if (ia !== ib) out.push(mix(a, b, da / (da - db)));
  }
  return out;
}
export const lower = (x) => [-1, 0, 0, x];
export const upper = (x) => [1, 0, 0, -x];
export function partitionGeometry(geometry, regions) {
  const keys = Object.keys(geometry.attributes).filter((k) =>
    ["position", "normal", "uv", "color", "tangent"].includes(k),
  );
  const outputs = new Map();
  for (const r of regions)
    if (!outputs.has(r.part))
      outputs.set(r.part, {
        data: Object.fromEntries(keys.map((k) => [k, []])),
        cuts: new Map(),
      });
  const p = geometry.attributes.position,
    ix = geometry.index,
    count = ix?.count ?? p.count;
  function vertex(i) {
    const v = {};
    for (const k of keys) {
      const a = geometry.attributes[k];
      v[k] = Array.from({ length: a.itemSize }, (_, j) =>
        j === 0
          ? a.getX(i)
          : j === 1
            ? a.getY(i)
            : j === 2
              ? a.getZ(i)
              : a.getW(i),
      );
    }
    return v;
  }
  for (let i = 0; i < count; i += 3) {
    const tri = [0, 1, 2].map((j) => vertex(ix ? ix.getX(i + j) : i + j));
    for (const r of regions) {
      let poly = tri;
      for (const plane of r.planes) {
        if (poly.every((v) => value(v, plane) < -EPS)) {
          poly = [];
          break;
        }
        if (!poly.every((v) => value(v, plane) >= -EPS))
          poly = clip(poly, plane);
        if (poly.length < 3) break;
      }
      if (poly.length < 3) continue;
      const out = outputs.get(r.part);
      for (let j = 1; j < poly.length - 1; j++)
        for (const v of [poly[0], poly[j], poly[j + 1]])
          for (const k of keys) out.data[k].push(...v[k]);
      for (const plane of r.planes) {
        if (
          !tri.some((v) => value(v, plane) > EPS) ||
          !tri.some((v) => value(v, plane) < -EPS)
        )
          continue;
        const key = plane.join(",");
        if (!out.cuts.has(key)) out.cuts.set(key, { plane, segments: [] });
        for (let j = 0; j < poly.length; j++) {
          const a = poly[j],
            b = poly[(j + 1) % poly.length];
          if (
            Math.abs(value(a, plane)) < EPS * 5 &&
            Math.abs(value(b, plane)) < EPS * 5
          )
            out.cuts.get(key).segments.push([a.position, b.position]);
        }
      }
    }
  }
  return [...outputs.entries()]
    .filter(([, o]) => o.data.position.length)
    .map(([part, out]) => {
      const g = new T.BufferGeometry();
      for (const k of keys)
        g.setAttribute(
          k,
          new T.Float32BufferAttribute(
            out.data[k],
            geometry.attributes[k].itemSize,
          ),
        );
      if (g.attributes.normal) g.normalizeNormals();
      else g.computeVertexNormals();
      g.computeBoundingBox();
      return { part, geometry: g, cuts: out.cuts };
    });
}

// Only close complete intersection loops. Open source scans stay open rather
// than inventing a broad face across unrelated surfaces.
export function buildCutCaps(cuts) {
  const positions = [],
    normals = [];
  let closedLoops = 0;
  for (const { plane, segments } of cuts.values()) {
    const normal = new T.Vector3(...plane.slice(0, 3)).normalize().negate();
    const helper =
      Math.abs(normal.z) < 0.9
        ? new T.Vector3(0, 0, 1)
        : new T.Vector3(0, 1, 0);
    const u = new T.Vector3().crossVectors(helper, normal).normalize(),
      v = new T.Vector3().crossVectors(normal, u);
    const points = new Map(),
      edges = new Map();
    const key = (p) => p.map((x) => Math.round(x * 1e5)).join(",");
    for (const [a, b] of segments) {
      const ka = key(a),
        kb = key(b);
      if (ka === kb) continue;
      points.set(ka, a);
      points.set(kb, b);
      const ek = [ka, kb].sort().join("|");
      if (edges.has(ek)) edges.delete(ek);
      else edges.set(ek, [ka, kb]);
    }
    const adjacency = new Map();
    for (const [a, b] of edges.values()) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      if (!adjacency.has(b)) adjacency.set(b, []);
      adjacency.get(a).push(b);
      adjacency.get(b).push(a);
    }
    const visited = new Set(),
      loops = [];
    for (const start of adjacency.keys()) {
      if (visited.has(start) || adjacency.get(start).length !== 2) continue;
      let path = [],
        current = start,
        previous = null,
        valid = true;
      for (let i = 0; i <= edges.size; i++) {
        if (visited.has(current) && current !== start) {
          valid = false;
          break;
        }
        if (path.length && current === start) break;
        path.push(current);
        visited.add(current);
        const ns = adjacency.get(current);
        if (ns?.length !== 2) {
          valid = false;
          break;
        }
        const next = ns.find((n) => n !== previous);
        previous = current;
        current = next;
      }
      if (valid && current === start && path.length >= 3) {
        const xyz = path.map((k) => new T.Vector3(...points.get(k)));
        loops.push({
          xyz,
          xy: xyz.map((p) => new T.Vector2(p.dot(u), p.dot(v))),
        });
      }
    }
    // Polygon nesting preserves holes in a hollow grip or scabbard.
    function inside(p, poly) {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i],
          b = poly[j];
        if (
          a.y > p.y !== b.y > p.y &&
          p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
        )
          hit = !hit;
      }
      return hit;
    }
    loops.forEach(
      (l) =>
        (l.depth = loops.filter(
          (other) => other !== l && inside(l.xy[0], other.xy),
        ).length),
    );
    for (const loop of loops.filter((l) => l.depth % 2 === 0)) {
      const holes = loops.filter(
        (l) => l.depth === loop.depth + 1 && inside(l.xy[0], loop.xy),
      );
      const arrays = [loop, ...holes],
        flat = arrays.flatMap((l) => l.xyz),
        tris = T.ShapeUtils.triangulateShape(
          loop.xy,
          holes.map((l) => l.xy),
        );
      for (const tri of tris) {
        const a = flat[tri[0]],
          b = flat[tri[1]],
          c = flat[tri[2]];
        if (
          new T.Vector3()
            .crossVectors(b.clone().sub(a), c.clone().sub(a))
            .dot(normal) < 0
        )
          tri.reverse();
        for (const i of tri) {
          positions.push(...flat[i].toArray());
          normals.push(...normal.toArray());
        }
      }
      closedLoops++;
    }
  }
  if (!positions.length) return null;
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  g.userData.closedLoops = closedLoops;
  return g;
}
