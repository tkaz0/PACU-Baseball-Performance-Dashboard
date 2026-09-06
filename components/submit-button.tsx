"use client";
import { useFormStatus } from "react-dom";
export function SubmitButton({ children, pendingText = "Working…", disabled = false, className = "btn btn-primary", "aria-label": ariaLabel }: { children: React.ReactNode; pendingText?: string; disabled?: boolean; className?: string; "aria-label"?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} aria-label={ariaLabel} disabled={disabled || pending}>{pending ? pendingText : children}</button>;
}
