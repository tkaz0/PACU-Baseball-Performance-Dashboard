import { describe, expect, it } from "vitest";
import { buildExitMeetingReport } from "@/lib/exit-meeting";
import { parseExitMeetingSnapshotReport, parseExitMeetingSnapshotMeta, parseSavedExitMeeting, parseSaveExitMeetingCommand } from "@/lib/exit-meeting-history";
import type { RosterAthlete } from "@/lib/types";
import { fictionalHistoryAthlete as athleteId, fictionalHistoryRequest as requestId, fictionalHistoryReport, fictionalSavedMeeting } from "./fixtures/exit-meeting-history";

const command=()=>({athleteId,requestId,meetingDate:"2026-10-01",talkingPoints:"Coach talking points",reviewed:true});
describe("saved meeting boundaries",()=>{
 it("accepts only deliberately reviewed options, normalizes notes, and never accepts client statistics",()=>{
  expect(parseSaveExitMeetingCommand({...command(),talkingPoints:"  Cafe\u0301\r\nNext session  "})).toMatchObject({talkingPoints:"Café\nNext session",reviewed:true});
  for(const invalid of [{...command(),reviewed:false},{...command(),requestId:"invalid"},{...command(),athleteId:null},{...command(),report:fictionalHistoryReport()},{...command(),role:"coach"},{...command(),format:"detailed"},{...command(),meetingDate:"2026-02-30"},{...command(),talkingPoints:"x".repeat(1601)},{...command(),talkingPoints:"Hidden\u202eorder"}])expect(()=>parseSaveExitMeetingCommand(invalid)).toThrow();
 });
 it("validates condensed display models while rejecting raw provenance, detailed data, and impossible ranks",()=>{
  expect(parseExitMeetingSnapshotReport(fictionalHistoryReport())).toEqual(fictionalHistoryReport());
  const unknownRow=fictionalHistoryReport();Object.assign(unknownRow.sections[0].rows[0],{file_hash:"private"});
  const badRank=fictionalHistoryReport();badRank.sections[0].rows[0].peers=3;
  const duplicate=fictionalHistoryReport();duplicate.sections.push(duplicate.sections[0]);
  const giant=fictionalHistoryReport();giant.name="x".repeat(300);
  for(const invalid of [{...fictionalHistoryReport(),format:"detailed"},{...fictionalHistoryReport(),email:"private@example.com"},unknownRow,badRank,duplicate,giant,{...fictionalHistoryReport(),schemaVersion:2}])expect(()=>parseExitMeetingSnapshotReport(invalid)).toThrow();
  const unranked=fictionalHistoryReport();Object.assign(unranked.sections[0].rows[0],{percentile:null,peers:3});expect(parseExitMeetingSnapshotReport(unranked)).toEqual(unranked);
 });
 it("accepts a real empty and populated server-built summary without persisting input source fields",()=>{
  const athlete={id:athleteId,athlete_code:"PAC-9999",first_name:"Fictional",last_name:"Player",preferred_name:null,pacific_email:"not-in-report@example.com",athlete_seasons:[{season:"2026-27",player_type:"position",primary_position:"SS"}]} as RosterAthlete;
  const input={athlete,measurements:[],batches:[],percentileOverrides:[],games:[],comparisons:[],movement:null,generatedAt:"2026-09-28T12:00:00.000Z"};
  expect(parseExitMeetingSnapshotReport(buildExitMeetingReport(input)).sections).toEqual([]);
  const report=buildExitMeetingReport({...input,measurements:[{id:"fictional-reading",athlete_code:"PAC-9999",metric:"Muscle Mass",value:160,unit:"lb",source:"RENPHO",measured_at:"2026-09-16",source_file:"PRIVATE.png",source_sheet:"PRIVATE",source_row:2,file_hash:"a".repeat(64)}]});
  expect(parseExitMeetingSnapshotReport(report).sections).toHaveLength(1);expect(JSON.stringify(report)).not.toMatch(/PRIVATE|email|file_hash|source_row/);
 });
 it("rejects inconsistent or other-player receipts and accepts historical timestamps without relabeling them",()=>{
  const saved=fictionalSavedMeeting(),{report,talkingPoints,...meta}=saved;
  expect(parseExitMeetingSnapshotMeta(meta,athleteId)).toEqual(meta);expect(parseSavedExitMeeting(saved,athleteId)).toEqual(saved);
  for(const invalid of [{...saved,metricCount:2},{...saved,hasNotes:false},{...saved,generatedAt:"2026-09-29T00:00:00Z"},{...saved,athleteId:requestId},{...saved,report:{...report,raw_source:"private"}},{...saved,talkingPoints:"unsafe\u0001"}])expect(()=>parseSavedExitMeeting(invalid,athleteId)).toThrow();
  expect(talkingPoints).not.toBe("");
 });
});
