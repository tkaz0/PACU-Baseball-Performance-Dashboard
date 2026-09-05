import Image from "next/image";

type PacificLogoProps = {
  variant?: "athletics" | "university";
  tone?: "light" | "dark";
  decorative?: boolean;
  className?: string;
};

/** Official source assets, served locally without altering the marks. */
export function PacificLogo({ variant = "athletics", tone = "light", decorative = false, className = "" }: PacificLogoProps) {
  const university = variant === "university";
  return <Image
    src={university ? `/brand/pacific-university${tone === "dark" ? "-white" : ""}.svg` : "/brand/pacific-athletics-p.png"}
    alt={decorative ? "" : university ? "Pacific University Oregon" : "Pacific University Athletics"}
    width={university ? 244 : 88}
    height={university ? 166 : 119}
    className={`pacific-logo ${university ? "pacific-logo-university" : "pacific-logo-athletics"} ${className}`}
    unoptimized
  />;
}

export function PacificBrand({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return <span className={`pacific-brand ${compact ? "pacific-brand-compact" : ""} ${className}`}>
    <PacificLogo decorative />
    <span className="pacific-brand-copy"><span className="pacific-brand-name">Pacific Baseball</span><span className="pacific-brand-descriptor">Performance</span></span>
  </span>;
}
