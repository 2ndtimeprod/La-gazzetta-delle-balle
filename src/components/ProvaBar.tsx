import { useEffect } from 'react';
import { heartbeat, type GameState } from '../lib/api';
import { saveSession, type Session } from '../lib/session';

// Barra della stanza di prova: cambia giocatore con un tocco e tiene vivi i battiti di tutti.
export default function ProvaBar({ sessions, session, state, onPick }: {
  sessions: Session[]; session: Session; state: GameState | null; onPick: (s: Session) => void;
}) {
  useEffect(() => {
    const beat = () => sessions.forEach((s) => { heartbeat(s).catch(() => {}); });
    const t = setInterval(beat, 15000);
    return () => clearInterval(t);
  }, [sessions]);
  const nome = (id: string) => state?.players.find((p) => p.id === id)?.name ?? '?';
  return (
    <nav className="prova-bar" aria-label="Stanza di prova">
      <span>Prova:</span>
      {sessions.map((s) => (
        <button key={s.playerId} className={s.playerId === session.playerId ? 'on' : ''}
          onClick={() => { saveSession(s); onPick(s); }}>
          {nome(s.playerId)}{state?.round?.narrator_id === s.playerId ? ' (N)' : ''}
        </button>
      ))}
    </nav>
  );
}
