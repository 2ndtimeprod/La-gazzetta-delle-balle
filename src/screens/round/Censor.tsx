import { useMemo, useState } from 'react';
import { startWriting } from '../../lib/api';
import { archiveHole, censorPreview } from '../../lib/censor';
import { CATEGORIE, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import { vibrate } from '../../lib/drum';
import RoundHeader from '../../components/RoundHeader';
import Sentence from '../../components/Sentence';
import Toast from '../../components/Toast';

// Tamburo fermo: il narratore vede la frase intera e sceglie il buco. Parte dal buco dell'archivio;
// toccando le parole le censura o le rimette. Se la scelta coincide con l'archivio si pubblica come un round normale.
export default function Censor({ session, state, refresh, onDone }: RoundProps & { onDone: () => void }) {
  const r = state.round!;
  const tokens = r.tokens!;
  const archive = useMemo(() => archiveHole(tokens), [tokens]);
  const [sel, setSel] = useState<Set<number>>(() => new Set(archive));
  const { err, busy, run } = useAct(refresh);
  const pv = censorPreview(tokens, sel);
  const isArchive = sel.size === archive.size && [...sel].every((i) => archive.has(i));
  const problem = sel.size === 0 ? 'Tocca almeno una parola da censurare'
    : !pv.kept ? 'Lascia almeno una parola visibile'
    : pv.holes > 3 ? `${pv.holes} buchi: al massimo 3, unisci le parole censurate` : '';

  const toggle = (i: number) => {
    const n = new Set(sel); if (n.has(i)) n.delete(i); else n.add(i);
    setSel(n); vibrate(5);
  };
  const publish = () => run(async () => {
    await startWriting(session, isArchive ? undefined : [...sel].sort((a, b) => a - b));
    vibrate(12); onDone();
  });

  return (
    <main className="page">
      <RoundHeader state={state} />
      <div className="stack">
        <h1 className="head sm">Scegli cosa censurare</h1>
        <p className="lede">Tocca le parole da nascondere: gli altri vedranno solo quelle che lasci.</p>
      </div>
      <div className="secret" data-label={`Riservato al narratore${r.pending_category ? ' · ' + (CATEGORIE[r.pending_category] ?? r.pending_category) : ''}`}>
        <p className="censor-text">
          {tokens.map((t, i) => (
            <span key={i}>{t.sp && ' '}{t.w
              ? <button className={`tok${sel.has(i) ? ' on' : ''}${t.h ? ' arch' : ''}`} aria-pressed={sel.has(i)} disabled={busy} onClick={() => toggle(i)}>{t.t}</button>
              : <span className="punct">{t.t}</span>}</span>
          ))}
        </p>
        <p className="censor-legend"><span className="arch-mark">sottolineato</span> il buco dell'archivio</p>
      </div>
      <div className="stack">
        <span className="label">Gli altri vedranno</span>
        <Sentence frase={pv.frase} quote censor />
        <span className={`censor-count${problem ? ' bad' : ''}`}>
          {problem || `${pv.words} ${pv.words === 1 ? 'parola censurata' : 'parole censurate'} · ${pv.holes} ${pv.holes === 1 ? 'buco' : 'buchi'}${pv.words > 6 && !isArchive ? ' · 90 secondi per scrivere' : ''}`}
        </span>
      </div>
      <div className="actions">
        <div className="row2">
          <button className="btn small" disabled={busy || isArchive} onClick={() => setSel(new Set(archive))}>Buco dell'archivio</button>
          <button className="btn small" disabled={busy || sel.size === 0} onClick={() => setSel(new Set())}>Azzera</button>
        </div>
        <button className={`btn primary${busy ? ' busy' : ''}`} disabled={busy || !!problem} onClick={publish}>Manda in stampa</button>
        <Toast msg={err} />
      </div>
    </main>
  );
}
