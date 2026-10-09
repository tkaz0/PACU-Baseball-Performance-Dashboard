import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {AthleteGameStats} from "@/components/athlete-game-stats";
import {gameDirection} from "@/lib/game-metrics";
const comparison={metric:"batting_avg",source:"qpa_fall_2026",eventId:"",value:.3,percentile:75,sampleSize:6,snapshotId:"fictional"};
it("distinguishes batting walk and strikeout directions from pitching",()=>{expect(gameDirection("qpa_fall_2026","batting_bb_pct")).toBe("higher");expect(gameDirection("qpa_fall_2026","batting_k_pct")).toBe("lower");expect(gameDirection("qpa_fall_2026","gdp")).toBe("lower");expect(gameDirection("pitching_fall_2026","bb_outcome")).toBe("lower");});
it("retains a clean empty state without fictional percentile bars",()=>{const html=renderToStaticMarkup(createElement(AthleteGameStats,{stats:[]}));expect(html).toContain("Game Results Will Appear Here");expect(html).not.toContain('role="meter"');});

it("shows a labeled HR rate without a percentile bar (percentiles live in the Overview rankings)",()=>{
 const stats=[['pa',40],['pumps',2],['base_hit',10]].map(([metric,value])=>({source:"qpa_fall_2026" as const,athlete_id:"fictional-player",metric:metric as string,value:value as number,unit:"count" as const,scope:"cumulative_fall" as const,event_id:null,played_on:null,source_row:2,source_column:2,derived_from:[],snapshot_id:"fictional",fetched_at:"2026-09-13T01:00:00Z",content_hash:"a".repeat(64)}));
 const html=renderToStaticMarkup(createElement(AthleteGameStats,{stats,comparisons:[{...comparison,metric:"batting_hr_pct",value:5}]}));expect(html).toContain("Home Run Rate");expect(html).toContain("5.0%");expect(html).toContain("40 PA");expect(html).not.toContain('role="meter"');expect(html).toContain("doubles and triples");
 const stale=renderToStaticMarkup(createElement(AthleteGameStats,{stats,comparisons:[{...comparison,metric:"batting_hr_pct",value:5,snapshotId:"older"}]}));expect(stale).not.toContain('role="meter"');
});
