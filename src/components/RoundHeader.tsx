import { CATEGORIE, type RoundProps } from '../lib/round';
import { useTheme } from '../lib/theme';

// Testatina squadrata in cima alle schermate di gioco: round, categoria, narratore, edizione.
export default function RoundHeader({ state }: Pick<RoundProps, 'state'>) {
  const r = state.round!;
  const { theme, toggle } = useTheme();
  const mine = r.narrator_id === state.me;
  const narr = state.players.find((p) => p.id === r.narrator_id);
  return (
    <nav className="capsule" aria-label="Round">
      <span className="cap-main">
        <span className="cap-meta">Round {r.idx + 1} di {r.total}</span>
        {(r.category ?? r.pending_category)
          ? <span className="cap-cat">{CATEGORIE[(r.category ?? r.pending_category)!] ?? r.category ?? r.pending_category}</span>
          : <span className="cap-cat mast">Si gira il tamburo</span>}
      </span>
      {mine
        ? <span className="cap-chip hot">Narri tu</span>
        : narr && (
          <span className={`cap-chip${narr.connected ? '' : ' off'}`}>
            <span className="cap-who"><small>{narr.connected ? 'Narra' : 'Offline'}</small><b>{narr.name}</b></span>
          </span>
        )}
      <button className="cap-btn" onClick={toggle} aria-label={theme === 'sera' ? 'Passa al Quotidiano' : "Passa all'Edizione della sera"}>
        {theme === 'sera'
          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>}
      </button>
    </nav>
  );
}
