import Link from "next/link";
export default function NotFound() { return <div className="mx-auto my-16 max-w-lg p-7"><h1 className="text-2xl font-bold">Profile or page unavailable</h1><p className="muted">It may not exist, or your account may not have access.</p><Link href="/overview" className="btn btn-primary">Back to workspace</Link></div>; }
