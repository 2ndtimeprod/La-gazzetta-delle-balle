import { useEffect, useState } from 'react';
import { pickCategory, skipNarrator, spin, startWriting } from '../../lib/api';
import { CATEGORIE, NORMALI, nameOf, roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import RoundHeader from '../../components/RoundHeader';
import Drum from '../../components/Drum';
import Toast from '../../components/Toast';
import Waiting from '../../components/Waiting';

// Il narratore gira il tamburo. Il server tiene il risultato segreto finché il tamburo non si ferma:
// solo allora il client del narratore chiama `start_writing` e la frase compare a tutti insieme.
// `onHold` tiene questa schermata visibile fino a quel momento.
export default function Picking({ session, state, refresh, onHold }: RoundProps & { onHold: (b: boolean) => void }) {
  const r = state.round!;
  const { isNarrator } = roles(state);
  const { err, busy, run } = useAct(refresh);
  const [landed, setLanded] = useState<string | null>(null);
  const [spinErr, setSpinErr] = useState('');
  const me = nameOf(state.players, state.me);

  const doSpin = async () => {
    setSpinErr(''); onHold(true);
    try { return (await spin(session)).face; }
    catch (e) { setSpinErr((e as Error).message); onHold(false); throw e; }
  };
  const done = async () => {
    try { await startWriting(session); setSpinErr(''); onHold(false); refresh(); }
    catch (e) { setSpinErr((e as Error).message); }
  };

  // Dopo una categoria normale la frase si apre da sola a tamburo fermo; il pulsante serve a chi ha fretta.
  useEffect(() => {
    if (!landed || landed === 'Jolly') return;
    const t = setTimeout(done, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed]);

  const chooser = isNarrator && r.phase === 'picking' && r.jolly && (landed === 'Jolly' || landed === null);

  if (chooser && landed === null) {
    // rientro dopo un Jolly: niente tamburo, si sceglie e basta
    return (
      <main className="page">
        <RoundHeader state={state} />
        <h1 className="head">Jolly: scegli tu</h1>
        <Choices busy={busy} onPick={(c) => run(async () => { await pickCategory(session, c); onHold(false); })} />
        <Toast msg={err} />
      </main>
    );
  }

  return (
    <main className="page">
      <RoundHeader state={state} />
      {isNarrator
        ? <div><h1 className="head">Tocca a te, {me}</h1><p className="lede">Afferra il tamburo, dagli una spinta e lascialo andare.</p></div>
        : <div><h1 className="head sm">Si gira il tamburo</h1><Waiting>{nameOf(state.players, r.narrator_id)} sta estraendo la categoria</Waiting></div>}
      <Drum dark={state.room.settings.dark} interactive={isNarrator && r.phase === 'picking' && !r.jolly}
        onSpin={doSpin} onLanded={(f) => { if (f) setLanded(f); }} />
      {landed && landed !== 'Jolly' && (
        <div className="actions"><button className="btn primary" onClick={done}>Pesca la frase</button></div>
      )}
      {chooser && landed === 'Jolly' && (
        <section className="stack">
          <h2 className="section-title"><span>Jolly: scegli la categoria</span></h2>
          <Choices busy={busy} onPick={(c) => run(async () => { await pickCategory(session, c); onHold(false); })} />
        </section>
      )}
      {roles(state).isHost && !isNarrator && r.phase === 'picking' && !r.jolly && (
        <Skip name={nameOf(state.players, r.narrator_id)} busy={busy} onSkip={() => run(() => skipNarrator(session))} />
      )}
      <Toast msg={spinErr || err} />
    </main>
  );
}

// Solo il direttore: se il narratore non c'è o non gira, si passa al successivo (con conferma).
function Skip({ name, busy, onSkip }: { name: string; busy: boolean; onSkip: () => void }) {
  const [sure, setSure] = useState(false);
  if (!sure) return <div className="actions"><button className="btn link" onClick={() => setSure(true)}>{name} non gira? Salta il turno</button></div>;
  return (
    <div className="actions">
      <p className="muted" style={{ textAlign: 'center' }}>Salti il turno di {name}: il tamburo passa al prossimo narratore.</p>
      <div className="choices">
        <button className="btn small primary" disabled={busy} onClick={onSkip}>Salta il turno</button>
        <button className="btn small" onClick={() => setSure(false)}>Aspetta</button>
      </div>
    </div>
  );
}

function Choices({ busy, onPick }: { busy: boolean; onPick: (c: string) => void }) {
  return (
    <div className="choices">
      {NORMALI.map((c) => <button key={c} className="btn small" disabled={busy} onClick={() => onPick(c)}>{CATEGORIE[c]}</button>)}
    </div>
  );
}
