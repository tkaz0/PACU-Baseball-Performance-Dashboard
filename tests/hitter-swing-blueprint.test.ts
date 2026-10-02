import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BodyTiltDiagram, HitterSwingBlueprint, SwingAngleDiagram } from "@/components/hitter-swing-blueprint";
import { PlayerPerformanceProfile } from "@/components/player-performance-profile";
import { blastSource, type BlastSummaryKind } from "@/lib/blast-metrics";
import { hitterStudyMatches } from "@/lib/hitter-study-matches";
import { HITTER_STUDY_REFERENCE_SOURCE } from "@/lib/hitter-study-references";
import { hitterSwingProfile } from "@/lib/hitter-swing-profile";
import type { Measurement } from "@/lib/imports/engine";
import { getPlayerPerformance } from "@/lib/player-performance";
import type { RosterAthlete } from "@/lib/types";

const code = "SYN-BLUEPRINT-001";
function report({ attack = 12, vertical = -30, kind = "average", hash = "a", start = "2026-09-01", end = "2026-09-07" }: {
  attack?: number; vertical?: number; kind?: BlastSummaryKind; hash?: string; start?: string; end?: string;
} = {}): Measurement[] {
  const values: [string, number, string][] = [["Blast Swing Count", 25, "count"], [kind === "average" ? "Average Bat Speed" : "Peak Bat Speed (95th)", 65.25, "mph"],
    ["Peak Hand Speed", 18, "mph"], ["Attack Angle", attack, "deg"], ["Early Connection", 90, "deg"], ["Vertical Bat Angle", vertical, "deg"], ["Body Tilt Angle", 28, "deg"]];
  return values.map(([metric, value, unit], index) => ({ id: `fictional-${hash}-${index}`, athlete_code: code, measured_at: end,
    source: blastSource(kind, start, end), metric, value, unit, source_file: "fictional-blueprint.csv", source_sheet: "CSV", source_row: 2, file_hash: hash.repeat(64) }));
}
const performance = (readings: Measurement[] = []) => getPlayerPerformance({ readings, athleteCode: code });
const renderBlueprint = (readings: Measurement[]) => renderToStaticMarkup(createElement(HitterSwingBlueprint, { readings, performance: performance(readings), bats:"R" }));
function athlete(playerType: string | null = "position", primaryPosition: string | null = "CF"): RosterAthlete {
  return { id: code, athlete_code: code, first_name: "Fictional", preferred_name: null, last_name: "Blueprint", pacific_email: "fictional.blueprint@example.com", profile_photo_url: null, created_at: "", updated_at: "",
    athlete_seasons: [{ athlete_id: code, season: "2026-27", jersey_number: 0, primary_position: primaryPosition, secondary_position: playerType === "two_way" ? "P" : null,
      player_type: playerType, bats: "R", throws: "R", academic_class: null, eligibility_year: null, graduation_year: null, roster_status: "active" }] };
}

function diagram(html: string, kind: "attack" | "vertical" | "body") {
  const svg = [...html.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/g)].map(match => match[0]).find(svg => svg.includes(`data-angle-kind="${kind}"`));
  expect(svg).toBeDefined();
  return svg!;
}
function highlightedSegment(svg: string, width: 4 | 5) {
  const number = "([-+]?\\d*\\.?\\d+(?:e[-+]?\\d+)?)";
  const segment = new RegExp(`^M${number} ${number}L${number} ${number}$`, "i");
  const paths = [...svg.matchAll(/<path\b[^>]*>/g)].map(match => match[0]);
  for (const path of paths) {
    if (!path.includes(`stroke-width="${width}"`)) continue;
    const value = /\bd="([^"]+)"/.exec(path)?.[1];
    const match = value?.match(segment);
    if (match) return { x1: Number(match[1]), y1: Number(match[2]), x2: Number(match[3]), y2: Number(match[4]) };
  }
  throw new Error("Expected the highlighted measured-angle segment.");
}

describe("measured angle illustrations", () => {
  it.each([-25,0,25])("draws body tilt %s from vertical rather than inventing spine coordinates",angle=>{
    const svg=renderToStaticMarkup(createElement(BodyTiltDiagram,{angle}));
    const segment=highlightedSegment(svg,5);
    expect(90-Math.atan2(segment.y1-segment.y2,segment.x2-segment.x1)*180/Math.PI).toBeCloseTo(angle,8);
    expect(svg).toContain("not measured spine motion");
  });
  it("keeps unavailable body tilt unmeasured",()=>{
    const svg=renderToStaticMarkup(createElement(BodyTiltDiagram,{angle:null}));
    expect(svg).not.toContain("data-angle=");
    expect(svg).not.toContain('stroke-width="5"');
  });
  it.each([12, -12, 0])("draws signed attack angle %s in the correct screen direction", angle => {
    const svg = renderToStaticMarkup(createElement(SwingAngleDiagram, { angle, kind: "attack" }));
    const segment = highlightedSegment(svg, 4);
    expect(segment.x2).toBeGreaterThan(segment.x1);
    expect(Math.atan2(segment.y1 - segment.y2, segment.x2 - segment.x1) * 180 / Math.PI).toBeCloseTo(angle, 8);
    if (angle > 0) expect(segment.y2).toBeLessThan(segment.y1);
    if (angle < 0) expect(segment.y2).toBeGreaterThan(segment.y1);
    expect(svg).toContain(`data-angle="${angle}"`);
    expect(svg).toMatch(/aria-label="[^"]*illustrative/i);
  });

  it.each([-30, 30, 0])("draws vertical bat angle %s with its original sign", angle => {
    const svg = renderToStaticMarkup(createElement(SwingAngleDiagram, { angle, kind: "vertical" }));
    const segment = highlightedSegment(svg, 5);
    expect(Math.atan2(segment.y1 - segment.y2, segment.x2 - segment.x1) * 180 / Math.PI).toBeCloseTo(angle, 8);
    if (angle < 0) expect(segment.y2).toBeGreaterThan(segment.y1);
    if (angle > 0) expect(segment.y2).toBeLessThan(segment.y1);
    expect(svg).toMatch(/aria-label="[^"]*measured average/i);
  });

  it("renders missing geometry without a fabricated zero-angle reading", () => {
    const svg = renderToStaticMarkup(createElement(SwingAngleDiagram, { angle: null, kind: "attack" }));
    expect(svg).not.toContain("data-angle=");
    expect(svg).not.toContain('stroke-width="4"');
    expect(svg).toMatch(/aria-label="[^"]*(no reviewed|unavailable)/i);
    expect(svg).toMatch(/awaiting|unavailable/i);
  });
});

describe("Practice swing blueprint", () => {
  it("leads with angles and film study while keeping speed behind a closed supporting disclosure", () => {
    const html=renderBlueprint(report());
    const details=/<details\b[^>]*data-testid="swing-supporting-speed"[^>]*>/.exec(html);
    expect(details).not.toBeNull();
    expect(details![0]).not.toMatch(/\bopen(?:=|\s|>)/);
    const primary=html.slice(0,details!.index);
    expect(primary).toContain('data-angle-kind="attack"');
    expect(primary).toContain('data-angle-kind="vertical"');
    expect(primary).toContain('data-angle-kind="body"');
    expect(primary).toContain('aria-label="Professional hitters to study"');
    expect(primary).not.toContain('data-testid="swing-team-bat-speed"');
    expect(primary).not.toContain('data-testid="study-bat-speed-percentiles"');
    expect(html.slice(details!.index)).toContain('data-testid="swing-team-bat-speed"');
    expect(html).toContain("Bat speed does not affect selection");
  });
  it("shows measured averages beside an explicit illustrative-posture explanation", () => {
    const html = renderBlueprint(report());
    expect(html).toContain('data-testid="hitter-swing-blueprint"');
    expect(diagram(html, "attack")).toContain('data-angle="12"');
    expect(diagram(html, "vertical")).toContain('data-angle="-30"');
    expect(diagram(html, "body")).toContain('data-angle="28"');
    expect(html).toContain("+12.0°");
    expect(html).toContain("−30.0°");
    expect(html).toMatch(/illustrat(?:ed|ive|ion)/i);
    expect(html).toMatch(/not a recording of your body motion|not a personalized biomechanical reconstruction/i);
    expect(html).toMatch(/custom Pacific descriptions|custom.*descriptive/i);
    expect(html).toMatch(/not good\/bad grades|not.*ideal swing targets/i);
  });

  it("omits the blueprint when there are no Blast reports", () => {
    expect(renderBlueprint([])).toBe("");
    expect(renderBlueprint(report().map(row => ({ ...row, source: "Full Swing · Practice" })))).toBe("");
  });

  it("preserves one available angle when the other is missing", () => {
    const html = renderBlueprint(report().filter(row => row.metric !== "Attack Angle"));
    expect(diagram(html, "attack")).not.toContain("data-angle=");
    expect(diagram(html, "vertical")).toContain('data-angle="-30"');
    expect(html).not.toMatch(/href="https:\/\/www\.mlb\.com\/player\/\d+/);
  });

  it("never draws a P95-only angle or uses it for professional examples", () => {
    const html = renderBlueprint(report({ attack: 18, vertical: -45, kind: "p95" }));
    expect(diagram(html, "attack")).not.toContain("data-angle=");
    expect(diagram(html, "vertical")).not.toContain("data-angle=");
    expect(html).not.toMatch(/href="https:\/\/www\.mlb\.com\/player\/\d+/);
    expect(html).toMatch(/average/i);
  });

  it("withholds overlapping averages and unsupported figure geometry without pretending they are zero", () => {
    for (const readings of [
      [...report(), ...report({ hash: "b", start: "2026-09-07", end: "2026-09-14" })],
      report({ attack: 91, vertical: -91 }),
    ]) {
      const html = renderBlueprint(readings);
      expect(diagram(html, "attack")).not.toContain("data-angle=");
      expect(diagram(html, "vertical")).not.toContain("data-angle=");
      expect(html).not.toMatch(/href="https:\/\/www\.mlb\.com\/player\/\d+/);
      expect(html).toMatch(/without changing the saved readings/i);
    }
  });

  it("links the actual selected public references and source without fabricated similarity scores", () => {
    const readings = report();
    const model = hitterSwingProfile(readings, performance(readings));
    const study = hitterStudyMatches(model,undefined,{bats:"R"});
    const html = renderBlueprint(readings);
    const playerLinks = [...html.matchAll(/<a\b[^>]*href="https:\/\/www\.mlb\.com\/player\/(\d+)"[^>]*>/g)];
    expect(playerLinks.map(match => Number(match[1]))).toEqual(study.matches.map(reference => reference.id));
    expect(playerLinks).toHaveLength(3);
    for (const reference of study.matches) {
      expect(html).toContain(reference.name);
      expect(html).toContain(`${reference.attackAngle > 0 ? "+" : ""}${reference.attackAngle.toFixed(1)}°`);
      expect(html).toContain(`https://www.mlb.com/video/?q=${encodeURIComponent(`PlayerId == [${reference.id}] Order By Timestamp`)}`);
    }
    for (const match of playerLinks) {
      expect(match[0]).toContain('target="_blank"');
      expect(match[0]).toMatch(/rel="[^"]*noopener[^"]*noreferrer/);
    }
    expect(html).toContain(HITTER_STUDY_REFERENCE_SOURCE.leaderboardUrl.replaceAll("&", "&amp;"));
    expect(html).toContain(HITTER_STUDY_REFERENCE_SOURCE.sampleDefinitionUrl);
    expect(html).toMatch(/different systems|different.*swing samples/i);
    expect(html).not.toMatch(/data-(?:similarity|score)=|\d+(?:\.\d+)?%\s*(?:match|similar)/i);
    expect(html).not.toContain("fictional-blueprint.csv");
    expect(html).not.toContain("a".repeat(64));
  });

  it("uses own-environment percentiles and keeps raw practice speed separate from pro mph", () => {
    const readings = [...report(), ...report({kind:"p95",hash:"b"}).map(row=>row.metric==="Peak Bat Speed (95th)"?{...row,value:98.765}:row)];
    const reference={athleteId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",observedValue:65.25,percentile:75,sampleSize:9,swingCount:25,reportCount:1,firstDate:"2026-09-01",lastDate:"2026-09-07"};
    const html=renderToStaticMarkup(createElement(HitterSwingBlueprint,{readings,performance:performance(readings),batSpeedReference:reference,bats:"R"}));
    expect(html).toContain("65.3 mph"); expect(html).not.toContain("98.8"); expect(html).not.toContain("65.25");
    expect(html).toContain("75th"); expect(html).toContain("9 Pacific hitters"); expect(html).toContain("226 MLB hitters");
    expect(html).toContain('aria-label="Your Blast bat speed Pacific percentile"');
    expect(html).toMatch(/aria-label="[^"]+ bat speed MLB percentile"/);
    expect(html).toContain("not equal mph"); expect(html).not.toContain("Their Average Bat Speed");
    expect(html).toContain("Weekly P95 reports are never used");
  });
  it("shows relative body ranks and clearly separates unsupported MLB angle comparisons",()=>{
    const readings=report(), cards=performance(readings);
    for(const [metricKey,value,unit,rank] of [["height",70,"in",75],["weight",175,"lb",50]] as const){
      const card=cards.body.find(item=>item.metric.key===metricKey)!;
      card.latest={id:`fictional-${metricKey}`,athleteCode:code,metricKey,value,unit,measuredAt:"2026-09-15",period:"fall_2026",source:"Fictional body testing",importedAt:"",provenance:[],derived:false};
      card.percentile={value:rank,sampleSize:9,unit,period:"fall_2026",direction:"neutral"}; card.percentileStatus="available";
    }
    const html=renderToStaticMarkup(createElement(HitterSwingBlueprint,{readings,performance:cards,bats:"R"}));
    expect(html).toContain("50 familiar MLB names");
    expect(html).toContain("Height: 75th percentile among 9 Pacific players");
    expect(html).toContain("Weight: 50th percentile among 9 Pacific players");
    expect(html).toMatch(/Height: \d+(?:st|nd|rd|th) percentile among 226 MLB players/);
    expect(html).toContain("No verified MLB vertical bat angle or body tilt measurements");
    expect(html).not.toContain("Opposite-Side");
    expect(html).not.toContain("within 3 inches");
  });
  it("withholds professional cards when batting side is unknown",()=>{
    const readings=report();
    const html=renderToStaticMarkup(createElement(HitterSwingBlueprint,{readings,performance:performance(readings)}));
    expect(html).not.toMatch(/href="https:\/\/www\.mlb\.com\/player\/\d+/);
    expect(html).toContain("Add a verified batting side");
    expect(html).toContain("Body Tilt Angle");
  });
  it("withholds Pacific percentiles when the aggregate describes different reports",()=>{
    const readings=report();
    const valid={athleteId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",observedValue:65.25,percentile:75,sampleSize:9,swingCount:25,reportCount:1,firstDate:"2026-09-01",lastDate:"2026-09-07"};
    for(const patch of [{observedValue:65.4},{swingCount:26},{reportCount:2},{firstDate:"2026-09-02"},{lastDate:"2026-09-08"},{sampleSize:4,percentile:null}]){
      const html=renderToStaticMarkup(createElement(HitterSwingBlueprint,{readings,performance:performance(readings),batSpeedReference:{...valid,...patch}}));
      expect(html).not.toContain('aria-label="Your Blast bat speed Pacific percentile"');
    }
  });

});

describe("profile integration and hitter role boundaries", () => {
  it.each([
    { playerType: "position", primaryPosition: "CF", visible: true, pitch: false },
    { playerType: "two_way", primaryPosition: "P", visible: true, pitch: true },
    { playerType: "pitcher", primaryPosition: "P", visible: false, pitch: true },
    { playerType: null, primaryPosition: "P", visible: false, pitch: true },
    { playerType: null, primaryPosition: null, visible: false, pitch: false },
  ])("keeps role-matched design shortcuts in Practice for $playerType/$primaryPosition", ({ playerType, primaryPosition, visible, pitch }) => {
    const readings = report();
    const html = renderToStaticMarkup(createElement(PlayerPerformanceProfile, { athlete: athlete(playerType, primaryPosition), performance: performance(readings), blastReadings: readings, pitchDesignHref: "/pitch-design?athlete=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", swingDesignHref: "/swing-design?athlete=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }));
    const panels = html.split('role="tabpanel"').slice(1);
    expect(panels).toHaveLength(5);
    for (const panel of panels) {
      const isPractice = /id="[^"]*-panel-practice"/.test(panel);
      expect(panel.includes('href="/swing-design?athlete=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"')).toBe(visible && isPractice);
      expect(panel.includes('href="/pitch-design?athlete=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"')).toBe(pitch && isPractice);
      expect(panel).not.toContain('data-testid="hitter-swing-blueprint"');
    }
    expect((html.match(/href="\/swing-design\?/g) ?? []).length).toBe(visible ? 1 : 0);
  });

  it("withholds profile design shortcuts for a historical-only roster entry", () => {
    const historical = athlete("two_way", "P");
    historical.athlete_seasons = historical.athlete_seasons.map(season => ({ ...season, season: "2025-26" }));
    const html = renderToStaticMarkup(createElement(PlayerPerformanceProfile, { athlete: historical, performance: performance([]), swingDesignHref: "/swing-design", pitchDesignHref: "/pitch-design" }));
    expect(html).not.toContain('href="/swing-design"'); expect(html).not.toContain('href="/pitch-design"');
  });

  it("keeps local previews free of shared player links while retaining Blast summary cards", () => {
    const readings = report();
    const html = renderToStaticMarkup(createElement(PlayerPerformanceProfile, { athlete: athlete(), performance: performance(readings), blastReadings: readings, simplified: true, fictional: true }));
    const practice = html.split('role="tabpanel"').find(panel => /id="[^"]*-panel-practice"/.test(panel))!;
    expect(practice).not.toContain('data-testid="hitter-swing-blueprint"');
    expect(practice).not.toContain('href="/swing-design');
    expect(practice).not.toContain('href="/pitch-design');
    expect(practice).toContain("Attack Angle");
    expect(practice).toContain("Vertical Bat Angle");
    expect(html).not.toContain('data-testid="player-performance-methods"');
    expect(html).not.toContain("fictional.blueprint@example.com");
  });
});
