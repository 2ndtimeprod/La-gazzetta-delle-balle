import { useState } from 'react';
import { createRoom, joinRoom } from '../lib/api';
import type { Session } from '../lib/session';

export default function Home({ onSession }: { onSession: (s: Session) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('c')?.toUpperCase().slice(0, 4) ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (f: () => Promise<Session>) => {
    setBusy(true); setErr('');
    try { onSession(await f()); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  const nameOk = name.trim().length >= 1;

  return (
    <main className="page">
      <header className="masthead"><small>Edizione straordinaria</small><h1>La Gazzetta delle Balle</h1></header>
      <div><label htmlFor="n">Il tuo nome</label>
        <input id="n" type="text" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></div>
      <button className="primary" disabled={busy || !nameOk} onClick={() => run(() => createRoom(name))}>Crea stanza</button>
      <div className="card">
        <label htmlFor="c">Entra con il codice</label>
        <input id="c" className="code" type="text" maxLength={4} value={code} autoComplete="off"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
        <button disabled={busy || !nameOk || code.length !== 4} onClick={() => run(() => joinRoom(code, name))}>Entra</button>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
    </main>
  );
}
