import { useState } from 'react';
import { configured, supabase } from '../lib/supabase';
import { createRoom, joinRoom, leaveRoom, startGame } from '../lib/api';
import { clearSession, lastSession, type Session } from '../lib/session';
import { useRoomState } from '../lib/useRoomState';

// Pagina di verifica della fase 1 (si toglie dalla fase 2).
export default function DevTest() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [session, setSession] = useState<Session | null>(() => lastSession());
  const [msg, setMsg] = useState('');
  const { state, error, realtime } = useRoomState(session);

  const run = async (f: () => Promise<unknown>) => {
    try { await f(); setMsg(''); } catch (e) { setMsg((e as Error).message); }
  };

  const probe = async () => {
    const out: string[] = [];
    for (const t of ['facts', 'bluffs', 'votes', 'round_options', 'player_secrets']) {
      const { data, error: err } = await supabase.from(t).select('*').limit(1);
      const blocked = Boolean(err) || (data?.length ?? 0) === 0;
      out.push(`${t}: ${blocked ? 'bloccata (ok)' : 'LEGGIBILE: PROBLEMA GRAVE'}`);
    }
    setMsg(out.join(' | '));
  };

  if (!configured) {
    return <main style={s.page}><p>Mancano VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.</p></main>;
  }

  return (
    <main style={s.page}>
      <h1>Balle credibili: test fase 1</h1>
      <input style={s.in} placeholder="Il tuo nome" value={name} onChange={(e) => setName(e.target.value)} />
      <div style={s.row}>
        <button onClick={() => run(async () => setSession(await createRoom(name)))}>Crea stanza</button>
        <input style={{ ...s.in, width: 90 }} placeholder="Codice" maxLength={4} value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <button onClick={() => run(async () => setSession(await joinRoom(code, name)))}>Entra</button>
      </div>
      <div style={s.row}>
        <button onClick={probe}>Prova a leggere i dati segreti</button>
        {session && <button onClick={() => run(() => startGame(session))}>Avvia (host)</button>}
        {session && <button onClick={() => run(async () => { await leaveRoom(session); clearSession(session.code); setSession(null); })}>Esci</button>}
      </div>
      {msg && <p style={s.msg}>{msg}</p>}
      {error && <p style={s.msg}>{error}</p>}
      {session && <p>Stanza <b>{session.code}</b> · Realtime: {realtime}</p>}
      {state && (
        <>
          <ul>{state.players.map((p) => (
            <li key={p.id}>{p.name}{p.id === state.me ? ' (tu)' : ''}{p.id === state.room.host_player_id ? ' [host]' : ''} · {p.score}</li>
          ))}</ul>
          <pre style={s.pre}>{JSON.stringify({ room: state.room, round: state.round }, null, 1)}</pre>
        </>
      )}
    </main>
  );
}

const s = {
  page: { fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', padding: 16 } as const,
  row: { display: 'flex', gap: 8, margin: '8px 0', flexWrap: 'wrap' } as const,
  in: { padding: 8, fontSize: 16, width: '100%', boxSizing: 'border-box' } as const,
  msg: { background: '#fee', padding: 8, wordBreak: 'break-word' } as const,
  pre: { background: '#f4f4f4', padding: 8, overflow: 'auto', fontSize: 12 } as const,
};
