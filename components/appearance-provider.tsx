"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { APPEARANCE_EVENT, APPEARANCE_STORAGE_KEY, appearancePreference, resolveAppearance, type AppearancePreference, type ResolvedAppearance } from "@/lib/appearance";

type AppearanceContextValue = {
  preference: AppearancePreference;
  resolved: ResolvedAppearance;
  storageUnavailable: boolean;
  setPreference: (preference: AppearancePreference) => void;
};
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function applyAppearance(preference: AppearancePreference) {
  const resolved = resolveAppearance(preference, window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.appearance = preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  window.dispatchEvent(new Event(APPEARANCE_EVENT));
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const systemChange = () => {
    if (appearancePreference(document.documentElement.dataset.appearance) === "system") applyAppearance("system");
  };
  const storageChange = (event: StorageEvent) => {
    if (event.key === APPEARANCE_STORAGE_KEY || event.key === null) applyAppearance(appearancePreference(event.newValue));
  };
  window.addEventListener(APPEARANCE_EVENT, onChange);
  window.addEventListener("storage", storageChange);
  media.addEventListener("change", systemChange);
  // The OS may have changed between the pre-paint script and hydration.
  const preference = appearancePreference(document.documentElement.dataset.appearance);
  const resolved = resolveAppearance(preference, media.matches);
  if (document.documentElement.dataset.theme !== resolved) applyAppearance(preference);
  return () => {
    window.removeEventListener(APPEARANCE_EVENT, onChange);
    window.removeEventListener("storage", storageChange);
    media.removeEventListener("change", systemChange);
  };
}

function getSnapshot() {
  return `${appearancePreference(document.documentElement.dataset.appearance)}:${document.documentElement.dataset.theme === "dark" ? "dark" : "light"}`;
}
const getServerSnapshot = () => "system:light";

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const value = useMemo<AppearanceContextValue>(() => {
    const [preference, resolved] = snapshot.split(":") as [AppearancePreference, ResolvedAppearance];
    return { preference, resolved, storageUnavailable, setPreference(next) {
      const validated = appearancePreference(next);
      applyAppearance(validated);
      try { localStorage.setItem(APPEARANCE_STORAGE_KEY, validated); setStorageUnavailable(false); }
      catch { setStorageUnavailable(true); }
    } };
  }, [snapshot, storageUnavailable]);
  return <AppearanceContext value={value}>{children}</AppearanceContext>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("Appearance controls must be inside AppearanceProvider.");
  return value;
}
