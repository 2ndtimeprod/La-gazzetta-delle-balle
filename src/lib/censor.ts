import type { Token } from './api';

// Stessa regola del server (private.censor): parole censurate di fila = un buco; la punteggiatura tra due
// parole censurate sparisce con loro. Serve all'anteprima del narratore.
export function censorPreview(tokens: Token[], set: Set<number>) {
  const word = (i: number) => tokens[i].w;
  const near = (i: number, d: number) => { let j = i + d; while (j >= 0 && j < tokens.length && !word(j)) j += d; return j >= 0 && j < tokens.length && set.has(j); };
  let frase = ''; let holes = 0; let run = false;
  tokens.forEach((t, i) => {
    const inside = t.w ? set.has(i) : near(i, -1) && near(i, 1);
    const sp = t.sp ? ' ' : '';
    if (inside) { if (!run) { frase += sp + '____'; holes++; run = true; } }
    else { run = false; frase += sp + t.t; }
  });
  const kept = tokens.some((t, i) => t.w && !set.has(i));
  return { frase, holes, kept, words: set.size };
}

export const archiveHole = (tokens: Token[]) => new Set(tokens.flatMap((t, i) => (t.w && t.h > 0 ? [i] : [])));
