-- Tamburo visibile a tutti + riposo delle categorie.
-- `spin` scrive la faccia estratta in rounds.drum_face/drum_at (è solo la categoria, non il fatto): gli altri
-- giocatori la ricevono con get_state e fanno girare il tamburo sul loro schermo fino a quella faccia.
-- Una categoria (o il Jolly) uscita non può uscire per le 3 mani successive; se non resta nulla si ignora il riposo.

alter table public.rounds add column drum_face text, add column drum_at timestamptz;

create or replace function public.spin(p_code text, p_player uuid, p_secret uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_dark boolean; v_faces text[] := '{}'; v_c text; v_face text; v_recent text[];
begin
  if v_r.narrator_id <> v_me.id then raise exception 'not_narrator'; end if;
  -- già girato (es. il narratore ha ricaricato la pagina prima dell'apertura): stessa faccia
  select coalesce(v_r.drum_face, (select category from public.round_pending where round_id = v_r.id)) into v_face;
  if v_face is not null and v_r.phase = 'picking' and (v_r.jolly or exists (select 1 from public.round_pending where round_id = v_r.id)) then return jsonb_build_object('face', v_face); end if;
  if v_r.phase <> 'picking' or v_r.category is not null or v_r.jolly then raise exception 'bad_phase'; end if;
  select (settings->>'dark')::boolean into v_dark from public.rooms where code = v_r.room_code;
  -- Una categoria uscita non può rientrare per le 3 mani successive (anche il Jolly, e la categoria scelta con un Jolly).
  select coalesce(array_agg(x), '{}') into v_recent from (
    select unnest(array[r.category, case when r.jolly then 'Jolly' end]) as x
      from (select category, jolly from public.rounds
             where room_code = v_r.room_code and idx < v_r.idx order by idx desc limit 3) r) q
   where x is not null;
  foreach v_c in array private.normal_categories() loop
    if v_c = any(v_recent) then continue; end if;
    if private.draw_fact(v_r.room_code, v_c) is not null then v_faces := array_append(v_faces, v_c); end if;
  end loop;
  if v_dark then
    if not ('Dark/Politically incorrect' = any(v_recent)) and private.draw_fact(v_r.room_code, 'Dark/Politically incorrect') is not null then
      v_faces := array_append(v_faces, 'Dark/Politically incorrect'::text);
    end if;
  elsif not ('Jolly' = any(v_recent)) and random() < 0.4 then -- il Jolly pesa meno (40%)
    v_faces := array_append(v_faces, 'Jolly'::text);
  end if;
  if cardinality(v_faces) = 0 then -- poche categorie con fatti: si ignora il riposo
    foreach v_c in array private.normal_categories() loop
      if private.draw_fact(v_r.room_code, v_c) is not null then v_faces := array_append(v_faces, v_c); end if;
    end loop;
  end if;
  if cardinality(v_faces) = 0 then raise exception 'no_facts'; end if;
  update public.rounds set drum_face = null where id = v_r.id;
  v_face := v_faces[1 + floor(random() * cardinality(v_faces))::int];
  update public.rounds set drum_face = v_face, drum_at = now() where id = v_r.id;
  if v_face = 'Jolly' then
    update public.rounds set jolly = true where id = v_r.id;
    return jsonb_build_object('face', 'Jolly');
  end if;
  insert into public.round_pending (round_id, category, fact_id)
    values (v_r.id, v_face, private.draw_fact(v_r.room_code, v_face));
  return jsonb_build_object('face', v_face);
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
      'jolly', v_r.jolly, 'drum_face', v_r.drum_face, 'drum_at', v_r.drum_at, 'deadline_at', v_r.deadline_at,
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
