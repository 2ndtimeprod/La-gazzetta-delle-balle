-- I 10 fatti mostrati nel box "Ultim'ora" della home non devono uscire nel gioco.
-- Si eliminano dalla tabella facts, tranne quelli già usati da un round esistente (FK da rounds):
-- quelli spariranno quando la pulizia automatica toglie le vecchie stanze; riesegui lo script in quel caso.
do $$
declare v_ids text[] := array['HIS-002','FOO-057','POP-029','SCI-003','POP-003','FOO-090','SCI-080','FOO-026','HIS-015','SCI-004'];
        v_left int;
begin
  delete from public.facts f
   where f.id = any(v_ids)
     and not exists (select 1 from public.rounds r where r.fact_id = f.id);
  select count(*) into v_left from public.facts where id = any(v_ids);
  raise notice 'Fatti ultim''ora ancora presenti perché usati da round esistenti: %', v_left;
end $$;
