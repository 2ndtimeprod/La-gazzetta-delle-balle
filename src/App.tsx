import { useEffect, useState } from 'react';
import { configured } from './lib/supabase';
import { clearSession, lastSession, type Session } from './lib/session';
import { useRoomState } from './lib/useRoomState';
import { useHeartbeat } from './lib/useHeartbeat';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import Playing from './screens/Playing';
import Finished from './screens/Finished';
import './theme/fonts';
import './theme/tokens.css';
import './theme/base.css';
import './theme/game.css';
import './theme/drum.css';
import Toast from './components/Toast';
import Waiting from './components/Waiting';

import Anteprima from './dev/Anteprima';
const ANTEPRIMA = import.meta.env.DEV ? new URLSearchParams(location.search).get('anteprima') : null;

const DEAD = ['Stanza non trovata.', 'Sessione non valida.'];

export default function App() {
  const [session, setSession] = useState<Session | null>(() => lastSession());
  const { state, error, refresh } = useRoomState(session);
  useHeartbeat(session, refresh);

  // Sessione salvata ma stanza sparita o giocatore non più valido: torna alla home.
  useEffect(() => {
    if (session && error && DEAD.includes(error)) { clearSession(session.code); setSession(null); }
  }, [session, error]);

  if (ANTEPRIMA) return <Anteprima which={ANTEPRIMA} />;
  if (!configured) {
    return <main className="page"><Toast msg="Mancano VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY." /></main>;
  }
  if (!session) return <Home onSession={setSession} />;
  if (!state) return <main className="page"><Waiting>Caricamento della redazione</Waiting><Toast msg={error} /></main>;
  if (state.room.phase === 'lobby') {
    return <Lobby session={session} state={state} refresh={refresh} onLeft={() => setSession(null)} />;
  }
  if (state.room.phase === 'finished') return <Finished session={session} state={state} onLeft={() => setSession(null)} />;
  return <Playing session={session} state={state} refresh={refresh} onLeft={() => setSession(null)} />;
}
