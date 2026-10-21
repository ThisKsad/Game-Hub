-- Tempora: Statistik beendeter Partien (abgebrochene Partien werden nicht gespeichert).
create table public.jahreskreis_games (
  id uuid primary key default gen_random_uuid(),
  player text not null,
  finished_at timestamptz not null default now(),
  result text not null check (result in ('win','loss','tie')),
  rounds integer not null,
  year integer not null,
  end_season text not null,
  went_first boolean not null,
  difficulty text not null,
  my_deck_name text,
  my_deck_cards text[] not null default '{}',
  ai_deck text not null,
  my_life integer not null,
  ai_life integer not null,
  my_cards_played text[] not null default '{}',
  ai_cards_played text[] not null default '{}',
  duration_seconds integer,
  settings jsonb not null default '{}'::jsonb,
  version text
);
create index jahreskreis_games_player_idx on public.jahreskreis_games(player, finished_at desc);
alter table public.jahreskreis_games enable row level security;
create policy "anyone can read" on public.jahreskreis_games for select to anon using (true);
create policy "anyone can add" on public.jahreskreis_games for insert to anon with check (true);
