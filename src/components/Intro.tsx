import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Apertura dell'app: il titolo viene "battuto a macchina" al centro dello schermo, poi rimpicciolisce
// e atterra esattamente sulla testata della home (elemento [data-mast-title]). Una volta per caricamento.
const L1 = 'La Gazzetta', L2 = 'delle Balle';
const TOTAL = L1.length + L2.length;
export const INTRO_END = 'balle:intro-end';
let shown = false;

type Phase = 'type' | 'fly' | 'tail';
type Box = { left: number; top: number; width: number; height: number };

const target = () => document.querySelector<HTMLElement>('[data-mast-title]');
const measure = (): Box => {
  const r = target()?.getBoundingClientRect();
  if (r && r.width > 0) return { left: r.left, top: r.top, width: r.width, height: r.height };
  const w = Math.min(window.innerWidth - 44, 436);
  return { left: (window.innerWidth - w) / 2, top: window.innerHeight / 2 - 60, width: w, height: 120 };
};

export default function Intro() {
  const [on, setOn] = useState(() =>
    !shown && !matchMedia('(prefers-reduced-motion: reduce)').matches && !new URLSearchParams(location.search).has('anteprima'));
  useEffect(() => { shown = true; }, []);
  const [phase, setPhase] = useState<Phase>('type');
  const [n, setN] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [ready, setReady] = useState(false);
  const title = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const startT = useRef('none'); // posizione di partenza (centro, ingrandito) del titolo

  useLayoutEffect(() => {
    if (!on) return;
    document.body.classList.add('intro-on');
    return () => document.body.classList.remove('intro-on');
  }, [on]);

  // Si parte quando i font sono pronti, così la misura della testata è quella definitiva.
  useEffect(() => {
    if (!on) return;
    let dead = false;
    const go = () => { if (!dead) { setBox(measure()); setReady(true); } };
    Promise.race([
      document.fonts?.load('italic 900 57px "Playfair Display"') ?? Promise.resolve(),
      new Promise((r) => setTimeout(r, 900)),
    ]).then(go, go);
    return () => { dead = true; };
  }, [on]);

  useEffect(() => {
    if (!on || !ready || phase !== 'type') return;
    if (n >= TOTAL) { const t = setTimeout(() => setPhase('fly'), 650); return () => clearTimeout(t); }
    const t = setTimeout(() => setN((x) => x + 1), 70 + Math.random() * 70);
    return () => clearTimeout(t);
  }, [on, ready, phase, n]);

  useEffect(() => {
    if (phase !== 'fly' || !title.current) return;
    setBox(measure()); // misura fresca: la pagina può essersi assestata
    const a = title.current.animate([{ transform: startT.current }, { transform: 'none' }],
      { duration: 1050, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' });
    veil.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1050, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = () => setPhase('tail');
    return () => a.cancel();
  }, [phase]);

  useEffect(() => {
    if (phase !== 'tail') return;
    document.body.classList.remove('intro-on'); // la pagina si rivela sotto al titolo, che resta un attimo
    window.dispatchEvent(new Event(INTRO_END));
    const t = setTimeout(() => setOn(false), 700);
    return () => clearTimeout(t);
  }, [phase]);

  if (!on) return null;
  const skip = () => { if (phase === 'type') { setN(TOTAL); setPhase('fly'); } };
  const vw = window.innerWidth, vh = window.innerHeight;
  const b = box ?? measure();
  const s = Math.min(1.3, (vw - 40) / b.width);
  const dx = vw / 2 - (b.left + b.width / 2), dy = vh / 2 - (b.top + b.height / 2);
  const start = `translate(${dx}px, ${dy}px) scale(${s})`;
  if (phase === 'type') startT.current = start;
  const ch = (txt: string, off: number, red = 0) => [...txt].map((c, i) => {
    const k = off + i;
    return <span key={k} className={`ch${k < n ? ' on' : ''}${k === n - 1 && phase === 'type' ? ' cur' : ''}${i >= red && red ? ' red' : ''}`}>{c === ' ' ? ' ' : c}</span>;
  });

  return (
    <div className="intro" onClick={skip} aria-hidden="true">
      <div className="intro-veil" ref={veil} />
      {ready && (
        <div className="intro-title" ref={title} style={{ left: b.left, top: b.top, width: b.width, height: b.height, transform: phase === 'type' ? start : 'none' }}>
          <div className="mast-l1">{ch(L1, 0)}</div>
          <div className="mast-l2">{ch(L2, L1.length, 6)}</div>
        </div>
      )}
    </div>
  );
}
