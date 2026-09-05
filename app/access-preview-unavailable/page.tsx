import { AuthFrame } from "@/components/auth-frame";
import { SubmitButton } from "@/components/submit-button";
import { exitAccessPreview } from "@/app/(workspace)/view-as/actions";
export default function AccessPreviewUnavailable() {
  return <AuthFrame><h1 className="mb-3 text-3xl font-bold">Preview unavailable</h1><p className="muted mb-7 text-sm">This preview expired, the selected profile is unavailable, or your access changed. Exit preview to return to your current account access.</p><form action={exitAccessPreview}><SubmitButton pendingText="Leaving preview…">Exit preview</SubmitButton></form></AuthFrame>;
}
