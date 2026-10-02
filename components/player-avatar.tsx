"use client";
import { useState } from "react";
import { headshotSrc, initialsOf } from "@/lib/headshots";

/** Roster headshot with an initials fallback when no photo exists or it fails to load. */
export function PlayerAvatar({ name, path, size = 40, className = "" }: { name: string; path?: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : headshotSrc(path, Math.min(480, Math.round(size * 2.5)));
  return <span className={`player-avatar ${className}`} style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.32)) }} aria-hidden="true">
    {/* External roster photos are already resized by the athletics image service. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {src ? <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : initialsOf(name)}
  </span>;
}
