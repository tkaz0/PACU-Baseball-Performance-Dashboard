"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto my-16 max-w-lg p-7"><h1 className="text-2xl font-bold">This page couldn’t load.</h1><p className="muted">Try again. If the problem continues, ask the administrator to check the Supabase connection and database migrations.</p><button className="btn btn-primary" onClick={reset}>Try again</button></div>;
}
