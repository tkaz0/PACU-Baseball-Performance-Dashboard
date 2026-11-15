/** Remounts on each navigation so the page content fades in (presentation only; see showcase-theme.css). */
export default function WorkspaceTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>;
}
