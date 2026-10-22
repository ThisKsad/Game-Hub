-- Online-Asse-Raus (Supabase-Projekt "Ultimate Hunt")
-- asse_rooms: öffentlicher Spielstand ohne verdeckte Karten (Realtime)
-- asse_hands: Handkarten, nur über asse_my_hand mit Platz-Schlüssel lesbar
-- asse_secrets: Nachziehstapel, eigene Stapel und fertige Karten, nur für die Server-Funktion
create table public.asse_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  state jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.asse_hands (
  room_id uuid not null references public.asse_rooms(id) on delete cascade,
  seat smallint not null,
  token text not null,
  cards jsonb not null default '[]'::jsonb,
  primary key (room_id, seat)
);
create table public.asse_secrets (
  room_id uuid primary key references public.asse_rooms(id) on delete cascade,
  data jsonb not null
);
alter table public.asse_rooms enable row level security;
alter table public.asse_hands enable row level security;
alter table public.asse_secrets enable row level security;
create policy "asse rooms readable" on public.asse_rooms for select to anon, authenticated using (true);
create index asse_rooms_updated_idx on public.asse_rooms (updated_at);
alter publication supabase_realtime add table public.asse_rooms;

create or replace function public.asse_my_hand(p_room uuid, p_token text)
returns table(seat smallint, cards jsonb)
language sql stable security definer set search_path = public as $$
  select h.seat, h.cards from public.asse_hands h
  where h.room_id = p_room and h.token = p_token and length(p_token) >= 24;
$$;
revoke all on function public.asse_my_hand(uuid, text) from public;
grant execute on function public.asse_my_hand(uuid, text) to anon, authenticated, service_role;

create or replace function public.asse_save(p_room uuid, p_version integer, p_state jsonb, p_secrets jsonb, p_hands jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  update public.asse_rooms set state = p_state, version = version + 1, updated_at = now()
   where id = p_room and version = p_version
   returning version into v;
  if v is null then raise exception 'asse_conflict'; end if;
  insert into public.asse_secrets(room_id, data) values (p_room, p_secrets)
    on conflict (room_id) do update set data = excluded.data;
  insert into public.asse_hands(room_id, seat, token, cards)
    select p_room, (h->>'seat')::smallint, h->>'token', coalesce(h->'cards', '[]'::jsonb)
      from jsonb_array_elements(p_hands) h
    on conflict (room_id, seat) do update set cards = excluded.cards, token = excluded.token;
  return v;
end $$;
revoke all on function public.asse_save(uuid, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.asse_save(uuid, integer, jsonb, jsonb, jsonb) to service_role;
