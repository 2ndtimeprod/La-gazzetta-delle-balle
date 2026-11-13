import { useCallback, useEffect, useRef, useState } from 'react';

const SEEN = 'balle:tutorial-visto';
const EVT = 'balle:tutorial';
export const openTutorial = () => window.dispatchEvent(new Event(EVT));

type Slide = { kicker: string; title: string; body: React.ReactNode; art: React.ReactNode };

const SLIDES: Slide[] = [
  {
    kicker: 'Benvenuto in redazione', title: 'Una notizia è vera. Le altre sono balle.',
    body: <>Da 3 a 12 giocatori, un telefono a testa, tutti nella stessa stanza. Ogni round esce una notizia vera ma incompleta: voi inventate il pezzo mancante e cercate di far cadere gli altri.</>,
    art: <div className="tu-art"><span className="tu-mast">La Gazzetta delle Balle</span></div>,
  },
  {
    kicker: '1 · Il narratore', title: 'A turno, uno conduce',
    body: <>Il narratore gira il tamburo ed esce la categoria. Lui vede la risposta vera, quindi non gioca la mano: legge, conduce e non fa trapelare niente. Al round dopo tocca al vicino.</>,
    art: <div className="tu-art"><span className="tu-strip">Scienza</span></div>,
  },
  {
    kicker: '2 · Scrivi', title: 'Riempi il buco con una balla',
    body: <>Tutti gli altri vedono la frase con un buco (a volte due) e inventano la risposta più credibile possibile. Col cronometro acceso avete 60 secondi.</>,
    art: <div className="tu-art"><p className="tu-sent">Il Furby fu vietato all'NSA perché temeva che <span className="gap" />.</p></div>,
  },
  {
    kicker: 'Attenzione', title: 'Non devi indovinare. Devi ingannare.',
    body: <>Scrivere la risposta vera non serve a niente: se la tua balla è uguale o troppo simile alla vera viene rifiutata e devi riscriverla. Se pensi di saperla, tienitela per il voto.</>,
    art: <div className="tu-art"><span className="tu-stamp">Troppo simile</span></div>,
  },
  {
    kicker: '3 · Vota', title: 'Trova la notizia vera',
    body: <>Il narratore legge ad alta voce tutte le risposte mescolate, vera compresa. Ognuno vota quella che crede vera. La tua balla non la puoi votare.</>,
    art: <div className="tu-art tu-letters"><i>A</i><i className="on">B</i><i>C</i><i>D</i></div>,
  },
  {
    kicker: '4 · Punti', title: 'Si vince in due modi',
    body: <><b>+1</b> se voti la risposta vera. <b>+1</b> per ogni giocatore che vota la tua balla. Se due scrivono la stessa balla, diventa una sola card e i punti vanno a entrambi.</>,
    art: <div className="tu-art tu-points"><span>+1</span><span>+1</span><span>+1</span></div>,
  },
  {
    kicker: 'Il mestiere', title: 'Scrivila come un giornalista',
    body: <>Una balla scritta male si riconosce subito. Prima di inviare controlla maiuscole e minuscole, refusi e il correttore automatico del telefono, che cambia le parole senza chiedere. Niente punto finale (la frase ha già il suo) e niente emoji.</>,
    art: <div className="tu-art tu-typo"><s>la Torre eiffel.</s><b>la Torre Eiffel</b></div>,
  },
  {
    kicker: 'Consigli della redazione', title: 'Come si diventa credibili',
    body: (
      <ul className="tu-tips">
        <li>Imita il tono della frase: la verità è spesso precisa e strana. Numeri esatti e dettagli concreti sembrano veri.</li>
        <li>Lunghezza giusta: poche parole come una risposta vera, non un tema.</li>
        <li>Non votare la più assurda per esclusione: spesso è proprio quella vera.</li>
        <li>Narratore: leggi tutto con la stessa voce, senza fermarti sulla vera.</li>
        <li>Niente sbirciatine sugli schermi degli altri.</li>
      </ul>
    ),
    art: null,
  },
];

export default function Tutorial() {
  const [open, setOpen] = useState(() => { try { return !localStorage.getItem(SEEN); } catch { return false; } });
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const start = useRef<number | null>(null);
  const last = i === SLIDES.length - 1;

  const close = useCallback(() => {
    try { localStorage.setItem(SEEN, '1'); } catch { /* ignora */ }
    setOpen(false);
  }, []);
  const go = useCallback((n: number) => {
    if (n < 0 || n >= SLIDES.length) return;
    setDir(n > i ? 1 : -1); setI(n);
  }, [i]);

  useEffect(() => {
    const show = () => { setI(0); setOpen(true); };
    window.addEventListener(EVT, show);
    return () => window.removeEventListener(EVT, show);
  }, []);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, i, go, close]);

  if (!open) return null;
  const s = SLIDES[i];
  return (
    <div className="tu-backdrop" role="dialog" aria-modal="true" aria-label="Come si gioca" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="tu-card"
        onPointerDown={(e) => { start.current = e.clientX; }}
        onPointerUp={(e) => {
          if (start.current == null) return;
          const dx = e.clientX - start.current; start.current = null;
          if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        }}>
        <div className="tu-top">
          <span className="label">Come si gioca · {i + 1}/{SLIDES.length}</span>
          <button className="theme-btn" onClick={close}>{last ? 'Chiudi' : 'Salta'}</button>
        </div>
        <div className="tu-slide" key={i} style={{ ['--d' as string]: dir }}>
          {s.art}
          <span className="kicker">{s.kicker}</span>
          <h2 className="head sm">{s.title}</h2>
          <div className="tu-body">{s.body}</div>
        </div>
        <div className="tu-dots">{SLIDES.map((_, n) => <button key={n} className={n === i ? 'on' : ''} aria-label={`Scheda ${n + 1}`} onClick={() => go(n)} />)}</div>
        <div className="choices">
          <button className="btn small" disabled={i === 0} onClick={() => go(i - 1)}>Indietro</button>
          {last
            ? <button className="btn small primary" onClick={close}>Iniziamo</button>
            : <button className="btn small primary" onClick={() => go(i + 1)}>Avanti</button>}
        </div>
      </div>
    </div>
  );
}
