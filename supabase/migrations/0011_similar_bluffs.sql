-- Confronto "intelligente" tra risposte e niente più balle duplicate.
-- 1) Una balla è rifiutata se, tolti articoli e preposizioni, è uguale alla risposta vera (anche con parole
--    in altro ordine) o ne differisce di pochissimo: "una chewing gum" = "il chewing gum".
-- 2) Due giocatori non possono più consegnare la stessa balla (stesso criterio): chi arriva dopo deve
--    cambiarla. Così il numero di card al voto è sempre giocatori-1 + la vera e non tradisce i doppioni.

-- Parole "di contenuto" di un testo: minuscolo, senza accenti, elisioni (l', un', dell'...) e stopword tolte.
create function private.cmp_words(t text) returns text[] language sql immutable as $$
  select coalesce(array_agg(x order by o) filter (where x <> '' and x <> all (array['il','lo','la','le','i','gli','l','un','uno','una','di','del','dello','della','dei','degli','delle','a','al','allo','alla','ai','agli','alle','da','dal','dallo','dalla','dai','dagli','dalle','in','nel','nello','nella','nei','negli','nelle','su','sul','sullo','sulla','sui','sugli','sulle','con','per','e','ed','o'])), '{}')
    from unnest(string_to_array(btrim(regexp_replace(regexp_replace(
           regexp_replace(translate(lower(coalesce(t, '')), 'àáâäãèéêëìíîïòóôöõùúûüñç', 'aaaaaeeeeiiiiooooouuuunc'),
             '\m(l|un|dell|dall|all|nell|sull|d|quest|quell)[''’‘`]', ' ', 'g'),
           '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')), ' ')) with ordinality as u(x, o)
$$;

create function private.cmp_key(t text) returns text language sql immutable as $$
  select case when cardinality(private.cmp_words(t)) = 0 then private.norm(t)
              else array_to_string(private.cmp_words(t), ' ') end
$$;

create function private.cmp_sorted(t text) returns text language sql immutable as $$
  select array_to_string(array(select x from unnest(string_to_array(private.cmp_key(t), ' ')) x order by x), ' ')
$$;

-- Vero se ogni parte di a è uguale (o quasi) alla parte corrispondente di b.
create function private.parts_close(a text[], b text[]) returns boolean language plpgsql immutable as $$
declare i int; ka text; kb text;
begin
  if a is null or b is null or cardinality(a) <> cardinality(b) then return false; end if;
  for i in 1..cardinality(a) loop
    ka := private.cmp_key(a[i]); kb := private.cmp_key(b[i]);
    if not (ka = kb or private.cmp_sorted(a[i]) = private.cmp_sorted(b[i])
            or (length(kb) >= 4 and extensions.levenshtein(ka, kb) <= greatest(1, length(kb) / 5))) then
      return false;
    end if;
  end loop;
  return true;
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
  if p_parts is null or cardinality(p_parts) <> cardinality(v_f.risposte) then raise exception 'bad_parts'; end if;
  foreach v_x in array p_parts loop
    v_t := btrim(regexp_replace(coalesce(v_x, ''), '\s+', ' ', 'g'));
    if char_length(v_t) not between 1 and 80 or private.norm(v_t) = '' then raise exception 'bad_text'; end if;
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
