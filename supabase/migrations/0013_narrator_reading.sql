-- Lettura del narratore: durante "reading" solo il narratore vede le card, complete di frase, e può
-- correggere maiuscole, accenti e refusi delle balle. Poi "Mostra a tutti per il voto" (advance) le manda a tutti.
-- La correzione deve restare vicina al testo del giocatore (stesso confronto di parts_close, 0011), non può
-- avvicinarsi alla vera o a un'altra balla, e la vera non si tocca.

alter table public.round_options add column original_parts text[];

create function public.edit_option(p_code text, p_player uuid, p_secret uuid, p_option bigint, p_parts text[]) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_o public.round_options; v_f public.facts;
        v_parts text[] := '{}'; v_x text; v_t text; v_orig text[];
begin
  if v_r.phase <> 'reading' then raise exception 'bad_phase'; end if;
  if v_r.narrator_id <> v_me.id then raise exception 'not_narrator'; end if;
  select * into v_o from public.round_options where id = p_option and round_id = v_r.id;
  if v_o.id is null then raise exception 'bad_option'; end if;
  if v_o.is_true then raise exception 'edit_true'; end if;
  if p_parts is null or cardinality(p_parts) <> cardinality(v_o.parts) then raise exception 'bad_parts'; end if;
  foreach v_x in array p_parts loop
    v_t := btrim(regexp_replace(coalesce(v_x, ''), '\s+', ' ', 'g'));
    if char_length(v_t) not between 1 and 80 or private.norm(v_t) = '' then raise exception 'bad_text'; end if;
    v_parts := array_append(v_parts, v_t);
  end loop;
  v_orig := coalesce(v_o.original_parts, v_o.parts);
  if not private.parts_close(v_parts, v_orig) then raise exception 'edit_too_far'; end if;
  select * into v_f from public.facts where id = v_r.fact_id;
  if private.parts_close(v_parts, v_f.risposte) then raise exception 'too_close'; end if;
  if exists (select 1 from public.round_options o where o.round_id = v_r.id and o.id <> v_o.id and not o.is_true
                and private.parts_close(o.parts, v_parts)) then raise exception 'duplicate'; end if;
  update public.round_options
     set parts = v_parts, normalized = private.norm_parts(v_parts),
         original_parts = case when v_parts = v_orig then null else v_orig end
   where id = v_o.id;
end $$;

revoke all on function public.edit_option(text, uuid, uuid, bigint, text[]) from public, anon, authenticated;
grant execute on function public.edit_option(text, uuid, uuid, bigint, text[]) to anon, authenticated;

create or replace function public.get_state(p_code text, p_player uuid, p_secret uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare
  v_me public.players := private.auth(p_code, p_player, p_secret);
  v_room public.rooms; v_r public.rounds; v_f public.facts; v_rank int; v_round jsonb; v_n int;
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
      'debate_by', v_r.debate_by, 'debate_until', v_r.debate_until);

    if v_r.fact_id is not null then
      select * into v_f from public.facts where id = v_r.fact_id;
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
                'seat', p.seat_order, 'connected', p.connected, 'debate_used', p.debate_used) order by p.seat_order, p.created_at)
                from public.players p where p.room_code = v_room.code), '[]'));
end $$;
