import { useState } from 'react';
import { deleteRoom, kickPlayer, type GameState } from '../lib/api';
import type { Session } from '../lib/session';
import { useAct } from '../lib/useAct';
import Toast from './Toast';

// Solo il direttore: togliere un giocatore (per rientrare dopo un problema di sincronizzazione) o chiudere la stanza.
// Ogni azione chiede conferma con un secondo tocco.
export default function HostTools({ session, state, refresh, folded }: { session: Session; state: GameState; refresh: () => void; folded?: boolean }) {
  const [open, setOpen] = useState(!folded);
  const [sure, setSure] = useState<string | null>(null); // id del giocatore, oppure 'room'
  const { err, busy, run } = useAct(refresh);
  if (state.room.host_player_id !== state.me) return null;
  if (!open) return <button className="btn link" onClick={() => setOpen(true)}>Gestisci la stanza</button>;
  const lobby = state.room.phase === 'lobby';
  const others = state.players.filter((p) => p.id !== state.me);

  return (
    <section className="host-tools">
      <h2 className="section-title"><span>Strumenti del direttore</span>{folded && <button className="btn link" onClick={() => { setOpen(false); setSure(null); }}>Chiudi</button>}</h2>
      <p className="muted small">{lobby
        ? 'Chi viene tolto può rientrare subito con il codice.'
        : 'Chi viene tolto torna alla home e rientra con il codice e lo stesso nome: riprende il suo posto e i suoi punti.'}</p>
      <ul className="host-list">
        {others.map((p) => (
          <li key={p.id}>
            <span className="nm">{p.name}</span>
            {p.kicked ? <span className="tag off">tolto</span> : !p.connected && <span className="tag off">offline</span>}
            {!p.kicked && (sure === p.id
              ? <span className="host-confirm">
                  <button className="btn small primary" disabled={busy} onClick={() => run(async () => { await kickPlayer(session, p.id); setSure(null); })}>Togli</button>
                  <button className="btn small" onClick={() => setSure(null)}>No</button>
                </span>
              : <button className="btn small" disabled={busy} onClick={() => setSure(p.id)}>Togli</button>)}
          </li>
        ))}
      </ul>
      {sure === 'room'
        ? <div className="stack">
            <p className="muted small" style={{ textAlign: 'center' }}>La stanza sparisce per tutti, partita compresa.</p>
            <div className="choices">
              <button className="btn small primary" disabled={busy} onClick={() => run(() => deleteRoom(session))}>Chiudi la stanza</button>
              <button className="btn small" onClick={() => setSure(null)}>Annulla</button>
            </div>
          </div>
        : <button className="btn link danger" onClick={() => setSure('room')}>Chiudi la stanza per tutti</button>}
      <Toast msg={err} />
    </section>
  );
}
