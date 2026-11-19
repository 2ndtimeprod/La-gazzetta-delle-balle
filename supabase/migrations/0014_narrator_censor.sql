-- Buco scelto dal narratore. A tamburo fermo il narratore vede la frase intera (solo lui) e decide:
-- tiene il buco dell'archivio oppure tocca le parole da censurare, anche tutte tranne una.
-- Le parole censurate di fila formano un buco (massimo 3); la punteggiatura tra due parole censurate
-- sparisce con loro, quella ai bordi resta visibile. Poi il round va avanti come sempre.

alter table public.rounds add column frase_custom text, add column truth_custom text[],
  add column write_secs int not null default 60;

-- La frase intera divisa in parole: t testo, sp spazio prima, h buco dell'archivio (0 = no), w parola censurabile.
create function private.fact_tokens(f public.facts) returns jsonb language plpgsql immutable as $$
declare v_pieces text[] := string_to_array(f.frase, '____'); v_full text := ''; v_hs int[] := '{}'; v_he int[] := '{}';
        v_out jsonb := '[]'; v_word constant text := '[A-Za-z0-9À-ÖØ-öø-ÿ''’-]';
        i int := 1; j int; k int; n int; c text; v_kind boolean; v_sp boolean := false; v_h int;
begin
  for k in 1..cardinality(v_pieces) loop
    v_full := v_full || v_pieces[k];
    if k < cardinality(v_pieces) then
      v_hs := array_append(v_hs, length(v_full) + 1);
      v_full := v_full || coalesce(f.risposte[k], '');
      v_he := array_append(v_he, length(v_full));
    end if;
  end loop;
  n := length(v_full);
  while i <= n loop
    c := substr(v_full, i, 1);
    if c ~ '\s' then v_sp := true; i := i + 1; continue; end if;
    v_kind := c ~ v_word; j := i;
    while j < n and substr(v_full, j + 1, 1) !~ '\s' and (substr(v_full, j + 1, 1) ~ v_word) = v_kind loop j := j + 1; end loop;
    v_h := 0;
    for k in 1..coalesce(cardinality(v_hs), 0) loop
      if i between v_hs[k] and v_he[k] then v_h := k; end if;
    end loop;
    v_out := v_out || jsonb_build_array(jsonb_build_object('t', substr(v_full, i, j - i + 1), 'sp', v_sp, 'h', v_h, 'w', v_kind));
    v_sp := false; i := j + 1;
  end loop;
  return v_out;
end $$;

-- Costruisce frase con buchi e risposte dalle parole censurate (indici di fact_tokens, da 0).
create function private.censor(f public.facts, p_censor int[]) returns jsonb language plpgsql immutable as $$
declare v_tok jsonb := private.fact_tokens(f); n int := jsonb_array_length(v_tok);
        i int; j int; v_t jsonb; v_in boolean; v_run boolean := false; v_cur text; v_frase text := ''; v_parts text[] := '{}';
        v_pc boolean; v_nc boolean; v_sp text; v_x int;
begin
  if p_censor is null or cardinality(p_censor) = 0 then raise exception 'bad_censor'; end if;
  foreach v_x in array p_censor loop
    if v_x < 0 or v_x >= n or not (v_tok->v_x->>'w')::boolean then raise exception 'bad_censor'; end if;
  end loop;
  if not exists (select 1 from generate_series(0, n - 1) g
                  where (v_tok->g->>'w')::boolean and not (g = any (p_censor))) then raise exception 'nothing_kept'; end if;
  for i in 0..n - 1 loop
    v_t := v_tok->i;
    if (v_t->>'w')::boolean then v_in := i = any (p_censor);
    else
      v_pc := false; v_nc := false;
      j := i - 1; while j >= 0 and not (v_tok->j->>'w')::boolean loop j := j - 1; end loop;
      if j >= 0 then v_pc := j = any (p_censor); end if;
      j := i + 1; while j < n and not (v_tok->j->>'w')::boolean loop j := j + 1; end loop;
      if j < n then v_nc := j = any (p_censor); end if;
      v_in := v_pc and v_nc;
    end if;
    v_sp := case when (v_t->>'sp')::boolean then ' ' else '' end;
    if v_in then
      if v_run then v_cur := v_cur || v_sp || (v_t->>'t');
      else v_frase := v_frase || v_sp || '____'; v_cur := v_t->>'t'; v_run := true; end if;
    else
      if v_run then v_parts := array_append(v_parts, v_cur); v_run := false; end if;
      v_frase := v_frase || v_sp || (v_t->>'t');
    end if;
  end loop;
  if v_run then v_parts := array_append(v_parts, v_cur); end if;
  if cardinality(v_parts) > 3 then raise exception 'too_many_holes'; end if;
  return jsonb_build_object('frase', v_frase, 'parts', to_jsonb(v_parts), 'words', cardinality(p_censor));
end $$;

-- Jolly: la categoria scelta prepara la frase come il tamburo; la scrittura si apre con start_writing.
create or replace function public.pick_category(p_code text, p_player uuid, p_secret uuid, p_category text) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_fact text;
begin
  if v_r.narrator_id <> v_me.id then raise exception 'not_narrator'; end if;
  if v_r.phase <> 'picking' or not v_r.jolly or v_r.category is not null then raise exception 'bad_phase'; end if;
  if not (p_category = any (private.normal_categories())) then raise exception 'bad_category'; end if;
  if exists (select 1 from public.round_pending where round_id = v_r.id) then return; end if;
  v_fact := private.draw_fact(v_r.room_code, p_category);
  if v_fact is null then raise exception 'no_facts'; end if;
  insert into public.round_pending (round_id, category, fact_id) values (v_r.id, p_category, v_fact);
end $$;

-- Pubblica la frase: senza p_censor col buco dell'archivio (anche il direttore), con p_censor col buco del narratore.
-- Più di 6 parole censurate: 90 s invece di 60.
drop function public.start_writing(text, uuid, uuid);
create function public.start_writing(p_code text, p_player uuid, p_secret uuid, p_censor int[] default null) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_host uuid; v_p public.round_pending; v_timer boolean;
        v_f public.facts; v_c jsonb; v_secs int := 60;
begin
  if v_r.phase <> 'picking' then return; end if; -- già aperta da un altro client
  select host_player_id, coalesce((settings->>'timer')::boolean, true) into v_host, v_timer
    from public.rooms where code = v_r.room_code;
  if v_me.id <> v_r.narrator_id and v_me.id <> v_host then raise exception 'not_narrator'; end if;
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
revoke all on function public.start_writing(text, uuid, uuid, int[]) from public, anon, authenticated;
grant execute on function public.start_writing(text, uuid, uuid, int[]) to anon, authenticated;

-- Le funzioni che leggono frase e risposte dal fatto: se il round è censurato dal narratore valgono le sue.
create or replace function private.finish_writing(p_round bigint) returns void language plpgsql as $$
declare v_fact public.facts; v_nb int; v_cf text; v_ct text[];
begin
  select f.* into v_fact from public.facts f join public.rounds r on r.fact_id = f.id where r.id = p_round;
  select r.frase_custom, r.truth_custom into v_cf, v_ct from public.rounds r where r.id = p_round;
  if v_cf is not null then v_fact.risposte := v_ct; end if;
  insert into public.round_options (round_id, parts, normalized, is_true)
    values (p_round, v_fact.risposte, private.norm_parts(v_fact.risposte), true);
  insert into public.round_options (round_id, parts, normalized, is_true, author_ids)
    select distinct on (normalized) p_round, parts, normalized, false,
           array_agg(player_id) over (partition by normalized)
      from public.bluffs where round_id = p_round order by normalized, created_at;
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
   where room_code = v_r.room_code and connected and id <> v_r.narrator_id;
  if v_n >= v_need then perform private.finish_writing(v_r.id); end if;
end $$;

create or replace function public.edit_option(p_code text, p_player uuid, p_secret uuid, p_option bigint, p_parts text[]) returns void
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
    if char_length(v_t) not between 1 and (case when v_r.frase_custom is null then 80 else 200 end) or private.norm(v_t) = '' then raise exception 'bad_text'; end if;
    v_parts := array_append(v_parts, v_t);
  end loop;
  v_orig := coalesce(v_o.original_parts, v_o.parts);
  if not private.parts_close(v_parts, v_orig) then raise exception 'edit_too_far'; end if;
  select * into v_f from public.facts where id = v_r.fact_id;
  if v_r.frase_custom is not null then v_f.frase := v_r.frase_custom; v_f.risposte := v_r.truth_custom; end if;
  if private.parts_close(v_parts, v_f.risposte) then raise exception 'too_close'; end if;
  if exists (select 1 from public.round_options o where o.round_id = v_r.id and o.id <> v_o.id and not o.is_true
                and private.parts_close(o.parts, v_parts)) then raise exception 'duplicate'; end if;
  update public.round_options
     set parts = v_parts, normalized = private.norm_parts(v_parts),
         original_parts = case when v_parts = v_orig then null else v_orig end
   where id = v_o.id;
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
                'seat', p.seat_order, 'connected', p.connected, 'debate_used', p.debate_used) order by p.seat_order, p.created_at)
                from public.players p where p.room_code = v_room.code), '[]'));
end $$;
