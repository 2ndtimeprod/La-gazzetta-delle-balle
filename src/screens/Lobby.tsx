import { useState } from 'react';
import { leaveRoom, movePlayer, setFixedNarrator, startGame, updateSettings, type GameState, type Settings } from '../lib/api';
import { clearSession, type Session } from '../lib/session';
import HostTools from '../components/HostTools';
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
  const fixed = room.fixed_narrator ?? null;
  const turn = players.filter((p) => p.id !== fixed); // l'ordine in cui passa il ruolo di narratore

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

  const Toggle = ({ k, title, desc }: { k: 'dark' | 'estremi' | 'timer' | 'dibattito'; title: string; desc: string }) => (
    <label className="switch-row">
      <span><b>{title}</b><small>{desc}</small></span>
      <input type="checkbox" className="switch" checked={k === 'timer' ? st.timer !== false : k === 'dibattito' ? st.dibattito !== false : !!st[k]} disabled={!isHost}
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
        <p className="muted small">{fixed ? 'Narra sempre lo stesso: gli altri giocano soltanto.' : 'Il numero è il turno da narratore.'}{isHost && !fixed ? ' Usa le frecce per cambiare l\'ordine.' : ''}</p>
        <ul className="roster">
          {players.map((p, i) => (
            <li key={p.id} className={p.connected ? '' : 'offline'}>
              <span className="no">{p.id === fixed ? 'Fisso' : `N. ${String(turn.indexOf(p) + 1).padStart(2, '0')}`}</span>
              <span className="nm">{p.name}{p.id === me && <span className="tag"> (tu)</span>}</span>
              <span className="lead" />
              {!p.connected && <span className="tag off">offline</span>}
              {p.id === fixed && <span className="tag host">Narratore</span>}
              {p.id === room.host_player_id && <span className="tag host">Direttore</span>}
              {isHost && !fixed && (
                <span className="order">
                  <button aria-label={`${p.name} prima`} disabled={i === 0} onClick={() => act(() => movePlayer(session, p.id, -1))}>↑</button>
                  <button aria-label={`${p.name} dopo`} disabled={i === players.length - 1} onClick={() => act(() => movePlayer(session, p.id, 1))}>↓</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <HostTools session={session} state={state} refresh={refresh} folded />

      <section className="card">
        <div className="switch-row" style={{ cursor: 'default' }}>
          <span><b>Giri</b><small>{fixed ? 'Un giro = un round per ogni giocatore' : 'Ognuno fa il narratore una volta per giro'}</small></span>
        </div>
        <div className="seg" style={{ marginBottom: 6 }}>
          {[1, 2, 3].map((g) => <button key={g} className={st.giri === g ? 'on' : ''} disabled={!isHost} onClick={() => set({ giri: g })}>{g}</button>)}
        </div>
        <div className="switch-row" style={{ cursor: 'default' }}>
          <span><b>Narratore fisso</b><small>Chi non vuole giocare conduce tutta la partita e non prende punti</small></span>
        </div>
        <select className="input" aria-label="Narratore fisso" value={fixed ?? ''} disabled={!isHost}
          onChange={(e) => act(() => setFixedNarrator(session, e.target.value || null))}>
          <option value="">Nessuno: si fa a turno</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Toggle k="timer" title="Cronometro" desc="60 secondi per scrivere la balla" />
        <Toggle k="dibattito" title="Dibattito" desc="Un minuto di discussione, una volta a testa per partita" />
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
