import { useState } from 'react';
import { leaveRoom } from '../lib/api';
import { clearSession, type Session } from '../lib/session';

// Uscita a partita iniziata: in due passi, perché non si può rientrare.
export default function LeaveGame({ session, onLeft }: { session: Session; onLeft: () => void }) {
  const [sure, setSure] = useState(false);
  const leave = async () => { try { await leaveRoom(session); } catch { /* esci comunque */ } clearSession(session.code); onLeft(); };
  if (!sure) return <button className="btn link" onClick={() => setSure(true)}>Esci dalla partita</button>;
  return (
    <div className="stack" style={{ animation: 'rise .3s ease both' }}>
      <p className="muted" style={{ textAlign: 'center' }}>Uscendo non potrai rientrare in questa partita.</p>
      <div className="choices">
        <button className="btn small primary" onClick={leave}>Esci davvero</button>
        <button className="btn small" onClick={() => setSure(false)}>Resta</button>
      </div>
    </div>
  );
}
