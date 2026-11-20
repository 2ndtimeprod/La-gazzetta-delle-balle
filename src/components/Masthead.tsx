import { useTheme } from '../lib/theme';

const oggi = () => new Date().toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');

// Testata comune ai due temi: stesso carattere (Playfair Display corsivo 900) in entrambe le edizioni.
export default function Masthead({ meta, big }: { meta?: string; big?: boolean }) {
  const { theme, toggle } = useTheme();
  return (
    <header className={`mast${big ? ' big' : ''}`}>
      <div className="dateline">
        <span>{oggi()}</span>
        <button className="theme-btn" onClick={toggle} aria-label="Cambia edizione">
          {theme === 'sera'
            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></svg>}
          {theme === 'sera' ? 'Ed. della sera' : 'Il Quotidiano'}
        </button>
      </div>
      <div className="mast-bar">
        {big
          ? <div className="mast-title" data-mast-title><h1 className="mast-l1">La Gazzetta</h1><div className="mast-l2">delle <em className="shine">Balle</em></div></div>
          : <><span className="mast-name">La Gazzetta delle Balle</span>{meta && <span className="mast-meta">{meta}</span>}</>}
      </div>
      {big && <div className="motto"><i /><b /><span>Il quotidiano delle verità improbabili</span><b /><i /></div>}
    </header>
  );
}
