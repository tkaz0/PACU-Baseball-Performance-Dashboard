import {expect,it} from "vitest";
import {accountSetupStage,parseAccountSetupStatuses,type AccountSetupStatus} from "@/lib/account-setup-status";
const base:AccountSetupStatus={userId:"11111111-1111-4111-8111-111111111111",active:true,roles:["player"],athleteId:null,code:null,name:"Fictional Player",email:"fictional@example.com",invitedAt:"2026-09-21T18:00:00Z",acceptedAt:null,lastSignInAt:null,passwordSet:false};
it("separates invitation acceptance, password setup, and disabled access",()=>{
 expect(accountSetupStage(base)).toBe("waiting");
 expect(accountSetupStage({...base,passwordSet:true})).toBe("waiting");
 expect(accountSetupStage({...base,acceptedAt:"2026-09-22T01:00:00Z",lastSignInAt:"2026-09-22T01:00:00Z"})).toBe("password");
 expect(accountSetupStage({...base,active:false,acceptedAt:"2026-09-22T01:00:00Z",passwordSet:true})).toBe("complete");
});
it("returns only the minimal status projection",()=>{
 expect(parseAccountSetupStatuses([{...base,encrypted_password:"fictional-secret",recovery_token:"fictional-token",metadata:{admin:true}}])).toEqual([base]);
});
it("rejects incomplete, duplicate and malformed status responses",()=>{
 for(const value of [null,{},[base,base],[{...base,passwordSet:undefined}],[{...base,active:"true"}],[{...base,roles:["owner"]}],[{...base,acceptedAt:"bad"}]])expect(()=>parseAccountSetupStatuses(value)).toThrow();
});
