import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIE, NORMALI } from '../lib/round';
import { Flapper, N, R, SA, mod, tick, unlockAudio, vibrate } from '../lib/drum';

const CODES: Record<string, string> = {
  History: 'STO', 'Pop culture': 'POP', Geography: 'GEO', 'Animal kingdom': 'ANI',
  Science: 'SCI', 'Food & Drink': 'CIB', 'Dark/Politically incorrect': 'DRK', Jolly: 'JLY',
};

type Props = {
  dark: boolean;                          // settima faccia: Dark (acceso) o Jolly (spento)
  interactive: boolean;
  onSpin?: () => Promise<string>;         // chiede al server la faccia; l'animazione è solo scena
  onLanded?: (face: string) => void;
};
type Phase = 'idle' | 'hold' | 'coast' | 'land' | 'done';

const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export default function Drum({ dark, interactive, onSpin, onLanded }: Props) {
  const faces = useMemo(() => [...NORMALI, dark ? 'Dark/Politically incorrect' : 'Jolly'], [dark]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<string | null>(null);
  const axis = useRef<HTMLDivElement>(null);
  const shades = useRef<(HTMLDivElement | null)[]>([]);
  const flapL = useRef<HTMLDivElement>(null);
  const flapR = useRef<HTMLDivElement>(null);
  const cb = useRef({ onSpin, onLanded, faces });
  cb.current = { onSpin, onLanded, faces };

  // Stato mutabile del motore: niente re-render a ogni fotogramma.
  const m = useRef({
    pos: -SA * 0.0, vel: 0, phase: 'idle' as Phase, raf: 0, t: 0,
    lastY: 0, scale: 1, samples: [] as { p: number; t: number }[],
    land: null as null | { from: number; dir: number; D: number; T: number; t: number; face: string },
    pending: null as null | { face: string } | { error: true },
    flap: new Flapper((s) => { tick(s); vibrate(4); }),
  }).current;

  const go = (p: Phase) => { m.phase = p; setPhase(p); };

  useEffect(() => {
    // lunghezza reale della lancetta (dal perno a 9 px dal bordo fino alla punta)
    const w = flapL.current?.getBoundingClientRect().width ?? 45;
    m.flap.L = Math.max(20, w - 9);
    paint();
    return () => cancelAnimationFrame(m.raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function paint() {
    if (axis.current) axis.current.style.transform = `rotateX(${m.pos.toFixed(3)}deg)`;
    for (let i = 0; i < N; i++) {
      const e = mod(i * SA + m.pos + 180, 360) - 180;
      const el = shades.current[i];
      if (el) el.style.opacity = Math.min(0.85, Math.pow(Math.abs(e) / 90, 1.5) * 0.9).toFixed(3);
    }
    const th = m.flap.th.toFixed(2);
    if (flapL.current) flapL.current.style.transform = `rotate(${th}deg)`;
    if (flapR.current) flapR.current.style.transform = `rotate(${-m.flap.th}deg)`;
  }

  function startLoop() {
    if (m.raf) return;
    m.t = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(1 / 30, Math.max(1 / 240, (now - m.t) / 1000));
      m.t = now;
      step(dt);
      paint();
      const busy = m.phase === 'hold' || m.phase === 'coast' || m.phase === 'land';
      m.raf = busy || !m.flap.resting() ? requestAnimationFrame(frame) : 0;
    };
    m.raf = requestAnimationFrame(frame);
  }

  function step(dt: number) {
    if (m.phase === 'coast') {
      m.vel *= Math.exp(-0.25 * dt);
      if (Math.abs(m.vel) < 420) m.vel = Math.sign(m.vel || -1) * 420;   // in attesa del server non si ferma
      m.pos += m.vel * dt;
      if (m.pending) planLanding();
    } else if (m.phase === 'land' && m.land) {
      const L = m.land; L.t += dt;
      const u = Math.min(1, L.t / L.T);
      const prev = m.pos;
      m.pos = L.from + L.dir * L.D * (1 - Math.pow(1 - u, 3));
      m.vel = (m.pos - prev) / dt;
      if (u >= 1) {
        m.vel = 0; tick(1, true); vibrate([14, 30, 22]);
        go('done'); setResult(L.face);
        const f = L.face;
        setTimeout(() => cb.current.onLanded?.(f), 420);
      }
    }
    m.flap.step(dt, m.pos);
  }

  // Atterraggio: curva cubica che parte con la velocità attuale e si ferma esattamente sulla faccia.
  function planLanding() {
    const p = m.pending!; m.pending = null;
    const dir = Math.sign(m.vel) || -1;
    const v = Math.abs(m.vel);
    let idx: number;
    if ('error' in p) idx = mod(Math.round(-m.pos / SA), N);
    else idx = Math.max(0, cb.current.faces.indexOf(p.face));
    const red = reducedMotion();
    const Dmin = red ? 0 : Math.max(200, (v * v) / (2 * 1500));
    const tgt = mod(-idx * SA, 360);
    const after = m.pos + dir * Dmin;
    const extra = dir > 0 ? mod(tgt - after, 360) : mod(after - tgt, 360);
    const D = Dmin + extra;
    const T = red ? 0.5 : Math.max(0.9, (3 * D) / Math.max(v, 300));
    m.land = { from: m.pos, dir, D, T, t: 0, face: 'error' in p ? '' : p.face };
    go('land');
  }

  async function launch(v: number) {
    unlockAudio();
    m.vel = Math.max(-3200, Math.min(3200, v));
    setResult(null); go('coast'); startLoop();
    try { m.pending = { face: await cb.current.onSpin!() }; }
    catch { m.pending = { error: true }; }
  }

  const can = interactive && (phase === 'idle' || phase === 'done') && !result && !!onSpin;

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!can || reducedMotion()) return;
    unlockAudio();
    const el = e.currentTarget;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignora */ }
    m.lastY = e.clientY;
    m.scale = el.getBoundingClientRect().height / (el.offsetHeight || 1) || 1;
    m.samples = [{ p: m.pos, t: performance.now() }];
    go('hold'); startLoop();
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (m.phase !== 'hold') return;
    const dy = (e.clientY - m.lastY) / m.scale;
    m.lastY = e.clientY;
    m.pos -= (dy / R) * (180 / Math.PI);       // il dito trascina la superficie del cilindro
    m.samples.push({ p: m.pos, t: performance.now() });
    if (m.samples.length > 6) m.samples.shift();
  };
  const up = () => {
    if (m.phase !== 'hold') return;
    const a = m.samples[0], z = m.samples[m.samples.length - 1];
    let v = (z.p - a.p) / (Math.max(16, z.t - a.t) / 1000);
    if (performance.now() - z.t > 120) v = 0;                  // dito fermo prima di lasciare
    if (Math.abs(v) < 500) v = (Math.sign(v) || -1) * (900 + Math.random() * 500); // spinta minima
    void launch(v);
  };
  const auto = () => launch((Math.random() < 0.5 ? -1 : 1) * (1300 + Math.random() * 1300));

  const label = phase === 'hold' ? 'Lascia andare' : phase === 'coast' || phase === 'land' ? 'Gira…' : can ? 'Trascina il tamburo' : '';

  return (
    <div className="drum-wrap">
      <div className="tray">
        <div className={`drum-view${can ? '' : ' locked'}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          role="img" aria-label="Tamburo delle categorie">
          <div className="drum-axis" ref={axis} aria-hidden="true">
            {faces.map((f, i) => (
              <div key={f} className={`face${i % 2 ? ' alt' : ''}${f === 'Jolly' ? ' special' : ''}${f.startsWith('Dark') ? ' dark' : ''}`}
                style={{ transform: `rotateX(${(i * SA).toFixed(3)}deg) translateZ(${R}px)` }}>
                <i className="stud l" /><i className="stud r" />
                <span className="code">{CODES[f]}</span>
                <span className="lbl">{CATEGORIE[f]}</span>
                <span className="num">0{i + 1}/07</span>
                <div className="shade" ref={(el) => { shades.current[i] = el; }} />
              </div>
            ))}
          </div>
          <div className="drum-glass" />
        </div>
        <div className="flap l" ref={flapL} aria-hidden="true"><Pointer /></div>
        <div className="flap r" ref={flapR} aria-hidden="true"><Pointer mirror /></div>
        <div className="tray-label">{label}</div>
      </div>
      <div className="result" aria-live="polite">
        {result && <span className="result-chip">{CATEGORIE[result]}</span>}
      </div>
      {interactive && !result && (
        <button className="btn small" disabled={!can} onClick={auto}>Lancialo tu per me</button>
      )}
    </div>
  );
}

// Lancetta: perno a vite + lama rossa con riflesso.
function Pointer({ mirror }: { mirror?: boolean }) {
  return (
    <svg viewBox="0 0 46 26" preserveAspectRatio="none" style={mirror ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M4 7 L44 13 L4 19 Z" fill="var(--flap)" stroke="var(--flap-edge)" strokeWidth="1" strokeLinejoin="round" />
      <path d="M6 9 L40 12.6 L6 12 Z" fill="var(--flap-hi)" opacity=".55" />
      <circle cx="9" cy="13" r="6.5" fill="var(--pivot)" stroke="var(--flap-edge)" strokeWidth="1" />
      <path d="M5.5 13h7" stroke="var(--flap-edge)" strokeWidth="1.3" />
    </svg>
  );
}
