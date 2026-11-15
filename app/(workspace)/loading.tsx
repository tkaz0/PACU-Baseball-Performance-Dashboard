import { BaseballMark } from "@/components/baseball-mark";
export default function WorkspaceLoading(){
 return <section className="workspace-loading" role="status" aria-live="polite" aria-label="Loading dashboard"><div className="workspace-loading-head"><span className="workspace-loading-ball"><BaseballMark strokeWidth={7}/></span><p className="m-0">Loading your dashboard…</p></div><div aria-hidden="true"><div className="workspace-loading-title"/><div className="workspace-loading-grid"><span/><span/><span/></div></div></section>;
}
