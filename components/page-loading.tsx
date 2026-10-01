import { PageHeading } from "@/components/page-heading";

/** Shows the page title right away with placeholder panels while server data loads. */
export function PageLoading({ section, title, description }: { section: string; title: string; description: string }) {
  return <><PageHeading section={section} title={title} description={description}/>
    <section className="workspace-loading" role="status" aria-live="polite" aria-label={`Loading ${title}`}>
      <p className="m-0 mb-4">Loading {title}…</p>
      <div aria-hidden="true"><div className="workspace-loading-title"/><div className="workspace-loading-grid"><span/><span/><span/></div></div>
    </section></>;
}
