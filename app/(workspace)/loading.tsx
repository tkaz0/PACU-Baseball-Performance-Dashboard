import { PacificLogo } from "@/components/pacific-brand";
export default function WorkspaceLoading(){
 return <section className="workspace-loading" role="status" aria-live="polite" aria-label="Loading dashboard"><div className="mb-5 flex items-center gap-3"><PacificLogo className="w-7" decorative/><p className="m-0">Loading your dashboard…</p></div><div aria-hidden="true"><div className="workspace-loading-title"/><div className="workspace-loading-grid"><span/><span/><span/></div></div></section>;
}
