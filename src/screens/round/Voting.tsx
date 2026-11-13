import { advance, castVote } from '../../lib/api';
import { needed, roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import RoundHeader from '../../components/RoundHeader';
import Sentence from '../../components/Sentence';

// Fasi "reading" (il narratore legge) e "voting".
export default function Voting({ session, state, refresh }: RoundProps) {
  const r = state.round!;
  const { err, busy, run } = useAct(refresh);
  const { me, isNarrator, canAdvance } = roles(state);
  const voting = r.phase === 'voting';
  const canVote = voting && !isNarrator && r.my_vote == null;

  return (
    <main className="page">
      <RoundHeader state={state} />
      {!voting && <p>{isNarrator ? 'Leggi ad alta voce tutte le risposte, in ordine.' : 'Il narratore sta leggendo le risposte…'}</p>}
      {voting && !isNarrator && <p>{r.my_vote == null ? 'Qual è la risposta vera? Tocca per votare.' : 'Voto registrato. Aspetta gli altri.'}</p>}
      {voting && isNarrator && <p className="muted">Hanno votato {r.voted?.length ?? 0} di {needed(state)}.</p>}
      <div className="stack">
        {(r.options ?? []).map((o) => (
          <button key={o.id} className={`opt${r.my_vote === o.id ? ' on' : ''}`}
            disabled={busy || !canVote || o.mine} onClick={() => run(() => castVote(session, o.id))}>
            <Sentence frase={r.frase!} parts={o.parts} />
            {o.mine && <span className="tag">la tua balla</span>}
          </button>
        ))}
      </div>
      {canAdvance && !voting && <button className="primary" disabled={busy} onClick={() => run(() => advance(session))}>Apri le votazioni</button>}
      {canAdvance && voting && <button className="primary" disabled={busy} onClick={() => run(() => advance(session))}>Chiudi le votazioni e rivela</button>}
      {me === state.room.host_player_id && !isNarrator && <p className="muted">Come host puoi far avanzare il round se il narratore non risponde.</p>}
      {err && <p className="err" role="alert">{err}</p>}
    </main>
  );
}
