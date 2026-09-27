export function rankingSpread(values: readonly number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length < 3 || sorted[0] === sorted.at(-1)) return null;
  const min = sorted[0], max = sorted.at(-1)!;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const bins = new Map<number, number[]>();
  for (const value of sorted) {
    const fraction = (value - min) / (max - min), bin = Math.round(fraction * 36);
    bins.set(bin, [...(bins.get(bin) ?? []), value]);
  }
  const scale = Math.min(1, 13 / (3 * Math.sqrt(Math.max(...[...bins.values()].map(group => group.length)))));
  const dots = [...bins.values()].map(group => ({
    min: group[0], max: group.at(-1)!, count: group.length,
    fraction: (group.reduce((sum, value) => sum + value, 0) / group.length - min) / (max - min),
    radius: 3 * Math.sqrt(group.length) * scale,
  }));
  return { min, max, median, count: sorted.length, dots, medianFraction: (median - min) / (max - min) };
}
