import type { RoundProps } from '../lib/round';
import LeaveGame from '../components/LeaveGame';
import Picking from './round/Picking';
import Writing from './round/Writing';
import Voting from './round/Voting';
import Reveal from './round/Reveal';
import Explain from './round/Explain';
import Scores from './round/Scores';

// Sceglie la schermata in base alla fase del round.
function Screen(p: RoundProps) {
  switch (p.state.round?.phase) {
    case 'picking': return <Picking {...p} />;
    case 'writing': return <Writing {...p} />;
    case 'reading': case 'voting': return <Voting {...p} />;
    case 'reveal': return <Reveal {...p} />;
    case 'explain': return <Explain {...p} />;
    case 'scores': return <Scores {...p} />;
    default: return <main className="page"><p className="muted">Caricamento…</p></main>;
  }
}

export default function Playing(p: RoundProps & { onLeft: () => void }) {
  return <><Screen session={p.session} state={p.state} refresh={p.refresh} /><LeaveGame session={p.session} onLeft={p.onLeft} /></>;
}
