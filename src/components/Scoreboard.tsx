import type { Player } from '../lib/api';
import { useCountUp } from '../lib/useCountUp';

function Row({ p, pos, me, gain }: { p: Player; pos: number; me: boolean; gain: number }) {
  const n = useCountUp(p.score, p.score - gain);
  return (
    <li className={me ? 'me' : ''}>
      <span className="pos">{pos}</span>
      <span className="nm">{p.name}{!p.connected && <span className="tag off"> offline</span>}</span>
      {gain > 0 && <span className="gain">+{gain}</span>}
      <span className="pts">{n}</span>
    </li>
  );
}

export default function Scoreboard({ players, me, gained }: { players: Player[]; me: string; gained?: Record<string, number> }) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.seat - b.seat);
  return (
    <ol className="board">
      {sorted.map((p, i) => <Row key={p.id} p={p} pos={i + 1} me={p.id === me} gain={gained?.[p.id] ?? 0} />)}
    </ol>
  );
}
