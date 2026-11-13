import { useEffect, useState } from 'react';
import type { RoundProps } from '../lib/round';
import LeaveGame from '../components/LeaveGame';
import TimerToggle from '../components/TimerToggle';
import Picking from './round/Picking';
import Writing from './round/Writing';
import Voting from './round/Voting';
import Reveal from './round/Reveal';
import Explain from './round/Explain';
import Scores from './round/Scores';

// Sceglie la schermata in base alla fase del round. `hold`: il tamburo del narratore sta ancora girando.
function Screen(p: RoundProps & { hold: boolean; setHold: (b: boolean) => void }) {
  const phase = p.state.round?.phase;
  const base = { session: p.session, state: p.state, refresh: p.refresh };
  if (phase === 'picking' || (p.hold && phase === 'writing')) return <Picking {...base} onHold={p.setHold} />;
  switch (phase) {
    case 'writing': return <Writing {...base} />;
    case 'reading': case 'voting': return <Voting {...base} />;
    case 'reveal': return <Reveal {...base} />;
    case 'explain': return <Explain {...base} />;
    case 'scores': return <Scores {...base} />;
    default: return <main className="page"><p className="muted">Caricamento…</p></main>;
  }
}

export default function Playing(p: RoundProps & { onLeft: () => void }) {
  const [hold, setHold] = useState(false);
  const roundId = p.state.round?.id;
  useEffect(() => { setHold(false); }, [roundId]);
  // La chiave per fase fa ripartire le animazioni d'ingresso a ogni cambio di schermata.
  const key = `${roundId}-${hold && p.state.round?.phase === 'writing' ? 'picking' : p.state.round?.phase === 'voting' ? 'reading' : p.state.round?.phase}`;
  return (
    <>
      <Screen key={key} session={p.session} state={p.state} refresh={p.refresh} hold={hold} setHold={setHold} />
      <footer className="foot">
        <TimerToggle session={p.session} state={p.state} refresh={p.refresh} />
        <LeaveGame session={p.session} onLeft={p.onLeft} />
      </footer>
    </>
  );
}
