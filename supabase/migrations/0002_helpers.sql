-- Helper interni (schema private, non raggiungibile dall'API).

create function private.norm(t text) returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(
    translate(lower(regexp_replace(coalesce(t,''), '[''’‘`]', '', 'g')),
              'àáâäãèéêëìíîïòóôöõùúûüñç', 'aaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g'))
$$;

create function private.norm_parts(p text[]) returns text language sql immutable as $$
  select string_agg(private.norm(x), ' | ' order by o) from unnest(p) with ordinality as t(x, o)
$$;

-- Vero se la balla è uguale o molto vicina alla risposta vera.
create function private.too_close(a text, b text) returns boolean language sql immutable as $$
  select a = b or (length(b) >= 4 and extensions.levenshtein(a, b) <= greatest(1, length(b) / 6))
$$;

-- Verifica id + segreto e appartenenza alla stanza; restituisce il giocatore.
create function private.auth(p_code text, p_player uuid, p_secret uuid) returns public.players
language plpgsql stable as $$
declare v public.players;
begin
  select p.* into v from public.players p
    join public.player_secrets s on s.player_id = p.id
   where p.id = p_player and p.room_code = upper(btrim(p_code)) and s.secret = p_secret;
  if not found then raise exception 'unauthorized'; end if;
  return v;
end $$;

create function private.fact_ok(p_stato text) returns boolean language sql stable as $$
  select coalesce((select value from public.app_config where key = 'fact_filter'), 'all') = 'all'
         or p_stato = 'Verificato'
$$;

create function private.normal_categories() returns text[] language sql immutable as $$
  select array['History','Pop culture','Geography','Animal kingdom','Science','Food & Drink']
$$;

-- Un fatto non ancora usato in questa stanza, nella categoria data (o null).
create function private.draw_fact(p_code text, p_cat text) returns text language sql volatile as $$
  select f.id from public.facts f
   where f.categoria = p_cat and private.fact_ok(f.stato)
     and f.id not in (select r.fact_id from public.rounds r
                       where r.room_code = p_code and r.fact_id is not null)
   order by random() limit 1
$$;

-- Assegna categoria e fatto al round e apre la scrittura (60 s).
create function private.set_fact(p_round bigint, p_cat text) returns void language plpgsql as $$
declare v_code text; v_fact text;
begin
  select room_code into v_code from public.rounds where id = p_round;
  v_fact := private.draw_fact(v_code, p_cat);
  if v_fact is null then raise exception 'no_facts'; end if;
  update public.rounds
     set category = p_cat, fact_id = v_fact, phase = 'writing',
         deadline_at = now() + interval '60 seconds'
   where id = p_round;
end $$;

-- Crea il round p_idx: il narratore ruota secondo seat_order.
create function private.start_round(p_code text, p_idx int) returns void language plpgsql as $$
declare v_n int; v_narr uuid;
begin
  select count(*) into v_n from public.players where room_code = p_code;
  select id into v_narr from (
    select id, row_number() over (order by seat_order, created_at) rn
      from public.players where room_code = p_code) t
   where rn = (p_idx % v_n) + 1;
  insert into public.rounds (room_code, idx, narrator_id) values (p_code, p_idx, v_narr);
  update public.rooms set round_index = p_idx where code = p_code;
end $$;

-- Chiude la scrittura: crea le card (vera + balle, unendo le identiche) in ordine casuale.
create function private.finish_writing(p_round bigint) returns void language plpgsql as $$
declare v_fact public.facts; v_nb int;
begin
  select f.* into v_fact from public.facts f join public.rounds r on r.fact_id = f.id where r.id = p_round;
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

-- Calcola i punti del round e passa alla rivelazione.
create function private.reveal(p_round bigint) returns void language plpgsql as $$
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
  update public.players p set score = p.score + rp.points
    from public.round_points rp where rp.round_id = p_round and rp.player_id = p.id;
  update public.rounds set phase = 'reveal' where id = p_round;
end $$;
