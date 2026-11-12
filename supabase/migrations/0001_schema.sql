-- Balle credibili, fase 1. Eseguire nel SQL Editor di Supabase i file 0001..0005 in ordine.
create extension if not exists fuzzystrmatch with schema extensions;
create schema if not exists private; -- helper interni: non esposti dall'API

-- Dati di gioco pubblici (letti dai client, anche via Realtime) -------------------
create table public.rooms (
  code text primary key check (code ~ '^[A-Z]{4}$'),
  host_player_id uuid,
  settings jsonb not null default '{"giri":1,"dark":false,"estremi":false}',
  phase text not null default 'lobby' check (phase in ('lobby','playing','finished')),
  round_index int not null default 0,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.rooms(code) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  score int not null default 0,
  seat_order int not null,
  connected boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index players_room_name on public.players (room_code, lower(name));
alter table public.players replica identity full; -- DELETE filtrabili per room_code in Realtime

-- Il segreto del giocatore sta in una tabella a parte, mai leggibile dai client.
create table public.player_secrets (
  player_id uuid primary key references public.players(id) on delete cascade,
  secret uuid not null default gen_random_uuid()
);

create table public.facts (
  id text primary key,
  categoria text not null,
  frase text not null,
  risposte text[] not null check (array_length(risposte,1) between 1 and 2),
  spiegazione text not null default '',
  stato text not null default ''
);

-- Parametro modificabile: fact_filter = 'all' (default) oppure 'verified'.
create table public.app_config (key text primary key, value text not null);
insert into public.app_config values ('fact_filter', 'all');

create table public.rounds (
  id bigint generated always as identity primary key,
  room_code text not null references public.rooms(code) on delete cascade,
  idx int not null,
  narrator_id uuid not null references public.players(id) on delete cascade,
  category text,
  jolly boolean not null default false,
  fact_id text references public.facts(id),
  phase text not null default 'picking'
    check (phase in ('picking','writing','reading','voting','reveal','explain','scores')),
  deadline_at timestamptz,
  bluff_count int not null default 0, -- contatori: servono a far scattare Realtime
  vote_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (room_code, idx)
);

-- Dati segreti (nessun accesso diretto dai client) --------------------------------
create table public.bluffs (
  round_id bigint not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  parts text[] not null,
  normalized text not null,
  created_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

create table public.round_options (
  id bigint generated always as identity primary key,
  round_id bigint not null references public.rounds(id) on delete cascade,
  parts text[] not null,
  normalized text not null,
  is_true boolean not null,
  author_ids uuid[] not null default '{}',
  position int
);

create table public.votes (
  round_id bigint not null references public.rounds(id) on delete cascade,
  voter_id uuid not null references public.players(id) on delete cascade,
  option_id bigint not null references public.round_options(id) on delete cascade,
  primary key (round_id, voter_id)
);

create table public.round_points (
  round_id bigint not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  points int not null,
  primary key (round_id, player_id)
);

-- Sicurezza: RLS ovunque, i client leggono solo rooms/players/rounds ---------------
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.player_secrets enable row level security;
alter table public.facts enable row level security;
alter table public.app_config enable row level security;
alter table public.rounds enable row level security;
alter table public.bluffs enable row level security;
alter table public.round_options enable row level security;
alter table public.votes enable row level security;
alter table public.round_points enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

grant select on public.rooms, public.players, public.rounds to anon, authenticated;
create policy rooms_read on public.rooms for select to anon, authenticated using (true);
create policy players_read on public.players for select to anon, authenticated using (true);
create policy rounds_read on public.rounds for select to anon, authenticated using (true);

alter publication supabase_realtime add table public.rooms, public.players, public.rounds;
