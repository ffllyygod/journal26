-- Run once in the Supabase SQL editor for your project.
begin;

create table public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null check (
    jsonb_typeof(document) = 'object'
    and document ?& array['version', 'settings', 'days', 'trades', 'applications', 'learning', 'weeklyNotes']
    and document->>'version' = '1'
    and jsonb_typeof(document->'settings') = 'object'
    and jsonb_typeof(document->'days') = 'object'
    and jsonb_typeof(document->'trades') = 'array'
    and jsonb_typeof(document->'applications') = 'array'
    and jsonb_typeof(document->'learning') = 'array'
    and jsonb_typeof(document->'weeklyNotes') = 'object'
  ),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon;
grant select, insert, update, delete on public.workspaces to authenticated;

create policy "Read own journal" on public.workspaces for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own journal" on public.workspaces for insert to authenticated with check ((select auth.uid()) = user_id and revision = 0);
create policy "Update own journal" on public.workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own journal" on public.workspaces for delete to authenticated using ((select auth.uid()) = user_id);

create function public.enforce_workspace_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Workspace owner cannot be changed';
  end if;
  if new.revision <> old.revision + 1 then
    raise exception 'Workspace revision must increase by exactly one';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspace_revision before update on public.workspaces
for each row execute function public.enforce_workspace_revision();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal-images', 'journal-images', false, 1048576, array['image/webp', 'image/png', 'image/jpeg']);

create policy "Read own journal images" on storage.objects for select to authenticated
using (bucket_id = 'journal-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Upload own journal images" on storage.objects for insert to authenticated
with check (bucket_id = 'journal-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own journal images" on storage.objects for delete to authenticated
using (bucket_id = 'journal-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
