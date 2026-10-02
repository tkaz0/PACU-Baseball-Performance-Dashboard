"use client";
import { Printer } from "lucide-react";

/** Opens the browser print dialog; choose "Save as PDF" to download. */
export function PrintButton({ label = "Download PDF" }: { label?: string }) {
  return <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}><Printer size={16} aria-hidden="true"/>{label}</button>;
}
