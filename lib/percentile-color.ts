/** Presentation only: percentile direction and cohort eligibility are decided upstream. */
export function percentileColor(value: number) {
  const stops = [[23, 100, 174], [104, 166, 212], [230, 231, 233], [230, 144, 145], [195, 33, 50]];
  const position = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 50)) / 25;
  const index = Math.min(3, Math.floor(position)), fraction = position - index;
  const rgb = stops[index].map((channel, i) => Math.round(channel + (stops[index + 1][i] - channel) * fraction));
  const luminance = rgb.map(channel => { const c = channel / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  return { backgroundColor: `rgb(${rgb.join(', ')})`, color: luminance > 0.179 ? '#000000' : '#ffffff' };
}
