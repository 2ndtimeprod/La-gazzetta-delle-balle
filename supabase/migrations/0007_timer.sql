-- Cronometro attivabile e disattivabile dall'host, anche a partita in corso.
-- settings.timer: true (60 s, default anche se la chiave manca) o false (nessuna scadenza).

create or replace function private.set_fact(p_round bigint, p_cat text) returns void language plpgsql as $$
declare v_code text; v_fact text; v_timer boolean;
begin
  select room_code into v_code from public.rounds where id = p_round;
  v_fact := private.draw_fact(v_code, p_cat);
  if v_fact is null then raise exception 'no_facts'; end if;
  select coalesce((settings->>'timer')::boolean, true) into v_timer from public.rooms where code = v_code;
  update public.rounds
     set category = p_cat, fact_id = v_fact, phase = 'writing',
         deadline_at = case when v_timer then now() + interval '60 seconds' end
   where id = p_round;
end $$;

-- Senza cronometro la scrittura si chiude quando hanno scritto tutti i presenti,
-- oppure a mano: solo narratore o host (con il cronometro, tutti dopo la scadenza).
create or replace function public.close_writing(p_code text, p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_host uuid;
begin
  if v_r.phase <> 'writing' then return; end if; -- già chiusa da un altro client
  select host_player_id into v_host from public.rooms where code = v_r.room_code;
  if (v_r.deadline_at is null or now() < v_r.deadline_at) and v_me.id <> v_r.narrator_id and v_me.id <> v_host then
    raise exception 'too_early';
  end if;
  perform private.finish_writing(v_r.id);
end $$;

-- Solo l'host. Giri, Dark ed Estremi solo in lobby; il cronometro anche durante la partita:
-- se si accende nel mezzo di una scrittura riparte da 60 s, se si spegne la scadenza sparisce.
create or replace function public.update_settings(p_code text, p_player uuid, p_secret uuid, p_settings jsonb) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_room public.rooms; v_timer boolean;
begin
  select * into v_room from public.rooms where code = v_me.room_code for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  if v_room.phase = 'finished' then raise exception 'game_started'; end if;
  if v_room.phase <> 'lobby' and p_settings ?| array['giri', 'dark', 'estremi'] then raise exception 'game_started'; end if;
  v_timer := coalesce((p_settings->>'timer')::boolean, (v_room.settings->>'timer')::boolean, true);
  update public.rooms set settings = jsonb_build_object(
    'giri', least(3, greatest(1, coalesce((p_settings->>'giri')::int, (settings->>'giri')::int))),
    'dark', coalesce((p_settings->>'dark')::boolean, (settings->>'dark')::boolean),
    'estremi', coalesce((p_settings->>'estremi')::boolean, (settings->>'estremi')::boolean),
    'timer', v_timer)
   where code = v_me.room_code;
  if v_room.phase = 'playing' and v_r.phase = 'writing' then
    if not v_timer then
      update public.rounds set deadline_at = null where id = v_r.id;
    elsif v_r.deadline_at is null then
      update public.rounds set deadline_at = now() + interval '60 seconds' where id = v_r.id;
    end if;
  end if;
end $$;
