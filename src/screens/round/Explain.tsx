import { advance } from '../../lib/api';
import { roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import RoundHeader from '../../components/RoundHeader';
import Sentence from '../../components/Sentence';

// Provvisoria: la schermata di spiegazione definitiva (con mockup) arriva in fase 4.
export default function Explain({ session, state, refresh }: RoundProps) {
  const r = state.round!;
  const { err, busy, run } = useAct(refresh);
  const { canAdvance } = roles(state);
  return (
    <main className="page">
      <RoundHeader state={state} />
      <Sentence frase={r.frase!} parts={r.truth} />
      <div className="card"><span className="badge true">Com'è davvero</span><p style={{ margin: 0 }}>{r.spiegazione}</p></div>
      {canAdvance
        ? <button className="primary" disabled={busy} onClick={() => run(() => advance(session))}>Vai ai punteggi</button>
        : <p className="muted">Aspetta il narratore…</p>}
      {err && <p className="err" role="alert">{err}</p>}
    </main>
  );
}
