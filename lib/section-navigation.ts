/** A fragment only controls a section explicitly advertised by this navigation. */
export function sectionFromHash(hash: string, ids: readonly string[]): string | null {
  try {
    const id = decodeURIComponent(hash.replace(/^#/, ""));
    return ids.includes(id) ? id : null;
  } catch {
    return null;
  }
}

/** Use every section's current position, not just the entries changed in one observer callback. */
export function activeSectionAt(sections: readonly { id: string; top: number; bottom: number }[], line: number): string | null {
  const containing = sections.find(section => section.top <= line && section.bottom > line);
  if (containing) return containing.id;
  const preceding = sections.filter(section => section.top <= line);
  return preceding.at(-1)?.id ?? sections[0]?.id ?? null;
}
