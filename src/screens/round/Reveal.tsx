import { advance } from '../../lib/api';
import { nameOf, roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import RoundHeader from '../../components/RoundHeader';
import Avatar from '../../components/Avatar';
import Sentence from '../../components/Sentence';
import Toast from '../../components/Toast';
import Waiting from '../../components/Waiting';

// Le balle compaiono una alla volta, la vera per ultima, ognuna col suo timbro.
// Prima le vede solo il narratore (autori, voti, punti); con "Mostra a tutti" arrivano su ogni telefono.
export default function Reveal({ session, state, refresh }: RoundProps) {
  const r = state.round!;
  const { err, busy, run } = useAct(refresh);
  const { canAdvance, isNarrator } = roles(state);
  const shown = !!r.revealed;
  const names = (ids?: string[]) => (ids ?? []).map((i) => nameOf(state.players, i));
  const opts = [...(r.options ?? [])].sort((a, b) => Number(a.is_true) - Number(b.is_true) || (a.voters?.length ?? 0) - (b.voters?.length ?? 0));
  const step = 0.55;

  return (
    <main className="page">
      <RoundHeader state={state} />
      <div className="stack">
        <h1 className="head sm">Lo smascheramento</h1>
        <Sentence frase={r.frase!} quote censor={r.custom} />
      </div>
      {!shown && !isNarrator ? <Waiting>{nameOf(state.players, r.narrator_id)} sta guardando chi ci è cascato: tra poco lo svela a tutti</Waiting> : (
      <div className="reveal">
        {opts.map((o, i) => {
          const d = i * step;
          return (
            <article key={o.id} className={`rv${o.is_true ? ' true' : o.voters?.length ? ' fooled' : ''}`} style={{ animationDelay: `${d}s` }}>
              <div className="stampbox"><span className={`stamp ${o.is_true ? 'true' : 'lie'}`} style={{ animationDelay: `${d + 0.35}s` }}>
                {o.is_true ? 'Vera' : 'Balla'}</span></div>
              <div className="txt">{o.parts.join(' · ')}</div>
              <div className="by">{o.is_true ? 'La notizia autentica' : `Firmata da ${names(o.authors).join(', ')}`}</div>
              <div className="votes">
                {o.voters?.length
                  ? (o.voters ?? []).map((id, j) => {
                      const p = state.players.find((x) => x.id === id);
                      return <span key={j} className="chip" style={{ animationDelay: `${d + 0.5 + j * 0.06}s` }}>{p && <Avatar p={p} />}{nameOf(state.players, id)}</span>;
                    })
                  : <span className="tag">Nessuno ci è cascato</span>}
              </div>
            </article>
          );
        })}
      </div>)}
      <div className="actions">
        {isNarrator && !shown && <p className="label center">Per ora lo vedi solo tu</p>}
        {canAdvance
          ? <button className="btn primary" disabled={busy} onClick={() => run(() => advance(session, shown ? 'reveal:shown' : 'reveal'))}>
              {shown ? "Leggi l'articolo" : 'Mostra a tutti'}</button>
          : shown && <Waiting>Il narratore sta per leggere com'è andata</Waiting>}
        <Toast msg={err} />
      </div>
    </main>
  );
}
