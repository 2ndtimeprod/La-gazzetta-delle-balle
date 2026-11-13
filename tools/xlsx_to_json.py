# Converte l'archivio Excel di Balle credibili in facts.json per l'app.
# Uso: python3 xlsx_to_json.py archivio.xlsx facts.json [--sample N]
import openpyxl, json, sys, collections
# Fatti usati nel box "Ultim'ora" della home (src/data/ultimora.ts): non devono comparire nel gioco.
ESCLUDI = {'HIS-002', 'FOO-057', 'POP-029', 'SCI-003', 'POP-003', 'FOO-090', 'SCI-080', 'FOO-026', 'HIS-015', 'SCI-004'}
src, dst = sys.argv[1], sys.argv[2]
sample = int(sys.argv[sys.argv.index('--sample')+1]) if '--sample' in sys.argv else None
ws = openpyxl.load_workbook(src, data_only=True)['Fatti']
out, per = [], collections.Counter()
for r in ws.iter_rows(min_row=2, values_only=True):
    i, cat, frase, risp, _, _, stato = r[:7]
    spieg = r[12] if len(r) > 12 else None
    if not i or not frase or not risp or i in ESCLUDI: continue
    if sample and per[cat] >= sample: continue
    per[cat] += 1
    out.append({"id": i, "categoria": cat, "frase": ' '.join(frase.split()),
                "risposte": [p.strip() for p in str(risp).split(' | ')],
                "spiegazione": (spieg or "").strip(), "stato": stato})
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(out), dict(per))
