import { useState } from 'react';
import { createRoom, joinRoom } from '../lib/api';
import type { Session } from '../lib/session';
import Masthead from '../components/Masthead';
import Toast from '../components/Toast';
import { openTutorial } from '../components/Tutorial';
import { ULTIMORA } from '../data/ultimora';

export default function Home({ onSession }: { onSession: (s: Session) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('c')?.toUpperCase().slice(0, 4) ?? '');
  const [busy, setBusy] = useState<'' | 'create' | 'join'>('');
  const [err, setErr] = useState('');

  const run = async (kind: 'create' | 'join', f: () => Promise<Session>) => {
    setBusy(kind); setErr('');
    try { onSession(await f()); } catch (e) { setErr((e as Error).message); setBusy(''); }
  };
  const nameOk = name.trim().length >= 1;

  return (
    <main className="page">
      <Masthead big />
      <div className="ticker" aria-hidden="true">
        <span className="ticker-tag">Ultim'ora</span>
        <div className="ticker-viewport"><div className="ticker-track">{[...ULTIMORA, ...ULTIMORA].map((t, i) => <span key={i}>{t}</span>)}</div></div>
      </div>
      <section className="coupon">
      <div className="coupon-head"><span>Modulo di arruolamento</span><span className="coupon-no">N° 0317</span></div>
      <div className="field">
        <label className="label" htmlFor="n">Firma dell'inviato</label>
        <input id="n" className="input" maxLength={20} value={name} placeholder="Il tuo nome" autoComplete="off"
          onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="actions">
        <button className={`btn primary${busy === 'create' ? ' busy' : ''}`} disabled={!!busy || !nameOk}
          onClick={() => run('create', () => createRoom(name))}>Crea una partita</button>
        <div className="divider">oppure entra in una stanza</div>
        <input className="input code" maxLength={4} value={code} placeholder="Codice" autoComplete="off" aria-label="Codice stanza"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
        <button className={`btn${busy === 'join' ? ' busy' : ''}`} disabled={!!busy || !nameOk || code.length !== 4}
          onClick={() => run('join', () => joinRoom(code, name))}>Entra con il codice</button>
        <Toast msg={err} />
      </div>
      </section>
      <ol className="howto">
        <li><span><b>Il narratore</b> estrae una notizia vera, con un buco.</span></li>
        <li><span><b>Gli altri</b> riempiono il buco con una balla credibile.</span></li>
        <li><span><b>Si vota</b> la vera: punti a chi indovina e a chi inganna.</span></li>
      </ol>
      <button className="btn link howto-link" onClick={openTutorial}>Come si gioca: la guida completa</button>
    </main>
  );
}
