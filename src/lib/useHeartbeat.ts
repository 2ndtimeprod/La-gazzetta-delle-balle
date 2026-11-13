import { useEffect } from 'react';
import { heartbeat } from './api';
import type { Session } from './session';

// Battito ogni 15 s e subito al ritorno in primo piano: il server così sa chi c'è.
export function useHeartbeat(session: Session | null, refresh: () => void) {
  useEffect(() => {
    if (!session) return;
    const beat = () => { heartbeat(session).then(refresh, () => {}); };
    beat();
    const t = setInterval(beat, 15000);
    const onVis = () => { if (document.visibilityState === 'visible') beat(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [session, refresh]);
}
