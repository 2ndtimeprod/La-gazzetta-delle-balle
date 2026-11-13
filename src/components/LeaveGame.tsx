import { useState } from 'react';
import { leaveRoom } from '../lib/api';
import { clearSession, type Session } from '../lib/session';

// Uscita a partita iniziata: in due passi, perché non si può rientrare.
export default function LeaveGame({ session, onLeft }: { session: Session; onLeft: () => void }) {
  const [sure, setSure] = useState(false);
  const leave = async () => { try { await leaveRoom(session); } catch { /* esci comunque */ } clearSession(session.code); onLeft(); };
  return (
    <div className="page leave">
      {!sure
        ? <button onClick={() => setSure(true)}>Esci dalla partita</button>
        : <div className="row"><button className="primary" onClick={leave}>Esci davvero</button><button onClick={() => setSure(false)}>Resta</button></div>}
      {sure && <p className="muted">Non potrai rientrare in questa partita.</p>}
    </div>
  );
}
