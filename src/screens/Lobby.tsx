import { useState } from 'react';
import { leaveRoom, startGame, updateSettings, type GameState, type Settings } from '../lib/api';
import { clearSession, type Session } from '../lib/session';
import Masthead from '../components/Masthead';
import Toast from '../components/Toast';
import Waiting from '../components/Waiting';

type Props = { session: Session; state: GameState; onLeft: () => void; refresh: () => void };

export default function Lobby({ session, state, onLeft, refresh }: Props) {
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const { room, players, me } = state;
  const isHost = room.host_player_id === me;
  const st = room.settings;
  const enough = players.filter((p) => p.connected).length >= 3;

  const act = async (f: () => Promise<unknown>) => {
    try { await f(); setErr(''); refresh(); } catch (e) { setErr((e as Error).message); }
  };
  const set = (p: Partial<Settings>) => act(() => updateSettings(session, p));
  const leave = () => act(async () => { await leaveRoom(session); clearSession(session.code); onLeft(); });
  const share = async () => {
    const url = `${location.origin}${location.pathname}?c=${room.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'La Gazzetta delle Balle', text: `Entra nella stanza ${room.code}`, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* annullato */ }
  };

  const Toggle = ({ k, title, desc }: { k: 'dark' | 'estremi' | 'timer'; title: string; desc: string }) => (
    <label className="switch-row">
      <span><b>{title}</b><small>{desc}</small></span>
      <input type="checkbox" className="switch" checked={k === 'timer' ? st.timer !== false : !!st[k]} disabled={!isHost}
        onChange={(e) => set({ [k]: e.target.checked })} />
    </label>
  );

  return (
    <main className="page">
      <Masthead meta={`Stanza ${room.code}`} />
      <div className="code-tiles" aria-label={`Codice ${room.code}`}>{room.code.split('').map((c, i) => <span key={i}>{c}</span>)}</div>
      <button className="btn small" onClick={share}>{copied ? 'Link copiato' : 'Invita: condividi il link'}</button>

      <section>
        <h2 className="section-title"><span>La redazione</span><span>{players.length}/12</span></h2>
        <ul className="roster">
          {players.map((p, i) => (
            <li key={p.id} className={p.connected ? '' : 'offline'}>
              <span className="no">N. {String(i + 1).padStart(2, '0')}</span>
              <span className="nm">{p.name}{p.id === me && <span className="tag"> (tu)</span>}</span>
              <span className="lead" />
              {!p.connected && <span className="tag off">offline</span>}
              {p.id === room.host_player_id && <span className="tag host">Direttore</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="switch-row" style={{ cursor: 'default' }}>
          <span><b>Giri</b><small>Ognuno fa il narratore una volta per giro</small></span>
        </div>
        <div className="seg" style={{ marginBottom: 6 }}>
          {[1, 2, 3].map((g) => <button key={g} className={st.giri === g ? 'on' : ''} disabled={!isHost} onClick={() => set({ giri: g })}>{g}</button>)}
        </div>
        <Toggle k="timer" title="Cronometro" desc="60 secondi per scrivere la balla" />
        <Toggle k="dark" title="Dark" desc="Notizie scorrette: la settima faccia del tamburo" />
        <Toggle k="estremi" title="Estremi" desc="In arrivo" />
      </section>

      <div className="actions">
        {isHost
          ? <button className="btn primary" disabled={!enough} onClick={() => act(() => startGame(session))}>
              {enough ? 'Si va in stampa' : 'Servono almeno 3 giocatori'}</button>
          : <Waiting>Il direttore sta impaginando la partita</Waiting>}
        {!isHost && <p className="muted">Le impostazioni le sceglie il direttore, cioè chi ha creato la stanza.</p>}
        <button className="btn link" onClick={leave}>Esci dalla stanza</button>
        <Toast msg={err} />
      </div>
    </main>
  );
}
