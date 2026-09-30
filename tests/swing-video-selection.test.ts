import { isValidElement,type ReactElement } from "react";
import { beforeEach,expect,it,vi } from "vitest";
const fake=vi.hoisted(()=>({state:vi.fn(),session:vi.fn(),chart:vi.fn(),swing:vi.fn(),lock:vi.fn()}));
vi.mock("react",async original=>({...await original<typeof import("react")>(),useState:fake.state}));
import { HitterContactMap } from "@/components/hitter-contact-map";
import { HitterSprayMap } from "@/components/hitter-spray-map";
import { SwingVideoPanel } from "@/components/swing-video-panel";
import type { SavedContact } from "@/lib/full-swing-contacts-server";
type Element=ReactElement<Record<string,unknown>>;
const hash="a".repeat(64),athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const contacts:SavedContact[]=[2,3].map(row=>({fileHash:hash,sourceRow:row,pitchNumber:row,sourceFile:"fictional.csv",playedOn:"2026-09-11",category:"intrasquad",exitVelocity:90,launchAngle:20,direction:5,distance:210}));
function all(value:unknown):Element[]{if(Array.isArray(value))return value.flatMap(all);if(!isValidElement<Record<string,unknown>>(value))return [];return [value,...all(value.props.children)];}
function render(locked:boolean,chart:"contact"|"spray"="contact"){
 fake.state.mockReturnValueOnce(["all",fake.session]).mockReturnValueOnce([chart,fake.chart]).mockReturnValueOnce([`${hash}:2`,fake.swing]).mockReturnValueOnce([locked,fake.lock]);
 return all(HitterContactMap({contacts,context:"in_game",athleteId:athlete,canAttachVideo:true,videoActions:{prepare:vi.fn(),finish:vi.fn(),play:vi.fn()}}));
}
beforeEach(()=>vi.resetAllMocks());
it("retains the same panel during a locked upload even when session, dots, close, or table handlers are invoked",()=>{
 const nodes=render(true),session=nodes.find(node=>node.type==="select")!,dots=nodes.filter(node=>node.type==="g"&&node.props.role==="button"),tableButtons=nodes.filter(node=>node.type==="button"&&String(node.props.className).includes("text-link")),panel=nodes.find(node=>node.type===SwingVideoPanel)!;
 expect(session.props.disabled).toBe(true);(session.props.onChange as (event:unknown)=>void)({target:{value:hash}});
 expect(dots).toHaveLength(2);for(const dot of dots){expect(dot.props["aria-disabled"]).toBe(true);expect(dot.props.tabIndex).toBeUndefined();(dot.props.onClick as ()=>void)();(dot.props.onKeyDown as (event:unknown)=>void)({key:"Enter",preventDefault:vi.fn()});}
 for(const button of tableButtons){expect(button.props.disabled).toBe(true);(button.props.onClick as ()=>void)();}
 (panel.props.onClose as ()=>void)();expect(fake.session).not.toHaveBeenCalled();expect(fake.swing).not.toHaveBeenCalled();expect(panel.key).toBe(`${hash}:2`);
 (panel.props.onUploadLockChange as (locked:boolean)=>void)(false);expect(fake.lock).toHaveBeenCalledWith(false);
});
it("removes spray selection while locked and restores normal selection after completion",()=>{
 const lockedNodes=render(true,"spray"),lockedSpray=lockedNodes.find(node=>node.type===HitterSprayMap)!;expect(lockedSpray.props.onSelect).toBeUndefined();
 const openNodes=render(false,"spray"),openSpray=openNodes.find(node=>node.type===HitterSprayMap)!;(openSpray.props.onSelect as (row:SavedContact)=>void)(contacts[1]);expect(fake.swing).toHaveBeenCalledWith(`${hash}:3`);
 const session=openNodes.find(node=>node.type==="select")!;expect(session.props.disabled).toBe(false);(session.props.onChange as (event:unknown)=>void)({target:{value:hash}});expect(fake.session).toHaveBeenCalledWith(hash);
});
