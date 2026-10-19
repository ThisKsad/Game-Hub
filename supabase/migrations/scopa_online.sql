-- Online-Scopa (Supabase-Projekt "Ultimate Hunt")
-- scopa_rooms: öffentlicher Spielstand ohne verdeckte Karten (Realtime)
-- scopa_hands: Handkarten, nur über scopa_my_hand mit Platz-Schlüssel lesbar
-- scopa_secrets: Stapel und gesammelte Karten, nur für die Server-Funktion
create table public.scopa_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  state jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.scopa_hands (
  room_id uuid not null references public.scopa_rooms(id) on delete cascade,
  seat smallint not null,
  token text not null,
  cards jsonb not null default '[]'::jsonb,
  primary key (room_id, seat)
);
create table public.scopa_secrets (
  room_id uuid primary key references public.scopa_rooms(id) on delete cascade,
  data jsonb not null
);
alter table public.scopa_rooms enable row level security;
alter table public.scopa_hands enable row level security;
alter table public.scopa_secrets enable row level security;
create policy "scopa rooms readable" on public.scopa_rooms for select to anon, authenticated using (true);
create policy "scopa own hand" on public.scopa_hands for select to anon, authenticated
  using (token = coalesce((current_setting('request.headers', true)::json ->> 'x-seat-token'), ''));
create index scopa_rooms_updated_idx on public.scopa_rooms (updated_at);
alter publication supabase_realtime add table public.scopa_rooms;

create or replace function public.scopa_my_hand(p_room uuid, p_token text)
returns table(seat smallint, cards jsonb)
language sql stable security definer set search_path = public as $$
  select h.seat, h.cards from public.scopa_hands h
  where h.room_id = p_room and h.token = p_token and length(p_token) >= 24;
$$;
revoke all on function public.scopa_my_hand(uuid, text) from public;
grant execute on function public.scopa_my_hand(uuid, text) to anon, authenticated, service_role;

create or replace function public.scopa_save(p_room uuid, p_version integer, p_state jsonb, p_secrets jsonb, p_hands jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  update public.scopa_rooms set state = p_state, version = version + 1, updated_at = now()
   where id = p_room and version = p_version
   returning version into v;
  if v is null then raise exception 'scopa_conflict'; end if;
  insert into public.scopa_secrets(room_id, data) values (p_room, p_secrets)
    on conflict (room_id) do update set data = excluded.data;
  insert into public.scopa_hands(room_id, seat, token, cards)
    select p_room, (h->>'seat')::smallint, h->>'token', coalesce(h->'cards', '[]'::jsonb)
      from jsonb_array_elements(p_hands) h
    on conflict (room_id, seat) do update set cards = excluded.cards, token = excluded.token;
  return v;
end $$;
revoke all on function public.scopa_save(uuid, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.scopa_save(uuid, integer, jsonb, jsonb, jsonb) to service_role;
