import { Eye } from "lucide-react";
import { startAccessPreview, exitAccessPreview } from "@/app/(workspace)/view-as/actions";
import { SubmitButton } from "@/components/submit-button";
import type { AccessPreview } from "@/lib/access-preview";

type Choice = { id: string; label: string };
export function AccessPreviewControl({ preview, athletes }: { preview: AccessPreview | null; athletes: Choice[] }) {
  if (preview) return <form action={exitAccessPreview}><SubmitButton className="btn btn-secondary" pendingText="Leaving preview…">Exit preview</SubmitButton></form>;
  return <details className="group relative">
    <summary className="btn btn-secondary cursor-pointer list-none"><Eye size={16} aria-hidden="true" />View as</summary>
    <div className="absolute right-0 z-40 mt-3 w-[min(340px,calc(100vw-40px))] rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
      <p className="mb-1 font-bold">Preview an access level</p><p className="mb-4 text-xs leading-relaxed text-gray-500">Your administrator account stays signed in. Previews are read-only.</p>
      <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-pacu-red">Admin · Current access</p>
      <form action={startAccessPreview} className="mb-4"><input type="hidden" name="role" value="coach" /><SubmitButton className="btn btn-secondary w-full" pendingText="Opening coach view…">View as Coach</SubmitButton></form>
      <form action={startAccessPreview} className="space-y-3"><input type="hidden" name="role" value="player" /><label htmlFor="private-preview-athlete">Player profile</label><select id="private-preview-athlete" name="athlete_id" defaultValue="" required><option value="" disabled>Select an athlete</option>{athletes.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select><SubmitButton className="btn btn-secondary w-full" disabled={!athletes.length} pendingText="Opening player view…">View as Player</SubmitButton></form>
      {!athletes.length && <p className="mb-0 mt-3 text-xs text-gray-500">Import the private roster before previewing a player.</p>}
    </div>
  </details>;
}
