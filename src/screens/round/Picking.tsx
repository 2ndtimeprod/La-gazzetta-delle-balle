import { pickCategory, spin } from '../../lib/api';
import { CATEGORIE, NORMALI, roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import RoundHeader from '../../components/RoundHeader';

export default function Picking({ session, state, refresh }: RoundProps) {
  const { err, busy, run } = useAct(refresh);
  const { isNarrator } = roles(state);
  const r = state.round!;
  return (
    <main className="page">
      <RoundHeader state={state} />
      {isNarrator && !r.jolly && (
        <>
          <p>Tocca a te: gira il tamburo per scoprire la categoria.</p>
          <button className="primary" disabled={busy} onClick={() => run(() => spin(session))}>Gira il tamburo</button>
        </>
      )}
      {isNarrator && r.jolly && (
        <>
          <p><b>Jolly!</b> Scegli tu la categoria.</p>
          <div className="stack">
            {NORMALI.map((c) => <button key={c} disabled={busy} onClick={() => run(() => pickCategory(session, c))}>{CATEGORIE[c]}</button>)}
          </div>
        </>
      )}
      {!isNarrator && <p className="muted">{r.jolly ? 'Jolly: il narratore sceglie la categoria…' : 'Il narratore sta girando il tamburo…'}</p>}
      {err && <p className="err" role="alert">{err}</p>}
    </main>
  );
}
