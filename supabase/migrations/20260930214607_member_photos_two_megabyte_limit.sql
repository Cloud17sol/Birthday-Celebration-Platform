-- Lower the private member-photos upload limit from 5 MiB to 2 MiB.
-- The application stores an optimized WebP that is strictly smaller than this limit.
-- Privacy, MIME types, and Storage policies are unchanged.

update storage.buckets
set
  file_size_limit = 2097152,
  updated_at = now()
where id = 'member-photos'
  and name = 'member-photos'
  and public = false;

do $$
begin
  if (
    select count(*)
    from storage.buckets
    where id = 'member-photos'
      and name = 'member-photos'
      and public = false
      and file_size_limit = 2097152
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
  ) <> 1 then
    raise exception 'member-photos bucket limit was not set to 2097152';
  end if;
end
$$;
