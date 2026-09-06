import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { APPEARANCE_BOOTSTRAP_SCRIPT, APPEARANCE_STORAGE_KEY, appearancePreference, resolveAppearance } from "@/lib/appearance";

describe("appearance preference", () => {
  it.each([undefined, null, "", "LIGHT", "dark ", "admin", {}, "<script>alert(1)</script>"])("treats unsupported preference %s as System", value => {
    expect(appearancePreference(value)).toBe("system");
  });
  it("honors explicit choices and resolves System from the device", () => {
    expect(resolveAppearance("light", true)).toBe("light");
    expect(resolveAppearance("dark", false)).toBe("dark");
    expect(resolveAppearance("system", false)).toBe("light");
    expect(resolveAppearance("system", true)).toBe("dark");
  });
});

describe("appearance before hydration", () => {
  it.each([
    { saved: null, systemDark: true, preference: "system", theme: "dark" },
    { saved: null, systemDark: false, preference: "system", theme: "light" },
    { saved: "light", systemDark: true, preference: "light", theme: "light" },
    { saved: "dark", systemDark: false, preference: "dark", theme: "dark" },
    { saved: "system", systemDark: true, preference: "system", theme: "dark" },
    { saved: "malformed-choice", systemDark: true, preference: "system", theme: "dark" },
  ])("applies $preference / $theme without React or an account", ({ saved, systemDark, preference, theme }) => {
    const documentElement = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    const reads: string[] = [];
    runInNewContext(APPEARANCE_BOOTSTRAP_SCRIPT, {
      document: { documentElement },
      localStorage: { getItem(key: string) { reads.push(key); return saved; } },
      window: { matchMedia: () => ({ matches: systemDark }) },
    });
    expect(reads).toEqual([APPEARANCE_STORAGE_KEY]);
    expect(documentElement.dataset).toEqual({ appearance: preference, theme });
    expect(documentElement.style.colorScheme).toBe(theme);
  });
  it("still follows the device when browser storage throws", () => {
    const documentElement = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    expect(() => runInNewContext(APPEARANCE_BOOTSTRAP_SCRIPT, {
      document: { documentElement }, localStorage: { getItem() { throw new Error("Storage blocked"); } },
      window: { matchMedia: () => ({ matches: true }) },
    })).not.toThrow();
    expect(documentElement.dataset.theme).toBe("dark");
    expect(documentElement.dataset.appearance).toBe("system");
  });
  it("does not execute or reflect stored code", () => {
    const documentElement = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    runInNewContext(APPEARANCE_BOOTSTRAP_SCRIPT, {
      document: { documentElement }, localStorage: { getItem: () => '";throw new Error("executed");//' },
      window: { matchMedia: () => ({ matches: false }) },
    });
    expect(documentElement.dataset).toEqual({ appearance: "system", theme: "light" });
  });
});
