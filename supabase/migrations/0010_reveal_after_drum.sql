-- Il fatto esce a tutti nello stesso momento: quando il tamburo si è fermato per il narratore.
-- Prima `spin` apriva subito la scrittura, e gli altri giocatori vedevano la frase mentre il tamburo girava.
-- Ora `spin` salva il risultato in una tabella segreta; `start_writing` (chiamata dal client del narratore
-- a tamburo fermo) lo applica al round, apre la scrittura e fa partire i 60 s.

create table public.round_pending (
  round_id bigint primary key references public.rounds(id) on delete cascade,
  category text not null,
  fact_id text not null references public.facts(id)
);
alter table public.round_pending enable row level security;
revoke all on public.round_pending from anon, authenticated;

create or replace function public.spin(p_code text, p_player uuid, p_secret uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_dark boolean; v_faces text[] := '{}'; v_c text; v_face text;
begin
  if v_r.narrator_id <> v_me.id then raise exception 'not_narrator'; end if;
  -- già girato (es. il narratore ha ricaricato la pagina prima dell'apertura): stessa faccia
  select category into v_face from public.round_pending where round_id = v_r.id;
  if v_face is not null and v_r.phase = 'picking' then return jsonb_build_object('face', v_face); end if;
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
  insert into public.round_pending (round_id, category, fact_id)
    values (v_r.id, v_face, private.draw_fact(v_r.room_code, v_face));
  return jsonb_build_object('face', v_face);
end $$;

-- Tamburo fermo: apre la scrittura per tutti. Narratore o direttore (se il narratore è sparito).
create function public.start_writing(p_code text, p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_host uuid; v_p public.round_pending; v_timer boolean;
begin
  if v_r.phase <> 'picking' then return; end if; -- già aperta da un altro client
  select host_player_id, coalesce((settings->>'timer')::boolean, true) into v_host, v_timer
    from public.rooms where code = v_r.room_code;
  if v_me.id <> v_r.narrator_id and v_me.id <> v_host then raise exception 'not_narrator'; end if;
  select * into v_p from public.round_pending where round_id = v_r.id;
  if v_p.round_id is null then raise exception 'bad_phase'; end if;
  update public.rounds
     set category = v_p.category, fact_id = v_p.fact_id, phase = 'writing',
         deadline_at = case when v_timer then now() + interval '60 seconds' end
   where id = v_r.id;
  delete from public.round_pending where round_id = v_r.id;
end $$;
revoke all on function public.start_writing(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_writing(text, uuid, uuid) to anon, authenticated;
