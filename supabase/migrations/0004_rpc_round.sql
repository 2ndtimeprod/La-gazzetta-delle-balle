-- RPC del round. Ogni azione blocca la riga del round (for update) per evitare doppie azioni.

create function private.lock_round(p_code text) returns public.rounds language sql as $$
  select * from public.rounds where room_code = p_code order by idx desc limit 1 for update
$$;

-- Il narratore gira il tamburo: il server sceglie la faccia (6 categorie + Dark oppure Jolly).
create function public.spin(p_code text, p_player uuid, p_secret uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_dark boolean; v_faces text[] := '{}'; v_c text; v_face text;
begin
  if v_r.narrator_id <> v_me.id then raise exception 'not_narrator'; end if;
  if v_r.phase <> 'picking' or v_r.category is not null or v_r.jolly then raise exception 'bad_phase'; end if;
  select (settings->>'dark')::boolean into v_dark from public.rooms where code = v_r.room_code;
  foreach v_c in array private.normal_categories() loop
    if private.draw_fact(v_r.room_code, v_c) is not null then v_faces := array_append(v_faces, v_c); end if;
  end loop;
  if cardinality(v_faces) = 0 then raise exception 'no_facts'; end if;
  if v_dark then
    if private.draw_fact(v_r.room_code, 'Dark/Politically incorrect') is not null then
      v_faces := array_append(v_faces, 'Dark/Politically incorrect'::text);
    end if;
  else
    v_faces := array_append(v_faces, 'Jolly'::text);
  end if;
  v_face := v_faces[1 + floor(random() * cardinality(v_faces))::int];
  if v_face = 'Jolly' then
    update public.rounds set jolly = true where id = v_r.id;
    return jsonb_build_object('face', 'Jolly');
  end if;
  perform private.set_fact(v_r.id, v_face);
  return jsonb_build_object('face', v_face);
end $$;

-- Dopo un Jolly il narratore sceglie una delle 6 categorie normali.
create function public.pick_category(p_code text, p_player uuid, p_secret uuid, p_category text) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code);
begin
  if v_r.narrator_id <> v_me.id then raise exception 'not_narrator'; end if;
  if v_r.phase <> 'picking' or not v_r.jolly or v_r.category is not null then raise exception 'bad_phase'; end if;
  if not (p_category = any (private.normal_categories())) then raise exception 'bad_category'; end if;
  perform private.set_fact(v_r.id, p_category);
end $$;

-- Invia (o sostituisce) la propria balla. p_parts ha tanti elementi quanti sono i buchi.
create function public.submit_bluff(p_code text, p_player uuid, p_secret uuid, p_parts text[]) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_f public.facts; v_parts text[] := '{}'; v_x text; v_t text;
        v_norm text; v_need int; v_n int;
begin
  if v_r.phase <> 'writing' or now() > v_r.deadline_at + interval '3 seconds' then raise exception 'bad_phase'; end if;
  if v_r.narrator_id = v_me.id then raise exception 'is_narrator'; end if;
  select * into v_f from public.facts where id = v_r.fact_id;
  if p_parts is null or cardinality(p_parts) <> cardinality(v_f.risposte) then raise exception 'bad_parts'; end if;
  foreach v_x in array p_parts loop
    v_t := btrim(regexp_replace(coalesce(v_x, ''), '\s+', ' ', 'g'));
    if char_length(v_t) not between 1 and 80 or private.norm(v_t) = '' then raise exception 'bad_text'; end if;
    v_parts := array_append(v_parts, v_t);
  end loop;
  v_norm := private.norm_parts(v_parts);
  if private.too_close(v_norm, private.norm_parts(v_f.risposte)) then raise exception 'too_close'; end if;
  insert into public.bluffs (round_id, player_id, parts, normalized) values (v_r.id, v_me.id, v_parts, v_norm)
    on conflict (round_id, player_id) do update set parts = excluded.parts, normalized = excluded.normalized;
  select count(*) into v_n from public.bluffs where round_id = v_r.id;
  update public.rounds set bluff_count = v_n where id = v_r.id;
  select count(*) into v_need from public.players
   where room_code = v_r.room_code and connected and id <> v_r.narrator_id;
  if v_n >= v_need then perform private.finish_writing(v_r.id); end if;
end $$;

-- Chiude la scrittura: tutti dopo la scadenza, narratore o host anche prima.
create function public.close_writing(p_code text, p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_host uuid;
begin
  if v_r.phase <> 'writing' then return; end if; -- già chiusa da un altro client
  select host_player_id into v_host from public.rooms where code = v_r.room_code;
  if now() < v_r.deadline_at and v_me.id <> v_r.narrator_id and v_me.id <> v_host then raise exception 'too_early'; end if;
  perform private.finish_writing(v_r.id);
end $$;

create function public.cast_vote(p_code text, p_player uuid, p_secret uuid, p_option bigint) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_o public.round_options; v_n int; v_need int;
begin
  if v_r.phase <> 'voting' then raise exception 'bad_phase'; end if;
  if v_r.narrator_id = v_me.id then raise exception 'is_narrator'; end if;
  select * into v_o from public.round_options where id = p_option and round_id = v_r.id;
  if not found then raise exception 'bad_option'; end if;
  if v_me.id = any (v_o.author_ids) then raise exception 'own_bluff'; end if;
  begin
    insert into public.votes (round_id, voter_id, option_id) values (v_r.id, v_me.id, p_option);
  exception when unique_violation then raise exception 'already_voted';
  end;
  select count(*) into v_n from public.votes where round_id = v_r.id;
  update public.rounds set vote_count = v_n where id = v_r.id;
  select count(*) into v_need from public.players
   where room_code = v_r.room_code and connected and id <> v_r.narrator_id;
  if v_n >= v_need then perform private.reveal(v_r.id); end if;
end $$;

-- Avanzamento manuale (narratore o host): reading -> voting -> reveal -> explain -> scores -> round dopo.
create function public.advance(p_code text, p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_room public.rooms; v_n int;
begin
  select * into v_room from public.rooms where code = v_r.room_code for update;
  if v_me.id <> v_r.narrator_id and v_me.id <> v_room.host_player_id then raise exception 'not_allowed'; end if;
  case v_r.phase
    when 'reading' then update public.rounds set phase = 'voting' where id = v_r.id;
    when 'voting'  then perform private.reveal(v_r.id);
    when 'reveal'  then update public.rounds set phase = 'explain' where id = v_r.id;
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
