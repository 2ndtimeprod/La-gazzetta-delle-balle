-- Il narratore comanda.
-- 1) Solo il narratore manda avanti il round (scrittura, lettura, voto, rivelazione, articolo, classifica, frase).
--    Il direttore lo sostituisce solo se il narratore risulta offline (private.can_lead).
-- 2) advance riceve la fase da cui si parte (p_from): due tocchi contemporanei non saltano più una fase.
-- 3) Balle in diretta: durante la scrittura il narratore vede ogni balla appena arriva e può correggerla
--    (edit_bluff, bluffs.fix_parts). Se l'autore la riscrive la correzione si perde e la balla è "cambiata".
-- 4) Rivelazione: autori, voti e punti li vede prima solo il narratore; li manda a tutti con advance
--    (rounds.revealed). I punti entrano in classifica solo in quel momento.

alter table public.bluffs add column fix_parts text[], add column changed boolean not null default false;
alter table public.rounds add column live_rev int not null default 0, add column revealed boolean not null default false;

create function private.can_lead(p_r public.rounds, p_me uuid) returns boolean language sql stable as $$
  select p_me = p_r.narrator_id
      or (exists (select 1 from public.rooms ro where ro.code = p_r.room_code and ro.host_player_id = p_me)
          and not exists (select 1 from public.players p where p.id = p_r.narrator_id and p.connected))
$$;

-- Fine voto: calcola i punti del round ma non li somma ancora (lo fa show_points quando il narratore li manda).
create or replace function private.reveal(p_round bigint) returns void language plpgsql as $$
begin
  insert into public.round_points (round_id, player_id, points)
    select p_round, pid, sum(pts) from (
      select v.voter_id as pid, 1 as pts
        from public.votes v join public.round_options o on o.id = v.option_id
       where v.round_id = p_round and o.is_true
      union all
      select a, 1
        from public.votes v join public.round_options o on o.id = v.option_id
        cross join lateral unnest(o.author_ids) as a
       where v.round_id = p_round and not o.is_true
    ) q group by pid;
  update public.rounds set phase = 'reveal', revealed = false where id = p_round;
end $$;

create function private.show_points(p_round bigint) returns void language plpgsql as $$
begin
  update public.players p set score = p.score + rp.points
    from public.round_points rp where rp.round_id = p_round and rp.player_id = p.id;
  update public.rounds set revealed = true where id = p_round;
end $$;

drop function public.advance(text, uuid, uuid);
create function public.advance(p_code text, p_player uuid, p_secret uuid, p_from text default null) returns void
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
      select count(*) into v_n from public.players where room_code = v_room.code;
      if v_r.idx + 1 >= (v_room.settings->>'giri')::int * v_n then
        update public.rooms set phase = 'finished' where code = v_room.code;
      else
        perform private.start_round(v_room.code, v_r.idx + 1);
      end if;
    else raise exception 'bad_phase';
  end case;
end $$;
revoke all on function public.advance(text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.advance(text, uuid, uuid, text) to anon, authenticated;

create function public.edit_bluff(p_code text, p_player uuid, p_secret uuid, p_target uuid, p_parts text[]) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_b public.bluffs; v_f public.facts;
        v_parts text[] := '{}'; v_x text; v_t text;
begin
  if v_r.phase <> 'writing' then raise exception 'bad_phase'; end if;
  if v_r.narrator_id <> v_me.id then raise exception 'not_narrator'; end if;
  select * into v_b from public.bluffs where round_id = v_r.id and player_id = p_target;
  if v_b.player_id is null then raise exception 'bad_option'; end if;
  if p_parts is null or cardinality(p_parts) <> cardinality(v_b.parts) then raise exception 'bad_parts'; end if;
  foreach v_x in array p_parts loop
    v_t := btrim(regexp_replace(coalesce(v_x, ''), '\s+', ' ', 'g'));
    if char_length(v_t) not between 1 and (case when v_r.frase_custom is null then 80 else 200 end) or private.norm(v_t) = '' then
      raise exception 'bad_text';
    end if;
    v_parts := array_append(v_parts, v_t);
  end loop;
  if not private.parts_close(v_parts, v_b.parts) then raise exception 'edit_too_far'; end if;
  select * into v_f from public.facts where id = v_r.fact_id;
  if v_r.frase_custom is not null then v_f.risposte := v_r.truth_custom; end if;
  if private.parts_close(v_parts, v_f.risposte) then raise exception 'too_close'; end if;
  if exists (select 1 from public.bluffs b where b.round_id = v_r.id and b.player_id <> p_target
                and private.parts_close(b.parts, v_parts)) then raise exception 'duplicate'; end if;
  update public.bluffs set fix_parts = case when v_parts = v_b.parts then null else v_parts end, changed = false
   where round_id = v_r.id and player_id = p_target;
end $$;
revoke all on function public.edit_bluff(text, uuid, uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.edit_bluff(text, uuid, uuid, uuid, text[]) to anon, authenticated;


create or replace function public.close_writing(p_code text, p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_host uuid;
begin
  if v_r.phase <> 'writing' then return; end if; -- già chiusa da un altro client
  select host_player_id into v_host from public.rooms where code = v_r.room_code;
  if (v_r.deadline_at is null or now() < v_r.deadline_at) and not private.can_lead(v_r, v_me.id) then
    raise exception 'too_early';
  end if;
  perform private.finish_writing(v_r.id);
end $$;

create or replace function public.start_writing(p_code text, p_player uuid, p_secret uuid, p_censor int[] default null) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_host uuid; v_p public.round_pending; v_timer boolean;
        v_f public.facts; v_c jsonb; v_secs int := 60;
begin
  if v_r.phase <> 'picking' then return; end if; -- già aperta da un altro client
  select host_player_id, coalesce((settings->>'timer')::boolean, true) into v_host, v_timer
    from public.rooms where code = v_r.room_code;
  if not private.can_lead(v_r, v_me.id) then raise exception 'not_narrator'; end if;
  if p_censor is not null and cardinality(p_censor) > 0 and v_me.id <> v_r.narrator_id then raise exception 'not_narrator'; end if;
  select * into v_p from public.round_pending where round_id = v_r.id;
  if v_p.round_id is null then raise exception 'bad_phase'; end if;
  if p_censor is not null and cardinality(p_censor) > 0 then
    select * into v_f from public.facts where id = v_p.fact_id;
    v_c := private.censor(v_f, p_censor);
    if (v_c->>'words')::int > 6 then v_secs := 90; end if;
  end if;
  update public.rounds
     set category = v_p.category, fact_id = v_p.fact_id, phase = 'writing', write_secs = v_secs,
         frase_custom = v_c->>'frase',
         truth_custom = case when v_c is null then null else array(select jsonb_array_elements_text(v_c->'parts')) end,
         deadline_at = case when v_timer then now() + make_interval(secs => v_secs) end
   where id = v_r.id;
  delete from public.round_pending where round_id = v_r.id;
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
  select count(*) into v_n from public.players where room_code = v_room.code;
  if v_r.idx + 1 >= (v_room.settings->>'giri')::int * v_n then
    update public.rooms set phase = 'finished' where code = v_room.code;
  else
    perform private.start_round(v_room.code, v_r.idx + 1);
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
    on conflict (round_id, player_id) do update set parts = excluded.parts, normalized = excluded.normalized, fix_parts = null, changed = true;
  select count(*) into v_n from public.bluffs where round_id = v_r.id;
  update public.rounds set bluff_count = v_n, live_rev = live_rev + 1 where id = v_r.id;
  select count(*) into v_need from public.players
   where room_code = v_r.room_code and id <> v_r.narrator_id and not kicked and (connected or v_r.deadline_at is null);
  if v_n >= v_need then perform private.finish_writing(v_r.id); end if;
end $$;

create or replace function private.finish_writing(p_round bigint) returns void language plpgsql as $$
declare v_fact public.facts; v_nb int; v_cf text; v_ct text[];
begin
  select f.* into v_fact from public.facts f join public.rounds r on r.fact_id = f.id where r.id = p_round;
  select r.frase_custom, r.truth_custom into v_cf, v_ct from public.rounds r where r.id = p_round;
  if v_cf is not null then v_fact.risposte := v_ct; end if;
  insert into public.round_options (round_id, parts, normalized, is_true)
    values (p_round, v_fact.risposte, private.norm_parts(v_fact.risposte), true);
  -- una card per balla (i doppioni sono rifiutati all'invio), con la correzione del narratore se c'è
  insert into public.round_options (round_id, parts, normalized, is_true, author_ids, original_parts)
    select p_round, coalesce(fix_parts, parts), private.norm_parts(coalesce(fix_parts, parts)), false, array[player_id],
           case when fix_parts is not null then parts end
      from public.bluffs where round_id = p_round;
  update public.round_options o set position = s.rn
    from (select id, row_number() over (order by random()) rn
            from public.round_options where round_id = p_round) s
   where o.id = s.id;
  select count(*) into v_nb from public.bluffs where round_id = p_round;
  if v_nb = 0 then
    perform private.reveal(p_round);
  else
    update public.rounds set phase = 'reading' where id = p_round;
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
  select count(*) into v_n from public.players where room_code = v_room.code;

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
