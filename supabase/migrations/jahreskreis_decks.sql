-- Tempora (Arbeitstitel Jahreskreis): Spieler und Decks.
-- Vorerst ohne Anmeldung: Decks gehören einem Spielernamen.
create table public.jahreskreis_players (
  name text primary key check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.jahreskreis_decks (
  id uuid primary key default gen_random_uuid(),
  owner text not null references public.jahreskreis_players(name) on update cascade on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  cards text[] not null default '{}',
  starter_key text check (starter_key in ('spring','summer','autumn','winter')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jahreskreis_decks_owner_idx on public.jahreskreis_decks(owner);

create or replace function public.jahreskreis_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger jahreskreis_decks_touch
before update on public.jahreskreis_decks
for each row execute function public.jahreskreis_touch_updated_at();

alter table public.jahreskreis_players enable row level security;
alter table public.jahreskreis_decks enable row level security;

create policy "anyone can read" on public.jahreskreis_players for select to anon using (true);
create policy "anyone can add" on public.jahreskreis_players for insert to anon with check (true);

create policy "anyone can read" on public.jahreskreis_decks for select to anon using (true);
create policy "anyone can add" on public.jahreskreis_decks for insert to anon with check (true);
create policy "anyone can change" on public.jahreskreis_decks for update to anon using (true) with check (true);
create policy "anyone can delete" on public.jahreskreis_decks for delete to anon using (true);

insert into public.jahreskreis_players(name) values ('lukas');

-- Fünftes Startdeck „4 Jahreszeiten“
alter table public.jahreskreis_decks drop constraint if exists jahreskreis_decks_starter_key_check;
alter table public.jahreskreis_decks add constraint jahreskreis_decks_starter_key_check check (starter_key in ('spring','summer','autumn','winter','mixed'));
