import { startDebate } from '../lib/api';
import { debateLive } from '../lib/round';
import type { RoundProps } from '../lib/round';
import { useAct } from '../lib/useAct';
import Toast from './Toast';

// Una volta per partita, dall'arrivo del fatto all'ultimo voto. Il narratore resta fuori.
export default function DebateButton({ session, state, refresh, hidden }: RoundProps & { hidden?: boolean }) {
  const { err, busy, run } = useAct(refresh);
  const r = state.round, me = state.players.find((p) => p.id === state.me);
  if (state.room.settings.dibattito === false || !r || !me || hidden) return null;
  if (!['writing', 'reading', 'voting'].includes(r.phase) || r.narrator_id === state.me) return null;
  if (me.debate_used) return <small className="debate-used">Dibattito già usato</small>;
  if (debateLive(state)) return null;
  return (
    <>
      <button className="btn small debate-btn" disabled={busy} onClick={() => run(() => startDebate(session))}>
        Lancia il dibattito (1 a testa)
      </button>
      <Toast msg={err} />
    </>
  );
}
