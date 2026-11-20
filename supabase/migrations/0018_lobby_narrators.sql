-- Lobby: narratore fisso e ordine dei narratori (solo il direttore, solo in lobby).
-- rooms.fixed_narrator: se c'è, fa il narratore in ogni round, non gioca e non prende punti; la partita dura
-- giri x giocatori che giocano. move_player sposta un giocatore su o giù nell'ordine (seat_order), che è
-- l'ordine in cui passa il ruolo di narratore.

alter table public.rooms add column fixed_narrator uuid references public.players(id) on delete set null;

-- Quanti fanno il narratore a turno (tutti tranne il narratore fisso): un giro = un round a testa.
create function private.rotation_size(p_code text) returns int language sql stable as $$
  select count(*)::int from public.players p join public.rooms r on r.code = p.room_code
   where p.room_code = p_code and p.id is distinct from r.fixed_narrator
$$;

create or replace function private.start_round(p_code text, p_idx int) returns void language plpgsql as $$
declare v_n int; v_narr uuid; v_fixed uuid;
begin
  select fixed_narrator into v_fixed from public.rooms where code = p_code;
  if v_fixed is not null then
    v_narr := v_fixed;
  else
    select count(*) into v_n from public.players where room_code = p_code;
    select id into v_narr from (
      select id, row_number() over (order by seat_order, created_at) rn
        from public.players where room_code = p_code) t
     where rn = (p_idx % v_n) + 1;
  end if;
  insert into public.rounds (room_code, idx, narrator_id) values (p_code, p_idx, v_narr);
  update public.rooms set round_index = p_idx where code = p_code;
end $$;

create function public.set_fixed_narrator(p_code text, p_player uuid, p_secret uuid, p_target uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret); v_room public.rooms;
begin
  select * into v_room from public.rooms where code = v_me.room_code for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  if v_room.phase <> 'lobby' then raise exception 'game_started'; end if;
  if p_target is not null and not exists (select 1 from public.players where id = p_target and room_code = v_room.code) then
    raise exception 'bad_player';
  end if;
  update public.rooms set fixed_narrator = p_target where code = v_room.code;
end $$;
revoke all on function public.set_fixed_narrator(text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_fixed_narrator(text, uuid, uuid, uuid) to anon, authenticated;

-- p_dir: -1 su, +1 giù. Scambia il posto con il vicino; ricompatta i numeri prima (0, 1, 2, ...).
create function public.move_player(p_code text, p_player uuid, p_secret uuid, p_target uuid, p_dir int) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret); v_room public.rooms; v_pos int; v_other uuid;
begin
  select * into v_room from public.rooms where code = v_me.room_code for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  if v_room.phase <> 'lobby' then raise exception 'game_started'; end if;
  update public.players p set seat_order = t.rn - 1
    from (select id, row_number() over (order by seat_order, created_at) rn from public.players where room_code = v_room.code) t
   where p.id = t.id;
  select seat_order into v_pos from public.players where id = p_target and room_code = v_room.code;
  if v_pos is null then raise exception 'bad_player'; end if;
  select id into v_other from public.players where room_code = v_room.code and seat_order = v_pos + sign(p_dir)::int;
  if v_other is null then return; end if;
  update public.players set seat_order = v_pos + sign(p_dir)::int where id = p_target;
  update public.players set seat_order = v_pos where id = v_other;
end $$;
revoke all on function public.move_player(text, uuid, uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.move_player(text, uuid, uuid, uuid, int) to anon, authenticated;

create or replace function public.advance(p_code text, p_player uuid, p_secret uuid, p_from text default null) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_room public.rooms; v_n int; v_step text;
begin
  select * into v_room from public.rooms where code = v_r.room_code for update;
  if not private.can_lead(v_r, v_me.id) then raise exception 'not_allowed'; end if;
  v_step := case when v_r.phase = 'reveal' and v_r.revealed then 'reveal:shown' else v_r.phase end;
  if p_from is not null and p_from <> v_step then return; end if; -- tocco doppio o schermata vecchia: niente
  case v_step
    when 'reading' then update public.rounds set phase = 'voting' where id = v_r.id;
    when 'voting'  then perform private.reveal(v_r.id);
    when 'reveal'  then perform private.show_points(v_r.id);
    when 'reveal:shown' then update public.rounds set phase = 'explain' where id = v_r.id;
    when 'explain' then update public.rounds set phase = 'scores' where id = v_r.id;
    when 'scores'  then
      v_n := private.rotation_size(v_room.code);
      if v_r.idx + 1 >= (v_room.settings->>'giri')::int * v_n then
        update public.rooms set phase = 'finished' where code = v_room.code;
      else
        perform private.start_round(v_room.code, v_r.idx + 1);
      end if;
    else raise exception 'bad_phase';
  end case;
end $$;

create or replace function public.skip_narrator(p_code text, p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_room public.rooms; v_n int;
begin
  select * into v_room from public.rooms where code = v_me.room_code for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  if exists (select 1 from public.players where id = v_r.narrator_id and connected) then raise exception 'narrator_online'; end if;
  if v_room.phase <> 'playing' or v_r.phase <> 'picking' or v_r.category is not null or v_r.jolly then raise exception 'bad_phase'; end if;
  v_n := private.rotation_size(v_room.code);
  if v_r.idx + 1 >= (v_room.settings->>'giri')::int * v_n then
    update public.rooms set phase = 'finished' where code = v_room.code;
  else
    perform private.start_round(v_room.code, v_r.idx + 1);
  end if;
end $$;

create or replace function public.get_state(p_code text, p_player uuid, p_secret uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare
  v_me public.players := private.auth(p_code, p_player, p_secret);
  v_room public.rooms; v_r public.rounds; v_f public.facts; v_p public.round_pending; v_rank int; v_round jsonb; v_n int;
begin
  select * into v_room from public.rooms where code = v_me.room_code;
  select * into v_r from public.rounds where room_code = v_room.code order by idx desc limit 1;
  v_n := private.rotation_size(v_room.code);

  if v_r.id is not null then
    v_rank := array_position(array['picking','writing','reading','voting','reveal','explain','scores'], v_r.phase);
    v_round := jsonb_build_object(
      'id', v_r.id, 'idx', v_r.idx, 'total', (v_room.settings->>'giri')::int * v_n,
      'narrator_id', v_r.narrator_id, 'phase', v_r.phase, 'category', v_r.category,
      'jolly', v_r.jolly, 'deadline_at', v_r.deadline_at,
      'bluff_count', v_r.bluff_count, 'vote_count', v_r.vote_count,
      'debate_by', v_r.debate_by, 'debate_until', v_r.debate_until,
      'custom', v_r.frase_custom is not null, 'revealed', v_r.revealed, 'live_rev', v_r.live_rev, 'write_secs', v_r.write_secs,
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
      if v_me.id = v_r.narrator_id or v_rank >= 6 or (v_rank = 5 and v_r.revealed) then
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
      if v_me.id = v_r.narrator_id then
        v_round := v_round || jsonb_build_object('live', coalesce((
          select jsonb_agg(jsonb_build_object('player_id', b.player_id, 'parts', coalesce(b.fix_parts, b.parts),
                   'original', case when b.fix_parts is not null then to_jsonb(b.parts) end, 'changed', b.changed) order by b.created_at)
            from public.bluffs b where b.round_id = v_r.id), '[]'));
      end if;
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

    if v_rank >= 6 or (v_rank = 5 and (v_r.revealed or v_me.id = v_r.narrator_id)) then
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
