# Converte un facts.json in uno script SQL di import per la tabella facts (upsert per id).
# Uso: python3 tools/facts_to_sql.py data/facts_sample.json supabase/seed/facts_sample.sql
# Controlla anche che il numero di buchi (____) coincida con il numero di risposte.
import json, sys
src, dst = sys.argv[1], sys.argv[2]
facts = json.load(open(src, encoding='utf-8'))
q = lambda s: "'" + str(s).replace("'", "''") + "'"
bad = [f['id'] for f in facts if f['frase'].count('____') != len(f['risposte'])]
if bad:
    print('ATTENZIONE: buchi diversi dalle risposte in', bad)
rows = []
for f in facts:
    arr = 'array[' + ','.join(q(r) for r in f['risposte']) + ']'
    rows.append('(%s,%s,%s,%s,%s,%s)' % (q(f['id']), q(f['categoria']), q(f['frase']), arr,
                                          q(f['spiegazione']), q(f['stato'])))
with open(dst, 'w', encoding='utf-8') as o:
    o.write('-- Generato da tools/facts_to_sql.py. Upsert per id: si può rieseguire.\n')
    o.write('insert into public.facts (id, categoria, frase, risposte, spiegazione, stato) values\n')
    o.write(',\n'.join(rows))
    o.write('\non conflict (id) do update set categoria = excluded.categoria, frase = excluded.frase,\n'
            '  risposte = excluded.risposte, spiegazione = excluded.spiegazione, stato = excluded.stato;\n')
print(len(facts), 'fatti ->', dst)
