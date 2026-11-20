import { useEffect, useRef, useState } from 'react';
import CategoryReveal from '../components/CategoryReveal';
import type { RoundProps } from '../lib/round';
import LeaveGame from '../components/LeaveGame';
import HostTools from '../components/HostTools';
import DebateButton from '../components/DebateButton';
import DebateStamp from '../components/DebateStamp';
import TimerToggle from '../components/TimerToggle';
import Picking from './round/Picking';
import Writing from './round/Writing';
import Reading from './round/Reading';
import Voting from './round/Voting';
import Reveal from './round/Reveal';
import Explain from './round/Explain';
import Scores from './round/Scores';

// Sceglie la schermata in base alla fase del round. `hold`: il tamburo del narratore sta ancora girando.
function Screen(p: RoundProps & { hold: boolean; setHold: (b: boolean) => void; onReveal: (face: string) => void }) {
  const phase = p.state.round?.phase;
  const base = { session: p.session, state: p.state, refresh: p.refresh };
  if (phase === 'picking' || (p.hold && phase === 'writing')) return <Picking {...base} onHold={p.setHold} onReveal={p.onReveal} />;
  switch (phase) {
    case 'writing': return <Writing {...base} />;
    case 'reading': return <Reading {...base} />;
    case 'voting': return <Voting {...base} />;
    case 'reveal': return <Reveal {...base} />;
    case 'explain': return <Explain {...base} />;
    case 'scores': return <Scores {...base} />;
    default: return <main className="page"><p className="muted">Caricamento…</p></main>;
  }
}

export default function Playing(p: RoundProps & { onLeft: () => void }) {
  const [hold, setHold] = useState(false);
  const [reveal, setReveal] = useState<string | null>(null);
  const roundId = p.state.round?.id;
  const phase = p.state.round?.phase;
  const prevPhase = useRef(phase);
  const shown = useRef<number | undefined>(undefined);
  useEffect(() => { setHold(false); }, [roundId]);
  const onReveal = (face: string) => { shown.current = roundId; setReveal(face); };
  // Con il Jolly (o se il tamburo non ha fatto in tempo) il nome esce all'apertura della scrittura.
  useEffect(() => {
    const r = p.state.round;
    if (prevPhase.current === 'picking' && phase === 'writing' && r?.category && shown.current !== roundId) onReveal(r.category);
    prevPhase.current = phase;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  // La chiave per fase fa ripartire le animazioni d'ingresso a ogni cambio di schermata.
  const key = `${roundId}-${hold && p.state.round?.phase === 'writing' ? 'picking' : p.state.round?.phase}`;
  return (
    <>
      <Screen key={key} session={p.session} state={p.state} refresh={p.refresh} hold={hold} setHold={setHold} onReveal={onReveal} />
      {reveal && <CategoryReveal face={reveal} onDone={() => setReveal(null)} />}
      <DebateStamp state={p.state} />
      <footer className="foot">
        <DebateButton session={p.session} state={p.state} refresh={p.refresh} hidden={hold} />
        <TimerToggle session={p.session} state={p.state} refresh={p.refresh} />
        <HostTools session={p.session} state={p.state} refresh={p.refresh} folded />
        <LeaveGame session={p.session} onLeft={p.onLeft} />
      </footer>
    </>
  );
}
