-- Profile memory for the chat agent: one evolving "about you" blob per user.
-- The chat injects `profile` into every system prompt and rewrites it in the
-- background after each turn. The app degrades gracefully if this table is
-- missing (memory simply reads/writes as empty), so applying this is optional
-- but recommended for the "it remembers me" experience.
create table if not exists user_context (
  user_id    text primary key,
  profile    text not null default '',
  updated_at timestamptz not null default now()
);
