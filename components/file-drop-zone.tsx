"use client";

import { useId, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import styles from "./import-presentation.module.css";

export function FileDropZone({ label, description, accept, disabled, onFile }: {
  label: string; description: string; accept: string; disabled?: boolean; onFile: (file?: File) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
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
    <div className={styles.dropZone} data-dragging={dragging} data-disabled={!!disabled}
      onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); select(event.dataTransfer.files); }}>
      <span className={styles.dropIcon}><UploadCloud size={25} aria-hidden="true" /></span>
      <label htmlFor={id} className={styles.dropTitle}>{label}</label>
      <p id={`${id}-help`} className={styles.dropDescription}>{description}</p>
      <input ref={input} id={id} tabIndex={-1} aria-describedby={`${id}-help`} type="file" accept={accept} disabled={disabled} className={styles.fileInput} onChange={event => { select(event.target.files); event.target.value = ""; }} />
      <button type="button" disabled={disabled} className={`btn btn-secondary ${styles.chooseFile}`} onClick={() => input.current?.click()}>Choose File</button>
      {fileName && <p className={styles.selectedFile} role="status">Selected: {fileName}</p>}
    </div>
    {error && <p role="alert" className="notice notice-error mt-3">{error}</p>}
  </div>;
}
