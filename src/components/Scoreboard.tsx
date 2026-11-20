import type { Player } from '../lib/api';
import { useCountUp } from '../lib/useCountUp';
import Avatar from './Avatar';

type RowProps = { p: Player; pos: number; me: boolean; gain: number };

function Row({ p, pos, me, gain }: RowProps) {
  const n = useCountUp(p.score, p.score - gain);
  return (
    <li className={me ? 'me' : ''}>
      <span className="pos">{pos}</span>
      <Avatar p={p} size="sm" />
      <span className="nm">{p.name}{!p.connected && <span className="tag off"> offline</span>}</span>
      {gain > 0 && <span className="gain">+{gain}</span>}
      <span className="pts">{n}</span>
    </li>
  );
}

// Podio: il primo al centro, più alto, in oro e con il riflesso che passa.
function Pod({ p, pos, me, gain }: RowProps) {
  const n = useCountUp(p.score, p.score - gain);
  return (
    <div className={`pod p${pos}${me ? ' me' : ''}`}>
      {pos === 1 && <i className="pod-sweep" aria-hidden="true" />}
      {pos === 1 && <svg className="crown" viewBox="0 0 26 20" aria-hidden="true"><path d="M2 17 4 5l5.5 5L13 2l3.5 8L22 5l2 12z" /></svg>}
      <Avatar p={p} size={pos === 1 ? 'lg' : undefined} />
      <span className="nm">{p.name}</span>
      <span className="pts">{n}</span>
      <span className="pl">{pos}°{gain > 0 ? ` · +${gain}` : ''}</span>
    </div>
  );
}

export default function Scoreboard({ players, me, gained }: { players: Player[]; me: string; gained?: Record<string, number> }) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.seat - b.seat);
  const top = sorted.length >= 3 ? sorted.slice(0, 3) : [];
  const rest = sorted.slice(top.length);
  const g = (p: Player) => gained?.[p.id] ?? 0;
  return (
    <>
      {top.length > 0 && (
        <section className="podium" aria-label="Podio">
          {top.map((p, i) => <Pod key={p.id} p={p} pos={i + 1} me={p.id === me} gain={g(p)} />)}
        </section>
      )}
      {rest.length > 0 && (
        <ol className="board" start={top.length + 1}>
          {rest.map((p, i) => <Row key={p.id} p={p} pos={top.length + i + 1} me={p.id === me} gain={g(p)} />)}
        </ol>
      )}
    </>
  );
}
