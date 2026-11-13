import { updateSettings } from '../lib/api';
import { timerOn, type RoundProps } from '../lib/round';
import { useAct } from '../lib/useAct';

// Solo host: acceso/spento vale subito (se acceso a metà scrittura riparte da 60 s).
export default function TimerToggle({ session, state, refresh }: RoundProps) {
  const { err, busy, run } = useAct(refresh);
  if (state.room.host_player_id !== state.me) return null;
  return (
    <div className="page leave">
      <label className="toggle">Cronometro
        <input type="checkbox" checked={timerOn(state)} disabled={busy} onChange={(e) => run(() => updateSettings(session, { timer: e.target.checked }))} />
      </label>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}
