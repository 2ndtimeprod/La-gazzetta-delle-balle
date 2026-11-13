import { useCallback, useEffect, useRef, useState } from 'react';

import { INTRO_END } from './Intro';

const SEEN = 'balle:tutorial-visto';
const EVT = 'balle:tutorial';
export const openTutorial = () => window.dispatchEvent(new Event(EVT));

type Slide = { kicker: string; title: string; body: React.ReactNode; art: React.ReactNode };

const SLIDES: Slide[] = [
  {
    kicker: 'Benvenuto in redazione', title: 'Una notizia è vera. Le altre sono balle.',
    body: <><u className="hl">Da 3 a 12 giocatori</u>, un telefono a testa, tutti nella stessa stanza. Ogni round esce una notizia vera ma incompleta: <u className="hl">voi inventate il pezzo mancante</u> e <u className="hl">cercate di far cadere gli altri</u>.</>,
    art: <div className="tu-art"><span className="tu-mast">La Gazzetta delle Balle</span></div>,
  },
  {
    kicker: '1 · Il narratore', title: 'A turno, uno conduce',
    body: <>Il narratore gira il tamburo ed esce la categoria. <u className="hl">Lui vede la risposta vera, quindi non gioca la mano</u>: legge, conduce e non fa trapelare niente. Al round dopo tocca al vicino.</>,
    art: <div className="tu-art"><span className="tu-strip">Scienza</span></div>,
  },
  {
    kicker: '2 · Scrivi', title: 'Riempi il buco con una balla',
    body: <>Tutti gli altri vedono la frase con un buco (a volte due) e <u className="hl">inventano la risposta più credibile possibile</u>. Col cronometro acceso avete <u className="hl">60 secondi</u>.</>,
    art: <div className="tu-art"><p className="tu-sent">Il Furby fu vietato all'NSA perché temeva che <span className="gap" />.</p></div>,
  },
  {
    kicker: 'Attenzione', title: 'Non devi indovinare. Devi ingannare.',
    body: <><u className="hl">Scrivere la risposta vera non serve a niente</u>: se la tua balla è uguale o troppo simile alla vera <u className="hl">viene rifiutata e devi riscriverla</u>. Se pensi di saperla, tienitela per il voto.</>,
    art: <div className="tu-art"><span className="tu-stamp">Troppo simile</span></div>,
  },
  {
    kicker: '3 · Vota', title: 'Trova la notizia vera',
    body: <>Il narratore legge ad alta voce tutte le risposte mescolate, vera compresa. <u className="hl">Ognuno vota quella che crede vera</u>. <u className="hl">La tua balla non la puoi votare</u>.</>,
    art: <div className="tu-art tu-letters"><i>A</i><i className="on">B</i><i>C</i><i>D</i></div>,
  },
  {
    kicker: '4 · Punti', title: 'Si vince in due modi',
    body: <><u className="hl"><b>+1</b> se voti la risposta vera</u>. <u className="hl"><b>+1</b> per ogni giocatore che vota la tua balla</u>. Se due scrivono la stessa balla, <u className="hl">diventa una sola card</u> e i punti vanno a entrambi.</>,
    art: <div className="tu-art tu-points"><span>+1</span><span>+1</span><span>+1</span></div>,
  },
  {
    kicker: 'Il mestiere', title: 'Scrivila come un giornalista',
    body: <>Una balla scritta male si riconosce subito. Prima di inviare <u className="hl">controlla maiuscole e minuscole, refusi e il correttore automatico</u> del telefono, che cambia le parole senza chiedere. <u className="hl">Niente punto finale</u> (la frase ha già il suo) e niente emoji.</>,
    art: <div className="tu-art tu-typo"><s>la Torre eiffel.</s><b>la Torre Eiffel</b></div>,
  },
  {
    kicker: 'Consigli della redazione', title: 'Come si diventa credibili',
    body: (
      <ul className="tu-tips">
        <li><u className="hl">Imita il tono della frase</u>: la verità è spesso precisa e strana. Numeri esatti e dettagli concreti sembrano veri.</li>
        <li><u className="hl">Lunghezza giusta</u>: poche parole come una risposta vera, non un tema.</li>
        <li><u className="hl">Non votare la più assurda per esclusione</u>: spesso è proprio quella vera.</li>
        <li>Narratore: <u className="hl">leggi tutto con la stessa voce</u>, senza fermarti sulla vera.</li>
        <li>Niente sbirciatine sugli schermi degli altri.</li>
      </ul>
    ),
    art: null,
  },
];

export default function Tutorial() {
  const [open, setOpen] = useState(false);
  // Al primo avvio si apre dopo l'animazione di apertura (o subito, se non c'è).
  useEffect(() => {
    let first = false;
    try { first = !localStorage.getItem(SEEN); } catch { /* ignora */ }
    if (!first) return;
    if (!document.body.classList.contains('intro-on')) { setOpen(true); return; }
    const h = () => setOpen(true);
    window.addEventListener(INTRO_END, h, { once: true });
    return () => window.removeEventListener(INTRO_END, h);
  }, []);
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
