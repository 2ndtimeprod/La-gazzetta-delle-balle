import { useEffect } from 'react';
import type { GameState } from '../lib/api';

// Overlay a inizio partita: un'edizione straordinaria che ruota a schermo e si dissolve.
export default function EdizioneStraordinaria({ state, onDone }: { state: GameState; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2900); return () => clearTimeout(t); }, [onDone]);
  const n = state.players.length, giri = state.room.settings.giri;
  const narr = state.players.find((p) => p.id === state.round?.narrator_id)?.name;
  return (
    <div className="edi" aria-hidden="true" onClick={onDone}>
      <div className="edi-sheet">
        <div className="edi-mast">La Gazzetta delle <em>Balle</em></div>
        <span className="kicker">Edizione straordinaria</span>
        <h2 className="edi-head">Si comincia!</h2>
        <p className="edi-sub">{n} inviati in redazione · {giri} {giri === 1 ? 'giro' : 'giri'}</p>
        <div className="edi-cols"><i /><i /><i /></div>
        {narr && <p className="edi-narr">Primo a condurre: <b>{narr}</b></p>}
      </div>
    </div>
  );
}
