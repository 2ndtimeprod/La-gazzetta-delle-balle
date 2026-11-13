// Fisica del tamburo: 7 facce su un cilindro, pioli sul bordo superiore di ogni faccia,
// due lancette a molla smorzata che i pioli spingono e poi lasciano scattare.

export const N = 7;
export const SA = 360 / N;          // ampiezza di una faccia (gradi)
export const R = 100;               // raggio del cilindro (px): facce alte 96 px
const RAD = Math.PI / 180;
export const mod = (a: number, n: number) => ((a % n) + n) % n;

// Lancetta: angolo th in gradi, positivo = punta verso il basso.
export class Flapper {
  th = 0; om = 0;
  L = 36;                           // dal perno alla punta (px), misurato sul DOM
  private side = new Map<number, number>();     // piolo sopra (-1) o sotto (+1) la punta
  private slipped = new Set<number>();          // piolo appena scavalcato: non conta finché non è passato
  private static K = 1600; private static C = 26; private static MAX = 64; private static PEG = 5;
  constructor(private onSnap: (strength: number) => void) {}

  step(dt: number, pos: number) {
    const { K, C, MAX, PEG } = Flapper;
    const th0 = this.th;
    this.om += (-K * this.th - C * this.om) * dt;
    this.th += this.om * dt;
    let yt = this.L * Math.sin(this.th * RAD);
    const lim = this.L * Math.sin(MAX * RAD);

    for (let i = 0; i < N; i++) {
      const b = (i * SA + SA / 2 + pos) * RAD;
      const front = Math.cos(b) > 0.2;
      const y = -R * Math.sin(b);                       // piolo rispetto alla linea centrale (px, giù positivo)
      const prev = this.side.get(i);
      const s = Math.sign(y - yt) || 1;
      if (!front) { this.side.set(i, s); this.slipped.delete(i); continue; }
      if (this.slipped.has(i)) { if (s === prev) this.slipped.delete(i); continue; }
      if (prev === undefined || s === prev) { this.side.set(i, s); continue; }

      // Il piolo cercherebbe di attraversare la punta: la punta resta dalla sua parte, spinta dal piolo.
      const want = y - prev * PEG;
      if (Math.abs(want) <= lim) {
        yt = want;
        this.th = Math.asin(want / this.L) / RAD;
      } else {
        // Oltre la flessione massima la lancetta scavalca il piolo e scatta indietro.
        this.th = -prev * MAX;
        yt = this.L * Math.sin(this.th * RAD);
        this.side.set(i, -prev);
        this.slipped.add(i);
        this.onSnap(Math.min(1, Math.abs(this.om) / 1800 + 0.25));
      }
      this.om = Math.max(-3000, Math.min(3000, (this.th - th0) / dt));
    }
  }

  resting() { return Math.abs(this.th) < 0.05 && Math.abs(this.om) < 0.5; }
}

// Suono: un "tic" di legno sintetizzato (nessun file audio).
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let last = 0;

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    if (!noise) {
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 7);
    }
  } catch { /* audio non disponibile */ }
}

export function tick(strength = 0.5, low = false) {
  if (!ctx || !noise || ctx.state !== 'running') return;
  const now = performance.now();
  if (now - last < 22) return;
  last = now;
  const src = ctx.createBufferSource(); src.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass';
  f.frequency.value = low ? 520 : 1900 + Math.random() * 500; f.Q.value = low ? 1.2 : 3;
  const g = ctx.createGain(); g.gain.value = (low ? 0.7 : 0.18 + 0.32 * strength);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start();
}

export function vibrate(p: number | number[]) {
  try { navigator.vibrate?.(p); } catch { /* ignora */ }
}
