import Link from "next/link";
export function TestingNavigation({ coverage = false, changes = false }: { coverage?: boolean; changes?:boolean }) {
  return <nav className="testing-categories" aria-label="Testing views">
    <Link prefetch={false} href="/testing/coverage" aria-current={coverage ? "page" : undefined}>Data Coverage</Link>
    <Link prefetch={false} href="/testing/changes" aria-current={changes ? "page" : undefined}>What Changed</Link>
    <Link prefetch={false} href="/testing" aria-current={!coverage&&!changes ? "page" : undefined}>Record Tests</Link>
  </nav>;
}
