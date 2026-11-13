import { useState } from 'react';
import { leaveRoom, startGame, updateSettings, type GameState, type Settings } from '../lib/api';
import { clearSession, type Session } from '../lib/session';

type Props = { session: Session; state: GameState; onLeft: () => void; refresh: () => void };

export default function Lobby({ session, state, onLeft, refresh }: Props) {
  const [err, setErr] = useState('');
  const { room, players, me } = state;
  const isHost = room.host_player_id === me;
  const st = room.settings;
  const enough = players.length >= 3;

  const act = async (f: () => Promise<unknown>) => {
    try { await f(); setErr(''); refresh(); } catch (e) { setErr((e as Error).message); }
  };
  const set = (p: Partial<Settings>) => act(() => updateSettings(session, p));
  const leave = () => act(async () => { await leaveRoom(session); clearSession(session.code); onLeft(); });
  const share = () => {
    const url = `${location.origin}${location.pathname}?c=${room.code}`;
    if (navigator.share) void navigator.share({ title: 'Balle credibili', url }).catch(() => {});
    else void navigator.clipboard?.writeText(url);
  };

  return (
    <main className="page">
      <header className="masthead"><small>Codice stanza</small><p className="roomcode">{room.code}</p></header>
      <button onClick={share}>Condividi link</button>

      <section>
        <h2>Giocatori ({players.length}/12)</h2>
        <ul className="players">
          {players.map((p) => (
            <li key={p.id}>
              <span>{p.name}{p.id === me && ' (tu)'}</span>
              <span className="tag">{!p.connected && 'offline '}{p.id === room.host_player_id && 'host'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Impostazioni</h2>
        <div>
          <label>Giri (tutti fanno il narratore una volta per giro)</label>
          <div className="seg">
            {[1, 2, 3].map((g) => (
              <button key={g} className={st.giri === g ? 'on' : ''} disabled={!isHost} onClick={() => set({ giri: g })}>{g}</button>
            ))}
          </div>
        </div>
        <label className="toggle">Dark
          <input type="checkbox" checked={st.dark} disabled={!isHost} onChange={(e) => set({ dark: e.target.checked })} /></label>
        <label className="toggle">Estremi
          <input type="checkbox" checked={st.estremi} disabled={!isHost} onChange={(e) => set({ estremi: e.target.checked })} /></label>
        {!isHost && <p className="muted">Le impostazioni le decide chi ha creato la stanza.</p>}
      </section>

      {isHost
        ? <button className="primary" disabled={!enough} onClick={() => act(() => startGame(session))}>
            {enough ? 'Avvia partita' : 'Servono almeno 3 giocatori'}</button>
        : <p className="muted">In attesa che l'host avvii la partita.</p>}
      <button onClick={leave}>Esci</button>
      {err && <p className="err" role="alert">{err}</p>}
    </main>
  );
}
