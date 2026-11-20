import type { Player } from '../lib/api';
import { useCountUp } from '../lib/useCountUp';

type RowProps = { p: Player; pos: number; me: boolean; gain: number };

function Row({ p, pos, me, gain }: RowProps) {
  const n = useCountUp(p.score, p.score - gain);
  return (
    <li className={`${me ? 'me' : ''}${pos === 1 ? ' lead' : ''}`}>
      <span className="pos">{pos}</span>
      <span className="nm">{p.name}{!p.connected && <span className="tag off"> offline</span>}</span>
      {gain > 0 && <span className="gain">+{gain}</span>}
      <span className="pts">{n}</span>
    </li>
  );
}

// Podio di fine partita: tre gradini stampati, il primo al centro e più alto.
function Pod({ p, pos, me }: Omit<RowProps, 'gain'>) {
  return (
    <div className={`pod p${pos}${me ? ' me' : ''}`}>
      <span className="nm">{p.name}</span>
      <span className="pts">{p.score}<small>{p.score === 1 ? 'punto' : 'punti'}</small></span>
      <span className="step" aria-label={`${pos}° posto`}>{pos}</span>
    </div>
  );
}

export default function Scoreboard({ players, me, gained, podium }: { players: Player[]; me: string; gained?: Record<string, number>; podium?: boolean }) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.seat - b.seat);
  const top = podium && sorted.length >= 3 ? sorted.slice(0, 3) : [];
  const rest = sorted.slice(top.length);
  return (
    <>
      {top.length > 0 && (
        <section className="podium" aria-label="Podio">
          {top.map((p, i) => <Pod key={p.id} p={p} pos={i + 1} me={p.id === me} />)}
        </section>
      )}
      {rest.length > 0 && (
        <ol className="board" start={top.length + 1}>
          {rest.map((p, i) => <Row key={p.id} p={p} pos={top.length + i + 1} me={p.id === me} gain={gained?.[p.id] ?? 0} />)}
        </ol>
      )}
    </>
  );
}
