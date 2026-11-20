-- Poteri del direttore (chi ha creato la stanza, o chi l'ha ereditata).
-- kick_player: in lobby il giocatore viene cancellato e può rientrare col codice. A partita iniziata il suo
-- posto (con i punti) resta, ma il segreto viene buttato: il suo telefono torna alla home e rientrando con lo
-- stesso nome riprende quel posto. delete_room: cancella la stanza per tutti.

alter table public.players add column kicked boolean not null default false;

create function public.kick_player(p_code text, p_player uuid, p_secret uuid, p_target uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret); v_room public.rooms;
begin
  perform private.lock_round(v_me.room_code);
  select * into v_room from public.rooms where code = v_me.room_code for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  if p_target = v_me.id then raise exception 'kick_self'; end if;
  if not exists (select 1 from public.players where id = p_target and room_code = v_room.code) then raise exception 'bad_player'; end if;
  if v_room.phase = 'lobby' then
    delete from public.players where id = p_target;
  else
    delete from public.player_secrets where player_id = p_target;
    update public.players set kicked = true, connected = false where id = p_target;
  end if;
end $$;
revoke all on function public.kick_player(text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.kick_player(text, uuid, uuid, uuid) to anon, authenticated;

create function public.delete_room(p_code text, p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret); v_room public.rooms;
begin
  select * into v_room from public.rooms where code = v_me.room_code for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  delete from public.rooms where code = v_room.code;
end $$;
revoke all on function public.delete_room(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_room(text, uuid, uuid) to anon, authenticated;

create or replace function public.join_room(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_code text := upper(btrim(p_code)); v_room public.rooms; v_p public.players; v_s uuid;
        v_name text := btrim(coalesce(p_name,''));
begin
  if char_length(v_name) not between 1 and 20 then raise exception 'bad_name'; end if;
  select * into v_room from public.rooms where code = v_code for update;
  if not found then raise exception 'room_not_found'; end if;
  -- a partita iniziata si rientra solo nel posto di un giocatore tolto dal direttore, con lo stesso nome
  if v_room.phase <> 'lobby' then
    select * into v_p from public.players where room_code = v_code and kicked and lower(name) = lower(v_name);
    if v_p.id is null then raise exception 'game_started'; end if;
    insert into public.player_secrets (player_id) values (v_p.id) returning secret into v_s;
    update public.players set kicked = false, connected = true where id = v_p.id;
    insert into public.player_presence (player_id, last_seen) values (v_p.id, now())
      on conflict (player_id) do update set last_seen = excluded.last_seen;
    return jsonb_build_object('code', v_code, 'player_id', v_p.id, 'secret', v_s);
  end if;
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
   where room_code = v_r.room_code and id <> v_r.narrator_id and not kicked and (connected or v_r.deadline_at is null);
  if v_n >= v_need then perform private.finish_writing(v_r.id); end if;
end $$;

create or replace function public.get_state(p_code text, p_player uuid, p_secret uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare
  v_me public.players := private.auth(p_code, p_player, p_secret);
  v_room public.rooms; v_r public.rounds; v_f public.facts; v_p public.round_pending; v_rank int; v_round jsonb; v_n int;
begin
  select * into v_room from public.rooms where code = v_me.room_code;
  select * into v_r from public.rounds where room_code = v_room.code order by idx desc limit 1;
  select count(*) into v_n from public.players where room_code = v_room.code;

  if v_r.id is not null then
    v_rank := array_position(array['picking','writing','reading','voting','reveal','explain','scores'], v_r.phase);
    v_round := jsonb_build_object(
      'id', v_r.id, 'idx', v_r.idx, 'total', (v_room.settings->>'giri')::int * v_n,
      'narrator_id', v_r.narrator_id, 'phase', v_r.phase, 'category', v_r.category,
      'jolly', v_r.jolly, 'deadline_at', v_r.deadline_at,
      'bluff_count', v_r.bluff_count, 'vote_count', v_r.vote_count,
      'debate_by', v_r.debate_by, 'debate_until', v_r.debate_until,
      'custom', v_r.frase_custom is not null, 'write_secs', v_r.write_secs,
      'pending', exists (select 1 from public.round_pending p where p.round_id = v_r.id));

    -- Frase pronta ma non ancora pubblicata: solo il narratore la vede intera, divisa in parole da censurare.
    if v_r.phase = 'picking' and v_me.id = v_r.narrator_id then
      select * into v_p from public.round_pending where round_id = v_r.id;
      if v_p.round_id is not null then
        select * into v_f from public.facts where id = v_p.fact_id;
        v_round := v_round || jsonb_build_object('pending_category', v_p.category, 'tokens', private.fact_tokens(v_f));
        v_f := null;
      end if;
    end if;

    if v_r.fact_id is not null then
      select * into v_f from public.facts where id = v_r.fact_id;
      if v_r.frase_custom is not null then v_f.frase := v_r.frase_custom; v_f.risposte := v_r.truth_custom; end if;
      v_round := v_round || jsonb_build_object('frase', v_f.frase, 'holes', cardinality(v_f.risposte));
      if v_me.id = v_r.narrator_id or v_rank >= 5 then
        v_round := v_round || jsonb_build_object('truth', to_jsonb(v_f.risposte));
      end if;
      if v_rank >= 6 then
        v_round := v_round || jsonb_build_object('spiegazione', v_f.spiegazione);
      end if;
    end if;

    if v_r.phase = 'writing' then
      v_round := v_round || jsonb_build_object(
        'my_bluff', (select to_jsonb(b.parts) from public.bluffs b where b.round_id = v_r.id and b.player_id = v_me.id),
        'submitted', coalesce((select jsonb_agg(b.player_id) from public.bluffs b where b.round_id = v_r.id), '[]'));
    end if;

    -- Lettura: le card complete le vede solo il narratore (con la vera, gli autori e l'originale se corretta);
    -- gli altri sanno solo quante sono. Al voto arrivano a tutti, già corrette.
    if v_r.phase = 'reading' then
      v_round := v_round || jsonb_build_object('option_count',
        (select count(*) from public.round_options o where o.round_id = v_r.id));
      if v_me.id = v_r.narrator_id then
        v_round := v_round || jsonb_build_object('options', coalesce((
          select jsonb_agg(jsonb_build_object('id', o.id, 'parts', o.parts, 'is_true', o.is_true,
                   'authors', to_jsonb(o.author_ids), 'original', to_jsonb(o.original_parts)) order by o.position)
            from public.round_options o where o.round_id = v_r.id), '[]'));
      end if;
    end if;

    if v_r.phase = 'voting' then
      v_round := v_round || jsonb_build_object('options', coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id, 'parts', o.parts, 'mine', v_me.id = any (o.author_ids))
                         order by o.position)
          from public.round_options o where o.round_id = v_r.id), '[]'));
    end if;

    if v_r.phase = 'voting' then
      v_round := v_round || jsonb_build_object(
        'voted', coalesce((select jsonb_agg(v.voter_id) from public.votes v where v.round_id = v_r.id), '[]'),
        'my_vote', (select v.option_id from public.votes v where v.round_id = v_r.id and v.voter_id = v_me.id));
    end if;

    if v_rank >= 5 then
      v_round := v_round || jsonb_build_object(
        'options', coalesce((
          select jsonb_agg(jsonb_build_object('id', o.id, 'parts', o.parts, 'is_true', o.is_true,
                   'authors', to_jsonb(o.author_ids),
                   'voters', coalesce((select jsonb_agg(v.voter_id) from public.votes v where v.option_id = o.id), '[]'))
                   order by o.position)
            from public.round_options o where o.round_id = v_r.id), '[]'),
        'points', coalesce((select jsonb_object_agg(rp.player_id, rp.points)
                              from public.round_points rp where rp.round_id = v_r.id), '{}'));
    end if;
  end if;

  return jsonb_build_object(
    'now', now(), 'me', v_me.id, 'room', to_jsonb(v_room), 'round', v_round,
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'score', p.score,
                'seat', p.seat_order, 'connected', p.connected, 'debate_used', p.debate_used, 'kicked', p.kicked) order by p.seat_order, p.created_at)
                from public.players p where p.room_code = v_room.code), '[]'));
end $$;
