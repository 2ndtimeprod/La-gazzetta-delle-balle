-- Presenza dei giocatori, pulizia stanze, limite stanze. Eseguire dopo 0005.
-- La presenza sta in una tabella a parte e NON in Realtime: i battiti non devono far ricaricare i client.

create table public.player_presence (
  player_id uuid primary key references public.players(id) on delete cascade,
  last_seen timestamptz not null default now()
);
alter table public.player_presence enable row level security;
revoke all on public.player_presence from anon, authenticated;

-- Elimina le stanze senza attività (nessun battito da 3 ore) e più vecchie di 15 minuti.
create function private.cleanup_rooms() returns void language sql as $$
  delete from public.rooms r
   where r.created_at < now() - interval '15 minutes'
     and not exists (
       select 1 from public.players p left join public.player_presence pp on pp.player_id = p.id
        where p.room_code = r.code and coalesce(pp.last_seen, p.created_at) > now() - interval '3 hours')
$$;

-- Segna disconnessi chi non batte da 40 s, passa l'host, salta i narratori assenti,
-- chiude scrittura/voto se ormai hanno risposto tutti i presenti.
create function private.sweep(p_code text) returns void language plpgsql as $$
declare v_room public.rooms; v_r public.rounds; v_n int; v_need int; v_next uuid; i int := 0;
begin
  v_r := private.lock_round(p_code);               -- stesso ordine di lock delle altre RPC: round, poi stanza
  select * into v_room from public.rooms where code = p_code for update;
  if not found then return; end if;

  update public.players p set connected = false
   where p.room_code = p_code and p.connected
     and coalesce((select pp.last_seen from public.player_presence pp where pp.player_id = p.id), p.created_at)
         < now() - interval '40 seconds';

  if not exists (select 1 from public.players where id = v_room.host_player_id and connected) then
    select id into v_next from public.players where room_code = p_code and connected order by seat_order, created_at limit 1;
    if v_next is not null then update public.rooms set host_player_id = v_next where code = p_code; end if;
  end if;

  if v_room.phase <> 'playing' or v_r.id is null then return; end if;
  -- con un solo presente (gli altri in background) non si fa avanzare nulla
  if (select count(*) from public.players where room_code = p_code and connected) < 2 then return; end if;
  select count(*) into v_n from public.players where room_code = p_code;

  while v_r.phase = 'picking' and i < v_n
        and not exists (select 1 from public.players where id = v_r.narrator_id and connected) loop
    if v_r.idx + 1 >= (v_room.settings->>'giri')::int * v_n then
      update public.rooms set phase = 'finished' where code = p_code;
      return;
    end if;
    perform private.start_round(p_code, v_r.idx + 1);
    v_r := private.lock_round(p_code);
    i := i + 1;
  end loop;

  select count(*) into v_need from public.players where room_code = p_code and connected and id <> v_r.narrator_id;
  if v_need > 0 then
    if v_r.phase = 'writing' and (select count(*) from public.bluffs where round_id = v_r.id) >= v_need then
      perform private.finish_writing(v_r.id);
    elsif v_r.phase = 'voting' and (select count(*) from public.votes where round_id = v_r.id) >= v_need then
      perform private.reveal(v_r.id);
    end if;
  end if;
end $$;

-- Battito: il client lo manda ogni ~15 s e quando la pagina torna in primo piano.
create function public.heartbeat(p_code text, p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
begin
  insert into public.player_presence (player_id, last_seen) values (v_me.id, now())
    on conflict (player_id) do update set last_seen = now();
  if not v_me.connected then update public.players set connected = true where id = v_me.id; end if;
  perform private.sweep(v_me.room_code);
end $$;
revoke all on function public.heartbeat(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.heartbeat(text, uuid, uuid) to anon, authenticated;

-- create_room: pulizia opportunistica e tetto di 300 stanze aperte (freno minimo anti-abuso).
create or replace function public.create_room(p_name text, p_settings jsonb default null) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_code text; v_p public.players; v_s uuid; v_set jsonb; v_name text := btrim(coalesce(p_name,''));
begin
  if char_length(v_name) not between 1 and 20 then raise exception 'bad_name'; end if;
  perform private.cleanup_rooms();
  if (select count(*) from public.rooms) >= 300 then raise exception 'too_many_rooms'; end if;
  v_set := jsonb_build_object(
    'giri', least(3, greatest(1, coalesce((p_settings->>'giri')::int, 1))),
    'dark', coalesce((p_settings->>'dark')::boolean, false),
    'estremi', coalesce((p_settings->>'estremi')::boolean, false));
  loop
    v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random()*24)::int, 1), '')
                 from generate_series(1,4));
    begin
      insert into public.rooms (code, settings) values (v_code, v_set);
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  insert into public.players (room_code, name, seat_order) values (v_code, v_name, 0) returning * into v_p;
  insert into public.player_secrets (player_id) values (v_p.id) returning secret into v_s;
  update public.rooms set host_player_id = v_p.id where code = v_code;
  return jsonb_build_object('code', v_code, 'player_id', v_p.id, 'secret', v_s);
end $$;

-- start_game: chi è già disconnesso nella lobby viene tolto; i 3 giocatori minimi devono essere presenti.
create or replace function public.start_game(p_code text, p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret); v_room public.rooms;
begin
  select * into v_room from public.rooms where code = v_me.room_code for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  if v_room.phase <> 'lobby' then raise exception 'game_started'; end if;
  delete from public.players where room_code = v_room.code and not connected and id <> v_me.id;
  if (select count(*) from public.players where room_code = v_room.code) < 3 then
    raise exception 'too_few_players';
  end if;
  update public.rooms set phase = 'playing' where code = v_room.code;
  perform private.start_round(v_room.code, 0);
end $$;
