import { useEffect, useRef, useState } from 'react';
import { closeWriting, submitBluff } from '../../lib/api';
import { needed, roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import { useCountdown } from '../../lib/useCountdown';
import RoundHeader from '../../components/RoundHeader';
import Sentence from '../../components/Sentence';

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
    if (left === 0 && !closed.current) { closed.current = true; closeWriting(session).then(refresh, refresh); }
  }, [left, session, refresh]);

  const sent = r.my_bluff != null;
  const same = sent && r.my_bluff!.every((x, i) => x === parts[i].trim());
  const ready = parts.every((p) => p.trim().length > 0);

  return (
    <main className="page">
      <RoundHeader state={state} />
      <p className={`timer${left <= 10 ? ' low' : ''}`}>{left}s</p>
      {isNarrator ? (
        <>
          <Sentence frase={r.frase!} parts={r.truth} />
          <p className="muted">La risposta vera è questa. Gli altri stanno scrivendo: {r.bluff_count} di {needed(state)}.</p>
        </>
      ) : (
        <>
          <Sentence frase={r.frase!} />
          {parts.map((v, i) => (
            <div key={i}>
              {holes > 1 && <label>Buco {i + 1}</label>}
              <input type="text" maxLength={80} value={v} autoComplete="off" autoFocus={i === 0}
                onChange={(e) => setParts(parts.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
          <button className="primary" disabled={busy || !ready || same} onClick={() => run(() => submitBluff(session, parts))}>
            {sent ? (same ? 'Balla inviata' : 'Cambia balla') : 'Invia balla'}
          </button>
          {sent && <p className="muted">Puoi ancora cambiarla finché c'è tempo. Inviate: {r.bluff_count} di {needed(state)}.</p>}
        </>
      )}
      {canAdvance && <button disabled={busy} onClick={() => run(() => closeWriting(session))}>Chiudi la scrittura ora</button>}
      {err && <p className="err" role="alert">{err}</p>}
    </main>
  );
}
