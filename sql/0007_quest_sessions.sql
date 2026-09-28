-- Live quest sessions: when someone heads out on a quest with squadmates,
-- everyone included sees they're on a quest right now.
-- Run this in your Supabase dashboard → SQL Editor.
create table if not exists public.quest_sessions (
  id uuid primary key default gen_random_uuid(),
  quest_id text not null,
  quest_title text not null,
  location_name text not null default '',
  starter_id uuid not null references auth.users(id) on delete cascade,
  member_ids uuid[] not null default '{}',
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

grant select, insert, update on public.quest_sessions to authenticated;
grant all on public.quest_sessions to service_role;

alter table public.quest_sessions enable row level security;

-- You can see a session if you started it or you're one of the members.
create policy "Participants can read quest sessions"
on public.quest_sessions for select
to authenticated
using (starter_id = auth.uid() or auth.uid() = any(member_ids));

create policy "Starters can create quest sessions"
on public.quest_sessions for insert
to authenticated
with check (starter_id = auth.uid());

create policy "Starters can end quest sessions"
on public.quest_sessions for update
to authenticated
using (starter_id = auth.uid())
with check (starter_id = auth.uid());

create index if not exists quest_sessions_active_idx
on public.quest_sessions (started_at desc)
where ended_at is null;
