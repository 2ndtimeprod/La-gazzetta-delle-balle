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
for (const t of ['facts', 'bluffs', 'votes', 'round_options', 'player_secrets', 'app_config', 'round_points']) {
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

// --- Round 0
let s = await st(host);
const narrIs = (s0) => Object.values(P).find(p => p.player_id === s0.round.narrator_id);
let narr = narrIs(s); const others = Object.values(P).filter(p => p !== narr);
ok(s.round.phase === 'picking' && !s.round.frase, 'picking: nessuna frase visibile');
ok(await fails_with('not_narrator', 'spin', C, others[0].player_id, others[0].secret), 'solo il narratore gira');
let sp = await call('spin', narr);
if (sp.face === 'Jolly') { await call('pick_category', narr, 'Science'); }
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
await call('submit_bluff', others[1], mk('zebra')); // identica (normalizzata): si unisce
s = await st(narr);
ok(s.round.phase === 'reading', 'tutti hanno scritto: si passa a reading');
ok(s.round.options.length === 2, 'balle identiche unite: 2 card (vera + 1)');
ok(!JSON.stringify(s.round.options).includes('is_true'), 'le card non dicono quale è vera');
await call('advance', narr); // voting
s = await st(others[0]);
const trueText = (await db.query(`select id from public.round_options where is_true`)).rows[0].id;
const bluffOpt = (await db.query(`select id from public.round_options where not is_true`)).rows[0].id;
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
  sp = await call('spin', narr); if (sp.face === 'Jolly') await call('pick_category', narr, 'History');
  s = await st(narr);
  await call('close_writing', narr); // il narratore chiude subito: nessuna balla -> reveal
  s = await st(host);
  ok(s.round.phase === 'reveal', `round ${i}: nessuna balla, si va a reveal`);
  await call('advance', narr); await call('advance', narr); await call('advance', narr);
}
s = await st(host);
ok(s.room.phase === 'finished', 'partita finita dopo giri x giocatori round');
ok(s.players.reduce((t, p) => t + p.score, 0) === 2, 'punteggi totali coerenti (2)');

// --- Filtro fatti
await db.exec(`update public.app_config set value='verified' where key='fact_filter'`);
ok((await db.query(`select count(*) c from public.facts where private.fact_ok(stato)`)).rows[0].c < 35, 'filtro "verified" attivo');

console.log(fails ? `\n${fails} test FALLITI` : '\nTutti i test passati');
process.exit(fails ? 1 : 0);
