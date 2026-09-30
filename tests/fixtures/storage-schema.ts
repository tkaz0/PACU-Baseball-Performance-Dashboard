import type { PGlite } from "@electric-sql/pglite";

/** Minimal external Supabase Storage contract for isolated migration tests.
 * Real app migrations and RLS policies still execute unchanged. This fixture
 * does not emulate the Storage HTTP service, signed URLs, MIME checks or files.
 * Run after the anon/authenticated test roles have been created.
 */
export async function initializeStorageSchema(db: PGlite): Promise<void> {
  await db.exec(`
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id),
      name text not null,
      metadata jsonb,
      unique(bucket_id,name)
    );
    alter table storage.buckets enable row level security;
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select on storage.buckets to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
  `);
}
