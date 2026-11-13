import { advance } from '../../lib/api';
import { nameOf, roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import RoundHeader from '../../components/RoundHeader';
import Sentence from '../../components/Sentence';
import Toast from '../../components/Toast';
import Waiting from '../../components/Waiting';

// Le balle compaiono una alla volta, la vera per ultima, ognuna col suo timbro.
export default function Reveal({ session, state, refresh }: RoundProps) {
  const r = state.round!;
  const { err, busy, run } = useAct(refresh);
  const { canAdvance } = roles(state);
  const names = (ids?: string[]) => (ids ?? []).map((i) => nameOf(state.players, i));
  const opts = [...(r.options ?? [])].sort((a, b) => Number(a.is_true) - Number(b.is_true) || (a.voters?.length ?? 0) - (b.voters?.length ?? 0));
  const step = 0.55;

  return (
    <main className="page">
      <RoundHeader state={state} />
      <div className="stack">
        <h1 className="head sm">Lo smascheramento</h1>
        <Sentence frase={r.frase!} quote />
      </div>
      <div className="reveal">
        {opts.map((o, i) => {
          const d = i * step;
          return (
            <article key={o.id} className={`rv${o.is_true ? ' true' : ''}`} style={{ animationDelay: `${d}s` }}>
              <div className="stampbox"><span className={`stamp ${o.is_true ? 'true' : 'lie'}`} style={{ animationDelay: `${d + 0.35}s` }}>
                {o.is_true ? 'Vera' : 'Balla'}</span></div>
              <div className="txt">{o.parts.join(' · ')}</div>
              <div className="by">{o.is_true ? 'La notizia autentica' : `Firmata da ${names(o.authors).join(', ')}`}</div>
              <div className="votes">
                {o.voters?.length
                  ? names(o.voters).map((n, j) => <span key={j} className="chip" style={{ animationDelay: `${d + 0.5 + j * 0.06}s` }}>{n}</span>)
                  : <span className="tag">Nessuno ci è cascato</span>}
              </div>
            </article>
          );
        })}
      </div>
      <div className="actions">
        {canAdvance
          ? <button className="btn primary" disabled={busy} onClick={() => run(() => advance(session))}>Leggi l'articolo</button>
          : <Waiting>Il narratore sta per leggere com'è andata</Waiting>}
        <Toast msg={err} />
      </div>
    </main>
  );
}
