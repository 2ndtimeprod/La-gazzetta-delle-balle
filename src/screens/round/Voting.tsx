import { useState } from 'react';
import { advance, castVote } from '../../lib/api';
import { needed, roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import { vibrate } from '../../lib/drum';
import RoundHeader from '../../components/RoundHeader';
import Sentence from '../../components/Sentence';
import Toast from '../../components/Toast';
import Waiting from '../../components/Waiting';

const LETTERS = 'ABCDEFGHIJKLM';

// Fase "voting": le frasi intere, già corrette dal narratore (scegli, poi conferma).
export default function Voting({ session, state, refresh }: RoundProps) {
  const r = state.round!;
  const { err, busy, run } = useAct(refresh);
  const { isNarrator, canAdvance } = roles(state);
  const [pick, setPick] = useState<number | null>(null);
  const voted = r.my_vote != null;
  const canVote = !isNarrator && !voted;
  const chosen = r.my_vote ?? pick;
  const opts = r.options ?? [];
  const letter = (id: number) => LETTERS[opts.findIndex((o) => o.id === id)];

  const title = isNarrator ? 'Si vota' : voted ? 'Voto depositato' : 'Qual è la notizia vera?';

  return (
    <main className="page">
      <RoundHeader state={state} />
      <h1 className="head sm">{title}</h1>
      <div className="opts">
        {opts.map((o, i) => (
          <button key={o.id} className={`opt${chosen === o.id ? ' on' : ''}${o.mine ? ' mine' : ''}`}
            disabled={!canVote || o.mine} onClick={() => { setPick(o.id); vibrate(6); }}>
            <span className="letter">{LETTERS[i]}</span>
            <span><span className="txt"><Sentence frase={r.frase!} parts={o.parts} small /></span>{o.mine && <span className="sub">Firmata da te · non votabile</span>}</span>
          </button>
        ))}
      </div>
      <div className="actions">
        {(isNarrator || voted) && <Waiting>Hanno votato {r.voted?.length ?? 0} di {needed(state)}</Waiting>}
        {canVote && (
          <button className={`btn primary${busy ? ' busy' : ''}`} disabled={busy || pick == null}
            onClick={() => run(async () => { await castVote(session, pick!); vibrate([10, 40, 10]); })}>
            {pick == null ? 'Scegli una risposta' : `Ci credo: voto la ${letter(pick)}`}
          </button>
        )}
        {canAdvance && <button className="btn small" disabled={busy} onClick={() => run(() => advance(session, 'voting'))}>Chiudi le votazioni e rivela</button>}
        <Toast msg={err} />
      </div>
    </main>
  );
}
