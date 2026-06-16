-- Run in the Supabase SQL editor (same setup as the contacts table).
create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  title       text not null,
  image_url   text,
  member_ids  jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index goals_user_id_idx on public.goals (user_id);
alter table public.goals enable row level security;
-- No permissive policy: only the service-role key (our server actions) read/write.
