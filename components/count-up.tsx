"use client";
import { useEffect, useRef } from "react";

const NUMBER = /^(.*?)(-?(?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d+)?)(.*)$/s;

/** Formats `target × progress` the way the original string was written (decimals, commas, a leading "."). */
export function countUpFrame(value: string, progress: number): string {
  const match = value.match(NUMBER);
  if (!match || !/\d/.test(match[2])) return value;
  const [, before, number, after] = match;
  const target = Number(number.replace(/,/g, ""));
  if (!Number.isFinite(target)) return value;
  const decimals = number.split(".")[1]?.length ?? 0, current = target * Math.min(1, Math.max(0, progress));
  let text = number.includes(",") ? current.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : current.toFixed(decimals);
  if (/^-?\./.test(number)) text = text.replace(/^(-?)0\./, "$1.");
  return `${before}${text}${after}`;
}

/** Presentation only: the server renders the real value; the browser counts up to it once on load. */
export function CountUp({ value, className, duration = 900 }: { value: string; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || countUpFrame(value, 0) === value || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      element.textContent = progress < 1 ? countUpFrame(value, 1 - Math.pow(1 - progress, 3)) : value;
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); element.textContent = value; };
  }, [value, duration]);
  return <span ref={ref} className={className}>{value}</span>;
}
