export const APPEARANCE_STORAGE_KEY = "pacu-appearance-v1";
export const APPEARANCE_EVENT = "pacu:appearance-change";
export type AppearancePreference = "light" | "dark" | "system";
export type ResolvedAppearance = "light" | "dark";

export function appearancePreference(value: unknown): AppearancePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveAppearance(preference: AppearancePreference, systemDark: boolean): ResolvedAppearance {
  return preference === "system" ? systemDark ? "dark" : "light" : preference;
}

// Fixed application code only. No stored value is interpolated into executable text.
// Runs in <head> before content is painted, independently of React hydration.
export const APPEARANCE_BOOTSTRAP_SCRIPT = `(function(){var p="system";try{var s=localStorage.getItem("${APPEARANCE_STORAGE_KEY}");if(s==="light"||s==="dark")p=s}catch(e){}var d=false;try{d=window.matchMedia("(prefers-color-scheme: dark)").matches}catch(e){}var t=p==="system"?(d?"dark":"light"):p;document.documentElement.dataset.appearance=p;document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t})()`;
