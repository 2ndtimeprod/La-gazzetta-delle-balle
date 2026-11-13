import { useMemo } from 'react';
import type { GameState, RoundState } from '../lib/api';
import type { Session } from '../lib/session';
import Lobby from '../screens/Lobby';
import EdizioneStraordinaria from '../components/EdizioneStraordinaria';
import Home from '../screens/Home';
import Finished from '../screens/Finished';
import Writing from '../screens/round/Writing';
import Voting from '../screens/round/Voting';
import Reveal from '../screens/round/Reveal';
import Explain from '../screens/round/Explain';
import Scores from '../screens/round/Scores';
import RoundHeader from '../components/RoundHeader';
import Drum from '../components/Drum';

// Solo in sviluppo (npm run dev): /?anteprima=lobby|tamburo|scrive|narratore|vota|rivela|spiega|punti|fine
const S: Session = { code: 'KUBO', playerId: 'p1', secret: 's' };
const P = ['Dom', 'Giulia', 'Ale', 'Bea', 'Marco'].map((name, i) => ({ id: `p${i + 1}`, name, score: [7, 9, 4, 6, 2][i], seat: i, connected: i !== 4 }));
const FRASE = "Alla fine degli anni Novanta l'NSA vietò il Furby nei suoi uffici perché temeva che ____.";

function state(round: Partial<RoundState> | null, me = 'p1', phase = 'playing'): GameState {
  return {
    now: new Date().toISOString(), me, players: P,
    room: { code: 'KUBO', host_player_id: 'p1', settings: { giri: 2, dark: false, estremi: false, timer: true }, phase, round_index: 2 },
    round: round && { id: 1, idx: 2, total: 10, narrator_id: 'p2', phase: 'writing', category: 'Pop culture', jolly: false,
      deadline_at: new Date(Date.now() + 42000).toISOString(), bluff_count: 2, vote_count: 0, frase: FRASE, holes: 1, ...round },
  };
}
const OPTS = [
  { id: 1, parts: ["cantasse l'inno sovietico al buio"] },
  { id: 2, parts: ['imparasse segreti e li ripetesse in giro'], is_true: true },
  { id: 3, parts: ['le sue pile mandassero in tilt i radar'], mine: true },
  { id: 4, parts: ['gli impiegati ci giocassero invece di lavorare'] },
];

export default function Anteprima({ which }: { which: string }) {
  const noop = () => {};
  const st = useMemo(() => ({
    lobby: state(null, 'p1', 'lobby'),
    scrive: state({ my_bluff: null }),
    narratore: state({ truth: ['imparasse segreti e li ripetesse in giro'] }, 'p2'),
    vota: state({ phase: 'voting', options: OPTS, voted: ['p3'], my_vote: null }),
    rivela: state({ phase: 'reveal', options: [
      { ...OPTS[0], is_true: false, authors: ['p3'], voters: ['p4'] },
      { ...OPTS[1], voters: ['p1', 'p5'] },
      { ...OPTS[2], is_true: false, authors: ['p1'], voters: [] },
      { ...OPTS[3], is_true: false, authors: ['p4', 'p5'], voters: ['p3'] },
    ] }),
    spiega: state({ phase: 'explain', truth: ['imparasse segreti e li ripetesse in giro'],
      spiegazione: "Nel 1999 un memorandum interno dell'agenzia vietò i Furby negli edifici di Fort Meade: si credeva, a torto, che il pupazzo registrasse le conversazioni. In realtà non aveva alcuna memoria audio, ma il divieto restò in vigore per anni." }),
    punti: state({ phase: 'scores', points: { p1: 1, p2: 0, p3: 2, p4: 1 } }),
    fine: state(null, 'p1', 'finished'),
    tamburo: state({ phase: 'picking', category: null }, 'p2'),
  }), []);
  const p = { session: S, refresh: noop };
  switch (which) {
    case 'home': return <Home onSession={noop} />;
    case 'edizione': return <><Lobby session={S} state={state(null, 'p1', 'lobby')} refresh={noop} onLeft={noop} /><EdizioneStraordinaria state={state({ phase: 'picking' })} onDone={noop} /></>;
    case 'tutorial': localStorage.removeItem('balle:tutorial-visto'); return <Home onSession={noop} />;
    case 'lobby': return <Lobby {...p} state={st.lobby} onLeft={noop} />;
    case 'scrive': return <Writing {...p} state={st.scrive} />;
    case 'narratore': return <Writing {...p} state={st.narratore} />;
    case 'vota': return <Voting {...p} state={st.vota} />;
    case 'rivela': return <Reveal {...p} state={st.rivela} />;
    case 'spiega': return <Explain {...p} state={st.spiega} />;
    case 'punti': return <Scores {...p} state={st.punti} />;
    case 'fine': return <Finished {...p} state={st.fine} onLeft={noop} />;
    default: {
      const dark = which === 'tamburo-dark';
      return (
        <main className="page">
          <RoundHeader state={st.tamburo} />
          <div><h1 className="head">Tocca a te, Giulia</h1><p className="lede">Afferra il tamburo, dagli una spinta e lascialo andare.</p></div>
          <Drum dark={dark} interactive onSpin={() => new Promise((r) => setTimeout(() => r(dark ? 'Dark/Politically incorrect' : 'Science'), 300))} />
        </main>
      );
    }
  }
}
