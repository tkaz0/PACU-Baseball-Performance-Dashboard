import { describe, expect, it } from "vitest";
import { countLabel } from "@/lib/game-opportunities";
import { formatMetricNumber, formatSpin } from "@/lib/measurement-display";
import { BATTING_ENTRY_FIELDS, BATTING_FIELDS } from "@/lib/game-log";

describe("display polish", () => {
  it("uses singular sample labels for one opportunity and keeps abbreviations", () => {
    expect(countLabel(1, "walks")).toBe("1 walk");
    expect(countLabel(2, "walks")).toBe("2 walks");
    expect(countLabel(1, "HH opportunities")).toBe("1 HH opportunity");
    expect(countLabel(1, "pitches")).toBe("1 pitch");
    expect(countLabel(1, "PA")).toBe("1 PA");
    expect(countLabel(1123, "pitches")).toBe("1,123 pitches");
  });
  it("shows spin as whole RPM without changing other precision", () => {
    expect(formatSpin(1981.4)).toBe("1,981");
    expect(formatMetricNumber(2332.7, "classified_avg_spin", "Full Swing · Intrasquad · Sweeper")).toBe("2,333");
    expect(formatMetricNumber(83.25, "classified_avg_velocity", "Full Swing · Intrasquad · Sweeper")).toBe("83.3");
  });
  it("no longer offers RBI for new game logs but still accepts saved ones", () => {
    expect("rbi" in BATTING_ENTRY_FIELDS).toBe(false);
    expect("rbi" in BATTING_FIELDS).toBe(true);
  });
});
