import { advance } from '../../lib/api';
import { nameOf, roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import RoundHeader from '../../components/RoundHeader';
import Sentence from '../../components/Sentence';

export default function Reveal({ session, state, refresh }: RoundProps) {
  const r = state.round!;
  const { err, busy, run } = useAct(refresh);
  const { canAdvance } = roles(state);
  const names = (ids?: string[]) => (ids ?? []).map((i) => nameOf(state.players, i)).join(', ');
  return (
    <main className="page">
      <RoundHeader state={state} />
      <h2>La rivelazione</h2>
      <div className="stack">
        {(r.options ?? []).map((o) => (
          <div key={o.id} className={`card opt${o.is_true ? ' true' : ''}`}>
            <span className={`badge ${o.is_true ? 'true' : 'lie'}`}>{o.is_true ? 'Risposta vera' : `Balla di ${names(o.authors)}`}</span>
            <Sentence frase={r.frase!} parts={o.parts} />
            <span className="muted">{o.voters?.length ? `Votata da ${names(o.voters)}` : 'Nessun voto'}</span>
          </div>
        ))}
      </div>
      {canAdvance
        ? <button className="primary" disabled={busy} onClick={() => run(() => advance(session))}>Vai alla spiegazione</button>
        : <p className="muted">Aspetta il narratore…</p>}
      {err && <p className="err" role="alert">{err}</p>}
    </main>
  );
}
