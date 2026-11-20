-- Senza cronometro la scrittura non si chiude più da sola perché qualcuno risulta offline.
-- Un telefono che si blocca mentre il giocatore pensa smette di mandare battiti: dopo 90 s il giocatore
-- risultava offline e la scrittura si chiudeva senza la sua balla. Ora, a cronometro spento, si aspettano
-- tutti i giocatori (presenti o no); se qualcuno è davvero sparito il narratore chiude a mano.
-- Con il cronometro acceso non cambia nulla.

create or replace function private.sweep(p_code text) returns void language plpgsql as $$
declare v_room public.rooms; v_r public.rounds; v_need int; v_next uuid;
begin
  v_r := private.lock_round(p_code);               -- stesso ordine di lock delle altre RPC: round, poi stanza
  select * into v_room from public.rooms where code = p_code for update;
  if not found then return; end if;

  update public.players p set connected = false
   where p.room_code = p_code and p.connected
     and coalesce((select pp.last_seen from public.player_presence pp where pp.player_id = p.id), p.created_at)
         < now() - interval '90 seconds';

  if not exists (select 1 from public.players where id = v_room.host_player_id and connected) then
    select id into v_next from public.players where room_code = p_code and connected order by seat_order, created_at limit 1;
    if v_next is not null then update public.rooms set host_player_id = v_next where code = p_code; end if;
  end if;

  if v_room.phase <> 'playing' or v_r.id is null then return; end if;
  if (select count(*) from public.players where room_code = p_code and connected) < 2 then return; end if;

  select count(*) into v_need from public.players where room_code = p_code and connected and id <> v_r.narrator_id;
  if v_need > 0 then
    -- senza cronometro chi è offline (telefono bloccato mentre pensa) non viene saltato: si aspetta o chiude il narratore
    if v_r.phase = 'writing' and v_r.deadline_at is not null and (select count(*) from public.bluffs where round_id = v_r.id) >= v_need then
      perform private.finish_writing(v_r.id);
    elsif v_r.phase = 'voting' and (select count(*) from public.votes where round_id = v_r.id) >= v_need then
      perform private.reveal(v_r.id);
    end if;
  end if;
end $$;

create or replace function public.submit_bluff(p_code text, p_player uuid, p_secret uuid, p_parts text[]) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_f public.facts; v_parts text[] := '{}'; v_x text; v_t text;
        v_norm text; v_need int; v_n int;
begin
  if v_r.phase <> 'writing' or now() > v_r.deadline_at + interval '3 seconds' then raise exception 'bad_phase'; end if;
  if v_r.narrator_id = v_me.id then raise exception 'is_narrator'; end if;
  select * into v_f from public.facts where id = v_r.fact_id;
  if v_r.frase_custom is not null then v_f.frase := v_r.frase_custom; v_f.risposte := v_r.truth_custom; end if;
  if p_parts is null or cardinality(p_parts) <> cardinality(v_f.risposte) then raise exception 'bad_parts'; end if;
  foreach v_x in array p_parts loop
    v_t := btrim(regexp_replace(coalesce(v_x, ''), '\s+', ' ', 'g'));
    if char_length(v_t) not between 1 and (case when v_r.frase_custom is null then 80 else 200 end) or private.norm(v_t) = '' then raise exception 'bad_text'; end if;
    v_parts := array_append(v_parts, v_t);
  end loop;
  v_norm := private.norm_parts(v_parts);
  if private.parts_close(v_parts, v_f.risposte) then raise exception 'too_close'; end if;
  -- niente due balle uguali (o quasi) nello stesso round: chi arriva dopo deve cambiarla
  if exists (select 1 from public.bluffs b where b.round_id = v_r.id and b.player_id <> v_me.id
                and private.parts_close(b.parts, v_parts)) then raise exception 'duplicate'; end if;
  insert into public.bluffs (round_id, player_id, parts, normalized) values (v_r.id, v_me.id, v_parts, v_norm)
    on conflict (round_id, player_id) do update set parts = excluded.parts, normalized = excluded.normalized;
  select count(*) into v_n from public.bluffs where round_id = v_r.id;
  update public.rounds set bluff_count = v_n where id = v_r.id;
  select count(*) into v_need from public.players
   where room_code = v_r.room_code and id <> v_r.narrator_id and (connected or v_r.deadline_at is null);
  if v_n >= v_need then perform private.finish_writing(v_r.id); end if;
end $$;
