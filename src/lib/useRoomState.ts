import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getState, type GameState } from './api';
import type { Session } from './session';

// Stato della stanza: Realtime segnala "qualcosa è cambiato", poi si rilegge via get_state
// (così ognuno riceve solo ciò che gli spetta). Ricarica anche al ritorno in primo piano.
export function useRoomState(session: Session | null) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [realtime, setRealtime] = useState('idle');

  const refresh = useCallback(async () => {
    if (!session) return;
    try { setState(await getState(session)); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, [session]);

  useEffect(() => {
    if (!session) { setState(null); return; }
    const code = session.code;
    void refresh();
    const ch = supabase.channel(`room-${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_code=eq.${code}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${code}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `room_code=eq.${code}` }, () => void refresh())
      .subscribe((s) => { setRealtime(s); if (s === 'SUBSCRIBED') void refresh(); });
    const onVis = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); void supabase.removeChannel(ch); };
  }, [session, refresh]);

  return { state, error, realtime, refresh };
}
