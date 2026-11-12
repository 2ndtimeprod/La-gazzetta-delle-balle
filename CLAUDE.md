# Balle credibili: istruzioni di progetto

Gioco di bluff in stile Fibbage, creato da Dom (Domenico) con un amico. È una web app in tempo reale, in verticale, con un telefono per giocatore.
Rispondi a Dom sempre in italiano. Dom vuole onestà diretta: digli quando sbaglia. Niente domande o offerte a fine risposta, niente emoji pollice in su.

## Regole per risparmiare token (da seguire sempre)
- Modifica solo le righe necessarie; non riscrivere file interi senza motivo.
- Un file per schermata o componente; niente file oltre ~300 righe.
- Non aprire `data/facts.json` (è grande). Per sviluppare e testare usa `data/facts_sample.json`.
- Non rifare mockup o stili se Dom non lo chiede.
- A fine sessione aggiorna la sezione "Stato" di questo file in 3-5 righe.

## Il round
1. A turno un giocatore fa il narratore e non gioca la mano.
2. Il narratore gira il tamburo a rulli: la categoria la sceglie il server, l'animazione è solo scena.
3. Il narratore vede la frase con il buco e la risposta vera; gli altri vedono solo la frase.
4. Gli altri hanno 60 s per scrivere una balla che completi il buco (o i due buchi).
5. Il narratore legge ad alta voce tutte le risposte mescolate, vera compresa; gli altri votano (non la propria).
6. Punti: 1 a chi vota la vera; 1 all'autore di una balla per ogni voto ricevuto.
7. Rivelazione, poi spiegazione del fatto (campo `spiegazione`), punteggi, narratore successivo.

Setup: 3-12 giocatori, 1-3 giri (un giro = tutti fanno il narratore una volta), Dark on/off, Estremi on/off (criterio da definire, per ora ignorato).

## Categorie e tamburo
Nei dati ci sono 7 categorie. Nomi da mostrare: History = Storia, Pop culture = Pop culture, Geography = Geografia, Animal kingdom = Animali, Science = Scienza, Food & Drink = Cibo e bevande, Dark/Politically incorrect = Dark.
Il tamburo ha 7 facce: le 6 categorie normali più Jolly (il narratore sceglie) con Dark spento, oppure le 6 più Dark con Dark acceso. Proposta da confermare con Dom.
Interazione: velocità del tamburo pari alla velocità del dito; le frecce rosse laterali rimbalzano a ogni faccia che passa. Pulsante alternativo al gesto; rispettare `prefers-reduced-motion`.

## Dati dei fatti
L'archivio vero è l'Excel `Balle_credibili_archivio_vNN.xlsx`, curato da Dom. Si converte con `tools/xlsx_to_json.py`:
`python3 tools/xlsx_to_json.py archivio.xlsx data/facts.json` (su Windows: `py` al posto di `python3`; con `--sample 5` crea il campione).
Formato di ogni fatto:
```json
{"id":"POP-099","categoria":"Pop culture","frase":"... per la sua ____ e il suo ____.","risposte":["forma","ronzio"],"spiegazione":"...","stato":"Verificato"}
```
- `____` (4 trattini bassi) è il buco; il numero di buchi è uguale alla lunghezza di `risposte` (1 o 2).
- Con due buchi il giocatore scrive due campi; la balla si mostra dentro la frase.
- Decisione di Dom (12/11/2026): si importano e si usano TUTTI i fatti, non solo i verificati. Si conserva la colonna `stato`; l'estrazione filtra con un parametro modificabile (default: tutti), così si può tornare a "solo Verificato" senza reimportare. I fatti dubbi si segnalano via id e si correggono nell'Excel.
- La risposta vera non deve mai arrivare ai client che non sono il narratore: i fatti si importano in una tabella Supabase (`facts`) senza lettura pubblica, e il client li riceve tramite RPC.

## Stack
- Supabase: Postgres, Realtime, RPC (funzioni SQL `security definer`) o Edge Functions. Dom lo conosce già.
- Frontend proposto: Vite + React + TypeScript, `@supabase/supabase-js`, hosting statico (Vercel o Netlify).
- Niente account: stanza con codice di 4 lettere, giocatore = nome + id casuale salvato in `localStorage`.
- Lo stato di gioco vive sul server; i client si iscrivono ai cambiamenti via Realtime e chiamano RPC per agire.

## Modello dati (bozza)
- `rooms`: code, host_player_id, settings (giri, dark, estremi), phase, round_index, created_at.
- `players`: id (generato dal server), room_code, name, score, seat_order, connected. Il segreto del giocatore sta in `player_secrets` (mai leggibile): il client salva `{playerId, secret}` per stanza in `localStorage` e li passa a ogni RPC.
- `rounds`: id, room_code, narrator_id, category, fact_id, phase, deadline_at.
- `bluffs`: round_id, player_id, text (o due parti), normalized.
- `votes`: round_id, voter_id, choice_id.
- `facts`: i campi del JSON; nessuna policy di lettura per `anon`.
- Tabelle segrete aggiunte: `round_options` (card mescolate, balle identiche unite), `round_points`, `app_config` (`fact_filter` = `all`|`verified`). `anon` legge solo `rooms`, `players`, `rounds`; il resto passa da `get_state` e dalle RPC (`supabase/migrations/0001..0005`). I contatori `bluff_count`/`vote_count` in `rounds` servono a far scattare Realtime.
Fasi del round: `picking` → `writing` (60 s) → `reading` → `voting` → `reveal` → `explain` → `scores`.

## Regole sulle risposte
- Normalizza: minuscole, senza accenti, spazi compressi, punteggiatura tolta.
- Se una balla è uguale o molto vicina alla risposta vera (distanza di Levenshtein piccola), rifiutala e chiedi di riscriverla.
- Balle identiche tra giocatori si uniscono in una sola card; i punti vanno a tutti gli autori.
- Chi non scrive in tempo non ha una card.

## Look
Stile "La Gazzetta delle Balle" (giornale/tabloid), professionale, senza emoji come icone, soggetti originali. Due temi intercambiabili come set di token CSS:
- Edizione della sera (scuro): sfondo #15120E, testo #F1E9D8, rosso #F0443A, giallo #F2C230; font Anton, Source Serif 4, IBM Plex Mono.
- Il Quotidiano (chiaro): sfondo #FAF7F0, testo #111111, rosso #B3001B; font Playfair Display, Inter, Source Serif 4.
I mockup HTML di riferimento sono in `mockups/` (schermate S-/Q-: Home, Setup, Narratore, Scrive, Vota, Risultati; tamburo: `Estr-Rulli.dc.html`, `Q-Estr-Rulli.dc.html`). Il vecchio dado (`DadoFisico`) non si usa più. Manca la schermata della spiegazione.

## Struttura del repo
```
CLAUDE.md
data/        facts_sample.json (sviluppo), facts.json (completo, solo per l'import)
tools/       xlsx_to_json.py, import_facts (da scrivere)
supabase/    migrations/ (schema, policy, RPC)
src/         app React: screens/, components/, lib/ (supabase, normalizzazione), theme/
mockups/     sorgenti dei mockup
```

## Piano MVP
1. Schema Supabase, policy e RPC: crea/entra stanza, avvia partita, estrai categoria e fatto, invia balla, chiudi scrittura, vota, calcola punti, round successivo.
2. Lobby: crea stanza, entra con codice, lista giocatori in tempo reale.
3. Round completo con timer, solo tema chiaro, scelta categoria con un pulsante.
4. Tamburo a rulli, poi i due temi, poi la schermata della spiegazione.
5. Import di tutti i fatti verificati e test con 3-4 amici.

## Stato
- 12/11/2026: nessun codice ancora. Pronti: archivio v12 (541 fatti, 260 verificati), facts.json, facts_sample.json, convertitore.
- 12/11/2026 (sessione 0): repo preparato con la struttura sopra. Archivio xlsx in `data/`, mockup in `mockups/sorgenti` e `mockups/generatori`, handoff v5 in `docs/`. Aggiunto `.gitignore` (esclude `.env*`). Prossimo passo: fase 1 (Vite + React + TS, migration Supabase).
- 12/11/2026 (fase 1): migration 0001-0005 (schema, RLS, helper privati, RPC lobby e round, get_state), testate con `npm run test:db` (pglite: sicurezza + partita simulata, tutti ok). Scheletro Vite + React + TS con `src/lib/{supabase,session,api,useRoomState}.ts` e pagina `DevTest`. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (solo in `.env.local`/Vercel). Seed campione: `supabase/seed/facts_sample.sql` (generato da `tools/facts_to_sql.py`).
- Da fare in fase 2: lobby vera (sostituisce DevTest), impostazioni, avvio. Non ancora gestiti: heartbeat `connected`, pulizia stanze vecchie, limiti anti-abuso.
