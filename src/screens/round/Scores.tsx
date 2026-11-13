import { advance } from '../../lib/api';
import { roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import RoundHeader from '../../components/RoundHeader';
import Scoreboard from '../../components/Scoreboard';

export default function Scores({ session, state, refresh }: RoundProps) {
  const r = state.round!;
  const { err, busy, run } = useAct(refresh);
  const { canAdvance } = roles(state);
  const last = r.idx + 1 >= r.total;
  return (
    <main className="page">
      <RoundHeader state={state} />
      <h2>Punteggi</h2>
      <Scoreboard players={state.players} me={state.me} gained={r.points} />
      {canAdvance
        ? <button className="primary" disabled={busy} onClick={() => run(() => advance(session))}>{last ? 'Fine partita' : 'Prossimo round'}</button>
        : <p className="muted">Aspetta il narratore…</p>}
      {err && <p className="err" role="alert">{err}</p>}
    </main>
  );
}
