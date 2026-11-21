import { useEffect } from 'react';
import { CATEGORIE } from '../lib/round';

// Sipario a tutta pagina con il nome della categoria uscita; poi si dissolve e comincia la scrittura.
export default function CategoryReveal({ face, onDone }: { face: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3600); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="catrev" role="status" aria-live="polite" onClick={onDone}>
      <div className="catrev-in">
        <span className="kicker">La categoria è</span>
        <h2><span className="cz"><span className="w">{CATEGORIE[face] ?? face}</span></span></h2>
        <i className="catrev-rule" />
      </div>
    </div>
  );
}
