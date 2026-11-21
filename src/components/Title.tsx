// Testata "Sotto Censura": Anton schiacciato, con bordi d'inchiostro irregolari (filtro #sc-ink) e ogni lettera
// un po' storta, come battuta a mano. CENSURA sparisce a intervalli dietro un alone rosso con la linea sotto.
// `typed` (solo nell'intro) mostra le prime n lettere; `mode`: 'loop' in home, 'still' fermo, 'flick' tre lampi rapidi.

const W1 = 'SOTTO', W2 = 'CENSURA';
export const TITLE_LENGTH = W1.length + W2.length;

// spostamenti piccoli e fissi, uguali a ogni caricamento
const jitter = (k: number) => {
  const r = (i: number) => { const x = Math.sin((k + i) * 12.9898) * 43758.5453; return x - Math.floor(x); };
  return `translateY(${((r(0) - 0.5) * 5).toFixed(1)}px) rotate(${((r(40) - 0.5) * 4).toFixed(1)}deg)`;
};

// Filtro dei bordi d'inchiostro: va montato una sola volta nella pagina.
export function InkFilter() {
  return (
    <svg className="sc-defs" aria-hidden="true" focusable="false">
      <filter id="sc-ink" x="-4%" y="-8%" width="108%" height="116%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={4} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={3} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

export default function Title({ typed, cursor, mode = 'loop' }: { typed?: number; cursor?: boolean; mode?: 'loop' | 'still' | 'flick' }) {
  const ch = (word: string, off: number) => [...word].map((c, i) => {
    const k = off + i;
    const hidden = typed != null && k >= typed;
    const cur = cursor && typed != null && k === typed - 1;
    return <span key={k} className={`k${hidden ? ' off' : typed != null ? ' hit' : ''}${cur ? ' cur' : ''}`} style={{ transform: jitter(k + 1) }}>{c}</span>;
  });
  return (
    <h1 className={`sc-title ${mode}`} aria-label="Sotto Censura">
      <span className="l1" aria-hidden="true">{ch(W1, 0)}</span>
      <span className="l2" aria-hidden="true">
        <span className="w">{ch(W2, W1.length)}</span>
        <i className="sc-halo" /><i className="sc-line" />
      </span>
    </h1>
  );
}
