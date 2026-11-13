import { useEffect, useMemo, useState } from 'react';

// Secondi mancanti alla scadenza, corretti con l'orologio del server (state.now).
export function useCountdown(deadline: string | null, serverNow: string) {
  const offset = useMemo(() => Date.parse(serverNow) - Date.now(), [serverNow]);
  const calc = () => (deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - (Date.now() + offset)) / 1000)) : 0);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    const t = setInterval(() => setLeft(calc()), 250);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, offset]);
  return left;
}
