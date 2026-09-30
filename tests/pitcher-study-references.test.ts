import { describe, expect, it } from "vitest";
import {
  FEATURED_PITCHER_STUDY_IDS,
  PITCHER_STUDY_REFERENCES,
  PITCHER_STUDY_REFERENCE_SOURCE,
} from "@/lib/pitcher-study-references";

const source = PITCHER_STUDY_REFERENCE_SOURCE;
const references = PITCHER_STUDY_REFERENCES;
const pitches = references.flatMap(reference => reference.pitches);
const exactTypes = {
  FF: "Four-Seam Fastball",
  SI: "Sinker",
  FC: "Cutter",
  SL: "Slider",
  ST: "Sweeper",
  CU: "Curveball",
  CH: "Changeup",
  FS: "Splitter",
  KN: "Knuckleball",
} as const;

describe("public MLB pitcher study reference integrity", () => {
  it("accounts for the full declared 2025 cohort before featured-name filtering", () => {
    expect(source.season).toBe(2025);
    expect(source.referenceCount).toBe(368);
    expect(source.pitchReferenceCount).toBe(1519);
    expect(references).toHaveLength(source.referenceCount);
    expect(pitches).toHaveLength(source.pitchReferenceCount);
    expect(new Set(references.map(reference => reference.id)).size).toBe(references.length);
    expect(source.sourcePitcherCount).toBe(source.referenceCount + source.excludedPitcherCount);
    expect(references.filter(reference => reference.throws === "R")).toHaveLength(267);
    expect(references.filter(reference => reference.throws === "L")).toHaveLength(101);
  });

  it("keeps 100 unique featured IDs inside the verified pool with known throwing hands", () => {
    const byId = new Map(references.map(reference => [reference.id, reference]));
    expect(source.featuredCount).toBe(100);
    expect(FEATURED_PITCHER_STUDY_IDS).toHaveLength(source.featuredCount);
    expect(new Set(FEATURED_PITCHER_STUDY_IDS).size).toBe(source.featuredCount);
    for (const id of FEATURED_PITCHER_STUDY_IDS) {
      expect(byId.has(id), `featured MLB ID ${id}`).toBe(true);
      expect(["R", "L"]).toContain(byId.get(id)?.throws);
    }
    expect(FEATURED_PITCHER_STUDY_IDS.filter(id => byId.get(id)?.throws === "R")).toHaveLength(75);
    expect(FEATURED_PITCHER_STUDY_IDS.filter(id => byId.get(id)?.throws === "L")).toHaveLength(25);
  });

  it("requires recorded size, known hand, and at least 500 season pitches", () => {
    expect(source.minimumSeasonPitches).toBe(500);
    for (const reference of references) {
      expect(Number.isSafeInteger(reference.id)).toBe(true);
      expect(reference.id).toBeGreaterThan(0);
      expect(reference.name.trim().length).toBeGreaterThan(0);
      expect(["R", "L"]).toContain(reference.throws);
      expect(Number.isFinite(reference.heightInches)).toBe(true);
      expect(reference.heightInches).toBeGreaterThan(0);
      expect(Number.isFinite(reference.weightLb)).toBe(true);
      expect(reference.weightLb).toBeGreaterThan(0);
      expect(Number.isSafeInteger(reference.totalPitches)).toBe(true);
      expect(reference.totalPitches).toBeGreaterThanOrEqual(source.minimumSeasonPitches);
      expect(reference.pitches.length).toBeGreaterThan(0);
    }
  });

  it("retains only exact type/code mappings with no inferred generic pitches", () => {
    for (const pitch of pitches) {
      expect(exactTypes[pitch.statcastCode]).toBe(pitch.pitchType);
      expect(["Fastball", "Breaking Ball", "Two-Seam Fastball", "Other"]).not.toContain(pitch.pitchType);
      expect(["SV", "FO", "SC"]).not.toContain(pitch.statcastCode);
    }
    for (const reference of references) {
      expect(new Set(reference.pitches.map(pitch => pitch.pitchType)).size).toBe(reference.pitches.length);
      expect(new Set(reference.pitches.map(pitch => pitch.statcastCode)).size).toBe(reference.pitches.length);
    }
  });

  it("keeps at least 50 classified pitches per type without exceeding the season denominator", () => {
    expect(source.minimumPitchCount).toBe(50);
    for (const reference of references) {
      expect(reference.pitches.reduce((total, pitch) => total + pitch.pitchCount, 0)).toBeLessThanOrEqual(reference.totalPitches);
      for (const pitch of reference.pitches) {
        expect(Number.isSafeInteger(pitch.pitchCount)).toBe(true);
        expect(pitch.pitchCount).toBeGreaterThanOrEqual(source.minimumPitchCount);
        expect(pitch.pitchCount).toBeLessThanOrEqual(reference.totalPitches);
        expect(Number.isFinite(pitch.usagePercent)).toBe(true);
        expect(pitch.usagePercent).toBeGreaterThan(0);
        expect(pitch.usagePercent).toBeLessThanOrEqual(100);
        // Usage keeps all season pitches as its denominator, including omitted types.
        expect(Math.abs(pitch.usagePercent - 100 * pitch.pitchCount / reference.totalPitches)).toBeLessThanOrEqual(0.051);
      }
    }
  });

  it("keeps positive published means and represents absent spin only as null", () => {
    for (const pitch of pitches) {
      expect(Number.isFinite(pitch.averageVelocity)).toBe(true);
      expect(pitch.averageVelocity).toBeGreaterThan(0);
      if (pitch.averageSpin !== null) {
        expect(Number.isFinite(pitch.averageSpin)).toBe(true);
        expect(pitch.averageSpin).toBeGreaterThan(0);
      }
    }
    expect(source.sampleDefinition).toContain("not a published velocity-valid or spin-valid observation count");
  });

  it("records official public MLB provenance with explicit completed-season filters", () => {
    const savantUrls = [source.leaderboardUrl, source.velocityCsvUrl, source.spinCsvUrl, source.usageCsvUrl, source.countCsvUrl, source.movementCsvUrlTemplate];
    for (const value of savantUrls) {
      const url = new URL(value);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("baseballsavant.mlb.com");
      expect(url.searchParams.get("year")).toBe("2025");
      expect(url.username).toBe("");
      expect(url.password).toBe("");
    }
    expect(new URL(source.velocityCsvUrl).searchParams.get("type")).toBe("avg_speed");
    expect(new URL(source.spinCsvUrl).searchParams.get("type")).toBe("avg_spin");
    expect(new URL(source.velocityCsvUrl).searchParams.get("min")).toBe("500");
    const seasonUrl = new URL(source.regularSeasonTotalsUrl);
    expect(seasonUrl.origin).toBe("https://statsapi.mlb.com");
    expect(seasonUrl.searchParams.get("season")).toBe("2025");
    expect(seasonUrl.searchParams.get("gameType")).toBe("R");
    expect(new URL(source.peopleApiUrl).origin).toBe("https://statsapi.mlb.com");
    expect(new URL(source.pitchDefinitionUrl).hostname).toBe("baseballsavant.mlb.com");
    expect(new URL(source.spinDefinitionUrl).hostname).toBe("www.mlb.com");
    expect(source.retrievedOn).toBe("2026-09-29");
    expect(source.listedSizeAsOf).toBe(source.retrievedOn);
    expect(source.listedThrowsAsOf).toBe(source.retrievedOn);
  });

  it("preserves response fingerprints for each data source and people batch", () => {
    const hashes = [
      ...Object.values(source.csvSha256),
      ...Object.values(source.movementCsvSha256),
      ...Object.values(source.peopleResponseSha256),
      source.arsenalsPageSha256,
      source.regularSeasonTotalsSha256,
    ];
    expect(Object.keys(source.csvSha256).sort()).toEqual(["count", "spin", "usage", "velocity"]);
    expect(Object.keys(source.movementCsvSha256).sort()).toEqual(Object.keys(exactTypes).sort());
    expect(Object.keys(source.peopleResponseSha256)).toHaveLength(5);
    for (const hash of hashes) expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
