import {expect,it} from "vitest";
import {validateHomeCoverage} from "@/lib/home-coverage";
import {buildHomeSummary} from "@/lib/home-summary";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",peer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",today="2026-10-04";
const group={athleteId:id,metric:"Weight",unit:"lb",source:"RENPHO",date:"2026-09-20",importedAt:"2026-09-25T00:00:00+00:00",count:2};
const data=()=>({version:1,athleteId:id,today,playerIds:[id],totalReadings:2,groups:[{...group}]});
it("retains distinct player coverage and the actual latest test/import dates after compacting",()=>{
 const compact=validateHomeCoverage(data(),id,today);
 const full=[{...group,date:"2026-09-01",importedAt:"2026-09-02T00:00:00+00:00"},group];
 expect(buildHomeSummary(compact.playerIds,compact.groups,[],today)).toEqual(buildHomeSummary([id],full,[],today));
});
it.each([
 (v:ReturnType<typeof data>)=>({...v,athleteId:peer}),
 (v:ReturnType<typeof data>)=>({...v,playerIds:[id,peer]}),
 (v:ReturnType<typeof data>)=>({...v,totalReadings:1}),
 (v:ReturnType<typeof data>)=>({...v,today:"2026-09-30"}),
 (v:ReturnType<typeof data>)=>({...v,groups:[group,group],totalReadings:4}),
 (v:ReturnType<typeof data>)=>({...v,groups:[{...group,athleteId:peer}]}),
 (v:ReturnType<typeof data>)=>({...v,groups:[{...group,date:"2026-08-31"}]}),
 (v:ReturnType<typeof data>)=>({...v,groups:[{...group,date:"2026-10-05"}]}),
 (v:ReturnType<typeof data>)=>({...v,groups:[{...group,date:"2026-09-31"}]}),
 (v:ReturnType<typeof data>)=>({...v,groups:[{...group,value:180}]}),
 (v:ReturnType<typeof data>)=>({...v,sourceFile:"private.png"}),
])("rejects scope mismatches, partial counts, duplicate groups, unreviewed fields or periods %#",change=>{
 expect(()=>validateHomeCoverage(change(data()),id,today)).toThrow("could not be verified");
});
it("represents an empty reviewed staff cohort exactly without fake readings",()=>expect(validateHomeCoverage({version:1,athleteId:null,today,playerIds:[],totalReadings:0,groups:[]},null,today)).toEqual({playerIds:[],totalReadings:0,groups:[]}));
