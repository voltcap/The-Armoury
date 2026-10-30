// Pack callouts into upper/lower rows without losing labels near a crowded hilt.
export function layoutCallouts(items, width, height) {
  const margin = 12,
    gap = 7,
    rowGap = 6;
  const available = Math.max(1, width - margin * 2);
  const banks = [[], []];
  for (const lane of [0, 1]) {
    const sorted = items
      .filter((item) => item.lane === lane)
      .sort((a, b) => a.ax - b.ax || a.id - b.id);
    let row = [],
      used = 0;
    for (const item of sorted) {
      const w = Math.min(item.width, available);
      if (row.length && used + gap + w > available) {
        banks[lane].push(row);
        row = [];
        used = 0;
      }
      row.push({ ...item, width: w });
      used += (row.length > 1 ? gap : 0) + w;
    }
    if (row.length) banks[lane].push(row);
  }
  const bankHeight = (rows) =>
    rows.reduce((sum, row) => sum + Math.max(...row.map((i) => i.height)), 0) +
    Math.max(0, rows.length - 1) * rowGap;
  const inset = Math.max(
    2,
    Math.min(
      16,
      (height - bankHeight(banks[0]) - bankHeight(banks[1]) - 8) / 2,
    ),
  );
  const output = [];
  banks.forEach((rows, lane) => {
    let edge = lane === 0 ? inset : height - inset;
    for (const row of rows) {
      const rowHeight = Math.max(...row.map((i) => i.height));
      let left = margin;
      for (const item of row) {
        item.x = Math.max(
          left + item.width / 2,
          Math.min(width - margin - item.width / 2, item.ax),
        );
        left = item.x + item.width / 2 + gap;
      }
      let right = width - margin;
      for (let i = row.length - 1; i >= 0; i--) {
        row[i].x = Math.min(row[i].x, right - row[i].width / 2);
        right = row[i].x - row[i].width / 2 - gap;
      }
      const y = lane === 0 ? edge + rowHeight / 2 : edge - rowHeight / 2;
      row.forEach((item) => output.push({ ...item, y }));
      edge += (lane === 0 ? 1 : -1) * (rowHeight + rowGap);
    }
  });
  return output;
}
