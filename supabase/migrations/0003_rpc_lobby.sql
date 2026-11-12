-- RPC di lobby. Id e segreto del giocatore li genera il server e li restituisce una volta sola.

create function public.create_room(p_name text, p_settings jsonb default null) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_code text; v_p public.players; v_s uuid; v_set jsonb; v_name text := btrim(coalesce(p_name,''));
begin
  if char_length(v_name) not between 1 and 20 then raise exception 'bad_name'; end if;
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

create function public.join_room(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_code text := upper(btrim(p_code)); v_room public.rooms; v_p public.players; v_s uuid;
        v_name text := btrim(coalesce(p_name,''));
begin
  if char_length(v_name) not between 1 and 20 then raise exception 'bad_name'; end if;
  select * into v_room from public.rooms where code = v_code for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.phase <> 'lobby' then raise exception 'game_started'; end if;
  if (select count(*) from public.players where room_code = v_code) >= 12 then raise exception 'room_full'; end if;
  if exists (select 1 from public.players where room_code = v_code and lower(name) = lower(v_name)) then
    raise exception 'name_taken';
  end if;
  insert into public.players (room_code, name, seat_order)
    values (v_code, v_name, (select coalesce(max(seat_order), -1) + 1 from public.players where room_code = v_code))
    returning * into v_p;
  insert into public.player_secrets (player_id) values (v_p.id) returning secret into v_s;
  return jsonb_build_object('code', v_code, 'player_id', v_p.id, 'secret', v_s);
end $$;

create function public.update_settings(p_code text, p_player uuid, p_secret uuid, p_settings jsonb) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret); v_room public.rooms;
begin
  select * into v_room from public.rooms where code = v_me.room_code for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  if v_room.phase <> 'lobby' then raise exception 'game_started'; end if;
  update public.rooms set settings = jsonb_build_object(
    'giri', least(3, greatest(1, coalesce((p_settings->>'giri')::int, (settings->>'giri')::int))),
    'dark', coalesce((p_settings->>'dark')::boolean, (settings->>'dark')::boolean),
    'estremi', coalesce((p_settings->>'estremi')::boolean, (settings->>'estremi')::boolean))
   where code = v_me.room_code;
end $$;

create function public.leave_room(p_code text, p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret); v_room public.rooms; v_next uuid;
begin
  select * into v_room from public.rooms where code = v_me.room_code for update;
  if v_room.phase = 'lobby' then
    delete from public.players where id = v_me.id;
  else
    update public.players set connected = false where id = v_me.id;
  end if;
  if v_room.host_player_id = v_me.id then
    select id into v_next from public.players
     where room_code = v_room.code and id <> v_me.id and connected
     order by seat_order, created_at limit 1;
    if v_next is null then
      if v_room.phase = 'lobby' then delete from public.rooms where code = v_room.code; end if;
    else
      update public.rooms set host_player_id = v_next where code = v_room.code;
    end if;
  end if;
end $$;

create function public.start_game(p_code text, p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret); v_room public.rooms;
begin
  select * into v_room from public.rooms where code = v_me.room_code for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  if v_room.phase <> 'lobby' then raise exception 'game_started'; end if;
  if (select count(*) from public.players where room_code = v_room.code) < 3 then
    raise exception 'too_few_players';
  end if;
  update public.rooms set phase = 'playing' where code = v_room.code;
  perform private.start_round(v_room.code, 0);
end $$;
