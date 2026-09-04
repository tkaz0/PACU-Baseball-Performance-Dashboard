"use client";
import { useFormStatus } from "react-dom";
export function SubmitButton({ children, pendingText = "Working…", disabled = false, className = "btn btn-primary" }: { children: React.ReactNode; pendingText?: string; disabled?: boolean; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={disabled || pending}>{pending ? pendingText : children}</button>;
}
