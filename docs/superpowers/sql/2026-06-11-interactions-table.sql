-- Phase 1: interactions table + one-time backfill from contacts.data.interactions[]
-- Run once in the Supabase SQL editor for the project.

create table if not exists public.interactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     text        not null,
  contact_id  uuid        not null,
  type        text        not null,
  content     text        not null default '',
  due_at      timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists interactions_user_contact_idx on public.interactions (user_id, contact_id);
create index if not exists interactions_user_due_idx     on public.interactions (user_id, due_at);

-- One-time backfill: expand each contact's embedded interactions into rows.
-- due_at is left null for historical rows (no reliable structured date in the old blob).
insert into public.interactions (id, user_id, contact_id, type, content, due_at, created_at)
select
  coalesce(nullif(i->>'id','')::uuid, gen_random_uuid()),
  c.user_id,
  c.id,
  i->>'type',
  coalesce(i->>'content', ''),
  null,
  coalesce((i->>'date')::timestamptz, now())
from public.contacts c
cross join lateral jsonb_array_elements(coalesce(c.data->'interactions', '[]'::jsonb)) as i
on conflict (id) do nothing;
