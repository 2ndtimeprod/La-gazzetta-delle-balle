// Test delle migration su Postgres locale (pglite): sicurezza e partita completa simulata.
// Uso: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { fuzzystrmatch } from '@electric-sql/pglite/contrib/fuzzystrmatch';
import { readFileSync, readdirSync } from 'node:fs';

const db = new PGlite({ extensions: { fuzzystrmatch } });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

await db.exec(`create role anon nologin; create role authenticated nologin;
  create schema extensions; create publication supabase_realtime;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;`);
for (const f of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort())
  await db.exec(readFileSync('supabase/migrations/' + f, 'utf8'));
await db.exec(readFileSync('supabase/seed/facts_sample.sql', 'utf8'));

const as = async (role, sql, params) => { await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); } };
const rpc = async (fn, ...args) => (await as('anon',
  `select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as r`, args)).rows[0].r;
const fails_with = async (msg, fn, ...args) => { try { await rpc(fn, ...args); return false; }
  catch (e) { return e.message.includes(msg); } };

// --- Sicurezza: anon non legge i dati segreti
for (const t of ['facts', 'bluffs', 'votes', 'round_options', 'player_secrets', 'app_config', 'round_points', 'player_presence', 'round_pending']) {
  let denied = false;
  try { await as('anon', `select * from public.${t}`); } catch { denied = true; }
  ok(denied, `anon non può leggere ${t}`);
}
for (const t of ['rooms', 'players', 'rounds']) {
  let r = false; try { await as('anon', `select * from public.${t}`); r = true; } catch {}
  ok(r, `anon può leggere ${t} (per Realtime)`);
}
let w = false; try { await as('anon', `insert into public.rooms(code) values ('ZZZZ')`); w = true; } catch {}
ok(!w, 'anon non può scrivere direttamente');
let pv = false; try { await as('anon', `select private.norm('x')`); pv = true; } catch {}
ok(!pv, 'anon non può chiamare le funzioni private');

// --- Lobby
const host = await rpc('create_room', 'Dom', JSON.stringify({ giri: 1, dark: true }));
ok(/^[A-Z]{4}$/.test(host.code), 'create_room: codice ' + host.code);
const C = host.code;
const a = await rpc('join_room', C.toLowerCase(), 'Ale');
const b = await rpc('join_room', C, 'Bea');
ok(await fails_with('name_taken', 'join_room', C, 'ale'), 'nome doppio rifiutato');
ok(await fails_with('too_few_players', 'start_game', C, host.player_id, host.secret) === false, 'start con 3 giocatori ok');
ok(await fails_with('unauthorized', 'get_state', C, a.player_id, b.secret), 'segreto sbagliato rifiutato');
ok(await fails_with('game_started', 'join_room', C, 'Tardi'), 'ingresso a partita iniziata rifiutato');
const P = { host, a, b };
const st = async (p) => rpc('get_state', C, p.player_id, p.secret);
const call = (fn, p, ...x) => rpc(fn, C, p.player_id, p.secret, ...x);

// --- Confronto tra risposte (articoli, ordine, elisioni, refusi)
const close = async (a, b) => (await db.query(`select private.parts_close($1::text[], $2::text[]) as r`, [a, b])).rows[0].r;
ok(await close(['una chewing gum'], ['il chewing gum']), 'articolo diverso: troppo simile');
ok(await close(['chewing-gum'], ['il chewing gum']), 'senza articolo e col trattino: troppo simile');
ok(await close(['gum chewing'], ['il chewing gum']), 'parole in altro ordine: troppo simile');
ok(await close(["l'orso"], ['un orso']), 'elisione (l\'orso) = un orso');
ok(await close(['chewin gum'], ['chewing gum']), 'refuso: troppo simile');
ok(!(await close(['gomma da masticare'], ['il chewing gum'])), 'sinonimo diverso: accettato');
ok(!(await close(['Parigi'], ['Londra'])), 'risposte diverse: accettate');
ok(!(await close(['forma', 'altro'], ['forma', 'ronzio'])), 'due buchi: una sola parte uguale non basta');

// --- Round 0
let s = await st(host);
const narrIs = (s0) => Object.values(P).find(p => p.player_id === s0.round.narrator_id);
let narr = narrIs(s); const others = Object.values(P).filter(p => p !== narr);
ok(s.round.phase === 'picking' && !s.round.frase, 'picking: nessuna frase visibile');
ok(await fails_with('not_narrator', 'spin', C, others[0].player_id, others[0].secret), 'solo il narratore gira');
let sp = await call('spin', narr);
if (sp.face !== 'Jolly') {
  const so0 = await st(others[0]);
  ok(so0.round.phase === 'picking' && !so0.round.frase && !so0.round.category, 'a tamburo non fermo gli altri non vedono né fatto né categoria');
  ok((await call('spin', narr)).face === sp.face, 'spin ripetuto restituisce la stessa faccia');
  const nh = others.find(p => p.player_id !== host.player_id);
  ok(await fails_with('not_narrator', 'start_writing', C, nh.player_id, nh.secret), 'start_writing: solo narratore o direttore');
}
if (sp.face === 'Jolly') { await call('pick_category', narr, 'Science'); } else { await call('start_writing', narr); }
s = await st(narr);
ok(s.round.phase === 'writing' && s.round.truth?.length >= 1, 'narratore vede la risposta vera durante la scrittura');
const so = await st(others[0]);
ok(so.round.frase && !('truth' in so.round), 'gli altri vedono la frase ma non la risposta');
ok(!JSON.stringify(so).includes(s.round.truth[0]), 'la risposta vera non compare nel JSON degli altri');
ok(await fails_with('too_close', 'submit_bluff', C, others[0].player_id, others[0].secret, s.round.truth), 'balla uguale alla vera rifiutata');
const holes = s.round.holes;
const mk = (t) => Array.from({ length: holes }, (_, i) => `${t} ${i}`);
await call('submit_bluff', others[0], mk('Zebra'));
await call('submit_bluff', others[0], mk('Zebra')); // sostituzione
ok((await st(host)).round.bluff_count === 1, 'una balla contata');
ok(await fails_with('duplicate', 'submit_bluff', C, others[1].player_id, others[1].secret, mk('la zebra')), 'balla uguale a quella di un altro (senza articolo) rifiutata');
await call('submit_bluff', others[1], mk('cobra'));
s = await st(narr);
ok(s.round.phase === 'reading', 'tutti hanno scritto: si passa a reading');
ok(s.round.options.length === 3, 'una card per giocatore: vera + 2 balle, nessuna unione');
ok(!JSON.stringify(s.round.options).includes('is_true'), 'le card non dicono quale è vera');
await call('advance', narr); // voting
s = await st(others[0]);
const trueText = (await db.query(`select id from public.round_options where is_true`)).rows[0].id;
const bluffOpt = (await db.query(`select id from public.round_options where not is_true and $1 = any(author_ids)`, [others[0].player_id])).rows[0].id;
ok(await fails_with('own_bluff', 'cast_vote', C, others[0].player_id, others[0].secret, bluffOpt), 'non si vota la propria balla');
ok(s.round.options.find(o => o.id === Number(bluffOpt)).mine === true, 'la card propria è marcata mine');
await call('cast_vote', others[0], Number(trueText));
ok(await fails_with('already_voted', 'cast_vote', C, others[0].player_id, others[0].secret, trueText), 'voto doppio rifiutato');
await call('cast_vote', others[1], Number(trueText));
s = await st(host);
ok(s.round.phase === 'reveal', 'tutti hanno votato: rivelazione');
const pts = s.round.points;
ok(pts[others[0].player_id] === 1 && pts[others[1].player_id] === 1, 'punti: 1 a chi vota la vera');
ok(!('spiegazione' in s.round), 'spiegazione non ancora visibile');
await call('advance', narr);
s = await st(host);
ok(s.round.phase === 'explain' && typeof s.round.spiegazione === 'string', 'spiegazione visibile in explain');
await call('advance', narr); await call('advance', narr); // scores -> round 1
s = await st(host);
ok(s.round.idx === 1 && s.round.phase === 'picking' && s.round.narrator_id !== narr.player_id, 'round 1 con altro narratore');

// --- Fine partita: gioca i round restanti con balle subito sbagliate e voti per la vera
for (let i = 1; i < 3; i++) {
  s = await st(host); narr = narrIs(s);
  const oth = Object.values(P).filter(p => p !== narr);
  sp = await call('spin', narr); if (sp.face === 'Jolly') await call('pick_category', narr, 'History'); else { await call('start_writing', narr); }
  s = await st(narr);
  await call('close_writing', narr); // il narratore chiude subito: nessuna balla -> reveal
  s = await st(host);
  ok(s.round.phase === 'reveal', `round ${i}: nessuna balla, si va a reveal`);
  await call('advance', narr); await call('advance', narr); await call('advance', narr);
}
s = await st(host);
ok(s.room.phase === 'finished', 'partita finita dopo giri x giocatori round');
ok(s.players.reduce((t, p) => t + p.score, 0) === 2, 'punteggi totali coerenti (2)');

// --- Presenza (0006)
const mkRoom = async (names) => { const h = await rpc('create_room', names[0]); const ps = [h];
  for (const n of names.slice(1)) ps.push(await rpc('join_room', h.code, n)); return ps; };
const hb = (ps, p) => rpc('heartbeat', ps[0].code, p.player_id, p.secret);
const stale = (p) => db.exec(`insert into public.player_presence(player_id,last_seen) values ('${p.player_id}', now() - interval '5 minutes')
  on conflict (player_id) do update set last_seen = excluded.last_seen`);
const gs = (ps, p) => rpc('get_state', ps[0].code, p.player_id, p.secret);
const act = (ps, fn, p, ...x) => rpc(fn, ps[0].code, p.player_id, p.secret, ...x);

ok(await fails_with('unauthorized', 'heartbeat', C, a.player_id, b.secret), 'heartbeat: segreto sbagliato rifiutato');

// Narratore (e host) spariti prima di girare il tamburo: round saltato e host passato
{ const ps = await mkRoom(['H', 'A', 'B', 'C']);
  for (const p of ps) await hb(ps, p);
  await act(ps, 'start_game', ps[0]);
  ok((await gs(ps, ps[1])).round.narrator_id === ps[0].player_id, 'presenza: all\'inizio narra l\'host');
  await stale(ps[0]); await hb(ps, ps[1]);
  const s = await gs(ps, ps[1]);
  ok(s.room.host_player_id === ps[1].player_id, 'presenza: host sparito, ruolo passato');
  ok(s.round.idx === 0, 'presenza: narratore assente NON saltato in automatico');
  ok(await fails_with('not_host', 'skip_narrator', ps[0].code, ps[2].player_id, ps[2].secret), 'salta narratore: solo il direttore');
  await act(ps, 'skip_narrator', ps[1]);
  ok((await gs(ps, ps[1])).round.narrator_id === ps[1].player_id, 'salta narratore: il direttore passa al successivo');
  ok(s.players.find(p => p.id === ps[0].player_id).connected === false, 'presenza: giocatore segnato disconnesso');
  await hb(ps, ps[0]);
  ok((await gs(ps, ps[2])).players.find(p => p.id === ps[0].player_id).connected === true, 'presenza: rientro con battito');

  // Scrittura: un presente sparisce, gli altri rispondono e si passa avanti
  const sp = await act(ps, 'spin', ps[1]); if (sp.face === 'Jolly') await act(ps, 'pick_category', ps[1], 'Science'); else { await act(ps, 'start_writing', ps[1]); }
  const holes = (await gs(ps, ps[1])).round.holes;
  await stale(ps[3]); await hb(ps, ps[2]);
  const mk = (t) => Array.from({ length: holes }, (_, i) => `${t} ${i}`);
  await act(ps, 'submit_bluff', ps[2], mk('Alfa'));
  ok((await gs(ps, ps[1])).round.phase === 'writing', 'presenza: finché manca un presente si aspetta');
  await act(ps, 'submit_bluff', ps[0], mk('Beta'));
  ok((await gs(ps, ps[1])).round.phase === 'reading', 'presenza: scrittura chiusa con i soli presenti');
}
// Un solo presente: gli altri in background non fanno saltare i round
{ const ps = await mkRoom(['H', 'A', 'B']);
  for (const p of ps) await hb(ps, p);
  await act(ps, 'start_game', ps[0]);
  await stale(ps[0]); await stale(ps[2]); await hb(ps, ps[1]);
  ok((await gs(ps, ps[1])).round.idx === 0, 'presenza: con un solo presente nulla avanza da solo');
}
// Lobby: chi è disconnesso viene tolto all'avvio
{ const ps = await mkRoom(['H', 'A', 'B', 'C']);
  for (const p of ps) await hb(ps, p);
  await stale(ps[3]); await hb(ps, ps[0]);
  await act(ps, 'start_game', ps[0]);
  const s = await gs(ps, ps[0]);
  ok(s.players.length === 3 && s.room.phase === 'playing', 'lobby: disconnesso tolto, partita con i 3 presenti');
  const qs = await mkRoom(['H', 'A', 'B']);
  for (const p of qs) await hb(qs, p);
  await stale(qs[2]); await hb(qs, qs[0]);
  ok(await fails_with('too_few_players', 'start_game', qs[0].code, qs[0].player_id, qs[0].secret), 'lobby: 2 presenti + 1 disconnesso: avvio rifiutato');
}
// Pulizia e tetto stanze
await db.exec(`insert into public.rooms(code, created_at) values ('OLDR', now() - interval '1 day')`);
await db.exec(`insert into public.players(room_code, name, seat_order, created_at) values ('OLDR', 'x', 0, now() - interval '1 day')`);
await rpc('create_room', 'Nuovo');
ok((await db.query(`select count(*) c from public.rooms where code = 'OLDR'`)).rows[0].c === 0, 'pulizia: stanza vecchia senza battiti eliminata');
const fill = `select chr(65+(i/17576)%26)||chr(65+(i/676)%26)||chr(65+(i/26)%26)||chr(65+i%26) from generate_series(1000,1400) i`;
await db.exec(`insert into public.rooms(code) ${fill}`);
ok(await fails_with('too_many_rooms', 'create_room', 'Troppe'), 'tetto: oltre 300 stanze create_room rifiutato');
await db.exec(`delete from public.rooms where code in (${fill})`);

// --- Cronometro (0007)
{ const ps = await mkRoom(['H', 'A', 'B']);
  ok(await fails_with('not_host', 'update_settings', ps[0].code, ps[1].player_id, ps[1].secret, JSON.stringify({ timer: false })), 'timer: solo l\'host lo cambia');
  await act(ps, 'update_settings', ps[0], JSON.stringify({ timer: false }));
  ok((await gs(ps, ps[1])).room.settings.timer === false, 'timer: spento in lobby');
  await act(ps, 'start_game', ps[0]);
  const sp = await act(ps, 'spin', ps[0]); if (sp.face === 'Jolly') await act(ps, 'pick_category', ps[0], 'Science'); else { await act(ps, 'start_writing', ps[0]); }
  ok((await gs(ps, ps[1])).round.deadline_at === null, 'timer spento: nessuna scadenza');
  ok(await fails_with('too_early', 'close_writing', ps[0].code, ps[1].player_id, ps[1].secret), 'timer spento: un giocatore non chiude la scrittura');
  ok(await fails_with('game_started', 'update_settings', ps[0].code, ps[0].player_id, ps[0].secret, JSON.stringify({ giri: 2 })), 'in partita: i giri non si cambiano');
  await act(ps, 'update_settings', ps[0], JSON.stringify({ timer: true }));
  const d = (await gs(ps, ps[1])).round.deadline_at;
  ok(d !== null && Date.parse(d) > Date.now(), 'timer acceso a metà scrittura: riparte da 60 s');
  await act(ps, 'update_settings', ps[0], JSON.stringify({ timer: false }));
  ok((await gs(ps, ps[1])).round.deadline_at === null, 'timer spento a metà scrittura: scadenza tolta');
  const holes = (await gs(ps, ps[0])).round.holes;
  const mk = (t) => Array.from({ length: holes }, (_, i) => `${t} ${i}`);
  await act(ps, 'submit_bluff', ps[1], mk('Uno'));
  ok((await gs(ps, ps[0])).round.phase === 'writing', 'timer spento: si aspetta chi non ha scritto');
  await act(ps, 'submit_bluff', ps[2], mk('Due'));
  ok((await gs(ps, ps[0])).round.phase === 'reading', 'timer spento: chiude quando scrivono tutti');
  await act(ps, 'update_settings', ps[0], JSON.stringify({ timer: true }));
  await act(ps, 'advance', ps[0]); await act(ps, 'advance', ps[0]); await act(ps, 'advance', ps[0]); await act(ps, 'advance', ps[0]);
  const s2 = await gs(ps, ps[0]); // scores
  await act(ps, 'advance', ps[0]);
  const s3 = await gs(ps, ps[1]);
  const sp2 = await act(ps, 'spin', ps[1]); if (sp2.face === 'Jolly') await act(ps, 'pick_category', ps[1], 'Science'); else { await act(ps, 'start_writing', ps[1]); }
  ok(s2.round.phase === 'scores' && (await gs(ps, ps[2])).round.deadline_at !== null, 'timer riacceso: il round dopo ha la scadenza');
}

// --- Filtro fatti
await db.exec(`update public.app_config set value='verified' where key='fact_filter'`);
ok((await db.query(`select count(*) c from public.facts where private.fact_ok(stato)`)).rows[0].c < 35, 'filtro "verified" attivo');

console.log(fails ? `\n${fails} test FALLITI` : '\nTutti i test passati');
process.exit(fails ? 1 : 0);
