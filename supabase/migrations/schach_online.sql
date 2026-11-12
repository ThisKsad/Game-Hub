-- Online-Schach (Supabase-Projekt "Ultimate Hunt")
-- schach_rooms: öffentlicher Spielstand (Realtime), schach_seats: Platz-Schlüssel, nur für die Server-Funktion
create table public.schach_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  state jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.schach_seats (
  room_id uuid not null references public.schach_rooms(id) on delete cascade,
  seat smallint not null,
  token text not null,
  primary key (room_id, seat)
);
alter table public.schach_rooms enable row level security;
alter table public.schach_seats enable row level security;
create policy "schach rooms readable" on public.schach_rooms for select to anon, authenticated using (true);
create index schach_rooms_updated_idx on public.schach_rooms (updated_at);
alter publication supabase_realtime add table public.schach_rooms;

create or replace function public.schach_save(p_room uuid, p_version integer, p_state jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  update public.schach_rooms set state = p_state, version = version + 1, updated_at = now()
   where id = p_room and version = p_version
   returning version into v;
  if v is null then raise exception 'schach_conflict'; end if;
  return v;
end $$;
revoke all on function public.schach_save(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.schach_save(uuid, integer, jsonb) to service_role;
