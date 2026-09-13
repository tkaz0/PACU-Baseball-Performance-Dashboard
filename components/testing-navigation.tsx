import Link from "next/link";
export function TestingNavigation({ coverage = false }: { coverage?: boolean }) {
  return <nav className="testing-categories" aria-label="Testing views">
    <Link prefetch={false} href="/testing/coverage" aria-current={coverage ? "page" : undefined}>Data Coverage</Link>
    <Link prefetch={false} href="/testing" aria-current={!coverage ? "page" : undefined}>Record Tests</Link>
  </nav>;
}
