import type { GameState } from '../lib/api';
import { clearSession, type Session } from '../lib/session';
import Scoreboard from '../components/Scoreboard';

export default function Finished({ session, state, onLeft }: { session: Session; state: GameState; onLeft: () => void }) {
  const top = Math.max(...state.players.map((p) => p.score));
  const winners = state.players.filter((p) => p.score === top).map((p) => p.name).join(' e ');
  return (
    <main className="page">
      <header className="masthead"><small>Partita finita</small><h1>Vince {winners}</h1></header>
      <Scoreboard players={state.players} me={state.me} />
      <button className="primary" onClick={() => { clearSession(session.code); onLeft(); }}>Torna alla home</button>
    </main>
  );
}
