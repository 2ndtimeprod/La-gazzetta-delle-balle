import type { GameState } from '../lib/api';
import { clearSession, type Session } from '../lib/session';
import Masthead from '../components/Masthead';
import Scoreboard from '../components/Scoreboard';

export default function Finished({ session, state, onLeft }: { session: Session; state: GameState; onLeft: () => void }) {
  const top = Math.max(...state.players.map((p) => p.score));
  const winners = state.players.filter((p) => p.score === top).map((p) => p.name);
  return (
    <main className="page">
      <Masthead meta="Finale" />
      <span className="kicker extra-pre" style={{ alignSelf: 'center' }}>Edizione straordinaria</span>
      <h1 className="extra">{winners.length > 1 ? `Pari merito: ${winners.join(' e ')}` : `Vince ${winners[0]}`}</h1>
      <p className="lede" style={{ textAlign: 'center' }}>Il più credibile tra i bugiardi, con {top} {top === 1 ? 'punto' : 'punti'}.</p>
      <Scoreboard players={state.players} me={state.me} />
      <div className="actions">
        <button className="btn primary" onClick={() => { clearSession(session.code); onLeft(); }}>Nuova partita</button>
      </div>
    </main>
  );
}
