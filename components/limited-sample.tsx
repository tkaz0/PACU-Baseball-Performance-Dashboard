export function LimitedSample({count,pitching=false,opportunityLabel}:{count:number|null|undefined;pitching?:boolean;opportunityLabel?:string}) {
 const threshold=pitching?50:20;
 return count!=null&&count>0&&count<threshold?<span className="mt-1 inline-block rounded-md border border-[var(--line-subtle)] px-1.5 py-0.5 text-[10px] font-medium leading-4 tracking-normal text-[var(--text-secondary)]" title={`Dashboard display setting: fewer than ${threshold} ${pitching?"pitches":opportunityLabel??"batting opportunities"}. Results remain visible and ranks are unchanged.`}>Limited sample</span>:null;
}
