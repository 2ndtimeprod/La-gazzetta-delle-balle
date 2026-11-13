import { advance } from '../../lib/api';
import { CATEGORIE, roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import RoundHeader from '../../components/RoundHeader';
import Sentence from '../../components/Sentence';
import Toast from '../../components/Toast';
import Waiting from '../../components/Waiting';

// L'articolo: la frase vera come titolo, la spiegazione come pezzo di giornale.
export default function Explain({ session, state, refresh }: RoundProps) {
  const r = state.round!;
  const { err, busy, run } = useAct(refresh);
  const { canAdvance } = roles(state);
  return (
    <main className="page">
      <RoundHeader state={state} />
      <h1 className="head">Com'è andata davvero</h1>
      <Sentence frase={r.frase!} parts={r.truth} />
      <div className="byline"><span>Dal nostro archivio</span><span>{r.category ? CATEGORIE[r.category] : ''}</span></div>
      <p className="article">{r.spiegazione || 'Su questa notizia l\'archivio tace.'}</p>
      <div className="actions">
        {canAdvance
          ? <button className="btn primary" disabled={busy} onClick={() => run(() => advance(session))}>Vai alla classifica</button>
          : <Waiting>Si passa alla classifica</Waiting>}
        <Toast msg={err} />
      </div>
    </main>
  );
}
