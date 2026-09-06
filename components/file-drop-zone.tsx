"use client";

import { useId, useState } from "react";
import { UploadCloud } from "lucide-react";

export function FileDropZone({ label, description, accept, disabled, onFile }: {
  label: string; description: string; accept: string; disabled?: boolean; onFile: (file?: File) => void;
}) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  function select(files: FileList | null) {
    setDragging(false); setError("");
    if (disabled) return;
    if (files && files.length > 1) { setError("Choose one file at a time so each import can be reviewed."); return; }
    setFileName(files?.[0]?.name ?? "");
    onFile(files?.[0]);
  }
  return <div>
    <div className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? "border-red-500 bg-red-50" : "border-gray-300"} ${disabled ? "opacity-60" : ""}`}
      onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); select(event.dataTransfer.files); }}>
      <UploadCloud className="mx-auto mb-3 text-red-700" size={30} aria-hidden="true" />
      <label htmlFor={id} className="block text-base font-bold">{label}</label>
      <p id={`${id}-help`} className="muted mb-4 mt-2 text-sm">{description}</p>
      <input id={id} aria-describedby={`${id}-help`} type="file" accept={accept} disabled={disabled} className="mx-auto max-w-lg text-sm" onChange={event => { select(event.target.files); event.target.value = ""; }} />
      {fileName && <p className="mb-0 mt-3 break-words text-sm" role="status">Selected: {fileName}</p>}
    </div>
    {error && <p role="alert" className="notice notice-error mt-3">{error}</p>}
  </div>;
}
