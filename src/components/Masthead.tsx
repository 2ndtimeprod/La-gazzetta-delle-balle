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
          {theme === 'sera' ? 'Ed. della sera' : 'Il Quotidiano'}
        </button>
      </div>
      <div className="mast-bar">
        {big
          ? <><span className="mast-pre">La Gazzetta delle</span><span className="mast-big">Balle</span></>
          : <><span className="mast-name">La Gazzetta delle Balle</span>{meta && <span className="mast-meta">{meta}</span>}</>}
      </div>
    </header>
  );
}
