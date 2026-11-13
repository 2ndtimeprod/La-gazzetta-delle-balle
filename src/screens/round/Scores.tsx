import { advance } from '../../lib/api';
import { roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import RoundHeader from '../../components/RoundHeader';
import Scoreboard from '../../components/Scoreboard';
import Toast from '../../components/Toast';
import Waiting from '../../components/Waiting';

export default function Scores({ session, state, refresh }: RoundProps) {
  const r = state.round!;
  const { err, busy, run } = useAct(refresh);
  const { canAdvance } = roles(state);
  const last = r.idx + 1 >= r.total;
  return (
    <main className="page">
      <RoundHeader state={state} />
      <h1 className="head">Classifica</h1>
      <Scoreboard players={state.players} me={state.me} gained={r.points} />
      <div className="actions">
        {canAdvance
          ? <button className="btn primary" disabled={busy} onClick={() => run(() => advance(session))}>{last ? "Ultima edizione: vedi chi vince" : 'Prossimo round'}</button>
          : <Waiting>{last ? 'Si stampa l\'edizione finale' : 'Il prossimo narratore si prepara'}</Waiting>}
        <Toast msg={err} />
      </div>
    </main>
  );
}
