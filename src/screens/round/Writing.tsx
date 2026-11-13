import { useEffect, useRef, useState } from 'react';
import { closeWriting, submitBluff } from '../../lib/api';
import { needed, roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import { useCountdown } from '../../lib/useCountdown';
import { vibrate } from '../../lib/drum';
import RoundHeader from '../../components/RoundHeader';
import Sentence from '../../components/Sentence';
import Toast from '../../components/Toast';

function Pips({ done, total }: { done: number; total: number }) {
  return <span className="pips" aria-label={`${done} di ${total}`}>{Array.from({ length: total }, (_, i) => <i key={i} className={i < done ? 'on' : ''} />)}</span>;
}

export default function Writing({ session, state, refresh }: RoundProps) {
  const r = state.round!;
  const { err, busy, run } = useAct(refresh);
  const { isNarrator, canAdvance } = roles(state);
  const left = useCountdown(r.deadline_at, state.now);
  const holes = r.holes ?? 1;
  const [parts, setParts] = useState<string[]>(() => r.my_bluff ?? Array(holes).fill(''));
  const closed = useRef(false);

  // Allo scadere chiunque chiude la scrittura (il server accetta solo dopo la scadenza).
  useEffect(() => {
    if (r.deadline_at && left === 0 && !closed.current) { closed.current = true; closeWriting(session).then(refresh, refresh); }
  }, [left, r.deadline_at, session, refresh]);

  const sent = r.my_bluff != null;
  const same = sent && r.my_bluff!.every((x, i) => x === parts[i].trim());
  const ready = parts.every((p) => p.trim().length > 0);
  const total = needed(state);

  return (
    <main className="page">
      <RoundHeader state={state} />
      {r.deadline_at
        ? <div className={`timer${left <= 10 ? ' low' : ''}`}>
            <span className="timer-num">{left}</span>
            <span className="timer-bar"><i style={{ transform: `scaleX(${left / 60})` }} /></span>
          </div>
        : <p className="label">Senza cronometro: si va avanti quando hanno scritto tutti</p>}

      {isNarrator ? (
        <>
          <h1 className="head sm">La verità, solo per te</h1>
          <div className="secret" data-label="Riservato al narratore"><Sentence frase={r.frase!} parts={r.truth} /></div>
          <p className="lede">Gli altri stanno inventando le loro balle. Non far trapelare nulla.</p>
        </>
      ) : (
        <>
          <h1 className="head sm">{sent ? 'Balla in pagina' : 'Scrivi la tua balla'}</h1>
          <Sentence frase={r.frase!} parts={sent && same ? r.my_bluff! : undefined} />
          {parts.map((v, i) => (
            <div className="field" key={i}>
              <label className="label" htmlFor={`b${i}`}>{holes > 1 ? `Buco ${i + 1}` : 'La tua balla'}</label>
              <input id={`b${i}`} className="input" maxLength={80} value={v} autoComplete="off" autoCapitalize="none" autoFocus={i === 0 && !sent}
                placeholder="Deve sembrare vera" enterKeyHint={i === holes - 1 ? 'send' : 'next'}
                onChange={(e) => setParts(parts.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
        </>
      )}

      <div className="actions">
        <div className="kicker-row"><span className="label">Balle consegnate</span><Pips done={r.bluff_count} total={total} /></div>
        {!isNarrator && (
          <button className={`btn primary${busy ? ' busy' : ''}`} disabled={busy || !ready || same}
            onClick={() => run(async () => { await submitBluff(session, parts); vibrate(12); })}>
            {sent ? (same ? 'Consegnata: puoi ancora cambiarla' : 'Correggi la balla') : 'Manda in stampa'}
          </button>
        )}
        {canAdvance && <button className="btn small" disabled={busy} onClick={() => run(() => closeWriting(session))}>Chiudi la scrittura ora</button>}
        <Toast msg={err} />
      </div>
    </main>
  );
}
