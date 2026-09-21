const batSpeed = new Set(["bat_speed","avg_bat_speed","max_bat_speed","p95_bat_speed"]);
/** Source context is display-only; never rewrite the canonical metric or observations. */
export function profileMetricLabel(key: string, label: string, source?: string): string {
  if (!batSpeed.has(key) || !source) return label;
  const inGame = /^full swing\s*·\s*(game|intrasquad)(?:\s*·|$)/i.test(source.trim());
  return `${label} (${inGame ? "In-Game" : "Practice"})`;
}
