import type { ReactNode } from 'react';

// Illustrazioni originali a tratto, una per curiosità. Colori dai token del tema (inchiostro, rosso, oro, carta).
const A = 'var(--accent)', G = 'var(--gold)', P = 'var(--paper-2)';
const star = (cx: number, cy: number, R: number, r: number, n: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI / n) * i - Math.PI / 2, d = i % 2 ? r : R;
    return `${(cx + d * Math.cos(a)).toFixed(1)},${(cy + d * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

const DISEGNI: Record<string, ReactNode> = {
  // maiale alla forca
  'HIS-002': <>
    <path d="M12 82V10h38M12 24l14-14" /><path d="M44 10v14" /><circle cx="44" cy="30" r="6" />
    <ellipse cx="78" cy="56" rx="26" ry="16" fill={P} /><path d="M100 50c8-2 12 2 12 8s-6 8-12 6" fill={P} /><path d="M108 56h.1M108 60h.1" />
    <path d="M88 42l4-9 7 8" fill={A} /><path d="M62 70v12M72 71v11M86 71v11M94 68v14" /><path d="M52 52c-8-6-4-14 2-10" />
  </>,
  // banana radioattiva
  'FOO-057': <>
    <path d="M28 74C40 92 98 78 100 24 86 56 56 68 28 74Z" fill={G} /><path d="M100 24l-2-10" strokeWidth="4" /><circle cx="28" cy="74" r="2.5" fill="var(--ink)" />
    <path d="M34 22l6 8M52 12l3 10M16 40l9 4M70 14l-1 10" stroke={A} />
  </>,
  // distintivo di Elvis
  'POP-029': <>
    <polygon points={star(60, 46, 38, 16, 6)} fill={G} /><circle cx="60" cy="46" r="11" fill={P} />
    <path d="M52 46h16M60 38v16" /><path d="M60 8v-3M22 46h-3M101 46h-3" />
  </>,
  // giorno più corto
  'SCI-003': <>
    <circle cx="60" cy="46" r="30" fill={P} /><path d="M42 34c6-4 12 0 14 6s-6 8-10 14-8-4-8-12c0-4 2-6 4-8zM66 50c6-2 12 2 10 8s-8 8-12 4z" fill={G} />
    <path d="M60 16l-6 14 8 10-8 10 6 14" stroke={A} strokeWidth="3" /><path d="M96 22a42 42 0 0 1 8 24M104 46l-4-8M104 46l7-4" />
  </>,
  // tassa sulla barba
  'HIS-017': <>
    <circle cx="48" cy="34" r="19" fill={P} /><path d="M32 26c0-14 32-14 32 0-8-5-24-5-32 0z" fill={A} /><path d="M40 36h.1M56 36h.1" />
    <path d="M30 40c-4 24 6 40 18 40s22-16 18-40c-6 8-30 8-36 0z" fill="var(--ink)" stroke="none" />
    <circle cx="96" cy="58" r="15" fill={G} /><circle cx="96" cy="58" r="9" /><path d="M96 53v10" />
  </>,
  // webcam sul caffè
  'POP-003': <>
    <path d="M58 30h30l-4 8c8 6 10 20 6 34-1 6-6 10-12 10H58c-6 0-11-4-12-10-4-14-2-28 6-34z" fill={P} /><path d="M52 58h42l-1 14c-1 6-5 8-11 8H62c-6 0-10-2-11-8z" fill={A} />
    <path d="M58 30h30M52 24h42" />
    <rect x="8" y="14" width="30" height="20" rx="4" fill={P} /><circle cx="23" cy="24" r="6" fill="var(--ink)" /><path d="M23 34v8M16 42h14" />
  </>,
  // moka di Bialetti
  'FOO-090': <>
    <path d="M40 76l6-30h28l6 30z" fill={P} /><path d="M46 46l-4-22h36l-4 22z" fill={P} /><path d="M36 24h44l-4-8H40z" fill={A} />
    <path d="M80 30c16-2 16 28 0 26M36 24l-8-4" /><path d="M38 76h44v6H38z" fill="var(--ink)" /><path d="M54 24v22M66 24v22M50 60h20" />
  </>,
  // maratona del 1904
  'HIS-010': <>
    <path d="M22 28h12v10l6 8v32H16V46l6-8z" fill={P} /><path d="M18 62h20" /><path d="M24 52l8 14M32 52l-8 14" stroke={A} strokeWidth="3" />
    <circle cx="86" cy="22" r="7" fill={P} /><path d="M82 32l-8 20 12 8v18M82 36l16 10 8-4M74 52l-14 10M86 60l16 8" />
  </>,
  // Plutone e la sua orbita
  'SCI-080': <>
    <ellipse cx="52" cy="48" rx="46" ry="26" strokeDasharray="4 5" /><circle cx="40" cy="46" r="10" fill={G} />
    <path d="M40 30v-5M40 66v5M24 46h-5M56 46h5" stroke={G} /><circle cx="96" cy="60" r="5" fill={A} />
    <path d="M100 74l8 8M108 74l-8 8" />
  </>,
  // margarina rosa
  'FOO-026': <>
    <path d="M20 42h62v34H20z" fill={A} opacity=".5" /><path d="M20 42l16-16h62L82 42z" fill={A} opacity=".3" /><path d="M82 42l16-16v34L82 76z" fill={A} opacity=".7" />
    <path d="M20 42h62v34H20zM20 42l16-16h62L82 42M82 42v34l16-16V26" />
    <path d="M70 18l24 4-26 8z" fill={P} />
  </>,
  // tiro alla fune
  'POP-018': <>
    <path d="M6 54h108" strokeWidth="3.2" /><path d="M60 54v-14l12 4-12 6" fill={A} />
    <circle cx="22" cy="28" r="6" fill={P} /><path d="M24 36l-6 18-10 22M18 54l8 22M24 40l14 12" />
    <circle cx="98" cy="28" r="6" fill={P} /><path d="M96 36l6 18 10 22M102 54l-8 22M96 40L82 52" />
  </>,
  // fantino
  'HIS-015': <>
    <path d="M36 80V42a24 24 0 0 1 48 0v38H70V44a10 10 0 0 0-20 0v36z" fill={G} /><circle cx="43" cy="52" r="2" fill="var(--ink)" /><circle cx="77" cy="52" r="2" fill="var(--ink)" /><circle cx="43" cy="68" r="2" fill="var(--ink)" /><circle cx="77" cy="68" r="2" fill="var(--ink)" />
    <path d="M6 86h108" stroke={A} />
  </>,
  // silfio
  'FOO-003': <>
    <path d="M60 84V28M60 66c-14-2-22-10-24-22M60 54c14-2 20-8 24-18M60 76c-10 0-18-4-22-10" />
    <path d="M60 28c-14-4-22-12-24-20M60 28c0-10 0-14 0-20M60 28c14-4 22-12 24-20" /><circle cx="36" cy="8" r="2" fill="var(--ink)" /><circle cx="60" cy="8" r="2" fill="var(--ink)" /><circle cx="84" cy="8" r="2" fill="var(--ink)" />
    <path d="M96 62c-10-8-6-16 0-12 6-4 10 4 0 12z" fill={A} />
  </>,
  // Play-Doh e carta da parati
  'POP-039': <>
    <rect x="10" y="22" width="50" height="46" rx="3" fill={P} /><path d="M18 22v46M28 22v46M38 22v46M48 22v46" stroke={A} />
    <path d="M10 68c10 10 40 10 50 0" /><path d="M10 22c10-8 40-8 50 0" />
    <path d="M72 70c-4-14 4-22 14-20 6-8 22-2 20 12 6 6 2 14-8 14H78c-6 0-8-2-6-6z" fill={G} />
  </>,
  // annusatori di caffè
  'FOO-019': <>
    <ellipse cx="34" cy="50" rx="20" ry="28" fill="var(--ink)" transform="rotate(30 34 50)" /><path d="M20 28c14 12 2 22 28 36" stroke="var(--paper)" strokeWidth="3" />
    <path d="M84 18c-10 8-10 20-6 30-6 2-8 8-2 10 6 2 14-4 14-14 0-10 0-18-6-26z" fill={P} />
    <path d="M60 30c-6-4 4-8-2-12M62 42c-8-2 4-8-4-12" stroke={A} />
  </>,
  // oro letterario 1912
  'POP-060': <>
    <path d="M42 8l18 30 18-30" /><circle cx="60" cy="58" r="26" fill={G} /><circle cx="60" cy="58" r="19" />
    <path d="M48 70c6-4 10-12 18-22l4 2c-8 10-12 18-20 26z" fill={P} /><path d="M70 50l-2-6" />
  </>,
  // Pac-Man e la pizza
  'FOO-087': <>
    <path d="M66 46L108 28A46 46 0 1 0 108 64z" transform="translate(-44 0) scale(.9) translate(8 4)" fill={G} />
    <circle cx="26" cy="38" r="6" fill={A} /><circle cx="30" cy="64" r="6" fill={A} /><circle cx="48" cy="48" r="5" fill={A} />
    <path d="M70 46l36-12 4 8z" fill={P} /><circle cx="94" cy="44" r="3" fill={A} />
  </>,
  // fosforo che brilla
  'SCI-007': <>
    <path d="M50 10h20v20l22 36c4 8-2 16-10 16H38c-8 0-14-8-10-16l22-36z" fill={P} /><path d="M38 66h44l6 10c2 4 0 8-6 8H38c-6 0-8-4-6-8z" fill={G} />
    <path d="M60 50v8M50 52l2 6M70 52l-2 6" stroke={G} /><path d="M14 26l8 4M106 26l-8 4M10 50h8M102 50h8" stroke={G} />
  </>,
  // casu marzu
  'FOO-064': <>
    <path d="M8 66L74 22l38 30v22H8z" fill={G} /><path d="M8 66h104" /><path d="M74 22v52" />
    <circle cx="36" cy="68" r="4" fill={P} /><circle cx="60" cy="60" r="5" fill={P} /><circle cx="92" cy="62" r="4" fill={P} />
    <path d="M50 44c-3-2-3-5 0-6s3-4 0-5M84 40c-3-2-3-5 0-6" stroke={A} strokeWidth="3" />
  </>,
  // cubo d'oro con omino
  'SCI-004': <>
    <path d="M34 34l24-14 30 14v36L58 86 34 70z" fill={G} /><path d="M34 34l24 14 30-14M58 48v38" />
    <circle cx="14" cy="64" r="2.5" fill="var(--ink)" /><path d="M14 67v10M10 71h8M14 77l-3 6M14 77l3 6" strokeWidth="1.8" />
  </>,
};

export default function Illustrazione({ id }: { id: string }) {
  return (
    <svg className="illu" viewBox="0 0 120 90" role="img" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {DISEGNI[id]}
    </svg>
  );
}
