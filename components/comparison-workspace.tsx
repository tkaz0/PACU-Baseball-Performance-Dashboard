"use client";

import { useState } from "react";
import { Users, Columns2 } from "lucide-react";
import type { CoachingData } from "@/lib/coaching-tools";
import { PlayerComparison } from "@/components/player-comparison";
import { GroupComparison } from "@/components/group-comparison";
import styles from "./group-comparison.module.css";

export function ComparisonWorkspace({ data, today }: { data: CoachingData; today: string }) {
 const [mode, setMode] = useState<"group" | "pair">("group");
 return <div className={styles.workspace}>
  <div className={styles.modeBar}>
   <div className={styles.modes} role="group" aria-label="Comparison view">
    <button type="button" aria-pressed={mode === "group"} onClick={() => setMode("group")}><Users size={16}/>Group Comparison</button>
    <button type="button" aria-pressed={mode === "pair"} onClick={() => setMode("pair")}><Columns2 size={16}/>Side by Side</button>
   </div>
   <span className={styles.season}>Fall 2026</span>
  </div>
  <div hidden={mode !== "group"}><GroupComparison data={data} today={today}/></div>
  <div hidden={mode !== "pair"}><PlayerComparison data={data} today={today}/></div>
 </div>;
}
