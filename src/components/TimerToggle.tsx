import { updateSettings } from '../lib/api';
import { timerOn, type RoundProps } from '../lib/round';
import { useAct } from '../lib/useAct';
import Toast from './Toast';

// Solo il direttore (host): vale subito; se acceso a metà scrittura riparte da 60 s.
export default function TimerToggle({ session, state, refresh }: RoundProps) {
  const { err, busy, run } = useAct(refresh);
  if (state.room.host_player_id !== state.me) return null;
  return (
    <>
      <label className="switch-row">
        <span><b>Cronometro</b><small>Solo il direttore lo vede: vale da subito</small></span>
        <input type="checkbox" className="switch" checked={timerOn(state)} disabled={busy}
          onChange={(e) => run(() => updateSettings(session, { timer: e.target.checked }))} />
      </label>
      <Toast msg={err} />
    </>
  );
}
