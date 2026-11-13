import { useEffect, useState } from 'react';
import { configured } from './lib/supabase';
import { clearSession, lastSession, type Session } from './lib/session';
import { useRoomState } from './lib/useRoomState';
import { useHeartbeat } from './lib/useHeartbeat';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import Playing from './screens/Playing';
import Finished from './screens/Finished';
import './theme/theme.css';

const DEAD = ['Stanza non trovata.', 'Sessione non valida.'];

export default function App() {
  const [session, setSession] = useState<Session | null>(() => lastSession());
  const { state, error, refresh } = useRoomState(session);
  useHeartbeat(session, refresh);

  // Sessione salvata ma stanza sparita o giocatore non più valido: torna alla home.
  useEffect(() => {
    if (session && error && DEAD.includes(error)) { clearSession(session.code); setSession(null); }
  }, [session, error]);

  if (!configured) {
    return <main className="page"><p className="err">Mancano VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.</p></main>;
  }
  if (!session) return <Home onSession={setSession} />;
  if (!state) return <main className="page"><p className="muted">Caricamento…</p>{error && <p className="err">{error}</p>}</main>;
  if (state.room.phase === 'lobby') {
    return <Lobby session={session} state={state} refresh={refresh} onLeft={() => setSession(null)} />;
  }
  if (state.room.phase === 'finished') return <Finished session={session} state={state} onLeft={() => setSession(null)} />;
  return <Playing session={session} state={state} refresh={refresh} onLeft={() => setSession(null)} />;
}
