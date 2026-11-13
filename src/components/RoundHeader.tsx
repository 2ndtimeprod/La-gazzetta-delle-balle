import { CATEGORIE, nameOf, type RoundProps } from '../lib/round';

export default function RoundHeader({ state }: Pick<RoundProps, 'state'>) {
  const r = state.round!;
  return (
    <header className="masthead">
      <small>Round {r.idx + 1} di {r.total}{r.category ? ` · ${CATEGORIE[r.category] ?? r.category}` : ''}</small>
      <h1 style={{ fontSize: 22 }}>Narratore: {nameOf(state.players, r.narrator_id)}{r.narrator_id === state.me ? ' (tu)' : ''}</h1>
      {state.players.find((p) => p.id === r.narrator_id)?.connected === false && <small>Il narratore è offline: può avanzare l'host</small>}
    </header>
  );
}
