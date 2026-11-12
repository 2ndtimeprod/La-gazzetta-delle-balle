# Balle credibili: handoff v5 (sviluppo dell'app)

Data: 12 novembre 2026. Sostituisce l'handoff v4. Da qui si passa dai contenuti al codice.

## File
- `CLAUDE.md`: istruzioni complete per lo sviluppo (regole del gioco, dati, stack, modello dati, look, piano). È il documento principale e va nella radice del repo.
- `Balle_credibili_archivio_v12.xlsx`: archivio ufficiale, 541 fatti. Rispetto alla v11 di Dom sono corretti solo POP-099 e POP-110, aggiunta la seconda risposta in D.
- `facts.json`: tutti i 541 fatti convertiti. Serve solo per l'import finale.
- `facts_sample.json`: 35 fatti, 5 per categoria. È quello da usare per sviluppare.
- `xlsx_to_json.py`: convertitore. Se Dom modifica l'Excel, si rilancia e si rifà l'import; il codice non cambia.
- Da aggiungere da Dom: `Balle_credibili_mockup_sorgenti_v3.zip` con i sorgenti dei mockup, da mettere in `mockups/`. Artifact dei mockup: slug `36ed6323-5392-41a8-ab10-4f4fd82ae87b`.

## Come partire (per non sprecare token)
1. Crea un repo GitHub vuoto, per esempio `balle-credibili`.
2. Mettici `CLAUDE.md` nella radice, i file dei dati in `data/`, lo script in `tools/` e i mockup in `mockups/`.
3. Lavora con Claude Code sul repo: CLAUDE.md viene letto da solo e non c'è niente da rispiegare.
4. Una sessione per fase del piano MVP. A fine sessione si aggiorna la sezione "Stato" di CLAUDE.md.

Primo messaggio da usare: "Leggi CLAUDE.md e fai la fase 1 del piano MVP: progetto Vite + React + TypeScript e migration Supabase con schema, policy e RPC. Il progetto Supabase lo creo io e ti do URL e chiave anon."

## Stato dei contenuti
| Categoria | Fatti | Verificati |
|---|---|---|
| Food & Drink | 100 | 97 |
| Pop culture | 99 | 96 |
| History | 99 | 28 |
| Science | 83 | 20 |
| Dark/Politically incorrect | 65 | 16 |
| Geography | 50 | 3 |
| Animal kingdom | 45 | 0 |
| **Totale** | **541** | **260** |

Per l'MVP bastano i fatti verificati. Le categorie con pochi fatti verificati (Geografia, Animali, Dark) vanno verificate prima dei test veri, altrimenti il tamburo può uscire su una categoria quasi vuota. La verifica si fa in una chat separata, con il metodo dell'handoff v4 (sezione 3), e non tocca il codice.

## Decisioni aperte
- Tamburo: con Food & Drink le categorie normali sono 6, quindi 6 categorie + Jolly (Dark spento) oppure 6 categorie + Dark (Dark acceso). Proposta, da confermare.
- Criterio degli "Estremi": da definire con l'amico; per ora ignorato.
- Doppioni ancora da sistemare: Beer Flood di Londra (FOO-040 e DRK-046) e alcol avvelenato nel Proibizionismo (FOO-032 e DRK-069).
- Appunti di Dom ancora aperti in colonna L: FOO-007, FOO-015, DRK-005.
