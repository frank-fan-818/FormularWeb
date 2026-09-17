begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fastf1-private', 'fastf1-private', false, 10485760, array['application/json'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "FastF1 member download" on storage.objects;
create policy "FastF1 member download" on storage.objects for select to authenticated
using (bucket_id = 'fastf1-private' and auth.uid() is not null
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);

-- Restrictive policies also constrain any pre-existing broad storage policies.
drop policy if exists "FastF1 read boundary" on storage.objects;
create policy "FastF1 read boundary" on storage.objects as restrictive for select to anon, authenticated
using (bucket_id <> 'fastf1-private' or (auth.role() = 'authenticated' and auth.uid() is not null
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false));
drop policy if exists "FastF1 no client insert" on storage.objects;
create policy "FastF1 no client insert" on storage.objects as restrictive for insert to anon, authenticated
with check (bucket_id <> 'fastf1-private');
drop policy if exists "FastF1 no client update" on storage.objects;
create policy "FastF1 no client update" on storage.objects as restrictive for update to anon, authenticated
using (bucket_id <> 'fastf1-private') with check (bucket_id <> 'fastf1-private');
drop policy if exists "FastF1 no client delete" on storage.objects;
create policy "FastF1 no client delete" on storage.objects as restrictive for delete to anon, authenticated
using (bucket_id <> 'fastf1-private');

commit;
