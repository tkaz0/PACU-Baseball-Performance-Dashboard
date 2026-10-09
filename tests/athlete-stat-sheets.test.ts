import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {AthleteGameStats} from "@/components/athlete-game-stats";
import type {SharedGameStat} from "@/lib/game-server";
function rows(counts:Record<string,number>,pitching=false,week=1):SharedGameStat[] {
 return Object.entries(counts).map(([metric,value])=>({source:pitching?"pitching_fall_2026":"qpa_fall_2026",athlete_id:"fictional-player",metric,value,unit:"count",scope:pitching?"pitching_event":"cumulative_fall",event_id:pitching?`fall-2026-week-${week}`:null,played_on:null,source_row:2,source_column:2,derived_from:[],snapshot_id:"fictional-current",fetched_at:"2026-10-09T01:00:00Z",content_hash:"a".repeat(64)}));
}
it("keeps hitting values and denominator context in a stat sheet without rate charts",()=>{
 const stats=rows({pa:13,ab:10,base_hit:4,hh_extra_base_hit:2,pumps:1,bb:1,hbp:1,sac_fly:1,punchies:3,sb:2,gdp:0});
 const original=structuredClone(stats),html=renderToStaticMarkup(createElement(AthleteGameStats,{stats,showDetails:false}));
 for(const value of [".400",".462",".900",".500","13 PA","10 AB","8 contacts","Early sample"])expect(html).toContain(value);
 for(const label of ["Production","Rates","Counting Stats","About AVG","About ISO","About HR %"])expect(html).toContain(label);
 expect(html).not.toContain("Recorded rate, not a percentile.");expect(html).not.toContain("More Stats");
 expect(stats).toEqual(original);
});
it("sums reviewed pitching weeks once and preserves exact outs, contact and pitch splits without charts",()=>{
 const counts={pitches:20,strikes:12,innings_outs:5,k:3,bb_outcome:1,h:2,r:1,hbp:0,weak_contact:6,hard_contact:2,fb:10,fb_k:7,bb_pitch_family:6,bb_pitch_family_k:3,ch:4,ch_k:2};
 const stats=[...rows(counts,true),...rows(counts,true,2)],original=structuredClone(stats);
 const html=renderToStaticMarkup(createElement(AthleteGameStats,{stats}));
 for(const value of ["3.1","1.80","3.00","5.40","60.0%","75.0%","25.0%","70.0%","40 pitches","12 weak · 4 hard · 16 classified contacts"])expect(html).toContain(value);
 expect(html).toContain('aria-label="Pitch Splits"');expect(html).toContain('scope="col">Strike %');
 expect(html).not.toContain('role="img"');expect(html).not.toContain("Recorded rate, not a percentile.");
 expect(stats).toEqual(original);
});
it("preserves unavailable pitching rates as missing rather than inventing zeros",()=>{
 const html=renderToStaticMarkup(createElement(AthleteGameStats,{stats:rows({pitches:20,k:2,bb_outcome:0,weak_contact:3},true),showDetails:false}));
 expect(html).toContain("<dd>—</dd>");expect(html).not.toContain("NaN");expect(html).not.toContain("Infinity");
 expect(html).toContain("Both weak and hard counts are needed");
});
