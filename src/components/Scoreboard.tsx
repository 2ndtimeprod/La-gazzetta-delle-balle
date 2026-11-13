import type { Player } from '../lib/api';

export default function Scoreboard({ players, me, gained }: { players: Player[]; me: string; gained?: Record<string, number> }) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.seat - b.seat);
  return (
    <ol className="players">
      {sorted.map((p) => (
        <li key={p.id}>
          <span>{p.name}{p.id === me && ' (tu)'}{!p.connected && <span className="tag"> offline</span>}</span>
          <span><b>{p.score}</b>{gained?.[p.id] ? <span className="tag"> +{gained[p.id]}</span> : null}</span>
        </li>
      ))}
    </ol>
  );
}
