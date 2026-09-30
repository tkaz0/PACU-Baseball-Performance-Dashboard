"use client";

import { useId, useState } from "react";
import { Info, X } from "lucide-react";
import { statDefinition } from "@/lib/stat-definitions";
import { benchmarkGrade, benchmarkMetric, benchmarkRows, blastReference, collegePitchReference, statBenchmark, statRangeGuide, ungradedMetric, type Benchmark, type StatGuideContext } from "@/lib/stat-benchmarks";
import styles from "./stat-info.module.css";

/** References are public; Pacific ranges use only the existing signed-in ranking projection. */
export function StatInfo({ metric, label = metric, ...context }: { metric: string; label?: string } & StatGuideContext) {
  const id = useId(),key=JSON.stringify([metric,context.source,context.unit,context.period,context.eventId]);
  const [remote,setRemote]=useState<{key:string;benchmark:Benchmark|null}|null>(null),[loading,setLoading]=useState(false);
  const local=statBenchmark(metric,context),b=local??(remote?.key===key?remote.benchmark:null);
  const target=blastReference(metric,context),ungraded=ungradedMetric(metric);
  const range=statRangeGuide(metric,context,b);
  const collegePitch=collegePitchReference(metric,context);
  const current=b&&typeof context.value==="number"&&Number.isFinite(context.value)?benchmarkGrade(context.value,b):null;
  async function load(){
    if(local||ungraded||context.scope==="team"||!context.source||!context.unit||context.source==="blast_fall"||remote?.key===key||loading)return;
    setLoading(true);
    try{
      const p=new URLSearchParams({metric:benchmarkMetric(metric),source:context.source,unit:context.unit,period:context.period??"fall_2026",eventId:context.eventId??(context.source==="pitching_fall_2026"?"fall-2026-cumulative":"")});
      const response=await fetch(`/api/stat-benchmarks?${p}`,{cache:"no-store"});
      const data=response.ok?await response.json():null;
      setRemote({key,benchmark:data?.benchmark??null});
    }catch{setRemote({key,benchmark:null});}finally{setLoading(false);}
  }
  return <span className={styles.wrapper}>
    <button type="button" className={styles.trigger} popoverTarget={id} aria-label={`About ${label}`} title={`About ${label}`} onClick={load}><Info size={14} aria-hidden="true" /></button>
    <span id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`} className={styles.popover}>
      <span className={styles.heading}><strong id={`${id}-title`}>{label.replaceAll("_", " ")}</strong><button type="button" popoverTarget={id} popoverTargetAction="hide" aria-label="Close stat explanation" className={styles.close}><X size={17} aria-hidden="true" /></button></span>
      <span className={styles.description}>{statDefinition(metric)}</span>
      <span className={styles.range}><strong>{range.heading}</strong><span>{range.summary}</span><span className={styles.note}>{range.detail}</span></span>
      {b?<span className={styles.guide}>
        <strong>{b.title}</strong><span className={styles.sample}>{b.n} {context.scope==="team"?"teams":"players"} in reference</span>
        <span className={styles.bands}>{benchmarkRows(metric,b).map(row=><span key={row.index} className={styles.band} data-grade={row.index} data-current={current===row.index}><span><i aria-hidden="true"/>{row.label}{current===row.index&&<small>Current</small>}</span><strong>{row.range}</strong></span>)}</span>
        <span className={styles.note}>{b.direction==="neutral"?"Numerical position only; these bands are not health or performance grades. ":b.direction==="lower"?"Lower is better. ":"Higher is better. "}{b.note} Range boundaries are rounded for readability.</span>
        {b.url&&<a className={styles.source} href={b.url} target="_blank" rel="noreferrer">View official NWC statistics ↗</a>}
      </span>:loading?<span className={styles.note} role="status">Loading the exact Pacific comparison…</span>:null}
      {target&&<span className={styles.target}><strong>Blast College Reference</strong><span>{target}</span><span className={styles.note}>Vendor guidance, not D3 percentile cutoffs. Pitch location and swing intent matter. Not applied to Full Swing or weekly 95th-percentile results.</span><a className={styles.source} href="https://blastmotion.com/products/baseball/" target="_blank" rel="noreferrer">View Blast reference ↗</a></span>}
      {collegePitch&&<span className={styles.target}><strong>College Pitch Average</strong><span>Right-handed pitchers: {collegePitch.right.toFixed(1)} {collegePitch.unit === "rpm" ? "RPM" : "mph"}</span><span>Left-handed pitchers: {collegePitch.left.toFixed(1)} {collegePitch.unit === "rpm" ? "RPM" : "mph"}</span><span className={styles.note}>Rapsodo’s June 2023 reference covers college sessions from JUCO through D1. Your readings use Full Swing, so this is outside context, not a device-matched grade or D3 percentile. These are averages, not maximums. Spin depends on the pitch; higher is not always better.</span><a className={styles.source} href="https://rapsodo.com/blogs/baseball/college-pitching-averages-and-how-to-reach-them" target="_blank" rel="noreferrer">View Rapsodo college reference ↗</a></span>}
    </span>
  </span>;
}
