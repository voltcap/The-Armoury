const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const smooth = (value) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
function interval(box, axis) {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = box.min.map((value, j) => i & (1 << j) ? box.max[j] : value);
    const projected = dot(p, axis);
    min = Math.min(min, projected); max = Math.max(max, projected);
  }
  return [min, max];
}

// Open the joints along the weapon axis before moving pieces into display lanes.
// Scabbard mounts remain attached to their carrier instead of crossing its shell.
export function createDisassembly(parts, direction = [1, 0, 0]) {
  const length = Math.hypot(...direction), axis = direction.map((x) => x / length);
  const up = [0, 1, 0].map((x, i) => x - axis[i] * axis[1]);
  const upLength = Math.hypot(...up);
  const side = upLength > .01 ? up.map((x) => x / upLength) : [0, 0, 1];
  const bounds = parts.map((p) => interval(p, axis));
  const carrier = parts.findIndex((p) => /^scabbard$|^saya$|^sheathed blade$/i.test(p.name));
  const parents = parts.map((p, i) => {
    if (carrier >= 0 && i !== carrier && /scabbard mount|suspension (ring|fitting)|suspension mount/i.test(p.name)) return carrier;
    if (/shaft collars/i.test(p.name)) return parts.findIndex((p) => /^shaft$/i.test(p.name));
    if (/ornamental studs|grip scale/i.test(p.name)) return parts.findIndex((p) => /^hilt frame$/i.test(p.name));
    return -1;
  });
  const follows = parents.map((parent) => parent >= 0);
  const radial = parts.map((p, i) => /grip scale/i.test(p.name) && parents[i] >= 0);
  const core = parts.map((p, i) => i).filter((i) => i !== carrier && !follows[i]);
  const shift = parts.map(() => 0), lanes = parts.map(() => 0);
  let previous = null;
  for (const [rank, i] of core.entries()) {
    shift[i] = previous === null ? -.8 : Math.max(shift[previous] + .5, bounds[previous][1] + shift[previous] + .45 - bounds[i][0]);
    lanes[i] = rank % 2 === 0 ? .9 : -.9;
    previous = i;
  }
  if (carrier >= 0) {
    const left = Math.min(...core.map((i) => parts[i].min[0] + axis[0] * shift[i]));
    shift[carrier] = left - parts[carrier].max[0] - 1.2;
    lanes[carrier] = -1.8;
    follows.forEach((follow, i) => { if (follow) { shift[i] = shift[carrier]; lanes[i] = lanes[carrier]; } });
  }
  const position = (index, amount) => {
    const pull = smooth(amount / .65), fan = smooth((amount - .65) / .35);
    if (parents[index] >= 0) {
      const base = position(parents[index], amount);
      if (!radial[index]) return base;
      const sign = parts[index].min[2] + parts[index].max[2] >= 0 ? 1 : -1;
      const parent = parts[parents[index]];
      const clearance = sign > 0 ? parent.max[2] - parts[index].min[2] + .5 : parts[index].max[2] - parent.min[2] + .5;
      const escape = smooth(amount / .35);
      return base.map((x, j) => x + (j === 2 ? sign * Math.max(.8, clearance) * escape : 0) + side[j] * sign * 1.2 * fan);
    }
    if (index === carrier) return [shift[index] * pull, lanes[index] * fan, 0];
    return axis.map((value, j) => value * shift[index] * pull + side[j] * lanes[index] * fan);
  };
  return { axis, bounds, core, carrier, follows, parents, radial, shift, position };
}
