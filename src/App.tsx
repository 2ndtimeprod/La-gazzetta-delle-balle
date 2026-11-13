import { useCallback, useEffect, useRef, useState } from 'react';
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
import './theme/tutorial.css';
import './theme/intro.css';
import Intro from './components/Intro';
import EdizioneStraordinaria from './components/EdizioneStraordinaria';
import Tutorial from './components/Tutorial';
import Toast from './components/Toast';
import Waiting from './components/Waiting';

import Anteprima from './dev/Anteprima';
const ANTEPRIMA = import.meta.env.DEV ? new URLSearchParams(location.search).get('anteprima') : null;

const DEAD = ['Stanza non trovata.', 'Sessione non valida.'];

function Screens() {
  const [session, setSession] = useState<Session | null>(() => lastSession());
  const { state, error, refresh } = useRoomState(session);
  useHeartbeat(session, refresh);

  // Sessione salvata ma stanza sparita o giocatore non più valido: torna alla home.
  useEffect(() => {
    if (session && error && DEAD.includes(error)) { clearSession(session.code); setSession(null); }
  }, [session, error]);

  // Inizio partita: da 'lobby' a 'playing' si vede l'edizione straordinaria (non al rientro a partita in corso).
  const phase = state?.room.phase ?? null;
  const prev = useRef<string | null>(null);
  const [edi, setEdi] = useState(false);
  useEffect(() => {
    if (prev.current === 'lobby' && phase === 'playing') setEdi(true);
    prev.current = phase;
  }, [phase]);
  const endEdi = useCallback(() => setEdi(false), []);

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
  return <><Playing session={session} state={state} refresh={refresh} onLeft={() => setSession(null)} />{edi && <EdizioneStraordinaria state={state} onDone={endEdi} />}</>;
}

export default function App() {
  return <><Screens /><Intro /><Tutorial /></>;
}
