export function PageHeading({ section, title, description, children }: { section: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="page-head"><div className="min-w-0"><p className="eyebrow mb-2 text-pacu-red">{section}</p><h1 className="page-title">{title}</h1><p className="page-description">{description}</p></div>{children && <div className="page-actions">{children}</div>}</div>;
}
