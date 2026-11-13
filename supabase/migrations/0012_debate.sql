-- Dibattito: ogni giocatore può lanciarne uno per partita (non il narratore), da quando arriva il fatto
-- fino all'ultimo voto. Dura 60 s e vale per tutti; il timbro compare a tutti perché cambia rounds.
-- settings.dibattito: assente = acceso, modificabile solo in lobby.

alter table public.players add column debate_used boolean not null default false;
alter table public.rounds add column debate_by uuid references public.players(id) on delete set null,
                          add column debate_until timestamptz;

create or replace function public.start_debate(p_code text, p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_on boolean;
begin
  select coalesce((settings->>'dibattito')::boolean, true) into v_on from public.rooms where code = v_me.room_code;
  if not v_on then raise exception 'debate_off'; end if;
  if v_r.id is null or v_r.phase not in ('writing', 'reading', 'voting') then raise exception 'bad_phase'; end if;
  if v_me.id = v_r.narrator_id then raise exception 'debate_narrator'; end if;
  select * into v_me from public.players where id = v_me.id for update;
  if v_me.debate_used then raise exception 'debate_used'; end if;
  if v_r.debate_until is not null and v_r.debate_until > now() then raise exception 'debate_running'; end if;
  update public.players set debate_used = true where id = v_me.id;
  update public.rounds set debate_by = v_me.id, debate_until = now() + interval '60 seconds' where id = v_r.id;
end $$;
revoke all on function public.start_debate(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_debate(text, uuid, uuid) to anon, authenticated;

create or replace function public.update_settings(p_code text, p_player uuid, p_secret uuid, p_settings jsonb) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_room public.rooms; v_timer boolean;
begin
  select * into v_room from public.rooms where code = v_me.room_code for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  if v_room.phase = 'finished' then raise exception 'game_started'; end if;
  if v_room.phase <> 'lobby' and p_settings ?| array['giri', 'dark', 'estremi', 'dibattito'] then raise exception 'game_started'; end if;
  v_timer := coalesce((p_settings->>'timer')::boolean, (v_room.settings->>'timer')::boolean, true);
  update public.rooms set settings = jsonb_build_object(
    'giri', least(3, greatest(1, coalesce((p_settings->>'giri')::int, (settings->>'giri')::int))),
    'dark', coalesce((p_settings->>'dark')::boolean, (settings->>'dark')::boolean),
    'estremi', coalesce((p_settings->>'estremi')::boolean, (settings->>'estremi')::boolean),
    'timer', v_timer,
    'dibattito', coalesce((p_settings->>'dibattito')::boolean, (v_room.settings->>'dibattito')::boolean, true))
   where code = v_me.room_code;
  if v_room.phase = 'playing' and v_r.phase = 'writing' then
    if not v_timer then
      update public.rounds set deadline_at = null where id = v_r.id;
    elsif v_r.deadline_at is null then
      update public.rounds set deadline_at = now() + interval '60 seconds' where id = v_r.id;
    end if;
  end if;
end $$;

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

    if v_r.phase in ('reading', 'voting') then
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
