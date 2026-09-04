import { LockKeyhole } from "lucide-react";
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return <main className="login-grid">
    <section className="login-brand">
      <div><div className="mb-3 h-1 w-10 bg-pacu-red" /><p className="text-3xl font-black tracking-tight">PACU<span className="text-pacu-red">.</span></p><p className="eyebrow text-gray-400">Baseball Performance</p></div>
      <div className="brand-message relative z-10 my-24 max-w-md"><p className="eyebrow mb-5 text-gray-400">One team. A shared foundation.</p><h2 className="text-5xl font-bold leading-[1.1] tracking-tight">Know your roster.<br /><span className="text-gray-500">Build from here.</span></h2><div className="mt-8 h-1 w-16 bg-pacu-red" /></div>
      <p className="relative z-10 mb-0 max-w-sm text-xs leading-relaxed text-gray-400">An independent project by Trevor Kazahaya.<br />For Pacific Baseball players and coaches. Not an official university application.</p>
    </section>
    <section className="flex items-center justify-center bg-white px-6 py-14 sm:px-12"><div className="w-full max-w-sm"><div className="mb-8 flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-pacu-red"><LockKeyhole size={21} /></div>{children}<p className="mt-9 text-xs text-gray-500">Private workspace · Access is managed by your administrator.</p></div></section>
  </main>;
}
