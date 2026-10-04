import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect,it,vi } from "vitest";
import { profileTab,profileTabHref,PROFILE_TAB_IDS } from "@/lib/profile-tab";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
import { ProfileTabs } from "@/components/profile-tabs";
it.each([undefined,null,"bad","../../admin",["practice"],"practice\n"])("falls back to Overview for invalid URL input %s",v=>expect(profileTab(v)).toBe("overview"));
it.each(PROFILE_TAB_IDS)("keeps the requested %s tab and does not transmit other panels",tab=>{
 expect(profileTabHref("/athletes/fictional",tab)).toBe(`/athletes/fictional?tab=${tab}`);
 const tabs=PROFILE_TAB_IDS.map(id=>({id,label:id,content:createElement("p",null,`Fictional ${id} content`)}));
 const html=renderToStaticMarkup(createElement(ProfileTabs,{tabs,selectedTab:tab,navigationPath:"/athletes/fictional"}));
 for(const id of PROFILE_TAB_IDS)expect(html.includes(`Fictional ${id} content`)).toBe(id===tab);
 expect(html).toContain('aria-selected="true"');expect(html).toContain('role="tablist"');
});
