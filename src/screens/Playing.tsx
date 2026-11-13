import type { GameState } from '../lib/api';

// Segnaposto fino alla fase 3 (round completo).
export default function Playing({ state }: { state: GameState }) {
  const narr = state.players.find((p) => p.id === state.round?.narrator_id);
  return (
    <main className="page">
      <header className="masthead"><h1>Partita iniziata</h1></header>
      <p>Narratore: <b>{narr?.name ?? '?'}</b>{state.round?.narrator_id === state.me && ' (tu)'}</p>
      <p className="muted">Il round arriva nella fase 3.</p>
    </main>
  );
}
