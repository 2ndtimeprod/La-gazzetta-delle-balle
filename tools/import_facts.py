# Importa TUTTI i fatti dall'Excel: convalida, riepilogo e script SQL da incollare nel SQL Editor di Supabase.
# Uso: python3 tools/import_facts.py [archivio.xlsx] [--dry-run]
# Senza --dry-run scrive supabase/seed/facts_all.sql (upsert per id, rieseguibile) e riallinea data/facts.json.
# Il filtro "solo verificati" non richiede reimport: update app_config set value='verified' where key='fact_filter';
import collections, json, subprocess, sys, tempfile, os
args = [a for a in sys.argv[1:] if not a.startswith('--')]
xlsx = args[0] if args else 'data/Balle_credibili_archivio_v12.xlsx'
dry = '--dry-run' in sys.argv
here = os.path.dirname(os.path.abspath(__file__))
tmp = tempfile.mkdtemp()
js = os.path.join(tmp, 'facts.json')
sql = os.path.join(tmp, 'facts_all.sql')
subprocess.run([sys.executable, os.path.join(here, 'xlsx_to_json.py'), xlsx, js], check=True)
subprocess.run([sys.executable, os.path.join(here, 'facts_to_sql.py'), js, sql], check=True)
facts = json.load(open(js, encoding='utf-8'))
errs = []
cats = {'History', 'Pop culture', 'Geography', 'Animal kingdom', 'Science', 'Food & Drink', 'Dark/Politically incorrect'}
ids = collections.Counter(f['id'] for f in facts)
errs += ['id duplicato ' + i for i, n in ids.items() if n > 1]
for f in facts:
    if f['categoria'] not in cats: errs.append(f['id'] + ': categoria ' + repr(f['categoria']))
    if f['frase'].count('____') != len(f['risposte']): errs.append(f['id'] + ': buchi diversi dalle risposte')
    if not 1 <= len(f['risposte']) <= 2: errs.append(f['id'] + ': risposte non 1-2')
    if not f['spiegazione']: errs.append(f['id'] + ': spiegazione vuota')
print('Per categoria:', dict(collections.Counter(f['categoria'] for f in facts)))
print('Per stato:', dict(collections.Counter(f['stato'] for f in facts)))
print('Con filtro "verified" restano:', sum(f['stato'] == 'Verificato' for f in facts))
if errs:
    print('ERRORI:', *errs, sep='\n  '); sys.exit(1)
if dry:
    print('Dry-run ok, nulla scritto.'); sys.exit(0)
os.replace(sql, 'supabase/seed/facts_all.sql')
os.replace(js, 'data/facts.json')
print('Scritti supabase/seed/facts_all.sql e data/facts.json (%d fatti, %d KB di SQL)' % (len(facts), os.path.getsize('supabase/seed/facts_all.sql') // 1024))
