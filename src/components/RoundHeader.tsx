import { CATEGORIE, nameOf, type RoundProps } from '../lib/round';
import Masthead from './Masthead';

export default function RoundHeader({ state }: Pick<RoundProps, 'state'>) {
  const r = state.round!;
  const mine = r.narrator_id === state.me;
  const narr = state.players.find((p) => p.id === r.narrator_id);
  return (
    <>
      <Masthead meta={`Round ${r.idx + 1}/${r.total}`} />
      <div className="kicker-row">
        <span className={`kicker${mine ? '' : ' ghost'}`}>{mine ? 'Sei il narratore' : `Narra ${nameOf(state.players, r.narrator_id)}`}</span>
        {r.category && <span className="cat">{CATEGORIE[r.category] ?? r.category}</span>}
        {narr && !narr.connected && <span className="tag off">narratore offline: avanza l'host</span>}
      </div>
    </>
  );
}
