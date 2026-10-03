-- The app uses server-issued signed upload/download URLs only.
-- Keep this bucket private and do not grant direct object access to anon/authenticated.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'files',
  'files',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/dicom']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;