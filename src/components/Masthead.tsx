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
          ? (
            <svg className="mast-svg" viewBox="0 0 360 176" role="img" aria-label="La Gazzetta delle Balle">
              <defs>
                <path id="mast-l1" d="M4 72C100 32 250 98 356 54" />
                <path id="mast-l2" d="M4 146C100 106 250 172 356 128" />
              </defs>
              <text className="mast-t"><textPath href="#mast-l1" textLength="346" lengthAdjust="spacing">La Gazzetta</textPath></text>
              <text className="mast-t"><textPath href="#mast-l2" textLength="346" lengthAdjust="spacing">delle <tspan className="mast-red">Balle</tspan></textPath></text>
              <path className="mast-swash" d="M4 160C100 120 250 186 356 142" />
            </svg>
          )
          : <><span className="mast-name">La Gazzetta delle Balle</span>{meta && <span className="mast-meta">{meta}</span>}</>}
      </div>
    </header>
  );
}
