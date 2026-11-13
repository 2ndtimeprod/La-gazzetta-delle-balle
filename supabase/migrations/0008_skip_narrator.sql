-- Il narratore non viene più saltato in automatico: un telefono in tasca o una scheda in
-- background non devono far partire il round. Lo salta solo il direttore (host), a mano.
-- Soglia di "offline" alzata a 90 s (Chrome rallenta i timer delle schede in background).

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
    if v_r.phase = 'writing' and (select count(*) from public.bluffs where round_id = v_r.id) >= v_need then
      perform private.finish_writing(v_r.id);
    elsif v_r.phase = 'voting' and (select count(*) from public.votes where round_id = v_r.id) >= v_need then
      perform private.reveal(v_r.id);
    end if;
  end if;
end $$;

-- Solo il direttore, solo prima che il tamburo sia girato: passa al narratore successivo.
create function public.skip_narrator(p_code text, p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_me public.players := private.auth(p_code, p_player, p_secret);
        v_r public.rounds := private.lock_round(v_me.room_code); v_room public.rooms; v_n int;
begin
  select * into v_room from public.rooms where code = v_me.room_code for update;
  if v_room.host_player_id <> v_me.id then raise exception 'not_host'; end if;
  if v_room.phase <> 'playing' or v_r.phase <> 'picking' or v_r.category is not null or v_r.jolly then raise exception 'bad_phase'; end if;
  select count(*) into v_n from public.players where room_code = v_room.code;
  if v_r.idx + 1 >= (v_room.settings->>'giri')::int * v_n then
    update public.rooms set phase = 'finished' where code = v_room.code;
  else
    perform private.start_round(v_room.code, v_r.idx + 1);
  end if;
end $$;
revoke all on function public.skip_narrator(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.skip_narrator(text, uuid, uuid) to anon, authenticated;
