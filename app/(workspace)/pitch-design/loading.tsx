import { PageHeading } from "@/components/page-heading";

export default function PitchDesignLoading() {
  return <><PageHeading section="Team" title="Pitch Design" description="Your arsenal, grip options, and MLB pitchers to study."/><div className="panel p-8 text-sm text-[var(--text-secondary)]" role="status">Loading Pitch Design…</div></>;
}
