import { useState } from 'react';

// Esegue un'azione (RPC), mostra l'errore in italiano e ricarica lo stato.
export function useAct(refresh: () => void) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    try { await f(); setErr(''); refresh(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return { err, busy, run };
}
