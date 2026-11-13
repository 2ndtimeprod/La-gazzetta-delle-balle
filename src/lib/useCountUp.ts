import { useEffect, useState } from 'react';

// Numero che sale da `from` a `to` (punteggi).
export function useCountUp(to: number, from: number, ms = 900, delay = 350) {
  const [v, setV] = useState(from);
  useEffect(() => {
    let raf = 0; let t0 = 0;
    const f = (now: number) => {
      t0 ||= now + delay;
      const u = Math.min(1, Math.max(0, (now - t0) / ms));
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - u, 3))));
      if (u < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [to, from, ms, delay]);
  return v;
}
