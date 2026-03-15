-- Run this in the Supabase SQL editor after creating the `images` bucket.
-- It enables RLS for the tables used by this app and defines starter policies.

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_superadmin = true
  );
$$;

revoke all on function private.is_superadmin() from public;
grant execute on function private.is_superadmin() to authenticated;

alter table if exists public.profiles enable row level security;
alter table if exists public.humor_flavors enable row level security;
alter table if exists public.humor_flavor_steps enable row level security;
alter table if exists public.humor_mix enable row level security;
alter table if exists public.humor_flavor_mix enable row level security;
alter table if exists public.llm_providers enable row level security;
alter table if exists public.llm_models enable row level security;
alter table if exists public.llm_prompt_chains enable row level security;
alter table if exists public.allowed_domains enable row level security;
alter table if exists public.allowed_signup_domains enable row level security;
alter table if exists public.whitelisted_emails enable row level security;
alter table if exists public.images enable row level security;
alter table if exists public.captions enable row level security;
alter table if exists public.caption_votes enable row level security;
alter table if exists storage.objects enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_select_superadmin" on public.profiles;
create policy "profiles_select_superadmin"
on public.profiles
for select
to authenticated
using (private.is_superadmin());

drop policy if exists "humor_flavors_read_all" on public.humor_flavors;
create policy "humor_flavors_read_all"
on public.humor_flavors
for select
to authenticated
using (true);

drop policy if exists "humor_flavor_steps_read_authenticated" on public.humor_flavor_steps;
create policy "humor_flavor_steps_read_authenticated"
on public.humor_flavor_steps
for select
to authenticated
using (true);

do $$
begin
  if to_regclass('public.humor_mix') is not null then
    execute 'drop policy if exists "humor_mix_superadmin_all" on public.humor_mix';
    execute $policy$
      create policy "humor_mix_superadmin_all"
      on public.humor_mix
      for all
      to authenticated
      using (private.is_superadmin())
      with check (private.is_superadmin())
    $policy$;
  end if;
end
$$;

drop policy if exists "humor_flavor_mix_superadmin_all" on public.humor_flavor_mix;
create policy "humor_flavor_mix_superadmin_all"
on public.humor_flavor_mix
for all
to authenticated
using (private.is_superadmin())
with check (private.is_superadmin());

drop policy if exists "llm_providers_superadmin_all" on public.llm_providers;
create policy "llm_providers_superadmin_all"
on public.llm_providers
for all
to authenticated
using (private.is_superadmin())
with check (private.is_superadmin());

drop policy if exists "llm_models_superadmin_all" on public.llm_models;
create policy "llm_models_superadmin_all"
on public.llm_models
for all
to authenticated
using (private.is_superadmin())
with check (private.is_superadmin());

drop policy if exists "llm_prompt_chains_superadmin_all" on public.llm_prompt_chains;
create policy "llm_prompt_chains_superadmin_all"
on public.llm_prompt_chains
for all
to authenticated
using (private.is_superadmin())
with check (private.is_superadmin());

do $$
begin
  if to_regclass('public.allowed_domains') is not null then
    execute 'drop policy if exists "allowed_domains_superadmin_all" on public.allowed_domains';
    execute $policy$
      create policy "allowed_domains_superadmin_all"
      on public.allowed_domains
      for all
      to authenticated
      using (private.is_superadmin())
      with check (private.is_superadmin())
    $policy$;
  end if;
end
$$;

drop policy if exists "allowed_signup_domains_superadmin_all" on public.allowed_signup_domains;
create policy "allowed_signup_domains_superadmin_all"
on public.allowed_signup_domains
for all
to authenticated
using (private.is_superadmin())
with check (private.is_superadmin());

drop policy if exists "whitelisted_emails_superadmin_all" on public.whitelisted_emails;
create policy "whitelisted_emails_superadmin_all"
on public.whitelisted_emails
for all
to authenticated
using (private.is_superadmin())
with check (private.is_superadmin());

drop policy if exists "images_superadmin_all" on public.images;
create policy "images_superadmin_all"
on public.images
for all
to authenticated
using (private.is_superadmin())
with check (private.is_superadmin());

drop policy if exists "captions_superadmin_all" on public.captions;
create policy "captions_superadmin_all"
on public.captions
for all
to authenticated
using (private.is_superadmin())
with check (private.is_superadmin());

drop policy if exists "caption_votes_superadmin_all" on public.caption_votes;
create policy "caption_votes_superadmin_all"
on public.caption_votes
for all
to authenticated
using (private.is_superadmin())
with check (private.is_superadmin());

drop policy if exists "images_bucket_superadmin_select" on storage.objects;
create policy "images_bucket_superadmin_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'images'
  and private.is_superadmin()
);

drop policy if exists "images_bucket_superadmin_insert" on storage.objects;
create policy "images_bucket_superadmin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'images'
  and private.is_superadmin()
);

drop policy if exists "images_bucket_superadmin_update" on storage.objects;
create policy "images_bucket_superadmin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'images'
  and private.is_superadmin()
)
with check (
  bucket_id = 'images'
  and private.is_superadmin()
);

drop policy if exists "images_bucket_superadmin_delete" on storage.objects;
create policy "images_bucket_superadmin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'images'
  and private.is_superadmin()
);
