import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../lib/api';
import { nameOf } from '../lib/round';
import { useCountdown } from '../lib/useCountdown';

// Timbro gigante a tutti quando parte un dibattito, poi una barra col conto alla rovescia.
export default function DebateStamp({ state }: { state: GameState }) {
  const until = state.round?.debate_until ?? null;
  const seen = useRef<string | null | undefined>(undefined);
  const [stamp, setStamp] = useState(false);
  const left = useCountdown(until, state.now);
  useEffect(() => {
    // al primo stato (anche rientrando a dibattito in corso) non si ripete il timbro
    if (seen.current !== undefined && until && until !== seen.current && left > 0) setStamp(true);
    seen.current = until;
  }, [until]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!stamp) return; const t = setTimeout(() => setStamp(false), 3200); return () => clearTimeout(t); }, [stamp]);
  const who = state.round?.debate_by ? nameOf(state.players, state.round.debate_by) : '';
  return (
    <>
      {left > 0 && !stamp && (
        <div className="debate-bar" role="status">Dibattito di {who}: <b>0:{String(left).padStart(2, '0')}</b></div>
      )}
      {stamp && (
        <div className="debate-over" role="alert" onClick={() => setStamp(false)}>
          <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
            <filter id="stamp-rough" x="-8%" y="-8%" width="116%" height="116%">
              <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="warp" />
              <feDisplacementMap in="SourceGraphic" in2="warp" scale="6" result="rough" />
              <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="11" result="grain" />
              <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.6 -0.45" result="holes" />
              <feComposite in="rough" in2="holes" operator="in" />
            </filter>
          </svg>
          <div className="debate-stamp">Dibattito!</div>
          <p className="debate-sub"><b>{who}</b> ha lanciato un dibattito: avete 60 secondi per discutere.</p>
        </div>
      )}
    </>
  );
}
