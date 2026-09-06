export function AccessPreviewNotice({ status, isPreview }: { status?: string; isPreview: boolean }) {
  if (status === "invalid") return <p role="alert" className="notice notice-error mb-6">Choose an available player profile or the coach view. Your current view has not changed.</p>;
  if (status === "read-only" && isPreview) return <p role="status" className="notice mb-6">Exit preview to add or manage information. No change was saved.</p>;
  return null;
}
